/**
 * Tests for src/components/CronTab.tsx
 *
 * We stub global fetch to control API responses and verify
 * that the component renders, calls the right endpoints,
 * and shows the correct UI state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Stub lucide-react icons to avoid SVG rendering issues ────────────────────
// Use importOriginal so that ANY icon imported transitively (e.g. from Toast)
// also resolves — we override only the ones used by CronTab itself.
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    Clock: () => null,
    RefreshCw: () => null,
    Play: () => null,
    Trash2: () => null,
    Plus: () => null,
    ChevronDown: () => null,
    ChevronRight: () => null,
    AlertCircle: () => null,
    // Toast icons
    CheckCircle: () => null,
    XCircle: () => null,
    Info: () => null,
    X: () => null,
  };
});

// ─── Stub Toast (side-effect only, no UI) ─────────────────────────────────────
// Path must match what CronTab imports: `./Toast` (same directory as CronTab).
// From this test file at src/tests/components/, that resolves to ../../components/Toast.
vi.mock('../../components/Toast', () => ({
  showToast: vi.fn(),
}));

// We import Toast after the mock to get the spy
import { showToast } from '../../components/Toast';

// ─── Stub ConfirmDialog so we can control confirmation ────────────────────────
const mockShowConfirm = vi.fn();
vi.mock('../../components/ConfirmDialog', () => ({
  default: ({ open, onConfirm, onClose, title, message }: {
    open: boolean;
    onConfirm: () => void;
    onClose: () => void;
    title: string;
    message: string;
  }) => open ? (
    <div data-testid="confirm-dialog">
      <span data-testid="confirm-title">{title}</span>
      <span data-testid="confirm-message">{message}</span>
      <button onClick={onConfirm} data-testid="confirm-ok">OK</button>
      <button onClick={onClose} data-testid="confirm-cancel">Cancel</button>
    </div>
  ) : null,
  useConfirmDialog: () => ({
    open: false,
    config: { title: '', message: '', confirmLabel: 'Delete', type: 'danger' },
    onConfirm: vi.fn(),
    showConfirm: mockShowConfirm,
    closeConfirm: vi.fn(),
  }),
}));

// Re-mock ConfirmDialog with a version that actually triggers the callback
// when the confirm button is clicked (for more realistic tests)

import CronTab from '../../components/CronTab';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCronJob(overrides = {}) {
  return {
    id: 'job-test-1',
    name: 'Daily Summary',
    description: 'Summarize the day',
    enabled: true,
    deleteAfterRun: false,
    schedule: { kind: 'cron', expr: '0 9 * * *' },
    sessionTarget: 'isolated',
    wakeMode: 'now',
    payload: { kind: 'agentTurn', message: 'Summarize tasks' },
    state: { nextRunAtMs: Date.now() + 3600000 },
    ...overrides,
  };
}

function setupFetch(jobs: unknown[] = []) {
  // Build the mock fn first so we can return it — vi.stubGlobal returns the
  // *previous* value of the global, not the new mock function.
  const mockFn = vi.fn(async (url: string, options?: RequestInit) => {
    const method = options?.method || 'GET';

    if (url === '/api/cron' && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ jobs }),
      };
    }
    if (url === '/api/cron' && method === 'PATCH') {
      return { ok: true, json: async () => ({ success: true }) };
    }
    if (url.includes('/api/cron?action=run') && method === 'POST') {
      return { ok: true, json: async () => ({ success: true }) };
    }
    if (url.includes('/api/cron?id=') && method === 'DELETE') {
      return { ok: true, json: async () => ({ success: true }) };
    }
    if (url === '/api/cron' && method === 'POST') {
      return { ok: true, json: async () => ({ job: { id: 'new-job', name: 'New' } }) };
    }
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal('fetch', mockFn);
  return mockFn;
}

describe('CronTab component', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ─── Empty state ──────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('renders "No cron jobs configured" when API returns empty jobs', async () => {
      setupFetch([]);

      render(<CronTab />);

      await waitFor(() => {
        expect(screen.getByText('No cron jobs configured')).toBeDefined();
      });
    });

    it('shows job count of 0 when no jobs exist', async () => {
      setupFetch([]);

      render(<CronTab />);

      await waitFor(() => {
        expect(screen.getByText('0 cron jobs')).toBeDefined();
      });
    });

    it('renders "Add Job" button', async () => {
      setupFetch([]);

      render(<CronTab />);

      await waitFor(() => {
        expect(screen.getByText('Add Job')).toBeDefined();
      });
    });
  });

  // ─── Job list ─────────────────────────────────────────────────────────────

  describe('job list', () => {
    it('renders job names when API returns jobs', async () => {
      const jobs = [makeCronJob({ name: 'Morning Digest' })];
      setupFetch(jobs);

      render(<CronTab />);

      await waitFor(() => {
        expect(screen.getByText('Morning Digest')).toBeDefined();
      });
    });

    it('shows correct job count', async () => {
      const jobs = [
        makeCronJob({ id: 'j1', name: 'Job One' }),
        makeCronJob({ id: 'j2', name: 'Job Two' }),
      ];
      setupFetch(jobs);

      render(<CronTab />);

      await waitFor(() => {
        expect(screen.getByText('2 cron jobs')).toBeDefined();
      });
    });

    it('renders the schedule expression for each job', async () => {
      const jobs = [makeCronJob({ schedule: { kind: 'cron', expr: '*/30 * * * *' } })];
      setupFetch(jobs);

      render(<CronTab />);

      await waitFor(() => {
        expect(screen.getByText('*/30 * * * *')).toBeDefined();
      });
    });
  });

  // ─── Add Job modal ────────────────────────────────────────────────────────

  describe('Add Job modal', () => {
    it('shows modal when "Add Job" is clicked', async () => {
      setupFetch([]);

      render(<CronTab />);

      await waitFor(() => expect(screen.getByText('Add Job')).toBeDefined());

      fireEvent.click(screen.getByText('Add Job'));

      await waitFor(() => {
        expect(screen.getByText('Add Cron Job')).toBeDefined();
      });
    });

    it('hides modal when Cancel is clicked', async () => {
      setupFetch([]);

      render(<CronTab />);

      await waitFor(() => expect(screen.getByText('Add Job')).toBeDefined());
      fireEvent.click(screen.getByText('Add Job'));

      await waitFor(() => expect(screen.getByText('Add Cron Job')).toBeDefined());

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Add Cron Job')).toBeNull();
      });
    });

    it('calls POST /api/cron when Create is clicked with a name', async () => {
      const mockFetch = setupFetch([]);

      render(<CronTab />);

      await waitFor(() => expect(screen.getByText('Add Job')).toBeDefined());
      fireEvent.click(screen.getByText('Add Job'));

      await waitFor(() => expect(screen.getByLabelText('Cron job name')).toBeDefined());

      fireEvent.change(screen.getByLabelText('Cron job name'), {
        target: { value: 'My New Job' },
      });

      fireEvent.click(screen.getByText('Create'));

      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const postCall = calls.find(
          (c: unknown[]) =>
            c[0] === '/api/cron' &&
            (c[1] as RequestInit)?.method === 'POST'
        );
        expect(postCall).toBeDefined();
      });
    });

    it('shows a warning toast when Create is clicked without a name', async () => {
      setupFetch([]);

      render(<CronTab />);

      await waitFor(() => expect(screen.getByText('Add Job')).toBeDefined());
      fireEvent.click(screen.getByText('Add Job'));

      await waitFor(() => expect(screen.getByText('Create')).toBeDefined());

      fireEvent.click(screen.getByText('Create'));

      expect(showToast).toHaveBeenCalledWith('warning', 'Name required');
    });
  });

  // ─── Toggle job ───────────────────────────────────────────────────────────

  describe('toggle job', () => {
    it('calls PATCH /api/cron when toggle button is clicked', async () => {
      const jobs = [makeCronJob({ id: 'toggle-job', enabled: true })];
      const mockFetch = setupFetch(jobs);

      render(<CronTab />);

      await waitFor(() => expect(screen.getByText('Daily Summary')).toBeDefined());

      // The toggle button is the first button in the job row (the rounded toggle switch)
      const toggleBtn = screen.getAllByRole('button').find(
        btn => btn.className.includes('rounded-full')
      );
      expect(toggleBtn).toBeDefined();
      fireEvent.click(toggleBtn!);

      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const patchCall = calls.find(
          (c: unknown[]) =>
            c[0] === '/api/cron' &&
            (c[1] as RequestInit)?.method === 'PATCH'
        );
        expect(patchCall).toBeDefined();
        const body = JSON.parse((patchCall![1] as RequestInit).body as string);
        expect(body.id).toBe('toggle-job');
        expect(body.enabled).toBe(false); // was true, now toggling to false
      });
    });
  });

  // ─── Run job ──────────────────────────────────────────────────────────────

  describe('run job', () => {
    it('calls POST /api/cron?action=run when Play button is clicked', async () => {
      const jobs = [makeCronJob({ id: 'run-job' })];
      const mockFetch = setupFetch(jobs);

      render(<CronTab />);

      await waitFor(() => expect(screen.getByText('Daily Summary')).toBeDefined());

      const playBtn = screen.getByTitle('Run now');
      fireEvent.click(playBtn);

      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const runCall = calls.find(
          (c: unknown[]) =>
            (c[0] as string).includes('action=run') &&
            (c[1] as RequestInit)?.method === 'POST'
        );
        expect(runCall).toBeDefined();
        const body = JSON.parse((runCall![1] as RequestInit).body as string);
        expect(body.id).toBe('run-job');
      });
    });

    it('shows success toast after running a job', async () => {
      setupFetch([makeCronJob()]);

      render(<CronTab />);

      await waitFor(() => expect(screen.getByTitle('Run now')).toBeDefined());
      fireEvent.click(screen.getByTitle('Run now'));

      await waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('success', 'Job triggered');
      });
    });
  });

  // ─── Delete job ───────────────────────────────────────────────────────────

  describe('delete job', () => {
    it('calls showConfirm when Delete button is clicked', async () => {
      setupFetch([makeCronJob()]);

      render(<CronTab />);

      await waitFor(() => expect(screen.getByTitle('Delete')).toBeDefined());
      fireEvent.click(screen.getByTitle('Delete'));

      expect(mockShowConfirm).toHaveBeenCalledOnce();
      const confirmConfig = mockShowConfirm.mock.calls[0][0];
      expect(confirmConfig.title).toBe('Delete Cron Job');
      expect(confirmConfig.type).toBe('danger');
    });
  });

  // ─── Expand job ───────────────────────────────────────────────────────────

  describe('job expansion', () => {
    it('expands job details when clicking the job row', async () => {
      const jobs = [makeCronJob({ description: 'My job description' })];
      setupFetch(jobs);

      render(<CronTab />);

      await waitFor(() => expect(screen.getByText('Daily Summary')).toBeDefined());

      fireEvent.click(screen.getByRole('button', { name: /Daily Summary job/i }));

      await waitFor(() => {
        expect(screen.getByText('My job description')).toBeDefined();
      });
    });

    it('shows "No runs recorded" in expanded job when there are no runs', async () => {
      setupFetch([makeCronJob()]);

      render(<CronTab />);

      await waitFor(() => expect(screen.getByText('Daily Summary')).toBeDefined());
      fireEvent.click(screen.getByRole('button', { name: /Daily Summary job/i }));

      await waitFor(() => {
        expect(screen.getByText('No runs recorded')).toBeDefined();
      });
    });
  });
});
