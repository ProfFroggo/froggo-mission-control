/**
 * AccessibilitySettings - User interface for accessibility preferences
 *
 * Features:
 * - Reduced motion toggle
 * - High contrast mode
 * - Font size adjustment
 * - Keyboard navigation visibility
 * - Screen reader announcements
 */

import { useState, type ReactNode } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { Volume2, Type, Minus, Plus, Check, Info } from 'lucide-react';
import { Button, TextField, Flex } from '@radix-ui/themes';
import { Toggle } from './Toggle';

// ─── Shared layout primitives ──────────────────────────────────────────────────

function SettingGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim px-4 py-3 border-b border-mission-control-border bg-mission-control-bg/50">
        {label}
      </div>
      <div className="divide-y divide-mission-control-border/40">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex-1 min-w-0 pr-4">
        <div className="text-sm font-medium text-mission-control-text">{label}</div>
        {description && <div className="text-xs text-mission-control-text-dim mt-0.5">{description}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────

const FONT_SIZE_OPTIONS = [
  { value: 75, label: 'Small' },
  { value: 100, label: 'Default' },
  { value: 125, label: 'Large' },
  { value: 150, label: 'X-Large' },
];

export default function AccessibilitySettings() {
  const { settings, updateSettings, announce } = useAccessibility();
  const [testAnnouncement, setTestAnnouncement] = useState('');

  const handleFontSizeChange = (newSize: number) => {
    updateSettings({ fontSize: newSize });
    announce(`Font size changed to ${newSize}%`);
  };

  const handleTestAnnouncement = () => {
    if (testAnnouncement.trim()) {
      announce(testAnnouncement, 'assertive');
      setTestAnnouncement('');
    }
  };

  return (
    <div className="space-y-2">

      {/* Visual */}
      <SettingGroup label="Visual">
        <SettingRow
          label="Reduce Motion"
          description="Minimize animations and transitions throughout the UI"
        >
          <Toggle
            checked={settings.reducedMotion}
            onChange={(checked) => {
              updateSettings({ reducedMotion: checked });
              announce(checked ? 'Reduced motion enabled' : 'Reduced motion disabled');
            }}
            colorScheme="green"
          />
        </SettingRow>

        <SettingRow
          label="High Contrast"
          description="Increase color contrast for better visibility"
        >
          <Toggle
            checked={settings.highContrast}
            onChange={(checked) => {
              updateSettings({ highContrast: checked });
              announce(checked ? 'High contrast mode enabled' : 'High contrast mode disabled');
            }}
            colorScheme="green"
          />
        </SettingRow>

        {/* Font Size — inline segment control */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1 min-w-0 pr-4">
              <div className="text-sm font-medium text-mission-control-text flex items-center gap-2">
                <Type size={14} className="text-mission-control-text-dim" aria-hidden="true" />
                Font Size
              </div>
              <div className="text-xs text-mission-control-text-dim mt-0.5">
                Current: {settings.fontSize}%
              </div>
            </div>
          </div>

          {/* Font size preview */}
          <div className="mb-3 px-3 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg">
            <p
              className="text-mission-control-text leading-relaxed"
              style={{ fontSize: `${(settings.fontSize / 100) * 14}px` }}
            >
              The quick brown fox jumps over the lazy dog
            </p>
          </div>

          <Flex align="center" gap="2">
            <button
              type="button"
              onClick={() => handleFontSizeChange(Math.max(75, settings.fontSize - 25))}
              disabled={settings.fontSize <= 75}
              aria-label="Decrease font size"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Minus size={14} aria-hidden="true" />
            </button>

            <div
              role="group"
              aria-label="Font size options"
              className="flex flex-1 items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border"
            >
              {FONT_SIZE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleFontSizeChange(option.value)}
                  aria-label={`Set font size to ${option.label} (${option.value}%)`}
                  aria-pressed={settings.fontSize === option.value}
                  className={`flex flex-1 items-center justify-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    settings.fontSize === option.value
                      ? 'bg-mission-control-accent/10 text-mission-control-accent'
                      : 'text-mission-control-text-dim hover:text-mission-control-text'
                  }`}
                >
                  {option.label}
                  {settings.fontSize === option.value && (
                    <Check size={10} aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleFontSizeChange(Math.min(150, settings.fontSize + 25))}
              disabled={settings.fontSize >= 150}
              aria-label="Increase font size"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </Flex>
        </div>
      </SettingGroup>

      {/* Keyboard & Navigation */}
      <SettingGroup label="Keyboard & Navigation">
        <SettingRow
          label="Show Keyboard Focus"
          description="Display visible focus indicators when using keyboard navigation"
        >
          <Toggle
            checked={settings.keyboardNavVisible}
            onChange={(checked) => {
              updateSettings({ keyboardNavVisible: checked });
              announce(checked ? 'Keyboard focus indicators enabled' : 'Keyboard focus indicators disabled');
            }}
            colorScheme="green"
          />
        </SettingRow>
      </SettingGroup>

      {/* Screen Reader */}
      <SettingGroup label="Screen Reader">
        <SettingRow
          label="Enhanced Announcements"
          description="Enable additional screen reader announcements for dynamic content"
        >
          <Toggle
            checked={settings.screenReaderEnabled}
            onChange={(checked) => {
              updateSettings({ screenReaderEnabled: checked });
              announce(checked ? 'Screen reader announcements enabled' : 'Screen reader announcements disabled');
            }}
            colorScheme="green"
          />
        </SettingRow>

        {/* Test announcement */}
        <div className="px-4 py-3">
          <label htmlFor="test-announcement" className="block text-sm font-medium text-mission-control-text mb-2">
            Test Announcement
          </label>
          <Flex gap="2">
            <TextField.Root
              id="test-announcement"
              size="2"
              className="flex-1"
              aria-label="Test screen reader announcement input"
              value={testAnnouncement}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestAnnouncement(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleTestAnnouncement()}
              placeholder="Enter message to announce..."
              aria-describedby="test-announcement-help"
            />
            <Button
              variant="soft"
              color="gray"
              size="2"
              onClick={handleTestAnnouncement}
              disabled={!testAnnouncement.trim()}
              aria-label="Announce test message"
            >
              <Volume2 size={14} />
              Announce
            </Button>
          </Flex>
          <p id="test-announcement-help" className="text-xs text-mission-control-text-dim mt-2">
            Test how screen readers will announce messages in real time
          </p>
        </div>
      </SettingGroup>

      {/* Info tip */}
      <div
        className="flex items-start gap-3 px-4 py-3 bg-mission-control-surface border border-mission-control-border rounded-xl"
        role="note"
      >
        <Info size={14} className="text-mission-control-text-dim mt-0.5 flex-shrink-0" aria-hidden="true" />
        <p className="text-xs text-mission-control-text-dim/70">
          Use keyboard shortcuts to navigate efficiently. Press{' '}
          <kbd className="px-1.5 py-0.5 bg-mission-control-bg border border-mission-control-border rounded text-[10px] font-mono">
            Cmd ?
          </kbd>{' '}
          to view all shortcuts.
        </p>
      </div>
    </div>
  );
}
