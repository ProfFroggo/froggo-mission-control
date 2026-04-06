// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import type { ArtifactType, ArtifactMetadata } from '../store/artifactStore';
import { MC_PATH_RE as LIBRARY_PATH_RE, IMAGE_EXTS, PREVIEWABLE_EXTS } from '../lib/missionControlPaths';

export interface ExtractedArtifact {
  type: ArtifactType;
  content: string;
  metadata?: ArtifactMetadata;
}

// Languages that count as document/media output artifacts (NOT process/code)
// Agents produce these as deliverables; bash/python/typescript/json etc. are processes.
const DOCUMENT_LANGS = new Set(['html', 'htm', 'svg', 'markdown', 'md']);

// Code languages extracted as `code` artifacts (deliverable source code, not scripts/config)
const CODE_LANGS = new Set([
  'javascript', 'js', 'jsx', 'typescript', 'ts', 'tsx',
  'python', 'py', 'sql', 'css', 'scss', 'sass',
  'go', 'rust', 'rs', 'java', 'cpp', 'c',
  'swift', 'kotlin', 'kt', 'ruby', 'rb', 'php',
]);

// Structured data languages extracted as `data` artifacts
const DATA_LANGS = new Set(['json']);

// Minimum non-blank lines for a code block to become an artifact (avoids trivial snippets)
const MIN_CODE_LINES = 8;

// Minimum characters for a structured-document response to become a text artifact
const MIN_DOC_CHARS = 800;

/**
 * Returns true if content looks like a standalone structured document
 * (has an H1 + at least 2 H2 headers + enough content).
 * This catches long GTM strategies, reports, etc. returned as plain markdown.
 */
function isStructuredDocument(content: string): boolean {
  if (content.length < MIN_DOC_CHARS) return false;
  const hasH1 = /^#\s+\S/m.test(content);
  if (!hasH1) return false;
  const h2count = (content.match(/^##\s+\S/gm) ?? []).length;
  return h2count >= 2;
}

function isSubstantialCode(code: string): boolean {
  return code.split('\n').filter(l => l.trim()).length >= MIN_CODE_LINES;
}

/**
 * Check if a message contains any extractable artifacts.
 * Only returns true for final-output document/media types — not process scripts.
 */
export function containsArtifacts(content: string): boolean {
  // Document code blocks: html, svg, markdown only
  if (/```(?:html|htm|svg|markdown|md)\b[\s\S]*?```/i.test(content)) return true;

  // Substantial code blocks: recognized language + minimum non-blank lines
  const codeRe = /```(\w+)\n([\s\S]*?)```/g;
  let cm: RegExpExecArray | null;
  codeRe.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((cm = codeRe.exec(content)) !== null) {
    const lang = cm[1].toLowerCase();
    if ((CODE_LANGS.has(lang) || DATA_LANGS.has(lang)) && isSubstantialCode(cm[2])) return true;
  }

  // Mermaid diagrams
  if (/```mermaid\b[\s\S]*?```/i.test(content)) return true;

  // Image markdown or standalone image URLs
  if (/!\[.*?\]\(.*?\)/.test(content)) return true;
  if (/https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg)/i.test(content)) return true;
  if (/\/api\/library\?action=raw&id=[A-Za-z0-9_=-]+/.test(content)) return true;

  // Library file paths (agent output files)
  LIBRARY_PATH_RE.lastIndex = 0;
  if (LIBRARY_PATH_RE.test(content)) return true;

  // Structured document: plain markdown response that looks like a deliverable
  if (isStructuredDocument(content)) return true;

  return false;
}

/**
 * Extract a title hint from the prose immediately before a code block.
 * Strips markdown formatting and trailing punctuation.
 */
function extractTitleHint(content: string, matchIndex: number): string | null {
  const before = content.slice(0, matchIndex);
  const lines = before.split('\n').reverse();
  for (const raw of lines) {
    const line = raw
      .replace(/^#+\s*/, '')           // headings
      .replace(/\*\*(.+?)\*\*/g, '$1') // bold
      .replace(/\*(.+?)\*/g, '$1')     // italic
      .replace(/`(.+?)`/g, '$1')       // inline code
      .replace(/[:：]\s*$/, '')         // trailing colon
      .trim();
    if (line.length > 0 && line.length < 80 && !line.match(/^[-*>]/) && !line.includes('. ')) {
      return line;
    }
    if (line.length > 0) break; // stop at first non-empty line even if unsuitable
  }
  return null;
}

/**
 * Extract final-output artifacts from message content.
 *
 * Artifacts = documents and media the agent produced as deliverables.
 * NOT artifacts: bash scripts, python, typescript, JSON data, config files, etc.
 *
 * Extracted types:
 *   - HTML / SVG code blocks  → file  (previewable sites/graphics)
 *   - Markdown code blocks    → text  (document output)
 *   - Mermaid diagrams        → diagram
 *   - Image URLs              → image
 *   - Library file paths      → file or image (agent-written output files)
 */
export function extractAllArtifacts(content: string): ExtractedArtifact[] {
  const artifacts: ExtractedArtifact[] = [];
  let match: RegExpExecArray | null;

  // ── Code blocks: document/media output types only ──────────────────────────
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const lang = (match[1] || '').toLowerCase();
    const code = match[2].trim();
    if (!code) continue;
    const titleHint = extractTitleHint(content, match.index) ?? undefined;

    if (lang === 'mermaid') {
      artifacts.push({ type: 'diagram', content: code, metadata: { language: 'mermaid', titleHint } });
    } else if (lang === 'html' || lang === 'htm') {
      artifacts.push({ type: 'file', content: code, metadata: { language: 'html', titleHint } });
    } else if (lang === 'svg') {
      artifacts.push({ type: 'file', content: code, metadata: { language: 'svg', titleHint } });
    } else if (lang === 'markdown' || lang === 'md') {
      artifacts.push({ type: 'text', content: code, metadata: { language: 'markdown', titleHint } });
    } else if (CODE_LANGS.has(lang) && isSubstantialCode(code)) {
      artifacts.push({ type: 'code', content: code, metadata: { language: lang, titleHint } });
    } else if (DATA_LANGS.has(lang) && isSubstantialCode(code)) {
      artifacts.push({ type: 'data', content: code, metadata: { language: lang, titleHint } });
    }
    // All other languages (bash, sh, yaml, etc.) → skip (process scripts, not deliverables)
  }

  // ── Images ─────────────────────────────────────────────────────────────────
  const seenUrls = new Set<string>();

  const imageMarkdownRegex = /!\[(.*?)\]\((.*?)\)/g;
  while ((match = imageMarkdownRegex.exec(content)) !== null) {
    const url = match[2];
    // Skip bare filenames — only accept absolute URLs, root-relative paths, or data URIs
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/') && !url.startsWith('data:')) continue;
    if (!seenUrls.has(url)) {
      artifacts.push({ type: 'image', content: url, metadata: { filename: match[1] || 'image' } });
      seenUrls.add(url);
    }
  }

  const imageUrlRegex = /https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg)/gi;
  while ((match = imageUrlRegex.exec(content)) !== null) {
    const url = match[0];
    if (!seenUrls.has(url)) {
      artifacts.push({ type: 'image', content: url, metadata: { filename: 'image' } });
      seenUrls.add(url);
    }
  }

  const libraryImgUrlRegex = /\/api\/library\?action=raw&id=[A-Za-z0-9_=-]+/g;
  while ((match = libraryImgUrlRegex.exec(content)) !== null) {
    const url = match[0];
    if (!seenUrls.has(url)) {
      artifacts.push({ type: 'image', content: url, metadata: { filename: 'image' } });
      seenUrls.add(url);
    }
  }

  // ── Library file paths (agent output files) ────────────────────────────────
  const seenPaths = new Set<string>();
  LIBRARY_PATH_RE.lastIndex = 0;
  while ((match = LIBRARY_PATH_RE.exec(content)) !== null) {
    const filePath = match[0];
    if (seenPaths.has(filePath)) continue;
    seenPaths.add(filePath);

    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const filename = filePath.split('/').pop() ?? filePath;

    if (IMAGE_EXTS.has(ext)) {
      artifacts.push({ type: 'image', content: filePath, metadata: { filename, filePath } });
    } else if (ext === 'md') {
      artifacts.push({ type: 'text', content: filePath, metadata: { filename, filePath, language: 'markdown' } });
    } else {
      artifacts.push({ type: 'file', content: filePath, metadata: { filename, filePath, language: ext } });
    }
  }

  // ── Structured document (whole response is the artifact) ───────────────────
  // Only if nothing else was extracted — avoids doubling when a doc also has code blocks
  if (artifacts.length === 0 && isStructuredDocument(content)) {
    // Extract H1 as title hint
    const h1 = content.match(/^#\s+(.+)/m)?.[1]?.trim();
    artifacts.push({ type: 'text', content, metadata: { language: 'markdown', titleHint: h1 } });
  }

  return artifacts;
}

/**
 * Generate a meaningful title for an artifact by inspecting its content.
 */
export function generateArtifactTitle(artifact: ExtractedArtifact): string {
  const code = artifact.content;
  const hint = artifact.metadata?.titleHint as string | undefined;

  switch (artifact.type) {

    case 'code': {
      // 1. Explicit filename comment at top of file (common in LLM output)
      //    e.g. `// filename: Button.tsx` or `# file: config.py`
      const fileComment = code.match(/^(?:\/\/|#|\/\*)\s*(?:filename|file|name):\s*([^\s*]+)/im);
      if (fileComment) return fileComment[1].trim();

      // 2. Explicit filename in metadata
      if (artifact.metadata?.filename) return artifact.metadata.filename;

      // 3. Export default function/class name
      const exportDefault = code.match(/export\s+default\s+(?:async\s+)?(?:function|class)\s+(\w+)/);
      if (exportDefault) return exportDefault[1];

      // 4. Top-level export const/function/class
      const topLevel = code.match(/^(?:export\s+)?(?:async\s+)?(?:function|class)\s+(\w+)/m);
      if (topLevel) return topLevel[1];

      const exportConst = code.match(/^export\s+(?:const|let)\s+(\w+)/m);
      if (exportConst) return exportConst[1];

      // 5. First meaningful line comment (not a shebang)
      const lineComment = code.match(/^(?:\/\/|#(?!!\/usr))\s*(.{3,60})/m);
      if (lineComment) {
        const c = lineComment[1].trim();
        if (c.length < 60 && !c.startsWith('!')) return c;
      }

      // 6. Title hint from surrounding prose
      if (hint) return hint;

      // 7. Fallback: "Language File"
      const lang = artifact.metadata?.language || 'Code';
      return `${lang.charAt(0).toUpperCase() + lang.slice(1)} File`;
    }

    case 'diagram': {
      // 1. Mermaid `title` directive
      const titleDir = code.match(/^\s*(?:%%\s*)?title\s+(.+)/im);
      if (titleDir) return titleDir[1].trim();

      // 2. Title hint from surrounding prose
      if (hint) return hint;

      // 3. Diagram type label
      const typeMatch = code.match(/^\s*(graph\s+\w+|flowchart\s+\w+|sequenceDiagram|classDiagram|erDiagram|gantt|pie|stateDiagram[-v2]*|timeline|mindmap|gitGraph|quadrantChart)/im);
      if (typeMatch) {
        const labels: Record<string, string> = {
          graph: 'Flow Diagram', flowchart: 'Flowchart',
          sequencediagram: 'Sequence Diagram', classdiagram: 'Class Diagram',
          erdiagram: 'ER Diagram', gantt: 'Gantt Chart', pie: 'Pie Chart',
          statediagram: 'State Diagram', timeline: 'Timeline',
          mindmap: 'Mind Map', gitgraph: 'Git Graph', quadrantchart: 'Quadrant Chart',
        };
        const key = typeMatch[1].split(/\s/)[0].toLowerCase().replace(/-v2$/, '');
        return labels[key] || 'Diagram';
      }

      return 'Diagram';
    }

    case 'data': {
      // 1. Top-level `title`, `name`, or `$id` field
      try {
        const parsed = JSON.parse(code);
        if (parsed && typeof parsed === 'object') {
          if (!Array.isArray(parsed)) {
            if (parsed.title && typeof parsed.title === 'string') return parsed.title;
            if (parsed.name  && typeof parsed.name  === 'string') return parsed.name;
            if (parsed.$id   && typeof parsed.$id   === 'string')
              return (parsed.$id as string).split('/').filter(Boolean).pop() || 'Schema';
          }
          if (Array.isArray(parsed) && parsed.length > 0) {
            const firstKey = typeof parsed[0] === 'object' && parsed[0] !== null
              ? Object.keys(parsed[0])[0] : null;
            return firstKey
              ? `${parsed.length} ${firstKey} records`
              : `${parsed.length}-item list`;
          }
          // Object with no special fields — use first key
          const firstKey = Object.keys(parsed)[0];
          if (firstKey) return `${firstKey} data`;
        }
      } catch (err) { console.warn('[artifactExtractor] Non-critical: not valid JSON:', err); }

      // 2. Title hint from surrounding prose
      if (hint) return hint;

      return 'JSON Data';
    }

    case 'image':
      if (artifact.metadata?.filename && artifact.metadata.filename !== 'image')
        return artifact.metadata.filename;
      if (hint) return hint;
      return 'Image';

    case 'file':
      return artifact.metadata?.filename || hint || 'File';

    case 'text': {
      const firstLine = code.split('\n')[0].trim();
      if (firstLine.length > 0)
        return firstLine.length > 50 ? `${firstLine.slice(0, 47)}…` : firstLine;
      return hint || 'Text';
    }

    default:
      return hint || 'Artifact';
  }
}

/**
 * Get file extension for an artifact type
 */
export function getArtifactExtension(type: ArtifactType, language?: string): string {
  if (type === 'code' && language) {
    const extensions: Record<string, string> = {
      typescript: 'ts',
      javascript: 'js',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rust: 'rs',
      ruby: 'rb',
      php: 'php',
      swift: 'swift',
      kotlin: 'kt',
      jsx: 'jsx',
      tsx: 'tsx',
      html: 'html',
      css: 'css',
      scss: 'scss',
      json: 'json',
      yaml: 'yaml',
      yml: 'yml',
      xml: 'xml',
      sql: 'sql',
      bash: 'sh',
      sh: 'sh',
      shell: 'sh',
    };
    return extensions[language.toLowerCase()] || 'txt';
  }
  
  if (type === 'diagram') return 'mmd';
  if (type === 'data') return 'json';
  if (type === 'image') return 'png';
  
  return 'txt';
}
