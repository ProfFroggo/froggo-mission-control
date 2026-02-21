/**
 * useConversationFlow — LLM-connected conversational interview.
 * Each question is explored via back-and-forth with the LLM until
 * the answer is solid, then the LLM signals readiness to advance.
 * After key sections, generates wireframes and task plans on the right panel.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { ConversationMessage, SectionId, InterviewQuestion, ModuleSpec } from './types';
import { SECTION_ORDER, SECTION_LABELS } from './types';
import { getApplicableQuestions } from './questionBank';
import { gateway } from '../../lib/gateway';
import type { UseModuleSpecReturn } from './useModuleSpec';

// Sentinel the LLM embeds when the current question's answer is complete
const ANSWER_EXTRACT_RE = /\[\[ANSWER_READY:(.+?)\]\]/s;

/** A single task in the live build plan */
export interface LiveTask {
  title: string;
  agent: string;
  subtasks: string[];
  plan: string;
  section: SectionId;
}

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

function buildWireframePrompt(spec: Partial<ModuleSpec>): string {
  return `You are a UI wireframe generator. Given this module spec, create an ASCII wireframe showing the layout.

## Module Spec:
${JSON.stringify(spec, null, 2)}

## Rules:
- Use box-drawing characters (┌─┐│└─┘├┤┬┴┼) for borders
- Show the layout type (${spec.layout || 'single-panel'})
- Label each view/section clearly
- Show component placements (charts, tables, forms, etc.)
- Include a header bar with module name and nav if applicable
- Keep it under 30 lines, 60 chars wide
- Output ONLY the wireframe, no explanations`;
}

function buildTaskPlanPrompt(spec: Partial<ModuleSpec>, section: SectionId): string {
  const agentList = 'coder, senior-coder, designer, lead-engineer, writer, researcher';

  return `You are a project planner for the Froggo agent platform. Generate build tasks for a new dashboard module based on the spec so far.

## Module Spec:
${JSON.stringify(spec, null, 2)}

## Section just completed: ${section}

## Available agents: ${agentList}

## Agent assignment rules:
- designer: UI/UX work, wireframes, styling, component design
- coder: Standard implementation, views, components, store slices
- senior-coder: Complex services, IPC handlers, API integrations, architecture
- lead-engineer: System design decisions, module scaffold, registration
- writer: Documentation, README, inline docs
- researcher: API research, library evaluation

## Output format (strict JSON array):
[
  {
    "title": "task title",
    "agent": "agent-id",
    "subtasks": ["subtask 1", "subtask 2"],
    "plan": "1-2 sentence implementation approach"
  }
]

Generate tasks ONLY for what's been defined so far. Output ONLY the JSON array, no markdown fences, no explanation.`;
}

export function useConversationFlow({ moduleSpec }: ConversationFlowOptions) {
  const { spec, updateSpec, markAnswered } = moduleSpec;

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // Live preview state
  const [wireframe, setWireframe] = useState('');
  const [liveTasks, setLiveTasks] = useState<LiveTask[]>([]);

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

  const callLLM = useCallback(
    async (prompt: string, sessionSuffix: string): Promise<string> => {
      const sessionKey = `agent:chief:modulebuilder:${sessionIdRef.current}:${sessionSuffix}`;

      return new Promise<string>((resolve) => {
        let accumulated = '';
        let resolved = false;

        const safeResolve = (val: string) => {
          if (!resolved) { resolved = true; resolve(val); }
        };

        // Timeout: resolve after 60s if nothing comes back
        const timeout = setTimeout(() => {
          console.warn('[ModuleBuilder] LLM timeout for', sessionSuffix);
          safeResolve(accumulated || '');
        }, 60000);

        gateway.sendChatWithCallbacks(prompt, sessionKey, {
          onDelta: (delta) => {
            accumulated += delta;
          },
          onEnd: () => {
            clearTimeout(timeout);
            safeResolve(accumulated);
          },
          onError: (error) => {
            clearTimeout(timeout);
            console.error('Module Builder LLM error:', error);
            safeResolve(accumulated || '');
          },
        }).catch((err) => {
          clearTimeout(timeout);
          console.error('Module Builder gateway error:', err);
          safeResolve('');
        });
      });
    },
    [],
  );

  const sendToLLM = useCallback(
    async (userMessage: string, question: InterviewQuestion, section: SectionId): Promise<string> => {
      const systemPrompt = buildSystemPrompt(question, section, spec);
      const fullMessage = `${systemPrompt}\n\n---\n\nUser: ${userMessage}`;
      return callLLM(fullMessage, question.id);
    },
    [spec, callLLM],
  );

  // ─── Background generators (wireframe + tasks) ────────────────────

  const generateWireframe = useCallback(
    async (currentSpec: Partial<ModuleSpec>) => {
      const prompt = buildWireframePrompt(currentSpec);
      const result = await callLLM(prompt, 'wireframe');
      if (result.trim()) {
        setWireframe(result.trim());
      }
    },
    [callLLM],
  );

  const generateTasksForSection = useCallback(
    async (currentSpec: Partial<ModuleSpec>, section: SectionId) => {
      const prompt = buildTaskPlanPrompt(currentSpec, section);
      const result = await callLLM(prompt, `tasks-${section}`);
      try {
        // Strip markdown fences if LLM wrapped it
        const cleaned = result.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
        const tasks: LiveTask[] = JSON.parse(cleaned);
        if (Array.isArray(tasks)) {
          setLiveTasks(tasks.map(t => ({ ...t, section })));
        }
      } catch {
        // Parse failed — keep existing tasks
        console.warn('Task plan parse failed:', result.slice(0, 200));
      }
    },
    [callLLM],
  );

  // ─── Section completion handler ───────────────────────────────────

  const onSectionComplete = useCallback(
    (completedSection: SectionId, latestSpec: Partial<ModuleSpec>) => {
      // After features section (has views/layout info) → generate wireframe
      if (completedSection === 'features' || completedSection === 'type') {
        generateWireframe(latestSpec);
      }
      // After every section → regenerate task plan with latest spec
      generateTasksForSection(latestSpec, completedSection);
    },
    [generateWireframe, generateTasksForSection],
  );

  // ─── Advance Logic ────────────────────────────────────────────────

  const advanceToNextQuestion = useCallback(
    (latestSpec?: Partial<ModuleSpec>) => {
      const specSnapshot = latestSpec || spec;
      const questions = getApplicableQuestions(currentSection, specSnapshot);
      const nextIdx = currentQuestionIndex + 1;

      if (nextIdx < questions.length) {
        setCurrentQuestionIndex(nextIdx);
        const nextQ = questions[nextIdx];
        if (nextQ) {
          addMessage('assistant', nextQ.text, currentSection);
        }
      } else {
        // Section complete — trigger background generation
        onSectionComplete(currentSection, specSnapshot);

        const nextSectionIdx = currentSectionIndex + 1;
        if (nextSectionIdx < SECTION_ORDER.length) {
          setCurrentSectionIndex(nextSectionIdx);
          setCurrentQuestionIndex(0);
          const nextSec = SECTION_ORDER[nextSectionIdx];
          const nextQuestions = getApplicableQuestions(nextSec, specSnapshot);
          addMessage(
            'assistant',
            `Great! Let's move on to **${SECTION_LABELS[nextSec]}**.`,
            nextSec,
          );
          if (nextQuestions[0]) {
            addMessage('assistant', nextQuestions[0].text, nextSec);
          }
        } else {
          // All sections complete — final wireframe + task generation
          onSectionComplete('settings', specSnapshot);
          if (!wireframe) generateWireframe(specSnapshot);
          setIsFinished(true);
          addMessage(
            'assistant',
            "Interview complete! Your module spec, wireframe, and task plan are ready in the preview panel. Click **Generate Tasks** to push them to froggo-db.",
          );
        }
      }
    },
    [currentSection, currentSectionIndex, currentQuestionIndex, spec, addMessage, onSectionComplete, generateWireframe, wireframe],
  );

  // ─── User Answer Handler ──────────────────────────────────────────

  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!currentQuestion || isFinished || isStreaming) return;

      addMessage('user', answer, currentSection);
      setIsStreaming(true);

      try {
        const llmResponse = await sendToLLM(answer, currentQuestion, currentSection);
        const readyMatch = llmResponse.match(ANSWER_EXTRACT_RE);

        if (readyMatch) {
          const displayContent = llmResponse
            .replace(ANSWER_EXTRACT_RE, '')
            .trim();

          if (displayContent) {
            addMessage('assistant', displayContent, currentSection);
          }

          const extractedAnswer = readyMatch[1].trim();
          let latestSpec = spec;
          if (currentQuestion.parse) {
            const patch = currentQuestion.parse(extractedAnswer, spec);
            updateSpec(patch);
            latestSpec = { ...spec, ...patch };
          }
          markAnswered(currentQuestion.id);
          advanceToNextQuestion(latestSpec);
        } else {
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
    setWireframe('');
    setLiveTasks([]);
    abortRef.current = false;
    sessionIdRef.current = `modulebuilder-${Date.now()}`;

    addMessage(
      'assistant',
      "Welcome to the Module Builder! I'll walk you through designing your module step by step. As we go, the wireframe and task plan will build up on the right.\n\nLet's start with **Module Identity**.",
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
    wireframe,
    liveTasks,
    startInterview,
    submitAnswer,
    jumpToSection,
    askCurrentQuestion,
  };
}

export type UseConversationFlowReturn = ReturnType<typeof useConversationFlow>;
