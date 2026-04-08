// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useEffect, useRef, useCallback } from 'react';
import { useArtifactStore } from '../store/artifactStore';
import type { ArtifactType } from '../store/artifactStore';
import { IMAGE_EXTS } from '../lib/missionControlPaths';
import {
  extractAllArtifacts,
  containsArtifacts,
  generateArtifactTitle,
  getArtifactExtension,
} from '../utils/artifactExtractor';

function saveArtifactToProject(projectId: string, title: string, type: ArtifactType, content: string, language?: string) {
  const ext = getArtifactExtension(type, language);
  const safeName = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || type;
  const filename = `${safeName}.${ext}`;
  fetch(`/api/projects/${projectId}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: filename, content, encoding: 'utf-8' }),
  }).catch(() => { /* non-critical */ });
}

/** Auto-save substantial artifacts (file, code) to the library filesystem */
const savedArtifactKeys = new Set<string>();
function saveArtifactToLibrary(title: string, type: ArtifactType, content: string, language?: string) {
  // Only save file-type deliverables (HTML, SVG) and substantial code — skip images, diagrams, data, text
  if (type !== 'file' && type !== 'code') return;
  // Skip library path references (already on disk)
  if (content.startsWith('/') || content.startsWith('~')) return;
  // Deduplicate
  const key = `${title}:${content.length}`;
  if (savedArtifactKeys.has(key)) return;
  savedArtifactKeys.add(key);

  const ext = getArtifactExtension(type, language);
  const date = new Date().toISOString().slice(0, 10);
  const safeName = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || type;
  const filename = `${date}_${safeName}.${ext}`;

  fetch('/api/library/fs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'write', path: filename, content }),
  }).catch(() => { /* non-critical — library save is best-effort */ });
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  streaming?: boolean; // when true, content is incomplete — do not process yet
}

// ── Filesystem scan: the reliable fallback ─────────────────────────────────
// After each completed assistant message, scan ~/mission-control/ for files
// created/modified since the message timestamp. This catches files agents write
// to disk without mentioning the path in chat.

interface ScannedFile {
  path: string;
  filename: string;
  ext: string;
  modified: number;
  size: number;
}

async function scanForNewFiles(
  sinceMs: number,
  agentId?: string,
): Promise<ScannedFile[]> {
  try {
    const params = new URLSearchParams({ since: String(sinceMs) });
    if (agentId) params.set('agent', agentId);
    const res = await fetch(`/api/artifacts/scan?${params}`);
    if (!res.ok) return [];
    const { files } = await res.json();
    return Array.isArray(files) ? files : [];
  } catch {
    return [];
  }
}

function fileTypeFromExt(ext: string): ArtifactType {
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (ext === 'md') return 'text';
  if (ext === 'json') return 'data';
  return 'file';
}

/**
 * Hook to automatically extract artifacts from messages AND scan filesystem
 */
export function useArtifactExtraction(
  messages: Message[],
  sessionId?: string,
  options: {
    autoExtract?: boolean;
    extractFromUser?: boolean;
    extractFromAssistant?: boolean;
    projectId?: string;
    agentId?: string;
  } = {}
) {
  const { addArtifact, addVersion, artifacts } = useArtifactStore();
  const processedMessages = useRef<Set<string>>(new Set());
  const prevSessionId = useRef<string | undefined>(sessionId);

  // Reset processed set when session changes so we re-scan the new session's messages
  if (prevSessionId.current !== sessionId) {
    prevSessionId.current = sessionId;
    processedMessages.current = new Set();
  }

  const {
    autoExtract = true,
    extractFromUser = false,
    extractFromAssistant = true,
    projectId,
    agentId,
  } = options;

  // Stable callback for creating artifacts from scanned files
  const createArtifactFromFile = useCallback((
    file: ScannedFile,
    messageId: string,
    timestamp: number,
  ) => {
    // Check if we already have this file as an artifact in this session
    const existing = artifacts.find(
      a => a.sessionId === sessionId && a.content === file.path
    );
    if (existing) return;

    const type = fileTypeFromExt(file.ext);
    const lang = file.ext === 'md' ? 'markdown' : file.ext;

    addArtifact({
      type,
      title: file.filename,
      content: file.path,
      messageId,
      sessionId,
      timestamp,
      metadata: { filename: file.filename, filePath: file.path, language: lang },
      tags: ['assistant', 'file-scan'],
    });
  }, [addArtifact, artifacts, sessionId]);

  // ── Text-based extraction (existing logic) ──────────────────────────────
  useEffect(() => {
    if (!autoExtract) return;

    for (const message of messages) {
      if (processedMessages.current.has(message.id)) continue;
      if (message.role === 'user' && !extractFromUser) continue;
      if (message.role === 'assistant' && !extractFromAssistant) continue;
      if (message.role === 'system') continue;
      if (message.streaming) continue;

      if (!containsArtifacts(message.content)) {
        processedMessages.current.add(message.id);
        continue;
      }

      const extracted = extractAllArtifacts(message.content);

      for (const artifact of extracted) {
        const title = generateArtifactTitle(artifact);

        const existingArtifact = artifacts.find(
          (a) =>
            a.sessionId === sessionId &&
            a.type === artifact.type &&
            (a.content === artifact.content || a.title === title)
        );

        if (existingArtifact) {
          if (existingArtifact.content !== artifact.content) {
            addVersion(existingArtifact.id, artifact.content, message.id, 'Updated');
          }
        } else {
          addArtifact({
            type: artifact.type,
            title,
            content: artifact.content,
            messageId: message.id,
            sessionId,
            timestamp: message.timestamp,
            metadata: artifact.metadata,
            tags: [message.role],
          });
          if (projectId && artifact.type !== 'image') {
            saveArtifactToProject(projectId, title, artifact.type, artifact.content, artifact.metadata?.language);
          }
          saveArtifactToLibrary(title, artifact.type, artifact.content, artifact.metadata?.language);
        }
      }

      processedMessages.current.add(message.id);
    }
  }, [
    messages,
    sessionId,
    autoExtract,
    extractFromUser,
    extractFromAssistant,
    addArtifact,
    addVersion,
    artifacts,
    projectId,
  ]);

  // ── Filesystem scan: poll for new files every 10s while chat is active ────
  // Only runs in 1-on-1 agent chats (where agentId is known).
  // Disabled for chat rooms — rooms have multiple agents and the scan would
  // pull in unrelated files (training logs, task outputs) from all agents.
  const sessionStartRef = useRef<number>(Date.now());
  if (prevSessionId.current !== sessionId) {
    sessionStartRef.current = Date.now();
  }

  useEffect(() => {
    if (!autoExtract) return;
    if (!sessionId) return;
    if (!agentId) return; // Skip filesystem scan in chat rooms (no single agent)

    // Find the latest assistant message to attach artifacts to
    const getLatestAssistantMsg = () => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') return messages[i];
      }
      return null;
    };

    const runScan = () => {
      const sinceMs = sessionStartRef.current - 5000; // small buffer
      scanForNewFiles(sinceMs, agentId).then(files => {
        const msg = getLatestAssistantMsg();
        for (const file of files) {
          if (file.size < 100) continue;
          createArtifactFromFile(
            file,
            msg?.id ?? 'file-scan',
            msg?.timestamp ?? Date.now(),
          );
        }
      });
    };

    // Initial scan after a short delay (let first messages arrive)
    const initialTimer = setTimeout(runScan, 3000);
    // Then poll every 10 seconds
    const interval = setInterval(runScan, 10_000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, autoExtract, agentId, createArtifactFromFile]);

  return {
    extractManually: (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (!message) return [];

      const extracted = extractAllArtifacts(message.content);
      const addedArtifacts: any[] = [];

      for (const artifact of extracted) {
        const title = generateArtifactTitle(artifact);
        addArtifact({
          type: artifact.type,
          title,
          content: artifact.content,
          messageId: message.id,
          sessionId,
          timestamp: message.timestamp,
          metadata: artifact.metadata,
          tags: [message.role, 'manual'],
        });
        addedArtifacts.push({ ...artifact, title });
      }

      return addedArtifacts;
    },
  };
}

/**
 * Hook for simple artifact detection in messages
 */
export function useArtifactDetection(message: Message | null) {
  if (!message) return { hasArtifacts: false, count: 0 };

  const hasArtifacts = containsArtifacts(message.content);
  const artifacts = hasArtifacts ? extractAllArtifacts(message.content) : [];

  return {
    hasArtifacts,
    count: artifacts.length,
    artifacts,
  };
}
