// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import { X, Bell, BellOff, BellRing, Pin } from 'lucide-react';
import { Button, IconButton, TextField, TextArea } from '@radix-ui/themes';
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
          <IconButton
            onClick={onClose}
            aria-label="Close settings"
            variant="ghost"
            color="gray"
            size="2"
            radius="medium"
          >
            <X size={16} />
          </IconButton>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-mission-control-text-dim mb-1.5">Room Name</label>
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
            <label className="block text-xs font-medium text-mission-control-text-dim mb-1.5">Description</label>
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
            <p className="text-xs font-medium text-mission-control-text-dim mb-2">Notifications</p>
            <div className="space-y-1">
              {NOTIF_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  onClick={() => handleNotif(opt.value)}
                  variant={notif === opt.value ? 'soft' : 'ghost'}
                  color={notif === opt.value ? 'blue' : 'gray'}
                  size="2"
                  className="w-full justify-start"
                >
                  {opt.icon}
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Pinned message */}
          {room.pinnedMessageId ? (
            <div>
              <p className="text-xs font-medium text-mission-control-text-dim mb-2">Pinned Message</p>
              <Button
                onClick={onUnpin}
                variant="ghost"
                color="gray"
                size="2"
                className="w-full justify-start"
              >
                <Pin size={14} />
                Unpin current message
              </Button>
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
          <Button
            onClick={onLeave}
            variant="ghost"
            color="red"
            size="2"
            className="w-full"
          >
            Leave Room
          </Button>
        </div>
      </div>
    </div>
  );
}
