import { useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Send, Loader2 } from 'lucide-react';
import { gateway } from '../../lib/gateway';
import { useWritingStore } from '../../store/writingStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import AgentPicker from './AgentPicker';
import FeedbackAlternative from './FeedbackAlternative';

interface FeedbackPopoverProps {
  editor: Editor;
}

function getSelectedText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, ' ');
}

function buildPrompt(
  selectedText: string,
  instructions: string,
  chapterContent: string | null,
  chapters: { id: string; title: string; position: number }[] | undefined,
  agentId: string,
  selectionFrom: number,
): string {
  // Agent-specific preamble
  const agentPreamble: Record<string, string> = {
    writer: 'You are a skilled writing editor focused on style, pacing, and narrative craft.',
    researcher: 'You are a meticulous research editor focused on accuracy, fact-checking, and clarity.',
    jess: 'You are Jess, a compassionate editorial guide focused on emotional impact, sensitivity, and memoir-specific tone.',
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
  ].join('\n');
}

function parseAlternatives(response: string): string[] {
  const parts = response.split(/###\s*Alternative\s*\d+\s*/i);
  return parts.slice(1).map(p => p.trim()).filter(Boolean).slice(0, 3);
}

export default function FeedbackPopover({ editor }: FeedbackPopoverProps) {
  const {
    selectedAgent, instructions, streaming, streamContent, alternatives, error, savedSelection,
    setSelectedAgent, setInstructions, setStreaming, setStreamContent, setAlternatives,
    setError, setSavedSelection, reset,
  } = useFeedbackStore();

  const { activeProjectId, activeChapterId, activeChapterContent, activeProject } = useWritingStore();

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

    const sessionKey = `agent:${selectedAgent}:writing:${activeProjectId}`;
    const prompt = buildPrompt(
      selectedText,
      instructions,
      activeChapterContent,
      activeProject?.chapters,
      selectedAgent,
      from,
    );

    try {
      await gateway.sendChatWithCallbacks(prompt, sessionKey, {
        onDelta: (delta) => {
          accumulatedRef.current += delta;
          setStreamContent(accumulatedRef.current);
        },
        onEnd: () => {
          const parsed = parseAlternatives(accumulatedRef.current);
          setAlternatives(parsed);
          setStreaming(false);

          // Log the feedback interaction
          try {
            (window as any).clawdbot?.writing?.feedback?.log(activeProjectId, {
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
    } catch (e: any) {
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
      (window as any).clawdbot?.writing?.feedback?.log(activeProjectId, {
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
      className="bg-clawd-surface border border-clawd-border rounded-lg shadow-lg p-3 min-w-[320px] max-w-[480px]"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Agent picker row */}
      <AgentPicker selected={selectedAgent} onSelect={setSelectedAgent} disabled={streaming} />

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
          placeholder="How should this be rewritten?"
          className="flex-1 bg-clawd-bg border border-clawd-border rounded px-2 py-1.5 text-sm text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-clawd-accent"
          disabled={streaming}
          autoFocus
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
          {alternatives.map((alt, i) => (
            <FeedbackAlternative key={i} index={i} text={alt} onAccept={handleAccept} />
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
        <div className="mt-2 text-sm text-red-400">{error}</div>
      )}
    </div>
  );
}
