/**
 * Writing Project Service — per-book SQLite DB + file-based chapter content.
 *
 * Each project gets:
 *   ~/froggo/writing-projects/{projectId}/
 *     book.db              — SQLite DB with project, chapters, characters, timeline, facts tables
 *     chapters/            — chapter markdown files (01-slug.md, 02-slug.md, ...)
 *     memory/              — legacy JSON (auto-migrated to book.db)
 *     versions/            — (reserved for Phase 9)
 */

import { registerHandler } from './ipc-registry';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './utils/logger';

const logger = createLogger('WritingProject');
import { WRITING_PROJECTS_DIR, writingProjectPath, writingChapterPath, writingMemoryPath, writingBookDbPath } from './paths';
import { getBookDb, migrateJsonToDb, closeBookDb } from './writing-db';

// ── Helpers ──

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function countWords(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function generateProjectId(): string {
  const rand = Math.random().toString(36).substring(2, 8);
  return `proj-${Date.now()}-${rand}`;
}

function generateChapterId(): string {
  const rand = Math.random().toString(36).substring(2, 8);
  return `ch-${Date.now()}-${rand}`;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

/**
 * Ensure a project has a book.db. Migrates from JSON if needed.
 */
function ensureBookDb(projectId: string) {
  const dbPath = writingBookDbPath(projectId);
  const hasDb = fs.existsSync(dbPath);
  const hasJson = fs.existsSync(path.join(writingProjectPath(projectId), 'project.json'));

  if (!hasDb && hasJson) {
    migrateJsonToDb(projectId);
  }

  return getBookDb(projectId);
}

// ── Project operations ──

async function listProjects() {
  try {
    await ensureDir(WRITING_PROJECTS_DIR);

    const entries = await fs.promises.readdir(WRITING_PROJECTS_DIR, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;

      try {
        const db = ensureBookDb(entry.name);
        const meta = db.prepare('SELECT * FROM project LIMIT 1').get() as any;
        if (!meta) continue;

        // Get chapter count and total word count
        const chapters = db.prepare('SELECT filename FROM chapters ORDER BY position').all() as any[];
        let wordCount = 0;
        for (const ch of chapters) {
          try {
            const chPath = writingChapterPath(entry.name, ch.filename);
            const content = await fs.promises.readFile(chPath, 'utf-8');
            wordCount += countWords(content);
          } catch {
            // Chapter file missing
          }
        }

        projects.push({
          id: meta.id,
          title: meta.title,
          type: meta.type,
          genre: meta.genre || '',
          chapterCount: chapters.length,
          wordCount,
          createdAt: meta.created_at,
          updatedAt: meta.updated_at,
        });
      } catch {
        // Invalid project dir, skip
      }
    }

    return { success: true, projects };
  } catch (e: any) {
    logger.error('[writing] listProjects error:', e.message);
    return { success: false, error: e.message, projects: [] };
  }
}

async function createProject(title: string, type: string) {
  try {
    const id = generateProjectId();
    const projectDir = writingProjectPath(id);
    const now = new Date().toISOString();

    await ensureDir(projectDir);
    await ensureDir(path.join(projectDir, 'chapters'));

    // Create book.db with project metadata
    const db = getBookDb(id);
    db.prepare(`
      INSERT INTO project (id, title, type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, title, type, now, now);

    const meta = { id, title, type, createdAt: now, updatedAt: now };
    return { success: true, project: meta };
  } catch (e: any) {
    logger.error('[writing] createProject error:', e.message);
    return { success: false, error: e.message };
  }
}

async function createProjectFromWizard(wizardData: {
  title: string;
  type: string;
  genre: string;
  premise: string;
  themes: string[];
  storyArc: string;
  chapters: { title: string; synopsis: string }[];
  characters: { name: string; role: string; description: string; traits: string[] }[];
  timeline: { date: string; description: string }[];
}) {
  const id = generateProjectId();
  const projectDir = writingProjectPath(id);
  const now = new Date().toISOString();

  try {
    // Create directory structure
    await ensureDir(projectDir);
    await ensureDir(path.join(projectDir, 'chapters'));

    // Create book.db and populate all tables
    const db = getBookDb(id);

    const populate = db.transaction(() => {
      // Project metadata
      db.prepare(`
        INSERT INTO project (id, title, type, genre, premise, themes, story_arc, wizard_complete, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(id, wizardData.title, wizardData.type, wizardData.genre, wizardData.premise,
        JSON.stringify(wizardData.themes), wizardData.storyArc, now, now);

      // Chapters
      const insertCh = db.prepare(`
        INSERT INTO chapters (id, title, filename, position, synopsis, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < wizardData.chapters.length; i++) {
        const ch = wizardData.chapters[i];
        const position = i + 1;
        const paddedPos = String(position).padStart(2, '0');
        const filename = `${paddedPos}-${slugify(ch.title)}.md`;
        insertCh.run(generateChapterId(), ch.title, filename, position, ch.synopsis, now, now);
      }

      // Characters
      const insertChar = db.prepare(`
        INSERT INTO characters (id, name, role, description, traits, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of wizardData.characters) {
        const charId = `char-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        insertChar.run(charId, c.name, c.role, c.description, JSON.stringify(c.traits), now, now);
      }

      // Timeline
      const insertEvt = db.prepare(`
        INSERT INTO timeline (id, date, description, chapter_refs, position, created_at, updated_at)
        VALUES (?, ?, ?, '[]', ?, ?, ?)
      `);
      for (let i = 0; i < wizardData.timeline.length; i++) {
        const t = wizardData.timeline[i];
        const evtId = `evt-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 8)}`;
        insertEvt.run(evtId, t.date, t.description, i, now, now);
      }
    });

    populate();

    // Create empty chapter markdown files
    const chapters = db.prepare('SELECT filename FROM chapters ORDER BY position').all() as any[];
    for (const ch of chapters) {
      await fs.promises.writeFile(writingChapterPath(id, ch.filename), '', 'utf-8');
    }

    logger.debug(`[writing] Created wizard project: ${id} (${wizardData.chapters.length} chapters, ${wizardData.characters.length} chars, ${wizardData.timeline.length} events)`);
    const meta = {
      id,
      title: wizardData.title,
      type: wizardData.type,
      genre: wizardData.genre,
      premise: wizardData.premise,
      themes: wizardData.themes,
      storyArc: wizardData.storyArc,
      wizardComplete: true,
      createdAt: now,
      updatedAt: now,
    };
    return { success: true, project: meta };
  } catch (e: any) {
    // Rollback: close DB and clean up directory
    closeBookDb(id);
    try {
      await fs.promises.rm(projectDir, { recursive: true, force: true });
    } catch {
      // best-effort rollback
    }
    logger.error('[writing] createProjectFromWizard error:', e.message);
    return { success: false, error: e.message };
  }
}

async function getProject(projectId: string) {
  try {
    const db = ensureBookDb(projectId);
    const meta = db.prepare('SELECT * FROM project WHERE id = ?').get(projectId) as any;

    if (!meta) {
      return { success: false, error: 'Project not found' };
    }

    const chapters = db.prepare('SELECT * FROM chapters ORDER BY position').all() as any[];

    const chaptersWithWordCount = [];
    for (const ch of chapters) {
      let wordCount = 0;
      try {
        const content = await fs.promises.readFile(writingChapterPath(projectId, ch.filename), 'utf-8');
        wordCount = countWords(content);
      } catch {
        // Missing file
      }
      chaptersWithWordCount.push({
        id: ch.id,
        title: ch.title,
        filename: ch.filename,
        position: ch.position,
        synopsis: ch.synopsis,
        wordCount,
        createdAt: ch.created_at,
        updatedAt: ch.updated_at,
      });
    }

    return {
      success: true,
      project: {
        id: meta.id,
        title: meta.title,
        type: meta.type,
        genre: meta.genre,
        premise: meta.premise,
        themes: JSON.parse(meta.themes || '[]'),
        storyArc: meta.story_arc,
        wizardComplete: !!meta.wizard_complete,
        createdAt: meta.created_at,
        updatedAt: meta.updated_at,
        chapters: chaptersWithWordCount,
      },
    };
  } catch (e: any) {
    logger.error('[writing] getProject error:', e.message);
    return { success: false, error: e.message };
  }
}

async function updateProject(projectId: string, updates: { title?: string; type?: string }) {
  try {
    const db = ensureBookDb(projectId);
    const now = new Date().toISOString();

    if (updates.title !== undefined) {
      db.prepare('UPDATE project SET title = ?, updated_at = ? WHERE id = ?').run(updates.title, now, projectId);
    }
    if (updates.type !== undefined) {
      db.prepare('UPDATE project SET type = ?, updated_at = ? WHERE id = ?').run(updates.type, now, projectId);
    }

    const meta = db.prepare('SELECT * FROM project WHERE id = ?').get(projectId) as any;
    return { success: true, project: { ...meta, createdAt: meta.created_at, updatedAt: meta.updated_at } };
  } catch (e: any) {
    logger.error('[writing] updateProject error:', e.message);
    return { success: false, error: e.message };
  }
}

async function deleteProject(projectId: string) {
  try {
    closeBookDb(projectId);
    const projectDir = writingProjectPath(projectId);
    await fs.promises.rm(projectDir, { recursive: true, force: true });
    return { success: true };
  } catch (e: any) {
    logger.error('[writing] deleteProject error:', e.message);
    return { success: false, error: e.message };
  }
}

// ── Chapter operations ──

async function listChapters(projectId: string) {
  try {
    const db = ensureBookDb(projectId);
    const chapters = db.prepare('SELECT * FROM chapters ORDER BY position').all() as any[];

    const chaptersWithWordCount = [];
    for (const ch of chapters) {
      let wordCount = 0;
      try {
        const content = await fs.promises.readFile(writingChapterPath(projectId, ch.filename), 'utf-8');
        wordCount = countWords(content);
      } catch {
        // Missing file
      }
      chaptersWithWordCount.push({
        id: ch.id,
        title: ch.title,
        filename: ch.filename,
        position: ch.position,
        synopsis: ch.synopsis,
        wordCount,
        createdAt: ch.created_at,
        updatedAt: ch.updated_at,
      });
    }

    return { success: true, chapters: chaptersWithWordCount };
  } catch (e: any) {
    logger.error('[writing] listChapters error:', e.message);
    return { success: false, error: e.message, chapters: [] };
  }
}

async function createChapter(projectId: string, title: string) {
  try {
    const db = ensureBookDb(projectId);
    const now = new Date().toISOString();
    const id = generateChapterId();

    // Get max position
    const maxRow = db.prepare('SELECT MAX(position) as max_pos FROM chapters').get() as any;
    const position = (maxRow?.max_pos || 0) + 1;
    const paddedPos = String(position).padStart(2, '0');
    const filename = `${paddedPos}-${slugify(title)}.md`;

    // Ensure chapters dir exists
    const chaptersDir = path.join(writingProjectPath(projectId), 'chapters');
    await ensureDir(chaptersDir);

    // Write empty chapter file
    await fs.promises.writeFile(writingChapterPath(projectId, filename), '', 'utf-8');

    // Insert into DB
    db.prepare(`
      INSERT INTO chapters (id, title, filename, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, title, filename, position, now, now);

    // Update project timestamp
    db.prepare('UPDATE project SET updated_at = ?').run(now);

    const chapter = { id, title, filename, position, createdAt: now, updatedAt: now };
    return { success: true, chapter };
  } catch (e: any) {
    logger.error('[writing] createChapter error:', e.message);
    return { success: false, error: e.message };
  }
}

async function readChapter(projectId: string, chapterId: string) {
  try {
    const db = ensureBookDb(projectId);
    const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId) as any;

    if (!chapter) {
      return { success: false, error: 'Chapter not found' };
    }

    const content = await fs.promises.readFile(
      writingChapterPath(projectId, chapter.filename), 'utf-8'
    );
    const wordCount = countWords(content);

    return {
      success: true,
      chapter: {
        id: chapter.id,
        title: chapter.title,
        filename: chapter.filename,
        position: chapter.position,
        synopsis: chapter.synopsis,
        content,
        wordCount,
        createdAt: chapter.created_at,
        updatedAt: chapter.updated_at,
      },
    };
  } catch (e: any) {
    logger.error('[writing] readChapter error:', e.message);
    return { success: false, error: e.message };
  }
}

async function saveChapter(projectId: string, chapterId: string, content: string) {
  try {
    const db = ensureBookDb(projectId);
    const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId) as any;

    if (!chapter) {
      return { success: false, error: 'Chapter not found' };
    }

    const now = new Date().toISOString();
    const wordCount = countWords(content);

    // Write content to file
    await fs.promises.writeFile(
      writingChapterPath(projectId, chapter.filename), content, 'utf-8'
    );

    // Update DB
    db.prepare('UPDATE chapters SET word_count = ?, updated_at = ? WHERE id = ?').run(wordCount, now, chapterId);
    db.prepare('UPDATE project SET updated_at = ?').run(now);

    return { success: true, wordCount };
  } catch (e: any) {
    logger.error('[writing] saveChapter error:', e.message);
    return { success: false, error: e.message };
  }
}

async function renameChapter(projectId: string, chapterId: string, newTitle: string) {
  try {
    const db = ensureBookDb(projectId);
    const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId) as any;

    if (!chapter) {
      return { success: false, error: 'Chapter not found' };
    }

    const now = new Date().toISOString();
    const paddedPos = String(chapter.position).padStart(2, '0');
    const newFilename = `${paddedPos}-${slugify(newTitle)}.md`;

    // Rename file on disk if filename changed
    if (newFilename !== chapter.filename) {
      const oldPath = writingChapterPath(projectId, chapter.filename);
      const newPath = writingChapterPath(projectId, newFilename);
      try {
        await fs.promises.rename(oldPath, newPath);
      } catch {
        // File may not exist yet
      }
    }

    // Update DB
    db.prepare('UPDATE chapters SET title = ?, filename = ?, updated_at = ? WHERE id = ?')
      .run(newTitle, newFilename, now, chapterId);

    return {
      success: true,
      chapter: { id: chapterId, title: newTitle, filename: newFilename, position: chapter.position, createdAt: chapter.created_at, updatedAt: now },
    };
  } catch (e: any) {
    logger.error('[writing] renameChapter error:', e.message);
    return { success: false, error: e.message };
  }
}

async function reorderChapters(projectId: string, chapterIds: string[]) {
  try {
    const db = ensureBookDb(projectId);
    const chapters = db.prepare('SELECT * FROM chapters ORDER BY position').all() as any[];

    // First pass: rename to temp files to avoid collisions
    const reordered: any[] = [];
    for (let i = 0; i < chapterIds.length; i++) {
      const ch = chapters.find((c: any) => c.id === chapterIds[i]);
      if (!ch) continue;

      const newPosition = i + 1;
      const paddedPos = String(newPosition).padStart(2, '0');
      const newFilename = `${paddedPos}-${slugify(ch.title)}.md`;

      if (newFilename !== ch.filename) {
        const oldPath = writingChapterPath(projectId, ch.filename);
        const tmpFilename = `_tmp_${ch.id}.md`;
        const tmpPath = writingChapterPath(projectId, tmpFilename);
        try {
          await fs.promises.rename(oldPath, tmpPath);
          ch._tmpFilename = tmpFilename;
        } catch {
          // File missing
        }
      }

      ch._newPosition = newPosition;
      ch._newFilename = newFilename;
      reordered.push(ch);
    }

    // Second pass: rename from temp to final
    for (const ch of reordered) {
      if (ch._tmpFilename) {
        const tmpPath = writingChapterPath(projectId, ch._tmpFilename);
        const finalPath = writingChapterPath(projectId, ch._newFilename);
        try {
          await fs.promises.rename(tmpPath, finalPath);
        } catch {
          // Skip
        }
      }
    }

    // Update DB in transaction
    const now = new Date().toISOString();
    const updateTx = db.transaction(() => {
      const stmt = db.prepare('UPDATE chapters SET position = ?, filename = ?, updated_at = ? WHERE id = ?');
      for (const ch of reordered) {
        stmt.run(ch._newPosition, ch._newFilename, now, ch.id);
      }
    });
    updateTx();

    const updatedChapters = db.prepare('SELECT * FROM chapters ORDER BY position').all() as any[];
    return {
      success: true,
      chapters: updatedChapters.map((ch: any) => ({
        id: ch.id, title: ch.title, filename: ch.filename, position: ch.position,
        createdAt: ch.created_at, updatedAt: ch.updated_at,
      })),
    };
  } catch (e: any) {
    logger.error('[writing] reorderChapters error:', e.message);
    return { success: false, error: e.message };
  }
}

async function deleteChapter(projectId: string, chapterId: string) {
  try {
    const db = ensureBookDb(projectId);
    const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId) as any;

    if (!chapter) {
      return { success: false, error: 'Chapter not found' };
    }

    // Remove file
    try {
      await fs.promises.unlink(writingChapterPath(projectId, chapter.filename));
    } catch {
      // Already gone
    }

    // Remove from DB
    db.prepare('DELETE FROM chapters WHERE id = ?').run(chapterId);

    return { success: true };
  } catch (e: any) {
    logger.error('[writing] deleteChapter error:', e.message);
    return { success: false, error: e.message };
  }
}

// ── IPC Registration ──

export function registerWritingProjectHandlers() {
  registerHandler('writing:project:list', async () => listProjects());
  registerHandler('writing:project:create', async (_, title: string, type: string) =>
    createProject(title, type));
  registerHandler('writing:project:createFromWizard', async (_, wizardData) =>
    createProjectFromWizard(wizardData));
  registerHandler('writing:project:get', async (_, projectId: string) => getProject(projectId));
  registerHandler('writing:project:update', async (_, projectId: string, updates: any) =>
    updateProject(projectId, updates));
  registerHandler('writing:project:delete', async (_, projectId: string) => deleteProject(projectId));

  registerHandler('writing:chapter:list', async (_, projectId: string) => listChapters(projectId));
  registerHandler('writing:chapter:create', async (_, projectId: string, title: string) =>
    createChapter(projectId, title));
  registerHandler('writing:chapter:read', async (_, projectId: string, chapterId: string) =>
    readChapter(projectId, chapterId));
  registerHandler('writing:chapter:save', async (_, projectId: string, chapterId: string, content: string) =>
    saveChapter(projectId, chapterId, content));
  registerHandler('writing:chapter:rename', async (_, projectId: string, chapterId: string, title: string) =>
    renameChapter(projectId, chapterId, title));
  registerHandler('writing:chapter:reorder', async (_, projectId: string, chapterIds: string[]) =>
    reorderChapters(projectId, chapterIds));
  registerHandler('writing:chapter:delete', async (_, projectId: string, chapterId: string) =>
    deleteChapter(projectId, chapterId));

  logger.debug('[writing] IPC handlers registered');
}
