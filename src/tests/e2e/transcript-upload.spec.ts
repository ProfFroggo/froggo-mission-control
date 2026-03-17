// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// E2E tests for the Transcript Upload feature (Upload Transcript tab in MeetingsPanel).
//
// Test scope:
//   - Happy path: .txt and .md transcript uploads via file input
//   - Edge cases: invalid file types (.pdf, .docx), empty content, oversized file (>5MB)
//   - Extractive fallback: summary is always displayed regardless of Gemini availability
//
// These tests drive the UI via Playwright. Auth (INTERNAL_API_TOKEN) is empty in local
// dev so no token is needed; the app routes unauthenticated requests through fine.
//
// NOTE: Playwright requires the dev server to be running (npm run dev → localhost:3000).
// The playwright.config.ts webServer block starts it automatically when running the suite.
// Do NOT run this file with `npx playwright test` unless the dev server is available.

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Navigate to the Meetings page and click the "Upload Transcript" tab. */
async function goToUploadTranscriptTab(page: Page) {
  await page.goto('/');
  // The Meetings link is in the sidebar — look for the nav item
  await page.getByRole('link', { name: /meetings/i }).first().click();
  // Wait for the tab to appear and click it
  await page.getByRole('button', { name: 'Upload Transcript' }).click();
  // Wait for the upload zone to be visible
  await expect(page.getByText('Upload a .txt or .md transcript file')).toBeVisible();
}

/** Write a temp file and return its absolute path. Caller is responsible for cleanup. */
function writeTempFile(name: string, content: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-e2e-'));
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/** Minimal realistic meeting transcript content for happy-path tests. */
const SAMPLE_TRANSCRIPT = `
Sprint Planning Meeting - March 17, 2026

Attendees: Kevin, Alberto, Tayler

Kevin: Let's review the backlog and prioritize for this sprint.
Alberto: We need to finish the transcript upload feature before the demo.
Tayler: Agreed. I also think we should schedule a follow-up with the design team on the mockups.
Kevin: Good point. TODO: Set up staging environment for QA sign-off.
Alberto: Next steps: Deploy the hotfix by end of day Friday.
Kevin: Let's make sure we document the API changes before release.

Action items agreed:
- Kevin will finalize the sprint report by Thursday
- Alberto needs to review the pull request for the auth middleware
- Tayler should coordinate with legal on the compliance review
`.trim();

// ── Happy path ─────────────────────────────────────────────────────────────

test.describe('Happy path — successful transcript upload', () => {
  test('uploads a .txt file and shows the success card', async ({ page }) => {
    const filePath = writeTempFile('meeting-notes.txt', SAMPLE_TRANSCRIPT);

    try {
      await goToUploadTranscriptTab(page);

      // The file input is hidden behind the "Choose File" label — use setInputFiles
      const fileInput = page.locator('input[type="file"][accept=".txt,.md"]');
      await fileInput.setInputFiles(filePath);

      // A progress indicator should appear while the transcript is being processed
      await expect(page.getByText('Processing transcript...')).toBeVisible({ timeout: 5000 });

      // After processing, the success card should appear
      await expect(page.getByText('Transcript processed')).toBeVisible({ timeout: 30000 });

      // "View Meeting" button should be present
      await expect(page.getByRole('button', { name: 'View Meeting' })).toBeVisible();

      // "Upload Another" button for a second upload
      await expect(page.getByRole('button', { name: 'Upload Another' })).toBeVisible();
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  test('uploads a .md file and shows the success card', async ({ page }) => {
    const mdContent = `# Sprint Review — March 17, 2026

## Attendees
- Kevin, Alberto, Tayler

## Discussion
We need to finalize the API design before implementation.
Follow up with the design team on the mockups.
TODO: Deploy the hotfix by end of day.
Remember to update the changelog before release.

## Decisions
- Agreed to use extractive summaries as fallback when Gemini is unavailable
- Next steps: QA sign-off on the transcript upload feature
`;
    const filePath = writeTempFile('sprint-review.md', mdContent);

    try {
      await goToUploadTranscriptTab(page);

      const fileInput = page.locator('input[type="file"][accept=".txt,.md"]');
      await fileInput.setInputFiles(filePath);

      // Wait for processing to begin
      await expect(page.getByText('Processing transcript...')).toBeVisible({ timeout: 5000 });

      // Wait for success — allow time for the API call to complete
      await expect(page.getByText('Transcript processed')).toBeVisible({ timeout: 30000 });

      // Confirm the meeting was saved (the success card mentions summary type)
      await expect(
        page.locator('text=/AI summary generated|Extractive summary created/i')
      ).toBeVisible();
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  test('uploaded meeting appears in the Meetings tab after upload', async ({ page }) => {
    const filePath = writeTempFile('team-sync.txt', SAMPLE_TRANSCRIPT);

    try {
      await goToUploadTranscriptTab(page);

      const fileInput = page.locator('input[type="file"][accept=".txt,.md"]');
      await fileInput.setInputFiles(filePath);

      await expect(page.getByText('Transcript processed')).toBeVisible({ timeout: 30000 });

      // Click "View Meeting" — should navigate to meeting detail in history view
      await page.getByRole('button', { name: 'View Meeting' }).click();

      // Should land on the Meetings history tab with a meeting detail visible
      await expect(page.getByRole('button', { name: 'Upload Transcript' })).toBeVisible();
      // The history view should be active (tab underline or meeting detail content)
      await expect(page.locator('text=/Back to list/i')).toBeVisible({ timeout: 10000 });
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });
});

// ── Edge cases ─────────────────────────────────────────────────────────────

test.describe('Edge cases — client-side validation', () => {
  test('shows error when uploading a .pdf file', async ({ page }) => {
    // The UI validates extension client-side before posting to the API
    const filePath = writeTempFile('report.pdf', '%PDF-1.4 fake pdf content');

    try {
      await goToUploadTranscriptTab(page);

      const fileInput = page.locator('input[type="file"][accept=".txt,.md"]');
      // Override accept attribute so we can bypass browser file picker restriction
      await fileInput.evaluate((el: HTMLInputElement) => el.removeAttribute('accept'));
      await fileInput.setInputFiles(filePath);

      // Error should appear: unsupported file type
      await expect(page.getByText('Upload failed')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=/.pdf/i')).toBeVisible();
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  test('shows error when uploading a .docx file', async ({ page }) => {
    const filePath = writeTempFile('document.docx', 'PK fake docx content');

    try {
      await goToUploadTranscriptTab(page);

      const fileInput = page.locator('input[type="file"][accept=".txt,.md"]');
      await fileInput.evaluate((el: HTMLInputElement) => el.removeAttribute('accept'));
      await fileInput.setInputFiles(filePath);

      await expect(page.getByText('Upload failed')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=/.docx/i')).toBeVisible();
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  test('shows error when uploading an empty .txt file', async ({ page }) => {
    // The UI throws "File is empty" before posting to the API
    const filePath = writeTempFile('empty.txt', '');

    try {
      await goToUploadTranscriptTab(page);

      const fileInput = page.locator('input[type="file"][accept=".txt,.md"]');
      await fileInput.setInputFiles(filePath);

      await expect(page.getByText('Upload failed')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=/empty/i')).toBeVisible();
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  test('shows error when uploading a whitespace-only .txt file', async ({ page }) => {
    // content.trim() === '' triggers the "File is empty" check in processTranscriptFile
    const filePath = writeTempFile('whitespace.txt', '   \n   \t   \n   ');

    try {
      await goToUploadTranscriptTab(page);

      const fileInput = page.locator('input[type="file"][accept=".txt,.md"]');
      await fileInput.setInputFiles(filePath);

      await expect(page.getByText('Upload failed')).toBeVisible({ timeout: 10000 });
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  test('shows error when file exceeds 5MB', async ({ page }) => {
    // Generate content slightly over 5MB — use ASCII chars so byte size == char count
    const overLimit = 5 * 1024 * 1024 + 1024; // 5MB + 1KB padding
    const bigContent = 'Meeting transcript content line.\n'.repeat(
      Math.ceil(overLimit / 'Meeting transcript content line.\n'.length)
    ).slice(0, overLimit);
    const filePath = writeTempFile('huge-transcript.txt', bigContent);

    try {
      await goToUploadTranscriptTab(page);

      const fileInput = page.locator('input[type="file"][accept=".txt,.md"]');
      await fileInput.setInputFiles(filePath);

      // Client-side size check fires before any API call
      await expect(page.getByText('Upload failed')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=/5MB|too large/i')).toBeVisible();
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });
});

// ── API-level validation (direct fetch, bypasses UI client-side checks) ────

test.describe('API validation — server-side error responses', () => {
  /**
   * These tests call the API directly using Playwright's `request` fixture.
   * Auth is disabled in local dev (INTERNAL_API_TOKEN is empty), so no token needed.
   * If a token IS configured, tests skip gracefully.
   */

  test('POST /api/meetings/transcript → 400 when content is missing', async ({ request }) => {
    const res = await request.post('/api/meetings/transcript', {
      data: { filename: 'test.txt' },
    });
    // Either 400 (validation) or 401 (auth required in non-dev environment)
    expect([400, 401]).toContain(res.status());
    if (res.status() === 400) {
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toMatch(/content/i);
    }
  });

  test('POST /api/meetings/transcript → 400 when filename is missing', async ({ request }) => {
    const res = await request.post('/api/meetings/transcript', {
      data: { content: 'Some meeting content that is long enough to process.' },
    });
    expect([400, 401]).toContain(res.status());
    if (res.status() === 400) {
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toMatch(/filename/i);
    }
  });

  test('POST /api/meetings/transcript → 400 for unsupported extension (.pdf)', async ({ request }) => {
    const res = await request.post('/api/meetings/transcript', {
      data: {
        content: 'Some meeting content that is long enough to process.',
        filename: 'report.pdf',
      },
    });
    expect([400, 401]).toContain(res.status());
    if (res.status() === 400) {
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toMatch(/\.pdf|unsupported/i);
    }
  });

  test('POST /api/meetings/transcript → 413 when content exceeds 5MB', async ({ request }) => {
    // Build a 5MB + 1 byte string
    const overLimit = 5 * 1024 * 1024 + 1;
    const bigContent = 'x'.repeat(overLimit);

    const res = await request.post('/api/meetings/transcript', {
      data: { content: bigContent, filename: 'big.txt' },
    });
    expect([413, 401]).toContain(res.status());
    if (res.status() === 413) {
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toMatch(/5MB|too large/i);
    }
  });

  test('POST /api/meetings/transcript → 400 for unsupported extension (.docx)', async ({ request }) => {
    const res = await request.post('/api/meetings/transcript', {
      data: {
        content: 'Meeting notes with enough content to pass the empty check.',
        filename: 'notes.docx',
      },
    });
    expect([400, 401]).toContain(res.status());
    if (res.status() === 400) {
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toMatch(/\.docx|unsupported/i);
    }
  });

  test('POST /api/meetings/transcript → 200 with .txt file and returns expected fields', async ({ request }) => {
    const res = await request.post('/api/meetings/transcript', {
      data: {
        content: SAMPLE_TRANSCRIPT,
        filename: 'e2e-test-meeting.txt',
      },
    });

    // 200 (auth disabled, local dev) or 401 (auth required)
    if (res.status() === 401) {
      test.skip(); // auth is enabled — skip direct API test
      return;
    }

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('meetingId');
    expect(body).toHaveProperty('summary');
    expect(body).toHaveProperty('summarySource');
    expect(['gemini', 'extractive']).toContain(body.summarySource);
    expect(body).toHaveProperty('taskProposals');
    expect(Array.isArray(body.taskProposals)).toBe(true);
  });
});

// ── Extractive fallback summary ────────────────────────────────────────────

test.describe('Extractive fallback — summary is always present', () => {
  /**
   * The API generates a summary using either Gemini (if API key configured) or
   * the local extractive fallback. Either way, `summary` and `summarySource` must
   * be present in the response. This test validates that contract.
   *
   * The UI shows "AI summary generated" for gemini and "Extractive summary created"
   * for extractive — both are acceptable outcomes.
   */

  test('API always returns a summary regardless of Gemini availability', async ({ request }) => {
    const res = await request.post('/api/meetings/transcript', {
      data: {
        content: SAMPLE_TRANSCRIPT,
        filename: 'fallback-test.txt',
      },
    });

    if (res.status() === 401) {
      test.skip(); // auth enabled — skip direct API test
      return;
    }

    expect(res.status()).toBe(200);
    const body = await res.json();

    // summary must be a non-empty string regardless of source
    expect(typeof body.summary).toBe('string');
    expect(body.summary.length).toBeGreaterThan(0);

    // summarySource must be one of the two defined values
    expect(['gemini', 'extractive']).toContain(body.summarySource);
  });

  test('UI success card reflects summary source after upload', async ({ page }) => {
    const filePath = writeTempFile('fallback-ui-test.txt', SAMPLE_TRANSCRIPT);

    try {
      await goToUploadTranscriptTab(page);

      const fileInput = page.locator('input[type="file"][accept=".txt,.md"]');
      await fileInput.setInputFiles(filePath);

      // Wait for processing to complete
      await expect(page.getByText('Transcript processed')).toBeVisible({ timeout: 30000 });

      // The success card must mention one of the two summary sources
      // "AI summary generated" (gemini) or "Extractive summary created" (extractive)
      await expect(
        page.locator('text=/AI summary generated|Extractive summary created/i')
      ).toBeVisible();
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  test('extractive summary contains content from the first part of the transcript', async ({ request }) => {
    // Use content with known phrases so we can assert the summary contains them
    const knownPhrase = 'Quarterly planning review session';
    const content = `${knownPhrase}.\n\n`.padEnd(600, 'We discussed many topics. The team agreed on priorities. ');

    const res = await request.post('/api/meetings/transcript', {
      data: { content, filename: 'extractive-check.txt' },
    });

    if (res.status() === 401) {
      test.skip();
      return;
    }

    expect(res.status()).toBe(200);
    const body = await res.json();

    // If extractive (no Gemini key), summary must begin with the start of the content
    if (body.summarySource === 'extractive') {
      expect(body.summary).toContain(knownPhrase);
    }
    // If gemini, we can't predict content — just confirm it's non-empty
    expect(body.summary.length).toBeGreaterThan(0);
  });
});

// ── Accessibility spot-checks ──────────────────────────────────────────────

test.describe('Accessibility — Upload Transcript tab', () => {
  test('file input has an accessible label via the Choose File button', async ({ page }) => {
    await goToUploadTranscriptTab(page);

    // The label element wrapping the input must be visible and contain "Choose File"
    await expect(page.getByText('Choose File')).toBeVisible();

    // The input itself must be present in the DOM (even if visually hidden)
    const fileInput = page.locator('input[type="file"][accept=".txt,.md"]');
    await expect(fileInput).toBeAttached();
  });

  test('error message is accessible when upload fails', async ({ page }) => {
    const filePath = writeTempFile('bad.pdf', 'pdf content');

    try {
      await goToUploadTranscriptTab(page);

      const fileInput = page.locator('input[type="file"][accept=".txt,.md"]');
      await fileInput.evaluate((el: HTMLInputElement) => el.removeAttribute('accept'));
      await fileInput.setInputFiles(filePath);

      // Error container must be present and contain readable text
      const errorContainer = page.locator('text=Upload failed').first();
      await expect(errorContainer).toBeVisible({ timeout: 10000 });
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });
});
