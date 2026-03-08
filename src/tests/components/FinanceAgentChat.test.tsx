/**
 * Tests for src/components/FinanceAgentChat.tsx
 *
 * We mock fetch (SSE stream), chatApi, logger, and Toast to test
 * that the component renders correctly and assembles the stream request properly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ─── Hoist mock functions so vi.mock factories can reference them ──────────────
// vi.mock() calls are hoisted to the top of the file by Vitest, so any `const`
// declarations in the module scope are NOT yet initialised when the factory runs.
// vi.hoisted() runs before hoisting, making the functions available.
const { mockGetMessages, mockSaveMessage, mockDeleteSession } = vi.hoisted(() => ({
  mockGetMessages: vi.fn(async () => [] as unknown[]),
  mockSaveMessage: vi.fn(async () => ({})),
  mockDeleteSession: vi.fn(async () => ({})),
}));

// ─── Mock logger ──────────────────────────────────────────────────────────────
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── Mock Toast ───────────────────────────────────────────────────────────────
vi.mock('../../components/Toast', () => ({
  showToast: vi.fn(),
}));

// ─── Mock lucide-react ────────────────────────────────────────────────────────
// Use importOriginal so all icons resolve (including those used by Toast.tsx).
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    Send: () => null,
    Loader2: () => null,
    X: () => null,
    MessageSquare: () => null,
    Trash2: () => null,
    AlertCircle: () => null,
    // Toast icons
    CheckCircle: () => null,
    XCircle: () => null,
    Info: () => null,
  };
});

// ─── Mock chatApi ─────────────────────────────────────────────────────────────
vi.mock('../../lib/api', () => ({
  chatApi: {
    getMessages: mockGetMessages,
    saveMessage: mockSaveMessage,
    deleteSession: mockDeleteSession,
  },
}));

import FinanceAgentChat from '../../components/FinanceAgentChat';
import { showToast } from '../../components/Toast';

// ─── SSE helpers ──────────────────────────────────────────────────────────────

/** Build a minimal ReadableStream that emits the provided SSE lines, then DONE */
function makeSSEStream(events: Array<{ type: string; [k: string]: unknown }>) {
  const encoder = new TextEncoder();
  const lines: string[] = [
    'data: {"type":"init"}\n\n',
    ...events.map(e => `data: ${JSON.stringify(e)}\n\n`),
    'data: [DONE]\n\n',
  ];

  let idx = 0;
  return new ReadableStream({
    pull(controller) {
      if (idx < lines.length) {
        controller.enqueue(encoder.encode(lines[idx++]));
      } else {
        controller.close();
      }
    },
  });
}

function setupStreamFetch(events: Array<{ type: string; [k: string]: unknown }> = []) {
  // Build the mock fn first — vi.stubGlobal returns the previous value, not the new mock.
  const mockFn = vi.fn(async () => ({
    ok: true,
    body: makeSSEStream(events),
  }));
  vi.stubGlobal('fetch', mockFn);
  return mockFn;
}

describe('FinanceAgentChat component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMessages.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── Empty state ────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('renders "Start a conversation" when there are no messages', async () => {
      setupStreamFetch();
      render(<FinanceAgentChat />);

      await waitFor(() => {
        expect(screen.getByText('Start a conversation')).toBeDefined();
      });
    });

    it('renders helpful prompt suggestions in the empty state', async () => {
      setupStreamFetch();
      render(<FinanceAgentChat />);

      await waitFor(() => {
        expect(screen.getByText(/How much did I spend this month/)).toBeDefined();
      });
    });

    it('shows Finance Manager heading', async () => {
      setupStreamFetch();
      render(<FinanceAgentChat />);

      await waitFor(() => {
        expect(screen.getByText('Finance Manager')).toBeDefined();
      });
    });

    it('renders send button in disabled state when input is empty', async () => {
      setupStreamFetch();
      render(<FinanceAgentChat />);

      await waitFor(() => {
        const sendBtn = screen.getByRole('button', { name: 'Send message' });
        expect(sendBtn).toBeDefined();
        // Should be disabled since input is empty
        expect(sendBtn.hasAttribute('disabled')).toBe(true);
      });
    });

    it('renders the input placeholder text', async () => {
      setupStreamFetch();
      render(<FinanceAgentChat />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Ask about your finances...')).toBeDefined();
      });
    });
  });

  // ─── Message loading ───────────────────────────────────────────────────

  describe('message loading', () => {
    it('loads chat history on mount via chatApi.getMessages', async () => {
      setupStreamFetch();
      render(<FinanceAgentChat />);

      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalledWith('finance-agent');
      });
    });

    it('renders existing messages from chat history', async () => {
      const existingMessages = [
        { id: 'msg-1', role: 'user', content: 'Previous question', timestamp: Date.now() - 1000 },
        { id: 'msg-2', role: 'agent', content: 'Previous answer', timestamp: Date.now() - 500 },
      ];
      mockGetMessages.mockResolvedValue(existingMessages);
      setupStreamFetch();

      render(<FinanceAgentChat />);

      await waitFor(() => {
        expect(screen.getByText('Previous question')).toBeDefined();
        expect(screen.getByText('Previous answer')).toBeDefined();
      });
    });
  });

  // ─── Sending messages ──────────────────────────────────────────────────

  describe('sendMessageDirect', () => {
    it('calls fetch with POST to /api/agents/finance-manager/stream', async () => {
      const mockFetch = setupStreamFetch();

      render(<FinanceAgentChat />);

      await waitFor(() => expect(screen.getByPlaceholderText('Ask about your finances...')).toBeDefined());

      const input = screen.getByPlaceholderText('Ask about your finances...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'How much did I spend?' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      });

      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const streamCall = calls.find(
          (c: unknown[]) => (c[0] as string).includes('/api/agents/finance-manager/stream')
        );
        expect(streamCall).toBeDefined();
        expect((streamCall![1] as RequestInit).method).toBe('POST');
      });
    });

    it('includes history of last 20 messages in stream request', async () => {
      // Build 25 existing messages (only last 20 should be sent)
      const existingMessages = Array.from({ length: 25 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'agent',
        content: `Message ${i}`,
        timestamp: Date.now() - (25 - i) * 1000,
      }));
      mockGetMessages.mockResolvedValue(existingMessages);

      const mockFetch = setupStreamFetch();

      render(<FinanceAgentChat />);

      await waitFor(() => expect(screen.getByPlaceholderText('Ask about your finances...')).toBeDefined());

      const input = screen.getByPlaceholderText('Ask about your finances...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Current question' } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      });

      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const streamCall = calls.find(
          (c: unknown[]) => (c[0] as string).includes('/api/agents/finance-manager/stream')
        );
        expect(streamCall).toBeDefined();
        const body = JSON.parse((streamCall![1] as RequestInit).body as string);
        expect(body.history).toBeDefined();
        expect(body.history.length).toBeLessThanOrEqual(20);
      });
    });

    it('includes the message text in the stream request body', async () => {
      const mockFetch = setupStreamFetch();

      render(<FinanceAgentChat />);

      await waitFor(() => expect(screen.getByPlaceholderText('Ask about your finances...')).toBeDefined());

      const input = screen.getByPlaceholderText('Ask about your finances...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Show my budget' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      });

      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const streamCall = calls.find(
          (c: unknown[]) => (c[0] as string).includes('/api/agents/finance-manager/stream')
        );
        expect(streamCall).toBeDefined();
        const body = JSON.parse((streamCall![1] as RequestInit).body as string);
        expect(body.message).toBe('Show my budget');
      });
    });

    it('sends with model claude-sonnet-4-6', async () => {
      const mockFetch = setupStreamFetch();

      render(<FinanceAgentChat />);

      await waitFor(() => expect(screen.getByPlaceholderText('Ask about your finances...')).toBeDefined());

      await act(async () => {
        fireEvent.change(
          screen.getByPlaceholderText('Ask about your finances...'),
          { target: { value: 'test' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      });

      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const streamCall = calls.find(
          (c: unknown[]) => (c[0] as string).includes('/api/agents/finance-manager/stream')
        );
        const body = JSON.parse((streamCall![1] as RequestInit).body as string);
        expect(body.model).toBe('claude-sonnet-4-6');
      });
    });

    it('saves user message via chatApi.saveMessage', async () => {
      setupStreamFetch();

      render(<FinanceAgentChat />);

      await waitFor(() => expect(screen.getByPlaceholderText('Ask about your finances...')).toBeDefined());

      await act(async () => {
        fireEvent.change(
          screen.getByPlaceholderText('Ask about your finances...'),
          { target: { value: 'Save this message' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      });

      await waitFor(() => {
        expect(mockSaveMessage).toHaveBeenCalledWith(
          'finance-agent',
          expect.objectContaining({
            role: 'user',
            content: 'Save this message',
            channel: 'finance',
          })
        );
      });
    });
  });

  // ─── SSE stream accumulation ───────────────────────────────────────────

  describe('accumulated text from stream', () => {
    it('accumulates text events into the agent message', async () => {
      const events = [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'from ' },
        { type: 'text', text: 'Finance Manager!' },
      ];
      setupStreamFetch(events);

      render(<FinanceAgentChat />);

      await waitFor(() => expect(screen.getByPlaceholderText('Ask about your finances...')).toBeDefined());

      await act(async () => {
        fireEvent.change(
          screen.getByPlaceholderText('Ask about your finances...'),
          { target: { value: 'Hello' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      });

      await waitFor(() => {
        expect(screen.getByText('Hello from Finance Manager!')).toBeDefined();
      }, { timeout: 3000 });
    });

    it('accumulates assistant content blocks', async () => {
      const events = [
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'Your balance is ' },
              { type: 'text', text: '$1,234.56' },
            ],
          },
        },
      ];
      setupStreamFetch(events);

      render(<FinanceAgentChat />);

      await waitFor(() => expect(screen.getByPlaceholderText('Ask about your finances...')).toBeDefined());

      await act(async () => {
        fireEvent.change(
          screen.getByPlaceholderText('Ask about your finances...'),
          { target: { value: 'What is my balance?' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      });

      await waitFor(() => {
        expect(screen.getByText('Your balance is $1,234.56')).toBeDefined();
      }, { timeout: 3000 });
    });

    it('saves accumulated agent response via chatApi.saveMessage', async () => {
      const events = [{ type: 'text', text: 'Agent response here' }];
      setupStreamFetch(events);

      render(<FinanceAgentChat />);

      await waitFor(() => expect(screen.getByPlaceholderText('Ask about your finances...')).toBeDefined());

      await act(async () => {
        fireEvent.change(
          screen.getByPlaceholderText('Ask about your finances...'),
          { target: { value: 'test' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      });

      await waitFor(() => {
        const calls = mockSaveMessage.mock.calls;
        const agentSave = calls.find(
          (c: unknown[]) => (c[1] as { role: string }).role === 'agent'
        );
        expect(agentSave).toBeDefined();
        expect((agentSave![1] as { content: string }).content).toBe('Agent response here');
      }, { timeout: 3000 });
    });
  });

  // ─── Error state ───────────────────────────────────────────────────────

  describe('error handling', () => {
    it('shows error message when stream fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: false,
        status: 500,
        body: null,
      })));

      render(<FinanceAgentChat />);

      await waitFor(() => expect(screen.getByPlaceholderText('Ask about your finances...')).toBeDefined());

      await act(async () => {
        fireEvent.change(
          screen.getByPlaceholderText('Ask about your finances...'),
          { target: { value: 'Error test' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      });

      await waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('error', 'Failed to send message');
      });
    });

    it('can dismiss error message', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: false,
        status: 500,
        body: null,
      })));

      render(<FinanceAgentChat />);

      await waitFor(() => expect(screen.getByPlaceholderText('Ask about your finances...')).toBeDefined());

      await act(async () => {
        fireEvent.change(
          screen.getByPlaceholderText('Ask about your finances...'),
          { target: { value: 'Error test' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      });

      await waitFor(() => {
        expect(screen.getByText('Dismiss')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Dismiss'));

      await waitFor(() => {
        expect(screen.queryByText('Dismiss')).toBeNull();
      });
    });
  });

  // ─── Clear history ─────────────────────────────────────────────────────

  describe('clear history', () => {
    it('shows clear history button when messages exist', async () => {
      mockGetMessages.mockResolvedValue([
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ]);
      setupStreamFetch();

      render(<FinanceAgentChat />);

      await waitFor(() => {
        expect(screen.getByTitle('Clear chat history')).toBeDefined();
      });
    });

    it('does NOT show clear history button when no messages', async () => {
      mockGetMessages.mockResolvedValue([]);
      setupStreamFetch();

      render(<FinanceAgentChat />);

      await waitFor(() => {
        expect(screen.queryByTitle('Clear chat history')).toBeNull();
      });
    });
  });

  // ─── Visibility ────────────────────────────────────────────────────────

  describe('visibility', () => {
    it('renders nothing when isOpen is false', () => {
      setupStreamFetch();
      const { container } = render(<FinanceAgentChat isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      setupStreamFetch();

      render(<FinanceAgentChat onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Close chat' })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Close chat' }));

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('does not render close button when onClose is not provided', async () => {
      setupStreamFetch();
      render(<FinanceAgentChat />);

      await waitFor(() => expect(screen.getByText('Finance Manager')).toBeDefined());

      expect(screen.queryByRole('button', { name: 'Close chat' })).toBeNull();
    });
  });

  // ─── Keyboard interaction ──────────────────────────────────────────────

  describe('keyboard interaction', () => {
    it('sends message when Enter is pressed (no shift)', async () => {
      const mockFetch = setupStreamFetch();

      render(<FinanceAgentChat />);

      await waitFor(() => expect(screen.getByPlaceholderText('Ask about your finances...')).toBeDefined());

      const input = screen.getByPlaceholderText('Ask about your finances...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Enter key test' } });
        fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
      });

      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const streamCall = calls.find(
          (c: unknown[]) => (c[0] as string).includes('/api/agents/finance-manager/stream')
        );
        expect(streamCall).toBeDefined();
      });
    });
  });
});
