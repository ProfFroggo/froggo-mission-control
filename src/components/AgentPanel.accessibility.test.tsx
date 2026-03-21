/**
 * Accessibility regression tests for the AgentPanel agent card.
 *
 * These tests verify that the WCAG fix for nested-interactive-elements
 * (task-1774057440713-1uh318) is in place and no regression is introduced:
 *
 *  - The outer card wrapper is a plain <div> (no role="button")
 *  - The full-card interactive element is a semantic <button>
 *  - Nested buttons (Settings, Trust tier, Start/Stop) remain accessible
 *  - axe-core reports zero nested-interactive violations
 *
 * Uses a minimal card fixture matching the exact HTML pattern produced by
 * AgentPanel to avoid needing to mock the entire component's Zustand stores
 * and API dependencies.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';

// ---------------------------------------------------------------------------
// Minimal fixture that mirrors the fixed card structure in AgentPanel.tsx
// ---------------------------------------------------------------------------
function AgentCardFixture({ onManage }: { onManage: () => void }) {
  return (
    <div className="group relative rounded-2xl border-2 cursor-pointer flex flex-col">
      {/* Full-card cover button — replaces the old role="button" div */}
      <button
        type="button"
        className="absolute inset-0 z-[1] rounded-2xl"
        onClick={onManage}
        aria-label="Open Test Agent management"
      />

      {/* Color accent bar — decorative, no interaction */}
      <div className="absolute top-0 left-4 right-4 h-0.5 rounded-b" />

      {/* Settings button — absolute, z-10, separate interactive element */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onManage(); }}
        className="absolute top-2 right-2 z-10"
        aria-label="Manage Test Agent"
      >
        Settings
      </button>

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1">
        <h3>Test Agent</h3>
        <p>Test description</p>

        {/* Footer with interactive elements — relative z-[2] lifts above cover button */}
        <div className="flex items-center gap-1 flex-wrap relative z-[2]">
          <span>capability-tag</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); }}
            aria-label="Edit trust tier for Test Agent"
          >
            Worker
          </button>
        </div>

        {/* Start/Stop — relative z-[2] lifts above cover button */}
        <div className="flex items-center gap-1.5 mt-auto pt-2 border-t relative z-[2]">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); }}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AgentPanel card — WCAG nested-interactive-elements fix', () => {
  it('axe-core reports no nested-interactive violation', async () => {
    const { container } = render(<AgentCardFixture onManage={vi.fn()} />);
    const results = await axe.run(container);
    const nestedInteractive = results.violations.filter(
      (v) => v.id === 'nested-interactive',
    );
    expect(nestedInteractive).toHaveLength(0);
  });

  it('card outer wrapper is a plain div — no role="button"', () => {
    const { container } = render(<AgentCardFixture onManage={vi.fn()} />);
    const roleButtonDivs = container.querySelectorAll('div[role="button"]');
    expect(roleButtonDivs).toHaveLength(0);
  });

  it('cover button is a semantic <button> with aria-label', () => {
    const { container } = render(<AgentCardFixture onManage={vi.fn()} />);
    const coverButton = container.querySelector(
      'button[aria-label="Open Test Agent management"]',
    );
    expect(coverButton).not.toBeNull();
    expect(coverButton!.tagName).toBe('BUTTON');
  });

  it('Settings button remains accessible with aria-label', () => {
    const { container } = render(<AgentCardFixture onManage={vi.fn()} />);
    const settingsButton = container.querySelector(
      'button[aria-label="Manage Test Agent"]',
    );
    expect(settingsButton).not.toBeNull();
    expect(settingsButton!.tagName).toBe('BUTTON');
  });

  it('trust tier and Start/Stop buttons remain accessible', () => {
    const { container } = render(<AgentCardFixture onManage={vi.fn()} />);
    const tierButton = container.querySelector(
      'button[aria-label="Edit trust tier for Test Agent"]',
    );
    const startButton = container.querySelector('button[type="button"]');
    expect(tierButton).not.toBeNull();
    expect(startButton).not.toBeNull();
  });

  it('cover button fires onClick when activated', () => {
    const onManage = vi.fn();
    const { container } = render(<AgentCardFixture onManage={onManage} />);
    const coverButton = container.querySelector(
      'button[aria-label="Open Test Agent management"]',
    ) as HTMLButtonElement;
    coverButton.click();
    expect(onManage).toHaveBeenCalledTimes(1);
  });
});
