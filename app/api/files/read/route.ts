import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, statSync } from 'fs';
import { homedir } from 'os';
import { ENV } from '@/lib/env';

const TEXT_EXTENSIONS = new Set([
  'md', 'txt', 'ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml',
  'sh', 'bash', 'zsh', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp',
  'h', 'css', 'scss', 'html', 'xml', 'sql', 'env', 'toml', 'ini',
  'gitignore', 'dockerfile', 'makefile', 'log',
]);

function isTextFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return TEXT_EXTENSIONS.has(ext);
}

const ALLOWED_ROOTS = [
  ENV.LIBRARY_PATH,
  ENV.VAULT_PATH,
  `${homedir()}/mission-control/agents`,
  process.cwd(),
];

function isAllowedPath(p: string): boolean {
  return ALLOWED_ROOTS.some(root => p.startsWith(root + '/') || p === root);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 });
  }

  if (!isAllowedPath(filePath)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const stat = statSync(filePath);
  if (!stat.isFile()) {
    return NextResponse.json({ error: 'Not a file' }, { status: 400 });
  }

  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const name = filePath.split('/').pop() ?? filePath;

  if (!isTextFile(filePath)) {
    return NextResponse.json({
      type: 'binary',
      name,
      ext,
      size: stat.size,
      path: filePath,
    });
  }

  // Limit to 500KB for display
  if (stat.size > 500 * 1024) {
    const content = readFileSync(filePath, 'utf-8').slice(0, 500 * 1024);
    return NextResponse.json({ type: 'text', name, ext, content: content + '\n\n[Truncated — file exceeds 500KB]', size: stat.size });
  }

  const content = readFileSync(filePath, 'utf-8');
  return NextResponse.json({ type: 'text', name, ext, content, size: stat.size });
}
