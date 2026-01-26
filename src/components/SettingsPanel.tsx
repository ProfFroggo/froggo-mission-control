import { useState, useEffect } from 'react';
import { Settings, Wifi, Volume2, Bell, Moon, Sun, Palette, Save, RotateCcw, Check } from 'lucide-react';
import { useStore } from '../store/store';
import { reconnectGateway } from '../lib/gateway';

interface Settings {
  gatewayUrl: string;
  gatewayToken: string;
  voiceEnabled: boolean;
  voiceSpeed: number;
  notificationsEnabled: boolean;
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  autoRefresh: boolean;
  refreshInterval: number;
}

const defaultSettings: Settings = {
  gatewayUrl: 'ws://127.0.0.1:18789',
  gatewayToken: '',
  voiceEnabled: true,
  voiceSpeed: 1.0,
  notificationsEnabled: true,
  theme: 'dark',
  accentColor: '#22c55e',
  autoRefresh: true,
  refreshInterval: 30,
};

export default function SettingsPanel() {
  const { connected } = useStore();
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('froggo-settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('froggo-settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    
    // Reconnect gateway with new settings
    reconnectGateway();
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('froggo-settings');
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
            <Settings size={24} /> Settings
          </h1>
          <p className="text-clawd-text-dim">Configure Froggo dashboard preferences</p>
        </div>

        {/* Connection */}
        <section className="mb-8">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Wifi size={18} /> Connection
          </h2>
          <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
            <div>
              <label className="block text-sm text-clawd-text-dim mb-1">Gateway URL</label>
              <input
                type="text"
                value={settings.gatewayUrl}
                onChange={(e) => setSettings(s => ({ ...s, gatewayUrl: e.target.value }))}
                className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-clawd-text-dim mb-1">Token (optional)</label>
              <input
                type="password"
                value={settings.gatewayToken}
                onChange={(e) => setSettings(s => ({ ...s, gatewayToken: e.target.value }))}
                placeholder="Leave empty to use default"
                className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-sm">{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </section>

        {/* Voice */}
        <section className="mb-8">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Volume2 size={18} /> Voice
          </h2>
          <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Voice Responses</div>
                <div className="text-sm text-clawd-text-dim">Read responses aloud</div>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, voiceEnabled: !s.voiceEnabled }))}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.voiceEnabled ? 'bg-clawd-accent' : 'bg-clawd-border'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.voiceEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            <div>
              <label className="block text-sm text-clawd-text-dim mb-2">
                Speech Speed: {settings.voiceSpeed.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.voiceSpeed}
                onChange={(e) => setSettings(s => ({ ...s, voiceSpeed: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="mb-8">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Bell size={18} /> Notifications
          </h2>
          <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Desktop Notifications</div>
                <div className="text-sm text-clawd-text-dim">Show alerts for important events</div>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, notificationsEnabled: !s.notificationsEnabled }))}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.notificationsEnabled ? 'bg-clawd-accent' : 'bg-clawd-border'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="mb-8">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Palette size={18} /> Appearance
          </h2>
          <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
            <div>
              <label className="block text-sm text-clawd-text-dim mb-2">Theme</label>
              <div className="flex gap-2">
                {(['dark', 'light', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSettings(s => ({ ...s, theme: t }))}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                      settings.theme === t 
                        ? 'border-clawd-accent bg-clawd-accent/20 text-clawd-accent' 
                        : 'border-clawd-border hover:border-clawd-accent/50'
                    }`}
                  >
                    {t === 'dark' && <Moon size={16} className="inline mr-2" />}
                    {t === 'light' && <Sun size={16} className="inline mr-2" />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-clawd-text-dim mb-2">Accent Color</label>
              <div className="flex gap-2">
                {['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setSettings(s => ({ ...s, accentColor: color }))}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      settings.accentColor === color ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Data */}
        <section className="mb-8">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <RotateCcw size={18} /> Data
          </h2>
          <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Auto Refresh</div>
                <div className="text-sm text-clawd-text-dim">Automatically refresh sessions list</div>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, autoRefresh: !s.autoRefresh }))}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.autoRefresh ? 'bg-clawd-accent' : 'bg-clawd-border'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.autoRefresh ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            {settings.autoRefresh && (
              <div>
                <label className="block text-sm text-clawd-text-dim mb-2">
                  Refresh Interval: {settings.refreshInterval}s
                </label>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="10"
                  value={settings.refreshInterval}
                  onChange={(e) => setSettings(s => ({ ...s, refreshInterval: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-colors"
          >
            {saved ? <Check size={18} /> : <Save size={18} />}
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-clawd-border text-clawd-text-dim rounded-xl hover:bg-clawd-border/80 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
