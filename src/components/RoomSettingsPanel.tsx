// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import { X, Bell, BellOff, BellRing, Pin } from 'lucide-react';
import { Button, TextField, TextArea } from '@radix-ui/themes';
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col shadow-2xl sm:m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <h3 className="text-base font-semibold">Room Settings</h3>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 min-h-0">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-mission-control-text-dim mb-1 block">Room Name</label>
            <TextField.Root
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Room name"
              maxLength={80}
              size="2"
              className="w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-mission-control-text-dim mb-1 block">Description</label>
            <TextArea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description..."
              maxLength={200}
              size="2"
              className="w-full"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            variant="solid"
            size="2"
            className="w-full"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>

          {/* Notifications */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">Notifications</p>
            <div className="space-y-1">
              {NOTIF_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleNotif(opt.value)}
                  className={`flex w-full items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    notif === opt.value
                      ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                      : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
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
              <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">Pinned Message</p>
              <button
                onClick={onUnpin}
                className="w-full inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
              >
                <Pin size={14} />
                Unpin current message
              </button>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1">Pinned Message</p>
              <p className="text-xs text-mission-control-text-dim">
                Hover a message and click the pin icon to pin it here.
              </p>
            </div>
          )}
        </div>

        {/* Leave room */}
        <div className="flex items-center justify-center px-6 py-4 border-t border-mission-control-border flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            color="red"
            size="2"
            onClick={onLeave}
          >
            Leave Room
          </Button>
        </div>
      </div>
    </div>
  );
}
