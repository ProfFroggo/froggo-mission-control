// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import type { ArtifactType, ArtifactMetadata } from '../store/artifactStore';

export interface ExtractedArtifact {
  type: ArtifactType;
  content: string;
  metadata?: ArtifactMetadata;
}

/**
 * Check if a message contains any extractable artifacts
 */
export function containsArtifacts(content: string): boolean {
  // Check for code blocks
  if (/```[\s\S]*?```/.test(content)) return true;
  
  // Check for image URLs or data URLs
  if (/!\[.*?\]\(.*?\)/.test(content)) return true;
  if (/https?:\/\/.*\.(png|jpg|jpeg|gif|webp|svg)/i.test(content)) return true;
  if (/\/api\/library\?action=raw&id=[A-Za-z0-9_-]+/.test(content)) return true;
  
  // Check for mermaid diagrams
  if (/```mermaid[\s\S]*?```/.test(content)) return true;
  
  // Check for JSON data blocks
  if (/```json[\s\S]*?```/.test(content)) return true;
  
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
 * Extract all artifacts from message content
 */
export function extractAllArtifacts(content: string): ExtractedArtifact[] {
  const artifacts: ExtractedArtifact[] = [];

  // Extract code blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1] || 'text';
    const code = match[2].trim();
    const titleHint = extractTitleHint(content, match.index) ?? undefined;

    // Check if it's a Mermaid diagram
    if (language.toLowerCase() === 'mermaid') {
      artifacts.push({
        type: 'diagram',
        content: code,
        metadata: { language: 'mermaid', titleHint },
      });
    }
    // Check if it's JSON data
    else if (language.toLowerCase() === 'json') {
      artifacts.push({
        type: 'data',
        content: code,
        metadata: { language: 'json', titleHint },
      });
    }
    // Regular code
    else if (code.length > 0) {
      artifacts.push({
        type: 'code',
        content: code,
        metadata: { language, titleHint },
      });
    }
  }

  // Extract images (markdown format)
  const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
  while ((match = imageRegex.exec(content)) !== null) {
    const altText = match[1];
    const url = match[2];

    artifacts.push({
      type: 'image',
      content: url,
      metadata: { filename: altText || 'image' },
    });
  }

  // Extract standalone image URLs
  const urlRegex = /https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|svg)/gi;
  const seenUrls = new Set(artifacts.filter(a => a.type === 'image').map(a => a.content));

  while ((match = urlRegex.exec(content)) !== null) {
    const url = match[0];
    if (!seenUrls.has(url)) {
      artifacts.push({
        type: 'image',
        content: url,
        metadata: { filename: 'image' },
      });
      seenUrls.add(url);
    }
  }

  // Extract Mission Control library image URLs
  const libraryUrlRegex = /\/api\/library\?action=raw&id=[A-Za-z0-9_=-]+/g;
  while ((match = libraryUrlRegex.exec(content)) !== null) {
    const url = match[0];
    if (!seenUrls.has(url)) {
      artifacts.push({
        type: 'image',
        content: url,
        metadata: { filename: 'image' },
      });
      seenUrls.add(url);
    }
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
      } catch { /* not valid JSON */ }

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
