// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import { X, Bell, BellOff, BellRing, Pin } from 'lucide-react';
import { type ChatRoom } from '../store/chatRoomStore';

export type NotificationSetting = 'all' | 'mentions' | 'muted';

const NOTIF_OPTIONS: { value: NotificationSetting; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All messages', icon: <Bell size={14} /> },
  { value: 'mentions', label: 'Mentions only', icon: <BellRing size={14} /> },
  { value: 'muted', label: 'Muted', icon: <BellOff size={14} /> },
];

function getStoredNotif(roomId: string): NotificationSetting {
  if (typeof window === 'undefined') return 'all';
  return (localStorage.getItem(`room-notif:${roomId}`) as NotificationSetting) ?? 'all';
}

function setStoredNotif(roomId: string, value: NotificationSetting) {
  localStorage.setItem(`room-notif:${roomId}`, value);
}

export function useRoomNotifSetting(roomId: string) {
  const [setting, setSetting] = useState<NotificationSetting>(() => getStoredNotif(roomId));
  const update = (v: NotificationSetting) => {
    setSetting(v);
    setStoredNotif(roomId, v);
  };
  return [setting, update] as const;
}

interface RoomSettingsPanelProps {
  room: ChatRoom;
  onClose: () => void;
  onLeave: () => void;
  onSave: (updates: { name?: string; description?: string }) => Promise<void>;
  onUnpin: () => void;
}

export default function RoomSettingsPanel({ room, onClose, onLeave, onSave, onUnpin }: RoomSettingsPanelProps) {
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description ?? '');
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState<NotificationSetting>(() => getStoredNotif(room.id));

  useEffect(() => {
    setName(room.name);
    setDescription(room.description ?? '');
  }, [room.id, room.name, room.description]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name: name.trim() || room.name, description: description.trim() });
    } finally {
      setSaving(false);
    }
  };

  const handleNotif = (v: NotificationSetting) => {
    setNotif(v);
    setStoredNotif(room.id, v);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col shadow-2xl sm:m-4">
        {/* Header */}
        <div className="p-4 border-b border-mission-control-border flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-sm">Room Settings</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-mission-control-text-dim mb-1.5">Room Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent transition-colors"
              placeholder="Room name"
              maxLength={80}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-mission-control-text-dim mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 text-sm text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent resize-none transition-colors"
              placeholder="Optional description..."
              maxLength={200}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 text-sm bg-mission-control-accent text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {/* Notifications */}
          <div>
            <p className="text-xs font-medium text-mission-control-text-dim mb-2">Notifications</p>
            <div className="space-y-1">
              {NOTIF_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleNotif(opt.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    notif === opt.value
                      ? 'bg-mission-control-accent/15 text-mission-control-accent ring-1 ring-mission-control-accent/30'
                      : 'text-mission-control-text hover:bg-mission-control-border'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pinned message */}
          {room.pinnedMessageId ? (
            <div>
              <p className="text-xs font-medium text-mission-control-text-dim mb-2">Pinned Message</p>
              <button
                onClick={onUnpin}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border rounded-lg transition-colors"
              >
                <Pin size={14} />
                Unpin current message
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-mission-control-text-dim mb-1">Pinned Message</p>
              <p className="text-xs text-mission-control-text-dim">
                Hover a message and click the pin icon to pin it here.
              </p>
            </div>
          )}
        </div>

        {/* Leave room */}
        <div className="p-4 border-t border-mission-control-border shrink-0">
          <button
            onClick={onLeave}
            className="w-full py-2 text-sm text-error hover:bg-error-subtle rounded-lg transition-colors"
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}
