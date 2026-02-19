import { useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Send, Loader2, ShieldCheck } from 'lucide-react';
import { gateway } from '../../lib/gateway';
import { buildMemoryContext } from '../../lib/writingContext';
import { useWritingStore } from '../../store/writingStore';
import { useFeedbackStore, type ParsedAlternative } from '../../store/feedbackStore';
import { useMemoryStore } from '../../store/memoryStore';
import { useResearchStore } from '../../store/researchStore';
import AgentPicker from './AgentPicker';
import FeedbackAlternative from './FeedbackAlternative';

interface FeedbackPopoverProps {
  editor: Editor;
}

function getSelectedText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, ' ');
}

function responseFormat(agentId: string): string[] {
  if (agentId === 'jess') {
    return [
      '## Response Format',
      'Provide exactly 3 alternative versions of the highlighted text.',
      'For each alternative, include a brief explanation of its emotional dimension.',
      'Format each alternative as:',
      '',
      '### Alternative 1',
      '[rewritten text]',
      '',
      '**Why:** [1-2 sentences explaining the emotional impact, boundary consideration, or tone shift this version achieves]',
      '',
      '### Alternative 2',
      '[rewritten text]',
      '',
      '**Why:** [1-2 sentences]',
      '',
      '### Alternative 3',
      '[rewritten text]',
      '',
      '**Why:** [1-2 sentences]',
    ];
  }
  return [
    '## Response Format',
    'Provide exactly 3 alternative versions of the highlighted text.',
    'Format each alternative as:',
    '',
    '### Alternative 1',
    '[rewritten text]',
    '',
    '### Alternative 2',
    '[rewritten text]',
    '',
    '### Alternative 3',
    '[rewritten text]',
  ];
}

function buildPrompt(
  selectedText: string,
  instructions: string,
  chapterContent: string | null,
  chapters: { id: string; title: string; position: number }[] | undefined,
  agentId: string,
  selectionFrom: number,
  memoryContext: string,
): string {
  // Agent-specific preamble
  const agentPreamble: Record<string, string> = {
    writer: 'You are a skilled writing editor focused on style, pacing, and narrative craft.',
    researcher: 'You are a meticulous research editor focused on accuracy, fact-checking, and clarity.',
    jess: [
      'You are Jess, a therapist and editorial guide who understands memoir as psychological integration, not just storytelling.',
      'You focus on: emotional impact on the reader, emotional cost to the writer, pacing of sensitive disclosure,',
      'boundary awareness (what to reveal vs. what to protect), tone calibration (honesty without trauma performance),',
      'and the relationship between how something is written and what it does psychologically for the person writing it.',
      'You are warm but direct. You name what you see clearly and precisely. You do not use therapy cliches or empty validation.',
      'When you suggest alternatives, explain WHY each version handles the emotional dimension differently.',
    ].join(' '),
  };

  // Truncate chapter context to ~2000 words around selection position
  let contextWindow = '';
  if (chapterContent) {
    const charOffset = Math.min(selectionFrom * 5, chapterContent.length); // rough char estimate
    const windowSize = 8000;
    const start = Math.max(0, charOffset - windowSize);
    const end = Math.min(chapterContent.length, charOffset + windowSize);
    contextWindow = chapterContent.slice(start, end);
    if (start > 0) contextWindow = '...' + contextWindow;
    if (end < chapterContent.length) contextWindow += '...';
  }

  // Build outline from chapter titles
  let outline = '(no outline available)';
  if (chapters && chapters.length > 0) {
    outline = chapters
      .sort((a, b) => a.position - b.position)
      .map((ch, i) => `${i + 1}. ${ch.title}`)
      .join('\n');
  }

  return [
    agentPreamble[agentId] || agentPreamble.writer,
    '',
    '## Task',
    'The user has highlighted the following text and wants feedback:',
    '',
    '### Selected Text',
    `"${selectedText}"`,
    '',
    '### User Instructions',
    instructions,
    '',
    '### Chapter Context',
    contextWindow || '(no chapter content available)',
    '',
    '### Project Outline',
    outline,
    '',
    ...(memoryContext ? ['### Story Context (Memory)', memoryContext, ''] : []),
    ...responseFormat(agentId),
  ].join('\n');
}

function parseAlternatives(response: string, agentId?: string): ParsedAlternative[] {
  const parts = response.split(/###\s*Alternative\s*\d+\s*/i);
  return parts.slice(1).map(p => {
    if (agentId === 'jess') {
      const whyMatch = p.match(/\*\*Why:\*\*\s*([\s\S]*?)$/i);
      if (whyMatch) {
        const text = p.slice(0, whyMatch.index).trim();
        const commentary = whyMatch[1].trim();
        return { text, commentary };
      }
    }
    return { text: p.trim() };
  }).filter(a => a.text).slice(0, 3);
}

function buildFactCheckPrompt(
  claim: string,
  chapterContent: string | null,
  sources: { title: string; author: string; type: string }[],
  facts: { claim: string; source: string; status: string }[],
): string {
  const sourcesList = sources.length > 0
    ? sources.map((s) => `- "${s.title}" by ${s.author} (${s.type})`).join('\n')
    : '(no sources in library yet)';

  const factsList = facts.length > 0
    ? facts.map((f) => `- [${f.status}] ${f.claim}`).join('\n')
    : '(no facts recorded yet)';

  // Truncate chapter context around claim position
  let contextWindow = '(no chapter content available)';
  if (chapterContent) {
    const idx = chapterContent.indexOf(claim.slice(0, 40));
    const start = Math.max(0, (idx >= 0 ? idx : 0) - 4000);
    const end = Math.min(chapterContent.length, (idx >= 0 ? idx : 0) + 4000);
    contextWindow = chapterContent.slice(start, end);
    if (start > 0) contextWindow = '...' + contextWindow;
    if (end < chapterContent.length) contextWindow += '...';
  }

  return [
    'You are a meticulous research editor focused on accuracy and fact-checking.',
    '',
    '## Task',
    'The user has highlighted a claim and wants you to fact-check it.',
    '',
    '### Claim to Verify',
    `"${claim}"`,
    '',
    '### Chapter Context',
    contextWindow,
    '',
    '### Research Library (existing sources)',
    sourcesList,
    '',
    '### Known Facts',
    factsList,
    '',
    '## Response Format',
    'Respond with:',
    '1. **Verdict:** VERIFIED | DISPUTED | NEEDS MORE RESEARCH',
    '2. **Confidence:** HIGH | MEDIUM | LOW',
    '3. **Explanation:** Brief explanation of your finding',
    '4. **Suggested Sources:** If you can identify specific sources that would help verify this claim',
    '5. **Suggested Status:** What status this fact should have (verified/disputed/needs-source)',
  ].join('\n');
}

export default function FeedbackPopover({ editor }: FeedbackPopoverProps) {
  const {
    selectedAgent, instructions, streaming, streamContent, alternatives, error, savedSelection,
    setSelectedAgent, setInstructions, setStreaming, setStreamContent, setAlternatives,
    setError, setSavedSelection, reset,
  } = useFeedbackStore();

  const { activeProjectId, activeChapterId, activeChapterContent, activeProject } = useWritingStore();
  const { characters, timeline, facts } = useMemoryStore();
  const { sources } = useResearchStore();

  // Use ref for accumulating stream content (closures capture stale state)
  const accumulatedRef = useRef('');

  const handleSend = async () => {
    const selectedText = getSelectedText(editor);
    if (!selectedText || !instructions.trim()) return;

    // Save current selection range for reliable accept after streaming
    const { from, to } = editor.state.selection;
    setSavedSelection({ from, to });

    setStreaming(true);
    setStreamContent('');
    setAlternatives([]);
    setError(null);
    accumulatedRef.current = '';

    const sessionKey = `agent:${selectedAgent}:writing:${activeProjectId}:feedback`;
    const memoryContext = buildMemoryContext(characters, timeline, facts);
    const prompt = buildPrompt(
      selectedText,
      instructions,
      activeChapterContent,
      activeProject?.chapters,
      selectedAgent,
      from,
      memoryContext,
    );

    try {
      await gateway.sendChatWithCallbacks(prompt, sessionKey, {
        onDelta: (delta) => {
          accumulatedRef.current += delta;
          setStreamContent(accumulatedRef.current);
        },
        onEnd: () => {
          const parsed = parseAlternatives(accumulatedRef.current, selectedAgent);
          setAlternatives(parsed);
          setStreaming(false);

          // Log the feedback interaction
          try {
            window.clawdbot?.writing?.feedback?.log(activeProjectId || '', {
              chapterId: activeChapterId,
              agentId: selectedAgent,
              selectedText,
              instructions,
              alternatives: parsed,
              accepted: null,
              selectionRange: { from, to },
            });
          } catch {
            // Logging failure should not block UX
          }
        },
        onError: (err) => {
          setError(typeof err === 'string' ? err : 'An error occurred');
          setStreaming(false);
        },
      });
    } catch (e: unknown) {
      setError(e.message || 'Failed to send');
      setStreaming(false);
    }
  };

  const handleFactCheck = async () => {
    const claim = getSelectedText(editor);
    if (!claim || streaming) return;

    // Save selection
    const { from, to } = editor.state.selection;
    setSavedSelection({ from, to });

    // Force researcher agent for fact-checking
    setSelectedAgent('researcher');
    setStreaming(true);
    setStreamContent('');
    setAlternatives([]);
    setError(null);
    accumulatedRef.current = '';

    const sessionKey = `agent:researcher:writing:${activeProjectId}:feedback`;
    const prompt = buildFactCheckPrompt(claim, activeChapterContent, sources, facts);

    try {
      await gateway.sendChatWithCallbacks(prompt, sessionKey, {
        onDelta: (delta) => {
          accumulatedRef.current += delta;
          setStreamContent(accumulatedRef.current);
        },
        onEnd: () => {
          // Fact-check results are displayed as raw stream content (no alternative parsing)
          setStreamContent(accumulatedRef.current);
          setStreaming(false);

          // Log as fact-check interaction
          try {
            window.clawdbot?.writing?.feedback?.log(activeProjectId || '', {
              type: 'fact-check',
              chapterId: activeChapterId,
              agentId: 'researcher',
              selectedText: claim,
              instructions: '(fact-check)',
              result: accumulatedRef.current,
              accepted: null,
              selectionRange: { from, to },
            });
          } catch {
            // Logging failure should not block UX
          }
        },
        onError: (err) => {
          setError(typeof err === 'string' ? err : 'An error occurred');
          setStreaming(false);
        },
      });
    } catch (e: unknown) {
      setError(e.message || 'Failed to send');
      setStreaming(false);
    }
  };

  const handleAccept = (alternativeText: string) => {
    // Use saved selection if available (selection may have shifted during streaming)
    const range = savedSelection || {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };

    editor
      .chain()
      .focus()
      .insertContentAt({ from: range.from, to: range.to }, alternativeText, {
        updateSelection: true,
      })
      .run();

    // Collapse selection to prevent BubbleMenu flicker (Pitfall 1)
    editor.commands.setTextSelection(range.from + alternativeText.length);

    // Log the accept
    try {
      window.clawdbot?.writing?.feedback?.log(activeProjectId || '', {
        chapterId: activeChapterId,
        agentId: selectedAgent,
        selectedText: getSelectedText(editor),
        instructions,
        alternatives,
        accepted: alternativeText,
        selectionRange: range,
      });
    } catch {
      // Logging failure should not block UX
    }

    reset();
  };

  const handleDismiss = () => {
    reset();
    // Collapse selection so BubbleMenu hides
    editor.commands.setTextSelection(editor.state.selection.to);
  };

  return (
    <div
      role="toolbar"
      aria-label="Writing feedback tools"
      className="bg-clawd-surface border border-clawd-border rounded-lg shadow-lg p-3 min-w-[320px] max-w-[480px]"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Agent picker row + fact check */}
      <div className="flex items-center justify-between">
        <AgentPicker selected={selectedAgent} onSelect={setSelectedAgent} disabled={streaming} />
        <button
          onClick={handleFactCheck}
          disabled={streaming}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-clawd-text-dim hover:text-clawd-accent hover:bg-clawd-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Fact-check highlighted claim"
        >
          <ShieldCheck className="w-3 h-3" />
          <span>Fact Check</span>
        </button>
      </div>

      {/* Instruction input + send button */}
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            selectedAgent === 'jess' ? 'How should this feel?'
              : selectedAgent === 'researcher' ? 'What should be checked?'
              : 'How should this be rewritten?'
          }
          className="flex-1 bg-clawd-bg border border-clawd-border rounded px-2 py-1.5 text-sm text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-clawd-accent"
          disabled={streaming}
        />
        <button
          onClick={handleSend}
          disabled={streaming || !instructions.trim()}
          className="px-2 py-1.5 rounded bg-clawd-accent/20 text-clawd-accent hover:bg-clawd-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {/* Streaming content (raw text while streaming) */}
      {streaming && streamContent && (
        <div className="mt-2 text-sm text-clawd-text-dim max-h-[200px] overflow-y-auto">
          <pre className="whitespace-pre-wrap font-sans">{streamContent}</pre>
        </div>
      )}

      {/* Parsed alternatives (after streaming completes) */}
      {!streaming && alternatives.length > 0 && (
        <div className="mt-2 space-y-2">
          {alternatives.map((alt) => (
            <FeedbackAlternative key={alt.text} index={alternatives.indexOf(alt)} text={alt.text} commentary={alt.commentary} onAccept={handleAccept} />
          ))}
          <button
            onClick={handleDismiss}
            className="text-xs text-clawd-text-dim hover:text-clawd-text transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-2 text-sm text-error">{error}</div>
      )}
    </div>
  );
}
