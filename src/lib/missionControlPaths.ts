// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Single source of truth for mission-control file path detection and allowed extensions.
// Used by: artifactExtractor, ArtifactPanel, library/serve API.

/** File extensions recognized as document/media artifacts */
export const DOCUMENT_EXTS = ['html', 'htm', 'svg', 'pdf', 'md'] as const;
export const MEDIA_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'mov'] as const;
export const ALL_ARTIFACT_EXTS = [...DOCUMENT_EXTS, ...MEDIA_EXTS] as const;

/** Extensions that can be previewed (rendered, not just shown as code) */
export const PREVIEWABLE_EXTS = new Set(['html', 'htm', 'svg', 'md', 'markdown']);

/** Extensions that are images */
export const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

/**
 * Regex matching any file path inside ~/mission-control/ with a recognized artifact extension.
 * Covers library/, agents/, memory/, data/, or any other subdirectory.
 *
 * IMPORTANT: reset .lastIndex before each use (global flag).
 */
const extPattern = ALL_ARTIFACT_EXTS.join('|');
export const MC_PATH_RE = new RegExp(
  `(?:~|\\/Users\\/[^/\\s]+)\\/mission-control\\/\\S+\\.(?:${extPattern})`,
  'gi'
);

/**
 * Regex matching relative library file paths like `library/filename.ext`.
 * Agents often reference files with short paths instead of absolute ones.
 *
 * IMPORTANT: reset .lastIndex before each use (global flag).
 */
export const LIBRARY_REL_PATH_RE = new RegExp(
  `(?:^|\\s|\\()library\\/\\S+\\.(?:${extPattern})`,
  'gi'
);

/**
 * Returns true if a path is inside the mission-control directory.
 * Used by the serve API for security checks.
 */
export function isInsideMissionControl(resolvedPath: string, mcBase: string): boolean {
  const norm = resolvedPath.startsWith(mcBase + '/') || resolvedPath === mcBase;
  return norm;
}

/**
 * Returns true if content string is a mission-control file path (not inline content).
 */
export function isMCFilePath(content: string): boolean {
  return (
    (content.startsWith('/') || content.startsWith('~')) &&
    /\/mission-control\//.test(content) &&
    new RegExp(`\\.(?:${extPattern})$`, 'i').test(content)
  );
}
