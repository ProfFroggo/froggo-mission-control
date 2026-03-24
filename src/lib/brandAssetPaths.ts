// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Shared path helpers for brand asset storage locations.
import { ENV } from '@/lib/env';
import path from 'path';

// Maps DB category slug → filesystem folder name under Brand Assets/
export const CATEGORY_FOLDER: Record<string, string> = {
  logos:             'Logos',
  colors:            'Colors',
  typography:        'Typography',
  imagery:           'Imagery',
  presentations:     'Presentations',
  guidelines:        'Guidelines',
  character:         'Character',
  'motion-graphics': 'Motion Graphics',
  templates:         'Templates',
  other:             'Others',
  others:            'Others',
};

// Actual binary files land in the library
export const LIBRARY_ASSETS_ROOT = path.join(ENV.LIBRARY_PATH, 'brand-assets');
// .md catalog files land in the knowledge vault
export const KNOWLEDGE_ASSETS_ROOT = path.join(ENV.VAULT_PATH, 'knowledge', 'Brand Assets');

export function brandAssetDir(category: string, folderName: string): string {
  const catFolder = CATEGORY_FOLDER[category] ?? 'Others';
  return path.join(LIBRARY_ASSETS_ROOT, catFolder, folderName);
}

/** Returns the path to the .md catalog file: ~/knowledge/Brand Assets/{Category}/{folderName}.md */
export function brandAssetKnowledgePath(category: string, folderName: string): string {
  const catFolder = CATEGORY_FOLDER[category] ?? 'Others';
  const safeName = folderName.replace(/[^a-zA-Z0-9._\- ]/g, '_');
  return path.join(KNOWLEDGE_ASSETS_ROOT, catFolder, `${safeName}.md`);
}
