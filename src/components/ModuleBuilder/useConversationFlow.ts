/**
 * useConversationFlow — LLM-connected conversational interview.
 * Each question is explored via back-and-forth with the LLM until
 * the answer is solid, then the LLM signals readiness to advance.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { ConversationMessage, SectionId, InterviewQuestion, ModuleSpec } from './types';
import { SECTION_ORDER, SECTION_LABELS } from './types';
import { getApplicableQuestions } from './questionBank';
import { gateway } from '../../lib/gateway';
import type { UseModuleSpecReturn } from './useModuleSpec';

// Sentinel the LLM embeds when the current question's answer is complete
const ANSWER_READY_TAG = '[[ANSWER_READY]]';
// Regex to extract the structured answer from inside the tag
const ANSWER_EXTRACT_RE = /\[\[ANSWER_READY:(.+?)\]\]/s;

interface ConversationFlowOptions {
  moduleSpec: UseModuleSpecReturn;
}

function buildSystemPrompt(
  question: InterviewQuestion,
  section: SectionId,
  spec: Partial<ModuleSpec>,
): string {
  const optionsHint = question.options?.length
    ? `\nValid options: ${question.options.join(', ')}`
    : '';

  return `You are the Module Builder assistant inside the Froggo dashboard.
You are helping the user define a new dashboard module by working through a structured questionnaire.

## Current Section: ${SECTION_LABELS[section]}
## Current Question: ${question.text}
## Question ID: ${question.id}
## Expected Input Type: ${question.inputType}${optionsHint}
## Fields this populates: ${question.targets.join(', ')}

## Current Spec So Far:
${JSON.stringify(spec, null, 2)}

## Your Behavior:
- Have a natural conversation to help the user answer this question well.
- Ask clarifying follow-ups if their answer is vague or incomplete.
- Suggest options or examples when helpful.
- When the user's answer is clear and complete enough to move on, include the tag [[ANSWER_READY:<extracted_answer>]] at the END of your message.
  - <extracted_answer> should be the clean, final value to store — NOT the full conversation, just the answer.
  - For 'select' type: extract one of the valid options.
  - For 'multiselect' type: extract comma-separated valid options.
  - For 'list' type: extract comma-separated items.
  - For 'confirm' type: extract "yes" or "no".
  - For 'text' type: extract the final text value.
- Do NOT include [[ANSWER_READY:...]] until you are confident the answer is solid.
- Keep responses concise (2-4 sentences). No essays.
- Be friendly but efficient — Kevin hates token waste.`;
}

export function useConversationFlow({ moduleSpec }: ConversationFlowOptions) {
  const { spec, updateSpec, markAnswered } = moduleSpec;

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const sessionIdRef = useRef(`modulebuilder-${Date.now()}`);
  const abortRef = useRef(false);

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

  // ─── LLM Call ──────────────────────────────────────────────────────

  const sendToLLM = useCallback(
    async (userMessage: string, question: InterviewQuestion, section: SectionId): Promise<string> => {
      const sessionKey = `agent:froggo:modulebuilder:${sessionIdRef.current}:${question.id}`;

      // Build the full prompt: system context + user message
      const systemPrompt = buildSystemPrompt(question, section, spec);
      const fullMessage = `${systemPrompt}\n\n---\n\nUser: ${userMessage}`;

      return new Promise<string>((resolve) => {
        let accumulated = '';

        gateway.sendChatWithCallbacks(fullMessage, sessionKey, {
          onDelta: (delta) => {
            accumulated += delta;
          },
          onEnd: () => {
            resolve(accumulated);
          },
          onError: (error) => {
            console.error('Module Builder LLM error:', error);
            resolve(accumulated || 'Sorry, I had trouble processing that. Could you try again?');
          },
        });
      });
    },
    [spec],
  );

  // ─── Advance Logic ────────────────────────────────────────────────

  const advanceToNextQuestion = useCallback(() => {
    const questions = getApplicableQuestions(currentSection, spec);
    const nextIdx = currentQuestionIndex + 1;

    if (nextIdx < questions.length) {
      setCurrentQuestionIndex(nextIdx);
      const nextQ = questions[nextIdx];
      if (nextQ) {
        addMessage('assistant', nextQ.text, currentSection);
      }
    } else {
      const nextSectionIdx = currentSectionIndex + 1;
      if (nextSectionIdx < SECTION_ORDER.length) {
        setCurrentSectionIndex(nextSectionIdx);
        setCurrentQuestionIndex(0);
        const nextSec = SECTION_ORDER[nextSectionIdx];
        const nextQuestions = getApplicableQuestions(nextSec, spec);
        addMessage(
          'assistant',
          `Great! Let's move on to **${SECTION_LABELS[nextSec]}**.`,
          nextSec,
        );
        if (nextQuestions[0]) {
          addMessage('assistant', nextQuestions[0].text, nextSec);
        }
      } else {
        setIsFinished(true);
        addMessage(
          'assistant',
          "Interview complete! Your module spec is ready. Click **Generate Tasks** to create the build tasks, or review the spec in the preview panel.",
        );
      }
    }
  }, [currentSection, currentSectionIndex, currentQuestionIndex, spec, addMessage]);

  // ─── User Answer Handler ──────────────────────────────────────────

  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!currentQuestion || isFinished || isStreaming) return;

      // Record user message
      addMessage('user', answer, currentSection);
      setIsStreaming(true);

      try {
        const llmResponse = await sendToLLM(answer, currentQuestion, currentSection);

        // Check if the LLM signaled the answer is ready
        const readyMatch = llmResponse.match(ANSWER_EXTRACT_RE);

        if (readyMatch) {
          // Strip the tag from the displayed message
          const displayContent = llmResponse
            .replace(ANSWER_EXTRACT_RE, '')
            .replace(ANSWER_READY_TAG, '')
            .trim();

          if (displayContent) {
            addMessage('assistant', displayContent, currentSection);
          }

          // Parse the extracted answer through the question's parse function
          const extractedAnswer = readyMatch[1].trim();
          if (currentQuestion.parse) {
            const patch = currentQuestion.parse(extractedAnswer, spec);
            updateSpec(patch);
          }
          markAnswered(currentQuestion.id);
          advanceToNextQuestion();
        } else {
          // LLM wants more info — show response and wait for user's next message
          addMessage('assistant', llmResponse.trim(), currentSection);
        }
      } catch (err) {
        console.error('Module Builder flow error:', err);
        addMessage('assistant', 'Something went wrong. Try answering again.', currentSection);
      } finally {
        setIsStreaming(false);
      }
    },
    [currentQuestion, currentSection, isFinished, isStreaming, spec, addMessage, sendToLLM, updateSpec, markAnswered, advanceToNextQuestion],
  );

  // ─── Start the interview ──────────────────────────────────────────

  const startInterview = useCallback(() => {
    setIsStarted(true);
    setCurrentSectionIndex(0);
    setCurrentQuestionIndex(0);
    setMessages([]);
    setIsFinished(false);
    abortRef.current = false;
    sessionIdRef.current = `modulebuilder-${Date.now()}`;

    addMessage(
      'assistant',
      "Welcome to the Module Builder! I'll walk you through designing your module step by step. We'll take each question at your pace — I'll help clarify and suggest options as we go.\n\nLet's start with **Module Identity**.",
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
      addMessage('assistant', `Revisiting **${SECTION_LABELS[sectionId]}** section.`, sectionId);
      if (questions[0]) {
        addMessage('assistant', questions[0].text, sectionId);
      }
    },
    [spec, addMessage],
  );

  const askCurrentQuestion = useCallback(() => {
    if (currentQuestion) {
      addMessage('assistant', currentQuestion.text, currentSection);
    }
  }, [currentQuestion, currentSection, addMessage]);

  return {
    messages,
    currentSection,
    currentQuestion,
    isStarted,
    isFinished,
    isStreaming,
    startInterview,
    submitAnswer,
    jumpToSection,
    askCurrentQuestion,
  };
}

export type UseConversationFlowReturn = ReturnType<typeof useConversationFlow>;
