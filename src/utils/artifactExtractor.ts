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
  
  // Check for mermaid diagrams
  if (/```mermaid[\s\S]*?```/.test(content)) return true;
  
  // Check for JSON data blocks
  if (/```json[\s\S]*?```/.test(content)) return true;
  
  return false;
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
    
    // Check if it's a Mermaid diagram
    if (language.toLowerCase() === 'mermaid') {
      artifacts.push({
        type: 'diagram',
        content: code,
        metadata: { language: 'mermaid' },
      });
    }
    // Check if it's JSON data
    else if (language.toLowerCase() === 'json') {
      artifacts.push({
        type: 'data',
        content: code,
        metadata: { language: 'json' },
      });
    }
    // Regular code
    else if (code.length > 0) {
      artifacts.push({
        type: 'code',
        content: code,
        metadata: { language },
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
  
  return artifacts;
}

/**
 * Generate a meaningful title for an artifact
 */
export function generateArtifactTitle(artifact: ExtractedArtifact): string {
  switch (artifact.type) {
    case 'code':
      if (artifact.metadata?.filename) {
        return artifact.metadata.filename;
      }
      const lang = artifact.metadata?.language || 'code';
      return `${lang.charAt(0).toUpperCase() + lang.slice(1)} Code`;
      
    case 'diagram':
      return 'Mermaid Diagram';
      
    case 'data':
      return 'JSON Data';
      
    case 'image':
      return artifact.metadata?.filename || 'Image';
      
    case 'file':
      return artifact.metadata?.filename || 'File';
      
    case 'text':
      // Use first line or first 50 chars as title
      const firstLine = artifact.content.split('\n')[0].trim();
      return firstLine.length > 50 
        ? firstLine.substring(0, 47) + '...'
        : firstLine || 'Text';
      
    default:
      return 'Artifact';
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
