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

import { useState } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { Eye, EyeOff, Volume2, VolumeX, Keyboard, Type, Minus, Plus, Check, Lightbulb } from 'lucide-react';
import { Button, IconButton, Switch, TextField } from '@radix-ui/themes';

export default function AccessibilitySettings() {
  const { settings, updateSettings, announce } = useAccessibility();
  const [testAnnouncement, setTestAnnouncement] = useState('');

  const fontSizeOptions = [
    { value: 75, label: 'Small' },
    { value: 100, label: 'Default' },
    { value: 125, label: 'Large' },
    { value: 150, label: 'Extra Large' },
  ];

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-mission-control-text mb-2">
          Accessibility Settings
        </h2>
        <p className="text-sm text-mission-control-text-dim">
          Configure accessibility features for better usability
        </p>
      </div>

      {/* Visual Settings */}
      <section aria-labelledby="visual-settings-heading">
        <h3 id="visual-settings-heading" className="text-lg font-medium text-mission-control-text mb-4">
          Visual
        </h3>

        <div className="space-y-4">
          {/* Reduced Motion */}
          <div className="flex items-center justify-between p-4 bg-mission-control-surface border border-mission-control-border rounded-lg">
            <div className="flex items-center gap-3">
              {settings.reducedMotion ? (
                <EyeOff size={20} className="text-mission-control-text-dim" aria-hidden="true" />
              ) : (
                <Eye size={20} className="text-mission-control-text-dim" aria-hidden="true" />
              )}
              <div>
                <label htmlFor="reduced-motion" className="text-sm font-medium text-mission-control-text cursor-pointer">
                  Reduce Motion
                </label>
                <p className="text-xs text-mission-control-text-dim">
                  Minimize animations and transitions
                </p>
              </div>
            </div>
            <Switch
              id="reduced-motion"
              size="2"
              checked={settings.reducedMotion}
              onCheckedChange={(checked) => {
                updateSettings({ reducedMotion: checked });
                announce(checked ? 'Reduced motion enabled' : 'Reduced motion disabled');
              }}
              aria-label="Toggle reduced motion"
            />
          </div>

          {/* High Contrast */}
          <div className="flex items-center justify-between p-4 bg-mission-control-surface border border-mission-control-border rounded-lg">
            <div className="flex items-center gap-3">
              <Eye size={20} className="text-mission-control-text-dim" aria-hidden="true" />
              <div>
                <label htmlFor="high-contrast" className="text-sm font-medium text-mission-control-text cursor-pointer">
                  High Contrast Mode
                </label>
                <p className="text-xs text-mission-control-text-dim">
                  Increase color contrast for better visibility
                </p>
              </div>
            </div>
            <Switch
              id="high-contrast"
              size="2"
              checked={settings.highContrast}
              onCheckedChange={(checked) => {
                updateSettings({ highContrast: checked });
                announce(checked ? 'High contrast mode enabled' : 'High contrast mode disabled');
              }}
              aria-label="Toggle high contrast mode"
            />
          </div>

          {/* Font Size */}
          <div className="p-4 bg-mission-control-surface border border-mission-control-border rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <Type size={20} className="text-mission-control-text-dim" aria-hidden="true" />
              <div className="flex-1">
                <span className="text-sm font-medium text-mission-control-text">
                  Font Size
                </span>
                <p className="text-xs text-mission-control-text-dim">
                  Adjust text size: {settings.fontSize}%
                </p>
              </div>
            </div>

            {/* Font size slider */}
            <div className="flex items-center gap-3">
              <IconButton
                variant="ghost"
                size="2"
                color="gray"
                onClick={() => handleFontSizeChange(Math.max(75, settings.fontSize - 25))}
                disabled={settings.fontSize <= 75}
                aria-label="Decrease font size"
              >
                <Minus size={16} aria-hidden="true" />
              </IconButton>

              <div
                role="group"
                aria-labelledby="font-size-label"
                className="flex-1 flex gap-2"
              >
                {fontSizeOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleFontSizeChange(option.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      settings.fontSize === option.value
                        ? 'bg-mission-control-accent text-white'
                        : 'bg-mission-control-border text-mission-control-text hover:bg-mission-control-border/80'
                    }`}
                    aria-label={`Set font size to ${option.label} (${option.value}%)`}
                    aria-pressed={settings.fontSize === option.value}
                  >
                    {option.label}
                    {settings.fontSize === option.value && (
                      <Check size={14} className="inline ml-1" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>

              <IconButton
                variant="ghost"
                size="2"
                color="gray"
                onClick={() => handleFontSizeChange(Math.min(150, settings.fontSize + 25))}
                disabled={settings.fontSize >= 150}
                aria-label="Increase font size"
              >
                <Plus size={16} aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        </div>
      </section>

      {/* Keyboard & Navigation */}
      <section aria-labelledby="keyboard-settings-heading">
        <h3 id="keyboard-settings-heading" className="text-lg font-medium text-mission-control-text mb-4">
          Keyboard &amp; Navigation
        </h3>

        <div className="space-y-4">
          {/* Keyboard Navigation Indicators */}
          <div className="flex items-center justify-between p-4 bg-mission-control-surface border border-mission-control-border rounded-lg">
            <div className="flex items-center gap-3">
              <Keyboard size={20} className="text-mission-control-text-dim" aria-hidden="true" />
              <div>
                <label htmlFor="keyboard-nav" className="text-sm font-medium text-mission-control-text cursor-pointer">
                  Show Keyboard Focus
                </label>
                <p className="text-xs text-mission-control-text-dim">
                  Display visible focus indicators when using keyboard
                </p>
              </div>
            </div>
            <Switch
              id="keyboard-nav"
              size="2"
              checked={settings.keyboardNavVisible}
              onCheckedChange={(checked) => {
                updateSettings({ keyboardNavVisible: checked });
                announce(checked ? 'Keyboard focus indicators enabled' : 'Keyboard focus indicators disabled');
              }}
              aria-label="Toggle keyboard focus indicators"
            />
          </div>
        </div>
      </section>

      {/* Screen Reader */}
      <section aria-labelledby="screen-reader-heading">
        <h3 id="screen-reader-heading" className="text-lg font-medium text-mission-control-text mb-4">
          Screen Reader
        </h3>

        <div className="space-y-4">
          {/* Enable announcements */}
          <div className="flex items-center justify-between p-4 bg-mission-control-surface border border-mission-control-border rounded-lg">
            <div className="flex items-center gap-3">
              {settings.screenReaderEnabled ? (
                <Volume2 size={20} className="text-mission-control-text-dim" aria-hidden="true" />
              ) : (
                <VolumeX size={20} className="text-mission-control-text-dim" aria-hidden="true" />
              )}
              <div>
                <label htmlFor="screen-reader" className="text-sm font-medium text-mission-control-text cursor-pointer">
                  Enhanced Announcements
                </label>
                <p className="text-xs text-mission-control-text-dim">
                  Enable additional screen reader announcements
                </p>
              </div>
            </div>
            <Switch
              id="screen-reader"
              size="2"
              checked={settings.screenReaderEnabled}
              onCheckedChange={(checked) => {
                updateSettings({ screenReaderEnabled: checked });
                announce(checked ? 'Screen reader announcements enabled' : 'Screen reader announcements disabled');
              }}
              aria-label="Toggle screen reader announcements"
            />
          </div>

          {/* Test announcements */}
          <div className="p-4 bg-mission-control-surface border border-mission-control-border rounded-lg">
            <label htmlFor="test-announcement" className="text-sm font-medium text-mission-control-text block mb-2">
              Test Screen Reader Announcement
            </label>
            <div className="flex gap-2">
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
                variant="solid"
                color="grass"
                size="2"
                onClick={handleTestAnnouncement}
                disabled={!testAnnouncement.trim()}
                aria-label="Announce test message"
              >
                Announce
              </Button>
            </div>
            <p id="test-announcement-help" className="text-xs text-mission-control-text-dim mt-2">
              Test how screen readers will announce messages
            </p>
          </div>
        </div>
      </section>

      {/* Info */}
      <div
        className="p-4 bg-info-subtle border border-info-border rounded-lg"
        role="status"
        aria-label="Accessibility information"
      >
        <p className="text-sm text-info">
          <strong><Lightbulb size={14} className="inline mr-1" />Tip:</strong> Use keyboard shortcuts to navigate efficiently. Press <kbd className="px-2 py-1 bg-mission-control-border rounded text-xs">Cmd?</kbd> to view all shortcuts.
        </p>
      </div>
    </div>
  );
}
