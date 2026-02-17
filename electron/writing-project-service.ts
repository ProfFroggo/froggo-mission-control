/**
 * Writing Project Service — file-based project and chapter CRUD.
 *
 * Storage layout per project:
 *   ~/froggo/writing-projects/{projectId}/
 *     project.json        — { id, title, type, createdAt, updatedAt }
 *     chapters.json       — [{ id, title, filename, position, createdAt, updatedAt }]
 *     chapters/            — chapter markdown files (01-slug.md, 02-slug.md, ...)
 *     memory/              — (reserved for Phase 7)
 *     versions/            — (reserved for Phase 9)
 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('WritingProject');
import { WRITING_PROJECTS_DIR, writingProjectPath, writingChapterPath, writingMemoryPath } from './paths';

// ── Types ──

interface ProjectMeta {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

interface ChapterMeta {
  id: string;
  title: string;
  filename: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

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

async function readJson<T>(filepath: string): Promise<T> {
  const raw = await fs.promises.readFile(filepath, 'utf-8');
  return JSON.parse(raw) as T;
}

async function writeJson(filepath: string, data: unknown): Promise<void> {
  await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Project operations ──

async function listProjects() {
  try {
    await ensureDir(WRITING_PROJECTS_DIR);

    const entries = await fs.promises.readdir(WRITING_PROJECTS_DIR, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const projectJsonPath = path.join(WRITING_PROJECTS_DIR, entry.name, 'project.json');
      try {
        const meta = await readJson<ProjectMeta>(projectJsonPath);
        const chaptersJsonPath = path.join(WRITING_PROJECTS_DIR, entry.name, 'chapters.json');

        let chapters: ChapterMeta[] = [];
        try {
          chapters = await readJson<ChapterMeta[]>(chaptersJsonPath);
        } catch {
          // No chapters yet
        }

        let wordCount = 0;
        for (const ch of chapters) {
          try {
            const chPath = writingChapterPath(entry.name, ch.filename);
            const content = await fs.promises.readFile(chPath, 'utf-8');
            wordCount += countWords(content);
          } catch {
            // Chapter file missing, skip
          }
        }

        projects.push({
          id: meta.id,
          title: meta.title,
          type: meta.type,
          chapterCount: chapters.length,
          wordCount,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
        });
      } catch {
        // Invalid project dir, skip
      }
    }

    return { success: true, projects };
  } catch (e: unknown) {
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
    await ensureDir(path.join(projectDir, 'memory'));
    await ensureDir(path.join(projectDir, 'versions'));

    const meta: ProjectMeta = { id, title, type, createdAt: now, updatedAt: now };
    await writeJson(path.join(projectDir, 'project.json'), meta);
    await writeJson(path.join(projectDir, 'chapters.json'), []);

    return { success: true, project: meta };
  } catch (e: unknown) {
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
    await ensureDir(path.join(projectDir, 'memory'));
    await ensureDir(path.join(projectDir, 'versions'));

    // Write project.json with extended metadata
    const meta: ProjectMeta & Record<string, unknown> = {
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
    await writeJson(path.join(projectDir, 'project.json'), meta);

    // Write chapters.json and empty chapter markdown files
    const chapters = wizardData.chapters.map((ch, i) => {
      const position = i + 1;
      const paddedPos = String(position).padStart(2, '0');
      const filename = `${paddedPos}-${slugify(ch.title)}.md`;
      return {
        id: generateChapterId(),
        title: ch.title,
        filename,
        position,
        synopsis: ch.synopsis,
        createdAt: now,
        updatedAt: now,
      };
    });
    await writeJson(path.join(projectDir, 'chapters.json'), chapters);
    for (const ch of chapters) {
      await fs.promises.writeFile(writingChapterPath(id, ch.filename), '', 'utf-8');
    }

    // Write characters.json into memory/
    const characters = wizardData.characters.map((c) => ({
      id: `char-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name: c.name,
      relationship: c.role,
      description: c.description,
      traits: c.traits,
      createdAt: now,
      updatedAt: now,
    }));
    await writeJson(writingMemoryPath(id, 'characters.json'), characters);

    // Write timeline.json into memory/
    const timeline = wizardData.timeline.map((t, i) => ({
      id: `evt-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 8)}`,
      date: t.date,
      description: t.description,
      chapterRefs: [] as string[],
      position: i,
      createdAt: now,
      updatedAt: now,
    }));
    await writeJson(writingMemoryPath(id, 'timeline.json'), timeline);

    logger.debug(`[writing] Created wizard project: ${id} (${chapters.length} chapters, ${characters.length} chars, ${timeline.length} events)`);
    return { success: true, project: meta };
  } catch (e: unknown) {
    // Rollback: clean up partial project directory
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
    const projectDir = writingProjectPath(projectId);
    const meta = await readJson<ProjectMeta>(path.join(projectDir, 'project.json'));

    let chapters: ChapterMeta[] = [];
    try {
      chapters = await readJson<ChapterMeta[]>(path.join(projectDir, 'chapters.json'));
    } catch {
      // No chapters
    }

    const chaptersWithWordCount = [];
    for (const ch of chapters) {
      let wordCount = 0;
      try {
        const content = await fs.promises.readFile(writingChapterPath(projectId, ch.filename), 'utf-8');
        wordCount = countWords(content);
      } catch {
        // Missing file
      }
      chaptersWithWordCount.push({ ...ch, wordCount });
    }

    return { success: true, project: { ...meta, chapters: chaptersWithWordCount } };
  } catch (e: unknown) {
    logger.error('[writing] getProject error:', e.message);
    return { success: false, error: e.message };
  }
}

async function updateProject(projectId: string, updates: { title?: string; type?: string }) {
  try {
    const projectJsonPath = path.join(writingProjectPath(projectId), 'project.json');
    const meta = await readJson<ProjectMeta>(projectJsonPath);

    if (updates.title !== undefined) meta.title = updates.title;
    if (updates.type !== undefined) meta.type = updates.type;
    meta.updatedAt = new Date().toISOString();

    await writeJson(projectJsonPath, meta);
    return { success: true, project: meta };
  } catch (e: unknown) {
    logger.error('[writing] updateProject error:', e.message);
    return { success: false, error: e.message };
  }
}

async function deleteProject(projectId: string) {
  try {
    const projectDir = writingProjectPath(projectId);
    await fs.promises.rm(projectDir, { recursive: true, force: true });
    return { success: true };
  } catch (e: unknown) {
    logger.error('[writing] deleteProject error:', e.message);
    return { success: false, error: e.message };
  }
}

// ── Chapter operations ──

async function listChapters(projectId: string) {
  try {
    const chaptersJsonPath = path.join(writingProjectPath(projectId), 'chapters.json');
    let chapters: ChapterMeta[] = [];
    try {
      chapters = await readJson<ChapterMeta[]>(chaptersJsonPath);
    } catch {
      return { success: true, chapters: [] };
    }

    const chaptersWithWordCount = [];
    for (const ch of chapters) {
      let wordCount = 0;
      try {
        const content = await fs.promises.readFile(writingChapterPath(projectId, ch.filename), 'utf-8');
        wordCount = countWords(content);
      } catch {
        // Missing file
      }
      chaptersWithWordCount.push({ ...ch, wordCount });
    }

    return { success: true, chapters: chaptersWithWordCount };
  } catch (e: unknown) {
    logger.error('[writing] listChapters error:', e.message);
    return { success: false, error: e.message, chapters: [] };
  }
}

async function createChapter(projectId: string, title: string) {
  try {
    const projectDir = writingProjectPath(projectId);
    const chaptersJsonPath = path.join(projectDir, 'chapters.json');

    let chapters: ChapterMeta[] = [];
    try {
      chapters = await readJson<ChapterMeta[]>(chaptersJsonPath);
    } catch {
      // Empty list
    }

    const id = generateChapterId();
    const position = chapters.length > 0
      ? Math.max(...chapters.map(c => c.position)) + 1
      : 1;
    const paddedPos = String(position).padStart(2, '0');
    const filename = `${paddedPos}-${slugify(title)}.md`;
    const now = new Date().toISOString();

    const chapter: ChapterMeta = { id, title, filename, position, createdAt: now, updatedAt: now };

    // Ensure chapters dir exists
    await ensureDir(path.join(projectDir, 'chapters'));

    // Write empty chapter file
    await fs.promises.writeFile(writingChapterPath(projectId, filename), '', 'utf-8');

    // Add to chapters.json
    chapters.push(chapter);
    await writeJson(chaptersJsonPath, chapters);

    // Update project updatedAt
    try {
      const projectJsonPath = path.join(projectDir, 'project.json');
      const meta = await readJson<ProjectMeta>(projectJsonPath);
      meta.updatedAt = now;
      await writeJson(projectJsonPath, meta);
    } catch {
      // Non-critical
    }

    return { success: true, chapter };
  } catch (e: unknown) {
    logger.error('[writing] createChapter error:', e.message);
    return { success: false, error: e.message };
  }
}

async function readChapter(projectId: string, chapterId: string) {
  try {
    const chaptersJsonPath = path.join(writingProjectPath(projectId), 'chapters.json');
    const chapters = await readJson<ChapterMeta[]>(chaptersJsonPath);
    const chapter = chapters.find(c => c.id === chapterId);

    if (!chapter) {
      return { success: false, error: 'Chapter not found' };
    }

    const content = await fs.promises.readFile(
      writingChapterPath(projectId, chapter.filename), 'utf-8'
    );
    const wordCount = countWords(content);

    return { success: true, chapter: { ...chapter, content, wordCount } };
  } catch (e: unknown) {
    logger.error('[writing] readChapter error:', e.message);
    return { success: false, error: e.message };
  }
}

async function saveChapter(projectId: string, chapterId: string, content: string) {
  try {
    const projectDir = writingProjectPath(projectId);
    const chaptersJsonPath = path.join(projectDir, 'chapters.json');
    const chapters = await readJson<ChapterMeta[]>(chaptersJsonPath);
    const idx = chapters.findIndex(c => c.id === chapterId);

    if (idx === -1) {
      return { success: false, error: 'Chapter not found' };
    }

    const now = new Date().toISOString();

    // Write content
    await fs.promises.writeFile(
      writingChapterPath(projectId, chapters[idx].filename), content, 'utf-8'
    );

    // Update chapters.json timestamp
    chapters[idx].updatedAt = now;
    await writeJson(chaptersJsonPath, chapters);

    // Update project updatedAt
    try {
      const projectJsonPath = path.join(projectDir, 'project.json');
      const meta = await readJson<ProjectMeta>(projectJsonPath);
      meta.updatedAt = now;
      await writeJson(projectJsonPath, meta);
    } catch {
      // Non-critical
    }

    const wordCount = countWords(content);
    return { success: true, wordCount };
  } catch (e: unknown) {
    logger.error('[writing] saveChapter error:', e.message);
    return { success: false, error: e.message };
  }
}

async function renameChapter(projectId: string, chapterId: string, newTitle: string) {
  try {
    const projectDir = writingProjectPath(projectId);
    const chaptersJsonPath = path.join(projectDir, 'chapters.json');
    const chapters = await readJson<ChapterMeta[]>(chaptersJsonPath);
    const idx = chapters.findIndex(c => c.id === chapterId);

    if (idx === -1) {
      return { success: false, error: 'Chapter not found' };
    }

    const chapter = chapters[idx];
    const now = new Date().toISOString();

    // Generate new filename preserving position prefix
    const paddedPos = String(chapter.position).padStart(2, '0');
    const newFilename = `${paddedPos}-${slugify(newTitle)}.md`;

    // Rename file on disk if filename changed
    if (newFilename !== chapter.filename) {
      const oldPath = writingChapterPath(projectId, chapter.filename);
      const newPath = writingChapterPath(projectId, newFilename);
      try {
        await fs.promises.rename(oldPath, newPath);
      } catch {
        // File may not exist yet, that's ok
      }
    }

    // Update metadata
    chapters[idx].title = newTitle;
    chapters[idx].filename = newFilename;
    chapters[idx].updatedAt = now;
    await writeJson(chaptersJsonPath, chapters);

    return { success: true, chapter: chapters[idx] };
  } catch (e: unknown) {
    logger.error('[writing] renameChapter error:', e.message);
    return { success: false, error: e.message };
  }
}

async function reorderChapters(projectId: string, chapterIds: string[]) {
  try {
    const projectDir = writingProjectPath(projectId);
    const chaptersJsonPath = path.join(projectDir, 'chapters.json');
    const chapters = await readJson<ChapterMeta[]>(chaptersJsonPath);

    // Build new ordered list
    const reordered: ChapterMeta[] = [];
    for (let i = 0; i < chapterIds.length; i++) {
      const ch = chapters.find(c => c.id === chapterIds[i]);
      if (!ch) continue;

      const newPosition = i + 1;
      const paddedPos = String(newPosition).padStart(2, '0');
      const newFilename = `${paddedPos}-${slugify(ch.title)}.md`;

      // Rename file if position changed
      if (newFilename !== ch.filename) {
        const oldPath = writingChapterPath(projectId, ch.filename);
        const newPath = writingChapterPath(projectId, newFilename);
        try {
          // Use a temp name to avoid collisions during reorder
          const tmpPath = writingChapterPath(projectId, `_tmp_${ch.id}.md`);
          await fs.promises.rename(oldPath, tmpPath);
          ch.filename = `_tmp_${ch.id}.md`;
        } catch {
          // File missing, skip rename
        }
      }

      ch.position = newPosition;
      reordered.push(ch);
    }

    // Second pass: rename from temp to final
    for (const ch of reordered) {
      if (ch.filename.startsWith('_tmp_')) {
        const paddedPos = String(ch.position).padStart(2, '0');
        const finalFilename = `${paddedPos}-${slugify(ch.title)}.md`;
        const tmpPath = writingChapterPath(projectId, ch.filename);
        const finalPath = writingChapterPath(projectId, finalFilename);
        try {
          await fs.promises.rename(tmpPath, finalPath);
        } catch {
          // Skip if temp file missing
        }
        ch.filename = finalFilename;
      }
    }

    await writeJson(chaptersJsonPath, reordered);

    return { success: true, chapters: reordered };
  } catch (e: unknown) {
    logger.error('[writing] reorderChapters error:', e.message);
    return { success: false, error: e.message };
  }
}

async function deleteChapter(projectId: string, chapterId: string) {
  try {
    const projectDir = writingProjectPath(projectId);
    const chaptersJsonPath = path.join(projectDir, 'chapters.json');
    const chapters = await readJson<ChapterMeta[]>(chaptersJsonPath);
    const idx = chapters.findIndex(c => c.id === chapterId);

    if (idx === -1) {
      return { success: false, error: 'Chapter not found' };
    }

    const chapter = chapters[idx];

    // Remove file
    try {
      await fs.promises.unlink(writingChapterPath(projectId, chapter.filename));
    } catch {
      // File already gone
    }

    // Remove from array
    chapters.splice(idx, 1);
    await writeJson(chaptersJsonPath, chapters);

    return { success: true };
  } catch (e: unknown) {
    logger.error('[writing] deleteChapter error:', e.message);
    return { success: false, error: e.message };
  }
}

// ── IPC Registration ──

export function registerWritingProjectHandlers() {
  ipcMain.handle('writing:project:list', async () => listProjects());
  ipcMain.handle('writing:project:create', async (_, title: string, type: string) =>
    createProject(title, type));
  ipcMain.handle('writing:project:createFromWizard', async (_, wizardData) =>
    createProjectFromWizard(wizardData));
  ipcMain.handle('writing:project:get', async (_, projectId: string) => getProject(projectId));
  ipcMain.handle('writing:project:update', async (_, projectId: string, updates: any) =>
    updateProject(projectId, updates));
  ipcMain.handle('writing:project:delete', async (_, projectId: string) => deleteProject(projectId));

  ipcMain.handle('writing:chapter:list', async (_, projectId: string) => listChapters(projectId));
  ipcMain.handle('writing:chapter:create', async (_, projectId: string, title: string) =>
    createChapter(projectId, title));
  ipcMain.handle('writing:chapter:read', async (_, projectId: string, chapterId: string) =>
    readChapter(projectId, chapterId));
  ipcMain.handle('writing:chapter:save', async (_, projectId: string, chapterId: string, content: string) =>
    saveChapter(projectId, chapterId, content));
  ipcMain.handle('writing:chapter:rename', async (_, projectId: string, chapterId: string, title: string) =>
    renameChapter(projectId, chapterId, title));
  ipcMain.handle('writing:chapter:reorder', async (_, projectId: string, chapterIds: string[]) =>
    reorderChapters(projectId, chapterIds));
  ipcMain.handle('writing:chapter:delete', async (_, projectId: string, chapterId: string) =>
    deleteChapter(projectId, chapterId));

  logger.debug('[writing] IPC handlers registered');
}
