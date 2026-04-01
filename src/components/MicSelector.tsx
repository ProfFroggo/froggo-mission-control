// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// MicSelector — reusable mic device picker dropdown for all STT consumers.

import { useState, useEffect, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { listMicDevices } from '../lib/globalStt';

interface MicSelectorProps {
  /** Currently selected device ID (empty string = system default) */
  value: string;
  /** Called when user picks a different device */
  onChange: (deviceId: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode — icon-only trigger with dropdown */
  compact?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export default function MicSelector({ value, onChange, className = '', compact = false, disabled = false }: MicSelectorProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const mics = await listMicDevices();
    setDevices(mics);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // Re-enumerate when devices change (plug/unplug)
    const handler = () => { refresh(); };
    navigator.mediaDevices?.addEventListener('devicechange', handler);
    return () => { navigator.mediaDevices?.removeEventListener('devicechange', handler); };
  }, [refresh]);

  if (devices.length <= 1 && !loading) {
    // Only one mic (or none) — no need to show a picker
    return null;
  }

  const label = devices.find(d => d.deviceId === value)?.label || 'System default';

  if (compact) {
    return (
      <div className={`relative inline-block ${className}`}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          title={`Microphone: ${label}`}
          aria-label="Select microphone"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        >
          <option value="">System default</option>
          {devices.map(d => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Mic ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text transition-colors">
          <Mic size={14} />
        </div>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label="Select microphone"
      className={`mc-select text-sm ${className}`}
    >
      <option value="">System default</option>
      {devices.map(d => (
        <option key={d.deviceId} value={d.deviceId}>
          {d.label || `Mic ${d.deviceId.slice(0, 8)}`}
        </option>
      ))}
    </select>
  );
}
