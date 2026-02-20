/**
 * useModuleSpec — React hook managing the ModuleSpec state with section-level update functions.
 */

import { useState, useCallback, useMemo } from 'react';
import type { ModuleSpec, SectionId, SectionProgress } from './types';
import { createEmptySpec, SECTION_ORDER, SECTION_LABELS } from './types';
import { getApplicableQuestions } from './questionBank';

export function useModuleSpec() {
  const [spec, setSpec] = useState<Partial<ModuleSpec>>(createEmptySpec());
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());

  const updateSpec = useCallback((patch: Partial<ModuleSpec>) => {
    setSpec((prev) => ({ ...prev, ...patch }));
  }, []);

  const markAnswered = useCallback((questionId: string) => {
    setAnsweredQuestions((prev) => new Set(prev).add(questionId));
  }, []);

  const resetSpec = useCallback(() => {
    setSpec(createEmptySpec());
    setAnsweredQuestions(new Set());
  }, []);

  // Section-specific update helpers
  const updateIdentity = useCallback(
    (patch: Pick<Partial<ModuleSpec>, 'id' | 'name' | 'description' | 'category' | 'icon'>) =>
      updateSpec(patch),
    [updateSpec],
  );

  const updateType = useCallback(
    (patch: Pick<Partial<ModuleSpec>, 'type' | 'hasNavigation'>) => updateSpec(patch),
    [updateSpec],
  );

  const updateFeatures = useCallback(
    (patch: Pick<Partial<ModuleSpec>, 'views' | 'components' | 'layout'>) => updateSpec(patch),
    [updateSpec],
  );

  const updateData = useCallback(
    (patch: Pick<Partial<ModuleSpec>, 'ipcChannels' | 'services' | 'storeSlice' | 'externalApis'>) =>
      updateSpec(patch),
    [updateSpec],
  );

  const updateSettings = useCallback(
    (patch: Pick<Partial<ModuleSpec>, 'permissions' | 'settings' | 'requiredApiKeys'>) =>
      updateSpec(patch),
    [updateSpec],
  );

  // Progress tracking
  const sectionProgress = useMemo((): SectionProgress[] => {
    return SECTION_ORDER.map((sectionId) => {
      const questions = getApplicableQuestions(sectionId, spec);
      const answered = questions.filter((q) => answeredQuestions.has(q.id)).length;
      return {
        id: sectionId,
        label: SECTION_LABELS[sectionId],
        complete: questions.length > 0 && answered >= questions.length,
        questionCount: questions.length,
        answeredCount: answered,
      };
    });
  }, [spec, answeredQuestions]);

  const overallProgress = useMemo(() => {
    const total = sectionProgress.reduce((s, p) => s + p.questionCount, 0);
    const done = sectionProgress.reduce((s, p) => s + p.answeredCount, 0);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [sectionProgress]);

  const isComplete = useMemo(
    () => sectionProgress.every((s) => s.complete),
    [sectionProgress],
  );

  return {
    spec,
    updateSpec,
    markAnswered,
    resetSpec,
    updateIdentity,
    updateType,
    updateFeatures,
    updateData,
    updateSettings,
    sectionProgress,
    overallProgress,
    isComplete,
    answeredQuestions,
  };
}

export type UseModuleSpecReturn = ReturnType<typeof useModuleSpec>;
