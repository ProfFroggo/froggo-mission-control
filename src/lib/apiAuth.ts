// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/lib/apiAuth.ts
// Shared auth + path-safety utilities for API routes.

import { NextRequest, NextResponse } from 'next/server';
import { ENV } from './env';
import { existsSync, realpathSync } from 'fs';
import path from 'path';

// ── Bearer token auth ─────────────────────────────────────────────────────────

/**
 * Returns an Unauthorized response if INTERNAL_API_TOKEN is configured and the
 * request doesn't carry the right Bearer token. Returns null when auth passes.
 *
 * If INTERNAL_API_TOKEN is empty the app is running in local/dev mode and all
 * requests are allowed through — no token needed.
 */
export function requireAuth(req: NextRequest): NextResponse | null {
  const token = ENV.INTERNAL_API_TOKEN;
  if (!token) return null; // auth disabled (local dev)
  const header = req.headers.get('authorization') ?? '';
  if (header === `Bearer ${token}`) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/** Same as requireAuth but for plain Request objects (used in route.ts edge cases). */
export function checkBearerToken(authHeader: string | null): boolean {
  const token = ENV.INTERNAL_API_TOKEN;
  if (!token) return true;
  return authHeader === `Bearer ${token}`;
}

// ── Safe library path resolution ─────────────────────────────────────────────

const LIBRARY_REAL = (() => {
  try { return realpathSync(ENV.LIBRARY_PATH); } catch { return ENV.LIBRARY_PATH; }
})();

/**
 * Resolves a base64url-encoded relative path ID to an absolute file path that
 * is guaranteed to be inside the library directory.
 *
 * Returns the resolved absolute path, or null if:
 *  - The id is not valid base64url
 *  - The decoded path contains '..' segments
 *  - The resolved path (symlinks included) escapes the library root
 *  - The file does not exist
 */
export function resolveLibraryId(id: string): string | null {
  let decoded: string;
  try {
    decoded = Buffer.from(id, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  // Reject explicit traversal attempts early
  if (decoded.includes('..')) return null;

  const joined = path.join(ENV.LIBRARY_PATH, decoded);

  // Normalize without following symlinks first
  if (!joined.startsWith(ENV.LIBRARY_PATH + path.sep) && joined !== ENV.LIBRARY_PATH) {
    return null;
  }

  if (!existsSync(joined)) return null;

  // Resolve symlinks and verify the real path is still inside the library
  try {
    const real = realpathSync(joined);
    if (!real.startsWith(LIBRARY_REAL + path.sep) && real !== LIBRARY_REAL) return null;
    return real;
  } catch {
    return null;
  }
}

/**
 * Resolves a caller-supplied file path to an absolute path guaranteed to be
 * inside the library directory. Accepts:
 *  - Paths relative to the library root (e.g. "design/images/foo.png")
 *  - Bare filenames searched in common subdirectories
 *
 * Rejects absolute paths and any path with '..' segments.
 * Returns null if the file is not found or escapes the library.
 */
export function resolveLibraryPath(inputPath: string): string | null {
  // Reject absolute paths — callers must use library-relative paths
  if (path.isAbsolute(inputPath)) return null;
  // Reject traversal attempts
  if (inputPath.includes('..')) return null;

  const search = (candidate: string): string | null => {
    if (!existsSync(candidate)) return null;
    try {
      const real = realpathSync(candidate);
      if (!real.startsWith(LIBRARY_REAL + path.sep) && real !== LIBRARY_REAL) return null;
      return real;
    } catch { return null; }
  };

  // Library-relative path
  const viaLibrary = search(path.join(ENV.LIBRARY_PATH, inputPath));
  if (viaLibrary) return viaLibrary;

  // Bare filename — search common image dirs
  const base = path.basename(inputPath);
  for (const sub of ['design/images', 'images', 'design', '.']) {
    const found = search(path.join(ENV.LIBRARY_PATH, sub, base));
    if (found) return found;
  }

  return null;
}
