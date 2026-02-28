/**
 * Artifact extractor utility
 * Extracts artifacts (code blocks, images, files) from chat messages
 */

interface Artifact {
  id: string;
  type: 'code' | 'image' | 'file' | 'text';
  title: string;
  content: string;
  messageId: string;
  timestamp: number;
  metadata?: {
    language?: string;
    filename?: string;
    size?: number;
  };
}

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: any;
  id?: string;
  tool_use_id?: string;
  content?: any;
  is_error?: boolean;
}

interface ChatMessage {
  id: string;
  content: string | ContentBlock[];
  timestamp: number;
  role: string;
}

/**
 * Extract code blocks from markdown text
 */
function extractCodeBlocksFromMarkdown(text: string): { language: string; code: string }[] {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: { language: string; code: string }[] = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    });
  }

  return blocks;
}

/**
 * Extract artifacts from a chat message
 */
export function extractArtifactsFromMessage(message: ChatMessage): Artifact[] {
  const artifacts: Artifact[] = [];
  let artifactCounter = 0;

  // If content is structured (array of blocks)
  if (Array.isArray(message.content)) {
    message.content.forEach((block: ContentBlock) => {
      // Tool use blocks with code
      if (block.type === 'tool_use' && block.input) {
        const inputStr = JSON.stringify(block.input, null, 2);
        artifacts.push({
          id: `${message.id}-artifact-${artifactCounter++}`,
          type: 'code',
          title: `${block.name || 'Tool'} Input`,
          content: inputStr,
          messageId: message.id,
          timestamp: message.timestamp,
          metadata: {
            language: 'json',
          },
        });
      }

      // Tool result blocks
      if (block.type === 'tool_result' && block.content) {
        const content = Array.isArray(block.content)
          ? block.content.map(c => c.text || JSON.stringify(c)).join('\n')
          : block.content;

        artifacts.push({
          id: `${message.id}-artifact-${artifactCounter++}`,
          type: 'text',
          title: `${block.name || 'Tool'} Result`,
          content: String(content),
          messageId: message.id,
          timestamp: message.timestamp,
        });
      }

      // Extract code blocks from text blocks
      if (block.type === 'text' && block.text) {
        const codeBlocks = extractCodeBlocksFromMarkdown(block.text);
        codeBlocks.forEach((codeBlock, cbIndex) => {
          artifacts.push({
            id: `${message.id}-artifact-${artifactCounter++}`,
            type: 'code',
            title: `Code ${cbIndex + 1}`,
            content: codeBlock.code,
            messageId: message.id,
            timestamp: message.timestamp,
            metadata: {
              language: codeBlock.language,
            },
          });
        });
      }
    });
  } else if (typeof message.content === 'string') {
    // Extract code blocks from plain string content
    const codeBlocks = extractCodeBlocksFromMarkdown(message.content);
    codeBlocks.forEach((codeBlock, index) => {
      artifacts.push({
        id: `${message.id}-artifact-${artifactCounter++}`,
        type: 'code',
        title: `Code ${index + 1}`,
        content: codeBlock.code,
        messageId: message.id,
        timestamp: message.timestamp,
        metadata: {
          language: codeBlock.language,
        },
      });
    });
  }

  return artifacts;
}

/**
 * Check if text contains artifacts (code blocks)
 */
export function containsArtifacts(content: string): boolean {
  return /```\w*\n[\s\S]*?```/.test(content);
}

/**
 * Extract all artifacts from a content string
 */
export function extractAllArtifacts(content: string): Artifact[] {
  const message: ChatMessage = {
    id: `inline-${Date.now()}`,
    content,
    timestamp: Date.now(),
    role: 'assistant',
  };
  return extractArtifactsFromMessage(message);
}

/**
 * Generate a title for an artifact
 */
export function generateArtifactTitle(artifact: Artifact): string {
  return artifact.title || artifact.metadata?.filename || 'Untitled';
}

/**
 * Extract artifacts from all messages
 */
export function extractArtifactsFromMessages(messages: ChatMessage[]): Artifact[] {
  const allArtifacts: Artifact[] = [];

  messages.forEach((message) => {
    // Only extract from assistant messages
    if (message.role === 'assistant') {
      const messageArtifacts = extractArtifactsFromMessage(message);
      allArtifacts.push(...messageArtifacts);
    }
  });

  return allArtifacts;
}
