import { useState, useEffect } from 'react';
import {
  Bell, BellOff, Volume2, Moon, Clock,
  AlertCircle, Save, ZapOff
} from 'lucide-react';
import { Button, Flex, Switch, Select, TextField, Spinner } from '@radix-ui/themes';
import { showToast } from './Toast';
import { settingsApi } from '../lib/api';

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
      const result = await settingsApi.get('notifications.defaults');

      const d = result?.value || (result?.success && result?.defaults ? result.defaults : null);
      if (d) {
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
    } catch (error: unknown) {
      // '[GlobalNotificationSettings] Failed to load:', error;
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedDefaults = {
        default_notification_level: defaultNotificationLevel,
        default_sound_enabled: defaultSoundEnabled ? 1 : 0,
        default_sound_type: defaultSoundType,
        default_desktop_notifications: defaultDesktopNotifications ? 1 : 0,
        quiet_hours_enabled: quietHoursEnabled ? 1 : 0,
        quiet_start: quietStart,
        quiet_end: quietEnd,
        default_priority_level: defaultPriorityLevel,
        do_not_disturb_enabled: doNotDisturbEnabled ? 1 : 0,
        dnd_until: dndUntil || null,
        enable_batching: enableBatching ? 1 : 0,
        batch_interval_minutes: batchIntervalMinutes,
      };

      const result = await settingsApi.set('notifications.defaults', updatedDefaults);

      if (result.success) {
        showToast('success', 'Global notification settings saved successfully!');
      } else {
        showToast('error', 'Failed to save global notification settings');
      }
    } catch (error) {
      // '[GlobalNotificationSettings] Save error:', error;
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
      <Flex align="center" justify="center" gap="3" className="p-8">
        <Spinner size="2" />
        <span className="text-sm text-mission-control-text-dim">Loading global notification settings...</span>
      </Flex>
    );
  }

  return (
    <div className="space-y-6">
      <Flex align="center" justify="between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell size={20} />
            Global Notification Defaults
          </h3>
          <p className="text-sm text-mission-control-text-dim mt-1">
            These settings apply to all conversations unless overridden individually
          </p>
        </div>
      </Flex>

      {/* Do Not Disturb */}
      {isDND && (
        <div className="bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg p-4 flex items-start gap-3">
          <BellOff size={20} className="text-[var(--color-error)] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-[var(--color-error)]">Do Not Disturb Active</p>
            {dndUntil && (
              <p className="text-sm text-mission-control-text-dim mt-1">
                Until {new Date(dndUntil).toLocaleString()}
              </p>
            )}
          </div>
          <Button variant="solid" color="violet" size="2" onClick={handleDisableDND}>
            Disable
          </Button>
        </div>
      )}

      {/* Quick DND */}
      <div className="bg-mission-control-bg rounded-lg p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <ZapOff size={16} />
          Quick Do Not Disturb
        </h4>
        <div className="flex gap-2 flex-wrap">
          <Button variant="surface" color="gray" size="2" onClick={() => handleQuickDND(1)}>1 hour</Button>
          <Button variant="surface" color="gray" size="2" onClick={() => handleQuickDND(4)}>4 hours</Button>
          <Button variant="surface" color="gray" size="2" onClick={() => handleQuickDND(24)}>24 hours</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Default Notification Level */}
        <div>
          <label className="block text-sm font-medium text-mission-control-text mb-2">Default Notification Level</label>
          <Select.Root value={defaultNotificationLevel} onValueChange={setDefaultNotificationLevel}>
            <Select.Trigger className="w-full" />
            <Select.Content>
              <Select.Item value="all">All messages</Select.Item>
              <Select.Item value="mentions">Mentions only</Select.Item>
              <Select.Item value="none">None</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        {/* Default Priority Level */}
        <div>
          <label className="text-sm font-medium text-mission-control-text mb-2 flex items-center gap-2">
            <AlertCircle size={16} />
            Default Priority
          </label>
          <Select.Root value={defaultPriorityLevel} onValueChange={setDefaultPriorityLevel}>
            <Select.Trigger className="w-full" />
            <Select.Content>
              <Select.Item value="low">Low</Select.Item>
              <Select.Item value="normal">Normal</Select.Item>
              <Select.Item value="high">High</Select.Item>
              <Select.Item value="urgent">Urgent</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
      </div>

      {/* Sound Settings */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">Sound</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {defaultSoundEnabled ? <Volume2 size={15} className="text-mission-control-text-dim" /> : <Volume2 size={15} className="text-mission-control-text-dim/40" />}
              <span className="text-sm text-mission-control-text">Enable notification sounds by default</span>
            </div>
            <Switch
              size="2"
              checked={defaultSoundEnabled}
              onCheckedChange={setDefaultSoundEnabled}
            />
          </div>
          {defaultSoundEnabled && (
            <Select.Root value={defaultSoundType} onValueChange={setDefaultSoundType}>
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
        <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">Desktop</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={15} className="text-mission-control-text-dim" />
            <span className="text-sm text-mission-control-text">Show desktop notifications by default</span>
          </div>
          <Switch
            size="2"
            checked={defaultDesktopNotifications}
            onCheckedChange={setDefaultDesktopNotifications}
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
              <span className="text-sm text-mission-control-text">Enable quiet hours (applies to all conversations)</span>
            </div>
            <Switch
              size="2"
              checked={quietHoursEnabled}
              onCheckedChange={setQuietHoursEnabled}
            />
          </div>
          {quietHoursEnabled && (
            <Flex gap="3" align="center" className="ml-5">
              <TextField.Root
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                size="2"
              />
              <span className="text-sm text-mission-control-text-dim">to</span>
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

      {/* Notification Batching */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">Batching</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-mission-control-text-dim" />
              <span className="text-sm text-mission-control-text">Batch notifications (reduce interruptions)</span>
            </div>
            <Switch
              size="2"
              checked={enableBatching}
              onCheckedChange={setEnableBatching}
            />
          </div>
          {enableBatching && (
            <div className="ml-5">
              <label className="block text-xs text-mission-control-text-dim mb-2">
                Batch interval (minutes)
              </label>
              <TextField.Root
                type="number"
                value={String(batchIntervalMinutes)}
                onChange={(e) => setBatchIntervalMinutes(parseInt(e.target.value) || 15)}
                min="5"
                max="60"
                size="2"
                className="w-32"
              />
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4 border-t border-mission-control-border">
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="solid"
          color="violet"
          size="2"
        >
          {saving ? (
            <><Spinner size="1" />Saving...</>
          ) : (
            <><Save size={16} />Save Global Settings</>
          )}
        </Button>
        <p className="text-xs text-mission-control-text-dim mt-2">
          These settings apply to all conversations that don&apos;t have custom notification preferences.
        </p>
      </div>
    </div>
  );
}
