/**
 * useConversationFlow — LLM-connected conversational interview.
 * Uses a single gateway session with Chief agent. System prompt sent once
 * at interview start, then lightweight per-question prompts.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { ConversationMessage, SectionId, InterviewQuestion, ModuleSpec } from './types';
import { SECTION_ORDER, SECTION_LABELS } from './types';
import { getApplicableQuestions } from './questionBank';
import { gateway } from '../../lib/gateway';
import type { UseModuleSpecReturn } from './useModuleSpec';

const ANSWER_EXTRACT_RE = /\[\[ANSWER_READY:(.+?)\]\]/s;

const SESSION_KEY = 'agent:chief:modulebuilder';

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

/** Sent once at interview start to establish context */
function buildBootstrapPrompt(): string {
  return `You are the Module Builder assistant in the Froggo dashboard. You help Kevin design new dashboard modules through a conversational interview.

Rules:
- Work through one question at a time. Ask follow-ups if answers are vague.
- Keep responses to 2-3 sentences. Be direct.
- When an answer is solid, end your message with [[ANSWER_READY:<value>]] where <value> is the clean extracted answer.
- For select questions: extract one valid option. For lists: comma-separated. For confirm: "yes" or "no".
- Do NOT include [[ANSWER_READY:...]] until the answer is clear.
- The right panel builds a live wireframe and task plan as we go.

Ready to start — I'll feed you one question at a time.`;
}

/** Lightweight per-question prompt — no full spec dump */
function buildQuestionPrompt(
  question: InterviewQuestion,
  section: SectionId,
): string {
  const opts = question.options?.length
    ? ` Options: ${question.options.join(', ')}.`
    : '';
  return `[Section: ${SECTION_LABELS[section]}] [${question.inputType}] ${question.text}${opts}`;
}

export function useConversationFlow({ moduleSpec }: ConversationFlowOptions) {
  const { spec, updateSpec, markAnswered } = moduleSpec;

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const [wireframe, setWireframe] = useState('');
  const [liveTasks, setLiveTasks] = useState<LiveTask[]>([]);

  const bootstrapSentRef = useRef(false);

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

  // ─── Gateway call ─────────────────────────────────────────────────

  const sendToGateway = useCallback(
    async (message: string): Promise<string> => {
      return new Promise<string>((resolve) => {
        let accumulated = '';
        let resolved = false;

        const safeResolve = (val: string) => {
          if (!resolved) { resolved = true; resolve(val); }
        };

        const timeout = setTimeout(() => {
          console.warn('[ModuleBuilder] Timeout');
          safeResolve(accumulated || '');
        }, 60000);

        gateway.sendChatWithCallbacks(message, SESSION_KEY, {
          onDelta: (delta) => { accumulated += delta; },
          onEnd: () => { clearTimeout(timeout); safeResolve(accumulated); },
          onError: (error) => {
            clearTimeout(timeout);
            console.error('[ModuleBuilder] Error:', error);
            safeResolve(accumulated || '');
          },
        }).then((runId) => {
          if (!runId) {
            clearTimeout(timeout);
            console.warn('[ModuleBuilder] No runId');
            safeResolve('');
          }
        }).catch((err) => {
          clearTimeout(timeout);
          console.error('[ModuleBuilder] Request failed:', err);
          safeResolve('');
        });
      });
    },
    [],
  );

  // ─── Background generators ────────────────────────────────────────

  const generateWireframe = useCallback(
    async (currentSpec: Partial<ModuleSpec>) => {
      const prompt = `Generate an ASCII wireframe for this module layout. Type: ${currentSpec.type}, Layout: ${currentSpec.layout}, Views: ${currentSpec.views?.map(v => v.name).join(', ') || 'none'}, Components: ${currentSpec.components?.map(c => c.type).join(', ') || 'none'}. Use box-drawing chars, keep under 25 lines, 60 chars wide. Output ONLY the wireframe. [[ANSWER_READY:wireframe]]`;
      const result = await sendToGateway(prompt);
      const clean = result.replace(ANSWER_EXTRACT_RE, '').trim();
      if (clean) setWireframe(clean);
    },
    [sendToGateway],
  );

  const generateTasksForSection = useCallback(
    async (currentSpec: Partial<ModuleSpec>, section: SectionId) => {
      const agents = 'coder, senior-coder, designer, lead-engineer, writer, researcher';
      const prompt = `Generate build tasks for this module. Name: ${currentSpec.name}, Type: ${currentSpec.type}, Views: ${currentSpec.views?.map(v=>v.name).join(',')||'none'}, Services: ${currentSpec.services?.map(s=>s.name).join(',')||'none'}, APIs: ${currentSpec.externalApis?.join(',')||'none'}. Agents: ${agents}. Output STRICT JSON array: [{"title":"...","agent":"...","subtasks":["..."],"plan":"..."}]. No markdown fences. [[ANSWER_READY:tasks]]`;
      const result = await sendToGateway(prompt);
      try {
        const cleaned = result.replace(ANSWER_EXTRACT_RE, '').replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
        const tasks: LiveTask[] = JSON.parse(cleaned);
        if (Array.isArray(tasks)) {
          setLiveTasks(tasks.map(t => ({ ...t, section })));
        }
      } catch {
        console.warn('[ModuleBuilder] Task parse failed');
      }
    },
    [sendToGateway],
  );

  const onSectionComplete = useCallback(
    (completedSection: SectionId, latestSpec: Partial<ModuleSpec>) => {
      if (completedSection === 'features' || completedSection === 'type') {
        generateWireframe(latestSpec);
      }
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
        onSectionComplete(currentSection, specSnapshot);

        const nextSectionIdx = currentSectionIndex + 1;
        if (nextSectionIdx < SECTION_ORDER.length) {
          setCurrentSectionIndex(nextSectionIdx);
          setCurrentQuestionIndex(0);
          const nextSec = SECTION_ORDER[nextSectionIdx];
          const nextQuestions = getApplicableQuestions(nextSec, specSnapshot);
          addMessage('assistant', `Great! Let's move on to **${SECTION_LABELS[nextSec]}**.`, nextSec);
          if (nextQuestions[0]) {
            addMessage('assistant', nextQuestions[0].text, nextSec);
          }
        } else {
          if (!wireframe) generateWireframe(specSnapshot);
          setIsFinished(true);
          addMessage(
            'assistant',
            "Interview complete! Your module spec, wireframe, and task plan are ready. Click **Push to froggo-db** to create the build tasks.",
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
        // Build the message to send
        let prompt = answer;
        if (!bootstrapSentRef.current) {
          // First message: prepend bootstrap + question context
          prompt = buildBootstrapPrompt() + '\n\n' + buildQuestionPrompt(currentQuestion, currentSection) + '\n\nUser: ' + answer;
          bootstrapSentRef.current = true;
        } else {
          // Subsequent: just question context + answer (session has history)
          prompt = buildQuestionPrompt(currentQuestion, currentSection) + '\n\nUser: ' + answer;
        }

        const llmResponse = await sendToGateway(prompt);

        if (!llmResponse.trim()) {
          addMessage('assistant', currentQuestion.text, currentSection);
          return;
        }

        const readyMatch = llmResponse.match(ANSWER_EXTRACT_RE);

        if (readyMatch) {
          const displayContent = llmResponse.replace(ANSWER_EXTRACT_RE, '').trim();
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
        console.error('[ModuleBuilder] Error:', err);
        addMessage('assistant', 'Something went wrong. Try again.', currentSection);
      } finally {
        setIsStreaming(false);
      }
    },
    [currentQuestion, currentSection, isFinished, isStreaming, spec, addMessage, sendToGateway, updateSpec, markAnswered, advanceToNextQuestion],
  );

  // ─── Start ────────────────────────────────────────────────────────

  const startInterview = useCallback(() => {
    setIsStarted(true);
    setCurrentSectionIndex(0);
    setCurrentQuestionIndex(0);
    setMessages([]);
    setIsFinished(false);
    setWireframe('');
    setLiveTasks([]);
    bootstrapSentRef.current = false;

    addMessage(
      'assistant',
      "Welcome to the Module Builder! I'll walk you through designing your module. Wireframe and task plan build up on the right as we go.\n\nLet's start with **Module Identity**.",
    );
    const firstQuestions = getApplicableQuestions('identity', spec);
    if (firstQuestions[0]) {
      addMessage('assistant', firstQuestions[0].text, 'identity');
    }
  }, [spec, addMessage]);

  // ─── Jump to section ──────────────────────────────────────────────

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
