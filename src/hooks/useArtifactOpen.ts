// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useCallback } from 'react';
import { useArtifactStore } from '../store/artifactStore';

/**
 * Returns a stable callback: (lang: string, code: string) => void
 *
 * When called, finds the artifact whose content matches `code`, selects it,
 * and expands the artifact panel if it is collapsed. Does nothing silently if
 * no matching artifact is found.
 */
export function useArtifactOpen(): (lang: string, code: string) => void {
  const { artifacts, selectArtifact, isCollapsed, setCollapsed } = useArtifactStore();

  return useCallback((lang: string, code: string) => {
    const match = artifacts.find(a => a.content.trim() === code.trim());
    if (match) {
      selectArtifact(match.id);
      if (isCollapsed) setCollapsed(false);
    }
  }, [artifacts, selectArtifact, isCollapsed, setCollapsed]);
}
