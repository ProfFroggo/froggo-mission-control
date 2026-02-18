/**
 * Writing Version Service -- file-copy snapshots with JSON manifest.
 *
 * Storage per chapter:
 *   ~/froggo/writing-projects/{projectId}/versions/{chapterId}/
 *     versions.json     -- [{ id, chapterId, label, createdAt, filename, wordCount }]
 *     v-{timestamp}.md  -- snapshot content copy
 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { writingProjectPath, writingChapterPath, writingVersionsPath } from './paths';
import { diffWords, Change } from 'diff';
import { createLogger } from './utils/logger';

const logger = createLogger('WritingVersion');

// ── Types ──

interface VersionMeta {
  id: string;
  chapterId: string;
  label: string;
  createdAt: string;
  filename: string;
  wordCount: number;
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

async function readJson<T>(filepath: string): Promise<T> {
  const raw = await fs.promises.readFile(filepath, 'utf-8');
  return JSON.parse(raw) as T;
}

async function readVersionsManifest(projectId: string, chapterId: string): Promise<VersionMeta[]> {
  const manifestPath = path.join(writingVersionsPath(projectId, chapterId), 'versions.json');
  try {
    return await readJson<VersionMeta[]>(manifestPath);
  } catch {
    return [];
  }
}

async function writeVersionsManifest(projectId: string, chapterId: string, versions: VersionMeta[]): Promise<void> {
  const manifestPath = path.join(writingVersionsPath(projectId, chapterId), 'versions.json');
  await fs.promises.writeFile(manifestPath, JSON.stringify(versions, null, 2), 'utf-8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function countWords(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

// ── Operations ──

async function saveSnapshot(projectId: string, chapterId: string, label?: string) {
  // Read current chapter content
  const chaptersJsonPath = path.join(writingProjectPath(projectId), 'chapters.json');
  const chapters = await readJson<ChapterMeta[]>(chaptersJsonPath);
  const chapter = chapters.find(c => c.id === chapterId);
  if (!chapter) return { success: false, error: 'Chapter not found' };

  const content = await fs.promises.readFile(
    writingChapterPath(projectId, chapter.filename), 'utf-8'
  );

  const now = new Date();
  const id = `ver-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const filename = `v-${Date.now()}.md`;
  const autoLabel = label || `Snapshot ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

  const dir = writingVersionsPath(projectId, chapterId);
  await fs.promises.mkdir(dir, { recursive: true });

  // Write snapshot file
  await fs.promises.writeFile(path.join(dir, filename), content, 'utf-8');

  // Update manifest
  const versions = await readVersionsManifest(projectId, chapterId);
  const meta: VersionMeta = {
    id,
    chapterId,
    label: autoLabel,
    createdAt: now.toISOString(),
    filename,
    wordCount: countWords(stripHtml(content)),
  };
  versions.push(meta);
  await writeVersionsManifest(projectId, chapterId, versions);

  return { success: true, version: meta };
}

async function listVersions(projectId: string, chapterId: string) {
  const versions = await readVersionsManifest(projectId, chapterId);
  // Sort by createdAt descending (newest first)
  versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { success: true, versions };
}

async function readVersionContent(projectId: string, chapterId: string, versionId: string) {
  const versions = await readVersionsManifest(projectId, chapterId);
  const version = versions.find(v => v.id === versionId);
  if (!version) return { success: false, error: 'Version not found' };

  const content = await fs.promises.readFile(
    path.join(writingVersionsPath(projectId, chapterId), version.filename), 'utf-8'
  );
  return { success: true, content };
}

async function restoreVersion(projectId: string, chapterId: string, versionId: string) {
  // Read version content
  const versions = await readVersionsManifest(projectId, chapterId);
  const version = versions.find(v => v.id === versionId);
  if (!version) return { success: false, error: 'Version not found' };

  const versionContent = await fs.promises.readFile(
    path.join(writingVersionsPath(projectId, chapterId), version.filename), 'utf-8'
  );

  // Find chapter in chapters.json
  const chaptersJsonPath = path.join(writingProjectPath(projectId), 'chapters.json');
  const chapters = await readJson<ChapterMeta[]>(chaptersJsonPath);
  const chapter = chapters.find(c => c.id === chapterId);
  if (!chapter) return { success: false, error: 'Chapter not found' };

  // Overwrite current chapter file
  await fs.promises.writeFile(
    writingChapterPath(projectId, chapter.filename), versionContent, 'utf-8'
  );

  return { success: true };
}

async function computeDiff(projectId: string, chapterId: string, versionId: string) {
  // Read version content
  const versions = await readVersionsManifest(projectId, chapterId);
  const version = versions.find(v => v.id === versionId);
  if (!version) return { success: false, error: 'Version not found' };

  const versionContent = await fs.promises.readFile(
    path.join(writingVersionsPath(projectId, chapterId), version.filename), 'utf-8'
  );

  // Read current chapter content
  const chaptersJsonPath = path.join(writingProjectPath(projectId), 'chapters.json');
  const chapters = await readJson<ChapterMeta[]>(chaptersJsonPath);
  const chapter = chapters.find(c => c.id === chapterId);
  if (!chapter) return { success: false, error: 'Chapter not found' };

  const currentContent = await fs.promises.readFile(
    writingChapterPath(projectId, chapter.filename), 'utf-8'
  );

  // Strip HTML and diff as prose
  const changes: Change[] = diffWords(stripHtml(versionContent), stripHtml(currentContent));
  return { success: true, changes, versionLabel: version.label };
}

async function deleteVersion(projectId: string, chapterId: string, versionId: string) {
  const versions = await readVersionsManifest(projectId, chapterId);
  const idx = versions.findIndex(v => v.id === versionId);
  if (idx === -1) return { success: false, error: 'Version not found' };

  const version = versions[idx];

  // Delete snapshot file
  try {
    await fs.promises.unlink(path.join(writingVersionsPath(projectId, chapterId), version.filename));
  } catch {
    // File already gone
  }

  // Remove from manifest
  versions.splice(idx, 1);
  await writeVersionsManifest(projectId, chapterId, versions);

  return { success: true };
}

// ── IPC Registration ──

export function registerWritingVersionHandlers(): void {
  ipcMain.handle('writing:version:list', async (_, projectId: string, chapterId: string) => {
    try {
      return await listVersions(projectId, chapterId);
    } catch (e: any) {
      logger.error('[writing-version] list error:', e instanceof Error ? e.message : String(e));
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('writing:version:save', async (_, projectId: string, chapterId: string, label?: string) => {
    try {
      return await saveSnapshot(projectId, chapterId, label);
    } catch (e: any) {
      logger.error('[writing-version] save error:', e instanceof Error ? e.message : String(e));
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('writing:version:read', async (_, projectId: string, chapterId: string, versionId: string) => {
    try {
      return await readVersionContent(projectId, chapterId, versionId);
    } catch (e: any) {
      logger.error('[writing-version] read error:', e instanceof Error ? e.message : String(e));
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('writing:version:restore', async (_, projectId: string, chapterId: string, versionId: string) => {
    try {
      return await restoreVersion(projectId, chapterId, versionId);
    } catch (e: any) {
      logger.error('[writing-version] restore error:', e instanceof Error ? e.message : String(e));
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('writing:version:diff', async (_, projectId: string, chapterId: string, versionId: string) => {
    try {
      return await computeDiff(projectId, chapterId, versionId);
    } catch (e: any) {
      logger.error('[writing-version] diff error:', e instanceof Error ? e.message : String(e));
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('writing:version:delete', async (_, projectId: string, chapterId: string, versionId: string) => {
    try {
      return await deleteVersion(projectId, chapterId, versionId);
    } catch (e: any) {
      logger.error('[writing-version] delete error:', e instanceof Error ? e.message : String(e));
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  logger.debug('[writing-version] IPC handlers registered');
}
