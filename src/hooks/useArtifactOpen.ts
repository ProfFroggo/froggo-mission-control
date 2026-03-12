// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useCallback } from 'react';
import { useArtifactStore } from '../store/artifactStore';
import type { ArtifactType } from '../store/artifactStore';
import { generateArtifactTitle } from '../utils/artifactExtractor';

function langToType(lang: string): ArtifactType {
  const l = lang.toLowerCase();
  if (l === 'mermaid') return 'diagram';
  if (l === 'json') return 'data';
  return 'code';
}

/**
 * Returns a stable callback: (lang: string, code: string) => void
 *
 * When called, finds the artifact in the store whose content matches `code`.
 * If not found (e.g. streaming just completed and extraction hook hasn't fired yet),
 * creates a transient store entry on the fly so the panel opens immediately.
 */
export function useArtifactOpen(): (lang: string, code: string) => void {
  const { artifacts, addArtifact, selectArtifact, isCollapsed, setCollapsed } = useArtifactStore();

  return useCallback((lang: string, code: string) => {
    let match = artifacts.find(a => a.content.trim() === code.trim());
    if (!match) {
      // Artifact not in store yet — create it on the fly so the panel opens
      const type = langToType(lang);
      const pseudo = {
        type,
        title: generateArtifactTitle({ type, content: code, metadata: { language: lang } }),
        content: code,
        messageId: 'inline',
        timestamp: Date.now(),
        metadata: { language: lang },
      };
      addArtifact(pseudo);
      match = useArtifactStore.getState().artifacts.find(a => a.content.trim() === code.trim());
    }
    if (match) {
      selectArtifact(match.id);
      if (isCollapsed) setCollapsed(false);
    }
  }, [artifacts, addArtifact, selectArtifact, isCollapsed, setCollapsed]);
}
