// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useEffect, useRef } from 'react';
import { useArtifactStore } from '../store/artifactStore';
import type { ArtifactType } from '../store/artifactStore';
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

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  streaming?: boolean; // when true, content is incomplete — do not process yet
}

/**
 * Hook to automatically extract artifacts from messages
 */
export function useArtifactExtraction(
  messages: Message[],
  sessionId?: string,
  options: {
    autoExtract?: boolean;
    extractFromUser?: boolean;
    extractFromAssistant?: boolean;
    projectId?: string;
  } = {}
) {
  const { addArtifact, addVersion, artifacts } = useArtifactStore();
  const processedMessages = useRef<Set<string>>(new Set());

  const {
    autoExtract = true,
    extractFromUser = false,
    extractFromAssistant = true,
    projectId,
  } = options;

  useEffect(() => {
    if (!autoExtract) return;

    for (const message of messages) {
      // Skip if already processed
      if (processedMessages.current.has(message.id)) continue;

      // Check role filter
      if (message.role === 'user' && !extractFromUser) continue;
      if (message.role === 'assistant' && !extractFromAssistant) continue;
      if (message.role === 'system') continue;

      // Skip messages still streaming — content is incomplete, don't mark as processed
      if (message.streaming) continue;

      // Check if message contains artifacts
      if (!containsArtifacts(message.content)) {
        processedMessages.current.add(message.id);
        continue;
      }

      // Extract artifacts
      const extracted = extractAllArtifacts(message.content);

      for (const artifact of extracted) {
        const title = generateArtifactTitle(artifact);

        // Check if this artifact already exists (by content similarity)
        const existingArtifact = artifacts.find(
          (a) =>
            a.content === artifact.content &&
            a.type === artifact.type &&
            a.sessionId === sessionId
        );

        if (existingArtifact) {
          // Check if content actually changed
          if (existingArtifact.content !== artifact.content) {
            addVersion(
              existingArtifact.id,
              artifact.content,
              message.id,
              'Updated from message'
            );
          }
        } else {
          // Add new artifact
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
          // Persist to project directory if in a project context
          if (projectId && artifact.type !== 'image') {
            saveArtifactToProject(projectId, title, artifact.type, artifact.content, artifact.metadata?.language);
          }
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
  ]);

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
