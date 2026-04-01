/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: NotificationSettingsModal uses file-level suppression for intentional stable ref patterns.
// Modal lifecycle effects and settings management are carefully designed.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useState, useEffect } from 'react';
import {
  Bell, BellOff, Volume2, VolumeX, Moon,
  X, Settings, Save, Trash2,
} from 'lucide-react';
import { Button, Flex, TextField, Select, TextArea, Switch } from '@radix-ui/themes';
import { showToast } from './Toast';
import { settingsApi } from '../lib/api';

interface NotificationSettingsModalProps {
  sessionKey: string;
  sessionName: string;
  onClose: () => void;
}

export default function NotificationSettingsModal({
  sessionKey,
  sessionName,
  onClose
}: NotificationSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [_settings, setSettings] = useState<any>(null);
  const [_globalDefaults, setGlobalDefaults] = useState<any>(null);
  const [hasCustomSettings, setHasCustomSettings] = useState(false);

  // Form state
  const [notificationLevel, setNotificationLevel] = useState('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundType, setSoundType] = useState('default');
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('08:00');
  const [keywordAlerts, setKeywordAlerts] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [priorityLevel, setPriorityLevel] = useState('normal');
  const [notificationFrequency, setNotificationFrequency] = useState('instant');
  const [showMessagePreview, setShowMessagePreview] = useState(true);
  const [badgeCountEnabled, setBadgeCountEnabled] = useState(true);
  const [muteUntil, setMuteUntil] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadSettings();
  }, [sessionKey]);

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Load conversation-specific settings
      const result = await settingsApi.get(`notifications.${sessionKey}`).catch(() => ({ success: false }));

      // Load global defaults
      const defaultsResult = await settingsApi.get('notifications.defaults').catch(() => ({ success: false }));

      if (result?.value || (result?.success && result?.settings)) {
        // Has custom settings
        setHasCustomSettings(true);
        const s = result.value || result.settings;
        setSettings(s);

        setNotificationLevel(s.notification_level || 'all');
        setSoundEnabled(s.sound_enabled === 1);
        setSoundType(s.sound_type || 'default');
        setDesktopNotifications(s.desktop_notifications === 1);
        setQuietHoursEnabled(s.quiet_hours_enabled === 1);
        setQuietStart(s.quiet_start || '22:00');
        setQuietEnd(s.quiet_end || '08:00');
        setKeywordAlerts(s.keyword_alerts ? JSON.parse(s.keyword_alerts) : []);
        setPriorityLevel(s.priority_level || 'normal');
        setNotificationFrequency(s.notification_frequency || 'instant');
        setShowMessagePreview(s.show_message_preview === 1);
        setBadgeCountEnabled(s.badge_count_enabled === 1);
        setMuteUntil(s.mute_until ?? null);
        setNotes(s.notes || '');
      } else if (defaultsResult?.value || (defaultsResult?.success && defaultsResult?.defaults)) {
        // No custom settings, use global defaults
        setHasCustomSettings(false);
        const d = defaultsResult.value || defaultsResult?.defaults;
        setGlobalDefaults(d);

        setNotificationLevel(d.default_notification_level || 'all');
        setSoundEnabled(d.default_sound_enabled === 1);
        setSoundType(d.default_sound_type || 'default');
        setDesktopNotifications(d.default_desktop_notifications === 1);
        setQuietHoursEnabled(d.quiet_hours_enabled === 1);
        setQuietStart(d.quiet_start || '22:00');
        setQuietEnd(d.quiet_end || '08:00');
        setPriorityLevel(d.default_priority_level || 'normal');
      }
    } catch (error) {
      // '[NotificationSettings] Failed to load:', error;
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedSettings = {
        notification_level: notificationLevel,
        sound_enabled: soundEnabled ? 1 : 0,
        sound_type: soundType,
        desktop_notifications: desktopNotifications ? 1 : 0,
        quiet_hours_enabled: quietHoursEnabled ? 1 : 0,
        quiet_start: quietStart,
        quiet_end: quietEnd,
        keyword_alerts: keywordAlerts,
        priority_level: priorityLevel,
        notification_frequency: notificationFrequency,
        show_message_preview: showMessagePreview ? 1 : 0,
        badge_count_enabled: badgeCountEnabled ? 1 : 0,
        mute_until: muteUntil,
        notes: notes,
      };

      const result = await settingsApi.set(`notifications.${sessionKey}`, updatedSettings);

      if (result?.success) {
        setHasCustomSettings(true);
        showToast('success', 'Settings Saved', 'Notification settings updated');
        onClose();
      } else {
        showToast('error', 'Save Failed', 'Failed to save notification settings');
      }
    } catch (error) {
      // '[NotificationSettings] Save error:', error;
      showToast('error', 'Save Failed', 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!confirm('Reset this conversation to global notification defaults?')) return;

    setSaving(true);
    try {
      const result = await settingsApi.set(`notifications.${sessionKey}`, null);
      if (result?.success) {
        setHasCustomSettings(false);
        await loadSettings(); // Reload to show defaults
      }
    } catch (error) {
      // '[NotificationSettings] Reset error:', error;
    } finally {
      setSaving(false);
    }
  };

  const handleQuickMute = async (hours: number) => {
    const until = new Date();
    until.setHours(until.getHours() + hours);

    setSaving(true);
    try {
      const result = await settingsApi.set(`notifications.${sessionKey}`, {
        notification_level: 'none',
        mute_until: until.toISOString(),
      });

      if (result?.success) {
        setMuteUntil(until.toISOString());
        setNotificationLevel('none');
        onClose();
      }
    } catch (error) {
      // '[NotificationSettings] Mute error:', error;
    } finally {
      setSaving(false);
    }
  };

  const handleUnmute = async () => {
    setSaving(true);
    try {
      const result = await settingsApi.set(`notifications.${sessionKey}`, {
        notification_level: 'all',
        mute_until: null,
      });

      if (result?.success) {
        setMuteUntil(null);
        setNotificationLevel('all');
        onClose();
      }
    } catch (error) {
      // '[NotificationSettings] Unmute error:', error;
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !keywordAlerts.includes(keywordInput.trim())) {
      setKeywordAlerts([...keywordAlerts, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywordAlerts(keywordAlerts.filter((k) => k !== keyword));
  };

  const isMuted = muteUntil && new Date(muteUntil) > new Date();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 modal-backdrop-enter">
        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-8 shadow-2xl modal-content-enter">
          <div className="text-center text-sm text-mission-control-text-dim">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop-enter"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
      role="button"
      tabIndex={0}
      aria-label="Close modal"
    >
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col modal-content-enter" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Bell size={16} />
              Notification Settings
            </h2>
            <p className="text-xs text-mission-control-text-dim mt-0.5">
              {sessionName}
            </p>
            {hasCustomSettings && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-mission-control-accent/20 text-mission-control-accent rounded-full text-xs mt-2">
                <Settings size={14} />
                Custom settings active
              </span>
            )}
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            onClick={onClose}
            title="Close (ESC)"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Mute Status */}
          {isMuted && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
              <BellOff size={20} className="text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-warning">Conversation Muted</p>
                <p className="text-sm text-mission-control-text-dim mt-1">
                  Until {new Date(muteUntil).toLocaleString()}
                </p>
              </div>
              <Button
                size="2"
                variant="solid"
                onClick={handleUnmute}
                disabled={saving}
              >
                Unmute
              </Button>
            </div>
          )}

          {/* Quick Mute Actions */}
          <div className="bg-mission-control-bg rounded-lg p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">Quick Mute</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50" onClick={() => handleQuickMute(1)} disabled={saving}>
                1 hour
              </button>
              <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50" onClick={() => handleQuickMute(4)} disabled={saving}>
                4 hours
              </button>
              <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50" onClick={() => handleQuickMute(24)} disabled={saving}>
                24 hours
              </button>
              <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50" onClick={() => handleQuickMute(168)} disabled={saving}>
                1 week
              </button>
            </div>
          </div>

          {/* Notification Level */}
          <div>
            <label htmlFor="notification-level" className="text-xs font-medium text-mission-control-text-dim mb-1 block">Notification Level</label>
            <Select.Root value={notificationLevel} onValueChange={setNotificationLevel} size="2">
              <Select.Trigger id="notification-level" className="w-full" />
              <Select.Content>
                <Select.Item value="all">All messages</Select.Item>
                <Select.Item value="mentions">Mentions only</Select.Item>
                <Select.Item value="none">None (muted)</Select.Item>
                <Select.Item value="custom">Custom (use keyword alerts)</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>

          {/* Sound Settings */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">Sound</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {soundEnabled ? <Volume2 size={15} className="text-mission-control-text-dim" /> : <VolumeX size={15} className="text-mission-control-text-dim" />}
                  <span className="text-sm text-mission-control-text">Enable notification sounds</span>
                </div>
                <Switch
                  size="2"
                  checked={soundEnabled}
                  onCheckedChange={(checked) => setSoundEnabled(checked === true)}
                />
              </div>
              {soundEnabled && (
                <Select.Root value={soundType} onValueChange={setSoundType} size="2">
                  <Select.Trigger className="w-full" />
                  <Select.Content>
                    <Select.Item value="default">Default</Select.Item>
                    <Select.Item value="subtle">Subtle</Select.Item>
                    <Select.Item value="urgent">Urgent</Select.Item>
                  </Select.Content>
                </Select.Root>
              )}
            </div>
          </div>

          {/* Desktop Notifications */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-mission-control-text-dim" />
                <span className="text-sm text-mission-control-text">Show desktop notifications</span>
              </div>
              <Switch
                size="2"
                checked={desktopNotifications}
                onCheckedChange={(checked) => setDesktopNotifications(checked === true)}
              />
            </div>
          </div>

          {/* Quiet Hours */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">Quiet Hours</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon size={15} className="text-mission-control-text-dim" />
                  <span className="text-sm text-mission-control-text">Enable quiet hours</span>
                </div>
                <Switch
                  size="2"
                  checked={quietHoursEnabled}
                  onCheckedChange={(checked) => setQuietHoursEnabled(checked === true)}
                />
              </div>
              {quietHoursEnabled && (
                <Flex gap="3" align="center" className="ml-7">
                  <TextField.Root
                    type="time"
                    value={quietStart}
                    onChange={(e) => setQuietStart(e.target.value)}
                    size="2"
                  />
                  <span className="text-mission-control-text-dim">to</span>
                  <TextField.Root
                    type="time"
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(e.target.value)}
                    size="2"
                  />
                </Flex>
              )}
            </div>
          </div>

          {/* Keyword Alerts */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">Keyword Alerts</p>
            <div className="space-y-2">
              <Flex gap="2">
                <TextField.Root
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                  placeholder="Add keyword..."
                  size="2"
                  className="flex-1"
                />
                <Button size="2" variant="solid" onClick={addKeyword}>
                  Add
                </Button>
              </Flex>
              {keywordAlerts.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {keywordAlerts.map((keyword) => (
                    <span
                      key={keyword}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-border rounded-full text-sm"
                    >
                      #{keyword}
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-5 h-5 rounded text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                        onClick={() => removeKeyword(keyword)}
                        aria-label={`Remove keyword ${keyword}`}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Priority Level */}
          <div>
            <label htmlFor="priority-level" className="text-xs font-medium text-mission-control-text-dim mb-1 block">Priority Level</label>
            <Select.Root value={priorityLevel} onValueChange={setPriorityLevel} size="2">
              <Select.Trigger id="priority-level" className="w-full" />
              <Select.Content>
                <Select.Item value="low">Low</Select.Item>
                <Select.Item value="normal">Normal</Select.Item>
                <Select.Item value="high">High</Select.Item>
                <Select.Item value="urgent">Urgent</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>

          {/* Notification Frequency */}
          <div>
            <label htmlFor="notification-frequency" className="text-xs font-medium text-mission-control-text-dim mb-1 block">Notification Frequency</label>
            <Select.Root value={notificationFrequency} onValueChange={setNotificationFrequency} size="2">
              <Select.Trigger id="notification-frequency" className="w-full" />
              <Select.Content>
                <Select.Item value="instant">Instant</Select.Item>
                <Select.Item value="batched_15m">Batched (15 minutes)</Select.Item>
                <Select.Item value="batched_1h">Batched (1 hour)</Select.Item>
                <Select.Item value="daily_digest">Daily digest</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>

          {/* Display Preferences */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">Display</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-mission-control-text">Show message preview in notifications</span>
                <Switch
                  size="2"
                  checked={showMessagePreview}
                  onCheckedChange={(checked) => setShowMessagePreview(checked === true)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-mission-control-text">Increment unread badge count</span>
                <Switch
                  size="2"
                  checked={badgeCountEnabled}
                  onCheckedChange={(checked) => setBadgeCountEnabled(checked === true)}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notification-notes" className="text-xs font-medium text-mission-control-text-dim mb-1 block">Notes</label>
            <TextArea
              id="notification-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about these settings..."
              size="2"
              rows={3}
              style={{ resize: 'none' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-mission-control-border flex-shrink-0">
          <div>
            {hasCustomSettings && (
              <Button
                type="button"
                variant="ghost"
                color="red"
                size="2"
                onClick={handleResetToDefaults}
                disabled={saving}
              >
                <Trash2 size={16} />
                Reset to Defaults
              </Button>
            )}
          </div>
          <Flex gap="3">
            <Button
              type="button"
              variant="ghost"
              size="2"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="2"
              variant="solid"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save size={16} />
                  Save Settings
                </>
              )}
            </Button>
          </Flex>
        </div>
      </div>
    </div>
  );
}
