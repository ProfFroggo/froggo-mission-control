import { useState, useEffect } from 'react';
import { 
  Bell, BellOff, Volume2, Moon, Clock, 
  AlertCircle, Save, ZapOff 
} from 'lucide-react';
import { showToast } from './Toast';

export default function GlobalNotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [_defaults, setDefaults] = useState<any>(null);

  // Form state
  const [defaultNotificationLevel, setDefaultNotificationLevel] = useState('all');
  const [defaultSoundEnabled, setDefaultSoundEnabled] = useState(true);
  const [defaultSoundType, setDefaultSoundType] = useState('default');
  const [defaultDesktopNotifications, setDefaultDesktopNotifications] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('08:00');
  const [defaultPriorityLevel, setDefaultPriorityLevel] = useState('normal');
  const [doNotDisturbEnabled, setDoNotDisturbEnabled] = useState(false);
  const [dndUntil, setDndUntil] = useState<string>('');
  const [enableBatching, setEnableBatching] = useState(false);
  const [batchIntervalMinutes, setBatchIntervalMinutes] = useState(15);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const result = await window.clawdbot!.notificationSettings.getGlobalDefaults();
      
      if (result.success && result.defaults) {
        const d = result.defaults;
        setDefaults(d);
        
        setDefaultNotificationLevel(String(d.default_notification_level || 'all'));
        setDefaultSoundEnabled(d.default_sound_enabled === 1);
        setDefaultSoundType(String(d.default_sound_type || 'default'));
        setDefaultDesktopNotifications(d.default_desktop_notifications === 1);
        setQuietHoursEnabled(d.quiet_hours_enabled === 1);
        setQuietStart(String(d.quiet_start || '22:00'));
        setQuietEnd(String(d.quiet_end || '08:00'));
        setDefaultPriorityLevel(String(d.default_priority_level || 'normal'));
        setDoNotDisturbEnabled(d.do_not_disturb_enabled === 1);
        setDndUntil(String(d.dnd_until || ''));
        setEnableBatching(d.enable_batching === 1);
        setBatchIntervalMinutes(Number(d.batch_interval_minutes || 15));
      }
    } catch (error) {
      console.error('[GlobalNotificationSettings] Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedDefaults = {
        default_notification_level: defaultNotificationLevel,
        default_sound_enabled: defaultSoundEnabled,
        default_sound_type: defaultSoundType,
        default_desktop_notifications: defaultDesktopNotifications,
        quiet_hours_enabled: quietHoursEnabled,
        quiet_start: quietStart,
        quiet_end: quietEnd,
        default_priority_level: defaultPriorityLevel,
        do_not_disturb_enabled: doNotDisturbEnabled,
        dnd_until: dndUntil || null,
        enable_batching: enableBatching,
        batch_interval_minutes: batchIntervalMinutes,
      };

      const result = await window.clawdbot!.notificationSettings.setGlobalDefaults(updatedDefaults);

      if (result.success) {
        showToast('success', 'Global notification settings saved successfully!');
      } else {
        showToast('error', 'Failed to save global notification settings');
      }
    } catch (error) {
      console.error('[GlobalNotificationSettings] Save error:', error);
      showToast('error', 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickDND = (hours: number) => {
    const until = new Date();
    until.setHours(until.getHours() + hours);
    setDndUntil(until.toISOString());
    setDoNotDisturbEnabled(true);
  };

  const handleDisableDND = () => {
    setDndUntil('');
    setDoNotDisturbEnabled(false);
  };

  const isDND = doNotDisturbEnabled || (dndUntil && new Date(dndUntil) > new Date());

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="text-clawd-text-dim">Loading global notification settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell size={20} />
            Global Notification Defaults
          </h3>
          <p className="text-sm text-clawd-text-dim mt-1">
            These settings apply to all conversations unless overridden individually
          </p>
        </div>
      </div>

      {/* Do Not Disturb */}
      {isDND && (
        <div className="bg-error-subtle border border-error-border rounded-lg p-4 flex items-start gap-3">
          <BellOff size={20} className="text-error flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-error">Do Not Disturb Active</p>
            {dndUntil && (
              <p className="text-sm text-clawd-text-dim mt-1">
                Until {new Date(dndUntil).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={handleDisableDND}
            className="px-3 py-1.5 bg-clawd-accent text-white rounded-lg text-sm hover:bg-clawd-accent/80 transition-colors"
          >
            Disable
          </button>
        </div>
      )}

      {/* Quick DND */}
      <div className="bg-clawd-bg rounded-lg p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <ZapOff size={16} />
          Quick Do Not Disturb
        </h4>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleQuickDND(1)}
            className="px-3 py-2 bg-clawd-border hover:bg-clawd-accent hover:text-white rounded-lg text-sm transition-colors"
          >
            1 hour
          </button>
          <button
            onClick={() => handleQuickDND(4)}
            className="px-3 py-2 bg-clawd-border hover:bg-clawd-accent hover:text-white rounded-lg text-sm transition-colors"
          >
            4 hours
          </button>
          <button
            onClick={() => handleQuickDND(24)}
            className="px-3 py-2 bg-clawd-border hover:bg-clawd-accent hover:text-white rounded-lg text-sm transition-colors"
          >
            24 hours
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Default Notification Level */}
        <div>
          <label className="block font-medium mb-2">Default Notification Level</label>
          <select
            value={defaultNotificationLevel}
            onChange={(e) => setDefaultNotificationLevel(e.target.value)}
            className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:border-clawd-accent"
          >
            <option value="all">All messages</option>
            <option value="mentions">Mentions only</option>
            <option value="none">None</option>
          </select>
        </div>

        {/* Default Priority Level */}
        <div>
          <label className="block font-medium mb-2 flex items-center gap-2">
            <AlertCircle size={16} />
            Default Priority
          </label>
          <select
            value={defaultPriorityLevel}
            onChange={(e) => setDefaultPriorityLevel(e.target.value)}
            className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:border-clawd-accent"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Sound Settings */}
      <div>
        <label className="block font-medium mb-3 flex items-center gap-2">
          <Volume2 size={16} />
          Sound
        </label>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={defaultSoundEnabled}
              onChange={(e) => setDefaultSoundEnabled(e.target.checked)}
              className="w-4 h-4 accent-clawd-accent"
            />
            <span>Enable notification sounds by default</span>
          </label>
          {defaultSoundEnabled && (
            <select
              value={defaultSoundType}
              onChange={(e) => setDefaultSoundType(e.target.value)}
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
            checked={defaultDesktopNotifications}
            onChange={(e) => setDefaultDesktopNotifications(e.target.checked)}
            className="w-4 h-4 accent-clawd-accent"
          />
          <span className="flex items-center gap-2">
            <Bell size={16} />
            Show desktop notifications by default
          </span>
        </label>
      </div>

      {/* Quiet Hours */}
      <div>
        <label className="block font-medium mb-3 flex items-center gap-2">
          <Moon size={16} />
          Quiet Hours
        </label>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={quietHoursEnabled}
              onChange={(e) => setQuietHoursEnabled(e.target.checked)}
              className="w-4 h-4 accent-clawd-accent"
            />
            <span>Enable quiet hours (applies to all conversations)</span>
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

      {/* Notification Batching */}
      <div>
        <label className="block font-medium mb-3 flex items-center gap-2">
          <Clock size={16} />
          Notification Batching
        </label>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={enableBatching}
              onChange={(e) => setEnableBatching(e.target.checked)}
              className="w-4 h-4 accent-clawd-accent"
            />
            <span>Batch notifications (reduce interruptions)</span>
          </label>
          {enableBatching && (
            <div className="ml-7">
              <label className="block text-sm text-clawd-text-dim mb-2">
                Batch interval (minutes)
              </label>
              <input
                type="number"
                value={batchIntervalMinutes}
                onChange={(e) => setBatchIntervalMinutes(parseInt(e.target.value) || 15)}
                min="5"
                max="60"
                step="5"
                className="bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent w-32"
              />
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4 border-t border-clawd-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/80 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>Saving...</>
          ) : (
            <>
              <Save size={16} />
              Save Global Settings
            </>
          )}
        </button>
        <p className="text-xs text-clawd-text-dim mt-2">
          These settings apply to all conversations that don&apos;t have custom notification preferences.
        </p>
      </div>
    </div>
  );
}
