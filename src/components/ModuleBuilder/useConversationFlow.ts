/**
 * useConversationFlow — React hook managing the interview state machine.
 * Drives section progression, question sequencing, and follow-up logic.
 */

import { useState, useCallback, useMemo } from 'react';
import type { ConversationMessage, SectionId, ModuleSpec, InterviewQuestion } from './types';
import { SECTION_ORDER } from './types';
import { getApplicableQuestions } from './questionBank';
import type { UseModuleSpecReturn } from './useModuleSpec';

interface ConversationFlowOptions {
  moduleSpec: UseModuleSpecReturn;
}

export function useConversationFlow({ moduleSpec }: ConversationFlowOptions) {
  const { spec, updateSpec, markAnswered } = moduleSpec;

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const currentSection: SectionId = SECTION_ORDER[currentSectionIndex] ?? 'identity';

  const applicableQuestions = useMemo(
    () => getApplicableQuestions(currentSection, spec),
    [currentSection, spec],
  );

  const currentQuestion: InterviewQuestion | null =
    applicableQuestions[currentQuestionIndex] ?? null;

  // ─── Helpers ───────────────────────────────────────────────────────

  const addMessage = useCallback(
    (role: ConversationMessage['role'], content: string, section?: SectionId) => {
      const msg: ConversationMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role,
        content,
        timestamp: Date.now(),
        section,
      };
      setMessages((prev) => [...prev, msg]);
      return msg;
    },
    [],
  );

  const askCurrentQuestion = useCallback(() => {
    if (currentQuestion) {
      addMessage('assistant', currentQuestion.text, currentSection);
    }
  }, [currentQuestion, currentSection, addMessage]);

  // ─── Advance Logic ────────────────────────────────────────────────

  const advanceToNextQuestion = useCallback(() => {
    // Re-compute applicable questions for current section (spec may have changed)
    const questions = getApplicableQuestions(currentSection, spec);
    const nextIdx = currentQuestionIndex + 1;

    if (nextIdx < questions.length) {
      setCurrentQuestionIndex(nextIdx);
      // Ask the next question after state update
      const nextQ = questions[nextIdx];
      if (nextQ) {
        addMessage('assistant', nextQ.text, currentSection);
      }
    } else {
      // Move to next section
      const nextSectionIdx = currentSectionIndex + 1;
      if (nextSectionIdx < SECTION_ORDER.length) {
        setCurrentSectionIndex(nextSectionIdx);
        setCurrentQuestionIndex(0);
        const nextSec = SECTION_ORDER[nextSectionIdx];
        const nextQuestions = getApplicableQuestions(nextSec, spec);
        addMessage(
          'assistant',
          `Great! Let's move on to **${nextSec.replace(/^\w/, (c) => c.toUpperCase())}**.`,
          nextSec,
        );
        if (nextQuestions[0]) {
          addMessage('assistant', nextQuestions[0].text, nextSec);
        }
      } else {
        // All sections complete
        setIsFinished(true);
        addMessage(
          'assistant',
          "🎉 Interview complete! Your module spec is ready. Click **Generate Tasks** to create the build tasks, or review the spec in the preview panel.",
        );
      }
    }
  }, [currentSection, currentSectionIndex, currentQuestionIndex, spec, addMessage]);

  // ─── User Answer Handler ──────────────────────────────────────────

  const submitAnswer = useCallback(
    (answer: string) => {
      if (!currentQuestion || isFinished) return;

      // Record user message
      addMessage('user', answer, currentSection);

      // Parse answer and update spec
      if (currentQuestion.parse) {
        const patch = currentQuestion.parse(answer, spec);
        updateSpec(patch);
      }
      markAnswered(currentQuestion.id);

      // Advance
      advanceToNextQuestion();
    },
    [currentQuestion, currentSection, isFinished, spec, addMessage, updateSpec, markAnswered, advanceToNextQuestion],
  );

  // ─── Start the interview ──────────────────────────────────────────

  const startInterview = useCallback(() => {
    setIsStarted(true);
    setCurrentSectionIndex(0);
    setCurrentQuestionIndex(0);
    setMessages([]);
    setIsFinished(false);

    addMessage(
      'assistant',
      "👋 Welcome to the Module Builder! I'll walk you through a few questions to design your module. Let's start with **Module Identity**.",
    );
    const firstQuestions = getApplicableQuestions('identity', spec);
    if (firstQuestions[0]) {
      addMessage('assistant', firstQuestions[0].text, 'identity');
    }
  }, [spec, addMessage]);

  // ─── Jump to section (for editing) ────────────────────────────────

  const jumpToSection = useCallback(
    (sectionId: SectionId) => {
      const idx = SECTION_ORDER.indexOf(sectionId);
      if (idx === -1) return;
      setCurrentSectionIndex(idx);
      setCurrentQuestionIndex(0);
      setIsFinished(false);
      const questions = getApplicableQuestions(sectionId, spec);
      addMessage('assistant', `Revisiting **${sectionId}** section.`, sectionId);
      if (questions[0]) {
        addMessage('assistant', questions[0].text, sectionId);
      }
    },
    [spec, addMessage],
  );

  return {
    messages,
    currentSection,
    currentQuestion,
    isStarted,
    isFinished,
    startInterview,
    submitAnswer,
    jumpToSection,
    askCurrentQuestion,
  };
}

export type UseConversationFlowReturn = ReturnType<typeof useConversationFlow>;
