/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: NotificationSettingsModal uses file-level suppression for intentional stable ref patterns.
// Modal lifecycle effects and settings management are carefully designed.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useState, useEffect } from 'react';
import {
  Bell, BellOff, Volume2, VolumeX, Moon, Clock,
  Hash, AlertCircle, X, Settings, Save, Trash2,
  ZapOff, MessageSquare
} from 'lucide-react';
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
      <div className="fixed inset-0 modal-backdrop backdrop-blur-md flex items-center justify-center z-50 modal-backdrop-enter">
        <div className="glass-modal rounded-xl p-8 shadow-xl modal-content-enter">
          <div className="text-center">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 modal-backdrop backdrop-blur-md flex items-center justify-center z-50 p-4 modal-backdrop-enter" 
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
      role="button"
      tabIndex={0}
      aria-label="Close modal"
    >
      <div className="glass-modal rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col modal-content-enter" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
        {/* Header */}
        <div className="p-6 border-b border-clawd-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Bell size={24} />
              Notification Settings
            </h2>
            <p className="text-sm text-clawd-text-dim mt-1">
              {sessionName}
            </p>
            {hasCustomSettings && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-clawd-accent/20 text-clawd-accent rounded-full text-xs mt-2">
                <Settings size={14} />
                Custom settings active
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
            title="Close (ESC)"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Mute Status */}
          {isMuted && (
            <div className="bg-warning-subtle border border-warning-border rounded-lg p-4 flex items-start gap-3">
              <BellOff size={20} className="text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-warning">Conversation Muted</p>
                <p className="text-sm text-clawd-text-dim mt-1">
                  Until {new Date(muteUntil).toLocaleString()}
                </p>
              </div>
              <button
                onClick={handleUnmute}
                disabled={saving}
                className="px-3 py-1.5 bg-clawd-accent text-white rounded-lg text-sm hover:bg-clawd-accent/80 transition-colors disabled:opacity-50"
              >
                Unmute
              </button>
            </div>
          )}

          {/* Quick Mute Actions */}
          <div className="bg-clawd-bg rounded-lg p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <ZapOff size={16} />
              Quick Mute
            </h3>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleQuickMute(1)}
                disabled={saving}
                className="px-3 py-2 bg-clawd-border hover:bg-clawd-accent hover:text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                1 hour
              </button>
              <button
                onClick={() => handleQuickMute(4)}
                disabled={saving}
                className="px-3 py-2 bg-clawd-border hover:bg-clawd-accent hover:text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                4 hours
              </button>
              <button
                onClick={() => handleQuickMute(24)}
                disabled={saving}
                className="px-3 py-2 bg-clawd-border hover:bg-clawd-accent hover:text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                24 hours
              </button>
              <button
                onClick={() => handleQuickMute(168)}
                disabled={saving}
                className="px-3 py-2 bg-clawd-border hover:bg-clawd-accent hover:text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                1 week
              </button>
            </div>
          </div>

          {/* Notification Level */}
          <div>
            <label htmlFor="notification-level" className="block font-medium mb-2 flex items-center gap-2">
              <MessageSquare size={16} />
              Notification Level
            </label>
            <select
              id="notification-level"
              value={notificationLevel}
              onChange={(e) => setNotificationLevel(e.target.value)}
              className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:border-clawd-accent"
            >
              <option value="all">All messages</option>
              <option value="mentions">Mentions only</option>
              <option value="none">None (muted)</option>
              <option value="custom">Custom (use keyword alerts)</option>
            </select>
          </div>

          {/* Sound Settings */}
          <div>
            <label className="block font-medium mb-3 flex items-center gap-2">
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              Sound
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="w-4 h-4 accent-clawd-accent"
                />
                <span>Enable notification sounds</span>
              </label>
              {soundEnabled && (
                <select
                  value={soundType}
                  onChange={(e) => setSoundType(e.target.value)}
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:border-clawd-accent"
                >
                  <option value="default">Default</option>
                  <option value="subtle">Subtle</option>
                  <option value="urgent">Urgent</option>
                </select>
              )}
            </div>
          </div>

          {/* Desktop Notifications */}
          <div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={desktopNotifications}
                onChange={(e) => setDesktopNotifications(e.target.checked)}
                className="w-4 h-4 accent-clawd-accent"
              />
              <span className="flex items-center gap-2">
                <Bell size={16} />
                Show desktop notifications
              </span>
            </label>
          </div>

          {/* Quiet Hours */}
          <div>
            <span className="block font-medium mb-3 flex items-center gap-2">
              <Moon size={16} />
              Quiet Hours
            </span>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={quietHoursEnabled}
                  onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                  className="w-4 h-4 accent-clawd-accent"
                />
                <span>Enable quiet hours</span>
              </label>
              {quietHoursEnabled && (
                <div className="flex gap-3 items-center ml-7">
                  <input
                    type="time"
                    value={quietStart}
                    onChange={(e) => setQuietStart(e.target.value)}
                    className="bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                  <span className="text-clawd-text-dim">to</span>
                  <input
                    type="time"
                    value={quietEnd}
                    onChange={(e) => setQuietEnd(e.target.value)}
                    className="bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Keyword Alerts */}
          <div>
            <span className="block font-medium mb-3 flex items-center gap-2">
              <Hash size={16} />
              Keyword Alerts
            </span>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                  placeholder="Add keyword..."
                  className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:border-clawd-accent"
                />
                <button
                  onClick={addKeyword}
                  className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/80 transition-colors"
                >
                  Add
                </button>
              </div>
              {keywordAlerts.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {keywordAlerts.map((keyword) => (
                    <span
                      key={keyword}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-clawd-border rounded-full text-sm"
                    >
                      #{keyword}
                      <button
                        onClick={() => removeKeyword(keyword)}
                        className="hover:text-error transition-colors"
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
            <label htmlFor="priority-level" className="block font-medium mb-2 flex items-center gap-2">
              <AlertCircle size={16} />
              Priority Level
            </label>
            <select
              id="priority-level"
              value={priorityLevel}
              onChange={(e) => setPriorityLevel(e.target.value)}
              className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:border-clawd-accent"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Notification Frequency */}
          <div>
            <label htmlFor="notification-frequency" className="block font-medium mb-2 flex items-center gap-2">
              <Clock size={16} />
              Notification Frequency
            </label>
            <select
              id="notification-frequency"
              value={notificationFrequency}
              onChange={(e) => setNotificationFrequency(e.target.value)}
              className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:border-clawd-accent"
            >
              <option value="instant">Instant</option>
              <option value="batched_15m">Batched (15 minutes)</option>
              <option value="batched_1h">Batched (1 hour)</option>
              <option value="daily_digest">Daily digest</option>
            </select>
          </div>

          {/* Display Preferences */}
          <div className="space-y-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={showMessagePreview}
                onChange={(e) => setShowMessagePreview(e.target.checked)}
                className="w-4 h-4 accent-clawd-accent"
              />
              <span>Show message preview in notifications</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={badgeCountEnabled}
                onChange={(e) => setBadgeCountEnabled(e.target.checked)}
                className="w-4 h-4 accent-clawd-accent"
              />
              <span>Increment unread badge count</span>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notification-notes" className="block font-medium mb-2">Notes</label>
            <textarea
              id="notification-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about these settings..."
              className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:border-clawd-accent resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-clawd-border flex items-center justify-between">
          <div>
            {hasCustomSettings && (
              <button
                onClick={handleResetToDefaults}
                disabled={saving}
                className="px-4 py-2 bg-error-subtle text-error border border-error-border rounded-lg hover:bg-error-subtle transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 size={16} />
                Reset to Defaults
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-clawd-border rounded-lg hover:bg-clawd-bg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/80 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save size={16} />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
