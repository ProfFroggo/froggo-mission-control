/**
 * useConversationFlow — LLM-powered conversational interview for Module Builder.
 *
 * Primary: sends each user answer to Chief agent via gateway.sendChatWithCallbacks()
 * (same proven pattern as XAgentChatPane) for a real conversational experience.
 *
 * Fallback: local validation handles answers if the LLM is unavailable.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { ConversationMessage, SectionId, InterviewQuestion, ModuleSpec } from './types';
import { SECTION_ORDER, SECTION_LABELS } from './types';
import { getApplicableQuestions } from './questionBank';
import { gateway } from '../../lib/gateway';
import type { UseModuleSpecReturn } from './useModuleSpec';

const ANSWER_EXTRACT_RE = /\[\[ANSWER_READY:(.+?)\]\]/s;

/** A single task in the live build plan */
export interface LiveTask {
  title: string;
  agent: string;
  subtasks: string[];
  plan: string;
  section: SectionId;
}

export interface ConversationFlowState {
  messages: ConversationMessage[];
  sectionIndex: number;
  questionIndex: number;
  isStarted: boolean;
  isFinished: boolean;
  sessionKey: string;
  wireframe: string;
  liveTasks: LiveTask[];
}

interface ConversationFlowOptions {
  moduleSpec: UseModuleSpecReturn;
  initialState?: Partial<ConversationFlowState>;
}

// ─── Local conversation intelligence (fallback) ──────────────────────

function isUserQuestion(text: string): boolean {
  const t = text.trim();
  if (t.endsWith('?')) return true;
  const lower = t.toLowerCase();
  return /^(what|which|how|can|should|where|why|do|is|are|tell me|show me|list|help)\b/.test(lower);
}

function isVague(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return /^(idk|i don'?t know|dunno|no idea|not sure|unsure|whatever|anything|something|stuff|things|tbd|todo|later|skip|pass|meh|hmm+|ok|eh)$/i.test(lower)
    || /^\.+$/.test(lower) || /^[?!]+$/.test(lower);
}

function matchOption(answer: string, options: string[]): string | null {
  const lower = answer.toLowerCase().trim();
  const exact = options.find(o => o.toLowerCase() === lower);
  if (exact) return exact;
  const partial = options.find(o =>
    lower.includes(o.toLowerCase()) || o.toLowerCase().includes(lower)
  );
  if (partial) return partial;
  return null;
}

function handleLocally(
  answer: string,
  question: InterviewQuestion,
): { accept: boolean; value: string; message: string } {
  const text = answer.trim();

  if (isUserQuestion(text)) {
    if (question.inputType === 'select' && question.options?.length) {
      return { accept: false, value: '', message: `Your options are:\n\n${question.options.map(o => `• **${o}**`).join('\n')}\n\nWhich one fits best?` };
    }
    if (question.inputType === 'confirm') {
      return { accept: false, value: '', message: `Just need a **yes** or **no** on this one.` };
    }
    if (question.inputType === 'multiselect' && question.options?.length) {
      return { accept: false, value: '', message: `Pick any combination of:\n\n${question.options.map(o => `• **${o}**`).join('\n')}\n\nList the ones you want, separated by commas.` };
    }
    if (question.inputType === 'list') {
      return { accept: false, value: '', message: `Give me a comma-separated list, or say **none** if not applicable.` };
    }
    return { accept: false, value: '', message: `Give it your best shot — we can always revisit later.` };
  }

  if (isVague(text)) {
    if (question.inputType === 'select' && question.options?.length) {
      return { accept: false, value: '', message: `I need a concrete pick here. Options: **${question.options.join('**, **')}**` };
    }
    return { accept: false, value: '', message: `I need a bit more than that! ${question.text}` };
  }

  if (question.inputType === 'select' && question.options?.length) {
    const matched = matchOption(text, question.options);
    if (matched) return { accept: true, value: matched, message: `**${matched}** — got it.` };
    return { accept: false, value: '', message: `"${text}" doesn't match any option. Pick one: **${question.options.join('**, **')}**` };
  }

  if (question.inputType === 'confirm') {
    if (/^(y|yes|yeah|yep|sure|true|1|absolutely|definitely|of course)/i.test(text)) {
      return { accept: true, value: 'yes', message: `**Yes** — noted.` };
    }
    if (/^(n|no|nah|nope|false|0|not really|probably not)/i.test(text)) {
      return { accept: true, value: 'no', message: `**No** — got it.` };
    }
    return { accept: false, value: '', message: `Just need **yes** or **no** on this one.` };
  }

  if (question.inputType === 'multiselect' && question.options?.length) {
    const parts = text.split(/[,&]/).map(p => p.trim().toLowerCase()).filter(Boolean);
    const matched = parts.map(p => matchOption(p, question.options!)).filter(Boolean) as string[];
    if (matched.length > 0) return { accept: true, value: matched.join(', '), message: `**${matched.join(', ')}** — locked in.` };
    const wholeMatch = question.options.filter(o => text.toLowerCase().includes(o.toLowerCase()));
    if (wholeMatch.length > 0) return { accept: true, value: wholeMatch.join(', '), message: `**${wholeMatch.join(', ')}** — locked in.` };
    return { accept: false, value: '', message: `Didn't match any options. Available: **${question.options.join('**, **')}**\n\nList the ones you want, separated by commas.` };
  }

  if (question.inputType === 'list') {
    if (/^(none|n\/a|no|nothing|nope)$/i.test(text)) return { accept: true, value: 'none', message: `**None** — moving on.` };
    const items = text.split(',').map(s => s.trim()).filter(Boolean);
    if (items.length > 0) return { accept: true, value: text, message: `Got it — **${items.join(', ')}**.` };
    return { accept: false, value: '', message: `Give me a comma-separated list, or say **none**.` };
  }

  if (question.inputType === 'text') {
    if (question.targets?.includes('description') && text.length < 10) {
      return { accept: false, value: '', message: `Can you give me a fuller description? One sentence is fine.` };
    }
    return { accept: true, value: text, message: `**${text.length > 60 ? text.slice(0, 57) + '...' : text}** — nice.` };
  }

  return { accept: true, value: text, message: `**${text}** — got it.` };
}

// ─── LLM prompt builders ─────────────────────────────────────────────

const BOOTSTRAP = `You are the Module Builder assistant in the Froggo dashboard. You guide Kevin through designing a new dashboard module via a conversational interview.

Rules:
- Be concise (2-3 sentences max). Be direct and conversational, like a coworker.
- Work through one question at a time.
- If the answer is vague or unclear, push back and ask for clarification.
- When you're satisfied with an answer, end your message with [[ANSWER_READY:<value>]] where <value> is the clean extracted answer.
- For select questions: extract one of the valid options exactly as listed. For lists: comma-separated values. For confirm: "yes" or "no". For text: the clean text value.
- Do NOT include [[ANSWER_READY:...]] if the answer needs clarification.
- If the user asks a question instead of answering, help them understand the options, then re-ask.`;

function buildQuestionPrompt(
  question: InterviewQuestion,
  section: SectionId,
  answer: string,
  isFirst: boolean,
): string {
  const parts: string[] = [];
  if (isFirst) parts.push(BOOTSTRAP);
  parts.push(`\n[Section: ${SECTION_LABELS[section]}] Question (${question.inputType}): ${question.text}`);
  if (question.options?.length) parts.push(`Valid options: ${question.options.join(', ')}`);
  parts.push(`\nUser says: "${answer}"`);
  return parts.join('\n');
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useConversationFlow({ moduleSpec, initialState }: ConversationFlowOptions) {
  const { spec, updateSpec, markAnswered } = moduleSpec;

  const [messages, setMessages] = useState<ConversationMessage[]>(initialState?.messages || []);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(initialState?.sectionIndex || 0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialState?.questionIndex || 0);
  const [isStarted, setIsStarted] = useState(initialState?.isStarted || false);
  const [isFinished, setIsFinished] = useState(initialState?.isFinished || false);
  const [isStreaming, setIsStreaming] = useState(false);

  const [wireframe, setWireframe] = useState(initialState?.wireframe || '');
  const [liveTasks, setLiveTasks] = useState<LiveTask[]>(initialState?.liveTasks || []);

  const sessionKeyRef = useRef(initialState?.sessionKey || '');
  const bootstrapSentRef = useRef(!!initialState?.isStarted);

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
      setMessages(prev => [...prev, msg]);
      return msg;
    },
    [],
  );

  // ─── LLM call via sendChatWithCallbacks (same pattern as XAgentChatPane) ──

  const sendToLLM = useCallback(
    (message: string, timeoutMs = 30000): Promise<string> => {
      return new Promise((resolve, reject) => {
        let accumulated = '';
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) { resolved = true; reject(new Error('timeout')); }
        }, timeoutMs);

        const finish = (result: string) => {
          if (!resolved) { resolved = true; clearTimeout(timer); resolve(result); }
        };
        const fail = (err: Error) => {
          if (!resolved) { resolved = true; clearTimeout(timer); reject(err); }
        };

        gateway.sendChatWithCallbacks(message, sessionKeyRef.current, {
          onDelta: (delta) => { accumulated += delta; },
          onMessage: (content) => { accumulated = content; },
          onEnd: () => finish(accumulated),
          onError: (error) => fail(new Error(error)),
        }).then(runId => {
          if (!runId) fail(new Error('no runId returned'));
        }).catch(fail);
      });
    },
    [],
  );

  // ─── Background generators (fire-and-forget LLM calls) ────────────

  const tryLLMQuiet = useCallback(
    async (message: string): Promise<string> => {
      try { return await sendToLLM(message, 15000); } catch { return ''; }
    },
    [sendToLLM],
  );

  const generateWireframe = useCallback(
    async (currentSpec: Partial<ModuleSpec>) => {
      const prompt = `Generate an ASCII wireframe for this module layout. Type: ${currentSpec.type}, Layout: ${currentSpec.layout}, Views: ${currentSpec.views?.map(v => v.name).join(', ') || 'none'}, Components: ${currentSpec.components?.map(c => c.type).join(', ') || 'none'}. Use box-drawing chars, keep under 25 lines, 60 chars wide. Output ONLY the wireframe, no [[ANSWER_READY]] tag.`;
      const result = await tryLLMQuiet(prompt);
      const clean = result.replace(ANSWER_EXTRACT_RE, '').trim();
      if (clean) setWireframe(clean);
    },
    [tryLLMQuiet],
  );

  const generateTasksForSection = useCallback(
    async (currentSpec: Partial<ModuleSpec>, section: SectionId) => {
      const agents = 'coder, senior-coder, designer, writer, researcher';
      const prompt = `Generate build tasks for this module. Name: ${currentSpec.name}, Type: ${currentSpec.type}, Views: ${currentSpec.views?.map(v => v.name).join(',') || 'none'}, Services: ${currentSpec.services?.map(s => s.name).join(',') || 'none'}, APIs: ${currentSpec.externalApis?.join(',') || 'none'}. Agents: ${agents}. Output STRICT JSON array: [{"title":"...","agent":"...","subtasks":["..."],"plan":"..."}]. No markdown fences. No [[ANSWER_READY]] tag.`;
      const result = await tryLLMQuiet(prompt);
      try {
        const cleaned = result.replace(ANSWER_EXTRACT_RE, '').replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
        const tasks: LiveTask[] = JSON.parse(cleaned);
        if (Array.isArray(tasks)) setLiveTasks(tasks.map(t => ({ ...t, section })));
      } catch { /* not valid JSON — that's OK */ }
    },
    [tryLLMQuiet],
  );

  const onSectionComplete = useCallback(
    (completedSection: SectionId, latestSpec: Partial<ModuleSpec>) => {
      if (completedSection === 'features' || completedSection === 'type') generateWireframe(latestSpec);
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
          let qText = nextQ.text;
          if ((nextQ.inputType === 'select' || nextQ.inputType === 'multiselect') && nextQ.options?.length) {
            qText += `\n\nOptions: **${nextQ.options.join('**, **')}**`;
          }
          addMessage('assistant', qText, currentSection);
        }
      } else {
        onSectionComplete(currentSection, specSnapshot);
        const nextSectionIdx = currentSectionIndex + 1;
        if (nextSectionIdx < SECTION_ORDER.length) {
          setCurrentSectionIndex(nextSectionIdx);
          setCurrentQuestionIndex(0);
          const nextSec = SECTION_ORDER[nextSectionIdx];
          const nextQuestions = getApplicableQuestions(nextSec, specSnapshot);
          addMessage('assistant', `Section done! Moving to **${SECTION_LABELS[nextSec]}**.`, nextSec);
          if (nextQuestions[0]) {
            let qText = nextQuestions[0].text;
            if ((nextQuestions[0].inputType === 'select' || nextQuestions[0].inputType === 'multiselect') && nextQuestions[0].options?.length) {
              qText += `\n\nOptions: **${nextQuestions[0].options.join('**, **')}**`;
            }
            addMessage('assistant', qText, nextSec);
          }
        } else {
          if (!wireframe) generateWireframe(specSnapshot);
          setIsFinished(true);
          addMessage('assistant', "All done! Your module spec, wireframe, and task plan are ready. Hit **Push to froggo-db** to create the build tasks.");
        }
      }
    },
    [currentSection, currentSectionIndex, currentQuestionIndex, spec, addMessage, onSectionComplete, generateWireframe, wireframe],
  );

  // ─── Apply accepted answer ─────────────────────────────────────────

  const applyAnswer = useCallback(
    (value: string, question: InterviewQuestion, latestSpec: Partial<ModuleSpec>) => {
      let newSpec = latestSpec;
      if (question.parse) {
        const patch = question.parse(value, latestSpec);
        updateSpec(patch);
        newSpec = { ...latestSpec, ...patch };
      }
      markAnswered(question.id);
      advanceToNextQuestion(newSpec);
    },
    [updateSpec, markAnswered, advanceToNextQuestion],
  );

  // ─── User Answer Handler ──────────────────────────────────────────

  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!currentQuestion || isFinished || isStreaming) return;

      addMessage('user', answer, currentSection);
      setIsStreaming(true);

      try {
        // Build prompt for LLM
        const isFirst = !bootstrapSentRef.current;
        const prompt = buildQuestionPrompt(currentQuestion, currentSection, answer, isFirst);
        bootstrapSentRef.current = true;

        // Send to LLM via sendChatWithCallbacks — 30s timeout
        const response = await sendToLLM(prompt, 30000);

        if (response.trim()) {
          const match = response.match(ANSWER_EXTRACT_RE);
          if (match) {
            // LLM accepted the answer — extract value, show response, advance
            const value = match[1].trim();
            const display = response.replace(ANSWER_EXTRACT_RE, '').trim();
            addMessage('assistant', display || `**${value}** — got it.`, currentSection);
            applyAnswer(value, currentQuestion, spec);
          } else {
            // LLM responded without accepting — it's pushing back or asking follow-up
            addMessage('assistant', response.trim(), currentSection);
          }
        } else {
          // Empty LLM response — fall back to local validation
          const local = handleLocally(answer, currentQuestion);
          addMessage('assistant', local.message, currentSection);
          if (local.accept) applyAnswer(local.value, currentQuestion, spec);
        }
      } catch (err) {
        // LLM unavailable — fall back to local validation
        console.warn('[ModuleBuilder] LLM failed, using local fallback:', (err as Error).message);
        const local = handleLocally(answer, currentQuestion);
        addMessage('assistant', local.message, currentSection);
        if (local.accept) applyAnswer(local.value, currentQuestion, spec);
      } finally {
        setIsStreaming(false);
      }
    },
    [currentQuestion, currentSection, isFinished, isStreaming, spec, addMessage, sendToLLM, applyAnswer],
  );

  // ─── Start ────────────────────────────────────────────────────────

  const startInterview = useCallback(() => {
    // Fresh session key per interview — prevents context accumulation
    const newKey = `agent:chief:mb-${Date.now()}`;
    sessionKeyRef.current = newKey;
    bootstrapSentRef.current = false;

    setIsStarted(true);
    setCurrentSectionIndex(0);
    setCurrentQuestionIndex(0);
    setMessages([]);
    setIsFinished(false);
    setWireframe('');
    setLiveTasks([]);

    // Pre-warm the session on the gateway (fire-and-forget, same as XAgentChatPane)
    if (gateway.connected) {
      gateway.request('chat.send', {
        message: BOOTSTRAP + '\n\nSession initialized. Waiting for the first user answer.',
        sessionKey: newKey,
        idempotencyKey: `warmup-mb-${Date.now()}`,
      }).catch(() => { /* best-effort warmup */ });
    }

    addMessage(
      'assistant',
      "Let's build a module. I'll walk you through the spec — answer each question and we'll shape it together.\n\n**Module Identity** first.",
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
        let qText = questions[0].text;
        if ((questions[0].inputType === 'select' || questions[0].inputType === 'multiselect') && questions[0].options?.length) {
          qText += `\n\nOptions: **${questions[0].options.join('**, **')}**`;
        }
        addMessage('assistant', qText, sectionId);
      }
    },
    [spec, addMessage],
  );

  const askCurrentQuestion = useCallback(() => {
    if (currentQuestion) addMessage('assistant', currentQuestion.text, currentSection);
  }, [currentQuestion, currentSection, addMessage]);

  const getState = useCallback((): ConversationFlowState => ({
    messages,
    sectionIndex: currentSectionIndex,
    questionIndex: currentQuestionIndex,
    isStarted,
    isFinished,
    sessionKey: sessionKeyRef.current,
    wireframe,
    liveTasks,
  }), [messages, currentSectionIndex, currentQuestionIndex, isStarted, isFinished, wireframe, liveTasks]);

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
    getState,
  };
}

export type UseConversationFlowReturn = ReturnType<typeof useConversationFlow>;
