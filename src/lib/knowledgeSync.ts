// Sync knowledge articles to ~/mission-control/memory/knowledge/{category}/
import fs from 'fs';
import path from 'path';
import os from 'os';

const KNOWLEDGE_DIR = path.join(os.homedir(), 'mission-control', 'memory', 'knowledge');

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

/**
 * Write a knowledge article to the filesystem as a markdown file.
 * Creates category directory if it doesn't exist.
 */
export function syncArticleToFilesystem(article: {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  scope?: string;
  createdBy?: string;
  updatedAt?: number;
}) {
  try {
    const category = article.category || 'general';
    const dir = path.join(KNOWLEDGE_DIR, category);
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${sanitizeFilename(article.title)}.md`;
    const filepath = path.join(dir, filename);

    // Build frontmatter
    const frontmatter = [
      '---',
      `id: ${article.id}`,
      `title: "${article.title.replace(/"/g, '\\"')}"`,
      `category: ${category}`,
      article.tags?.length ? `tags: [${article.tags.map(t => `"${t}"`).join(', ')}]` : null,
      article.scope ? `scope: ${article.scope}` : null,
      article.createdBy ? `author: ${article.createdBy}` : null,
      article.updatedAt ? `updated: ${new Date(article.updatedAt).toISOString()}` : null,
      '---',
      '',
    ].filter(Boolean).join('\n');

    fs.writeFileSync(filepath, frontmatter + article.content, 'utf-8');
    return { success: true, path: filepath };
  } catch (e) {
    console.error('[knowledgeSync] Failed to write article:', e);
    return { success: false, error: String(e) };
  }
}

/**
 * Delete the filesystem copy of an article.
 */
export function deleteArticleFromFilesystem(article: {
  title: string;
  category?: string;
}) {
  try {
    const category = article.category || 'general';
    const filename = `${sanitizeFilename(article.title)}.md`;
    const filepath = path.join(KNOWLEDGE_DIR, category, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    return { success: true };
  } catch (e) {
    console.error('[knowledgeSync] Failed to delete article:', e);
    return { success: false };
  }
}
