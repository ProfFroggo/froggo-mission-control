import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RoomMessage {
  id: string;
  role: 'user' | 'agent';
  agentId?: string; // which agent sent it (for agent messages)
  content: string;
  timestamp: number;
  streaming?: boolean;
  /** If this message is addressing another agent */
  mentionedAgents?: string[];
}

export interface ChatRoom {
  id: string;
  name: string;
  agents: string[]; // agent IDs participating
  messages: RoomMessage[];
  createdAt: number;
  updatedAt: number;
  /** Maps agentId -> spawned sessionKey */
  sessionKeys: Record<string, string>;
}

interface ChatRoomState {
  rooms: ChatRoom[];
  activeRoomId: string | null;

  // Actions
  createRoom: (name: string, agents: string[]) => string;
  deleteRoom: (roomId: string) => void;
  setActiveRoom: (roomId: string | null) => void;
  addMessage: (roomId: string, message: RoomMessage) => void;
  updateMessage: (roomId: string, messageId: string, updates: Partial<RoomMessage>) => void;
  setSessionKey: (roomId: string, agentId: string, sessionKey: string) => void;
  updateRoomAgents: (roomId: string, agents: string[]) => void;
  getActiveRoom: () => ChatRoom | null;
}

export const useChatRoomStore = create<ChatRoomState>()(
  persist(
    (set, get) => ({
      rooms: [],
      activeRoomId: null,

      createRoom: (name: string, agents: string[]) => {
        const id = `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const room: ChatRoom = {
          id,
          name,
          agents,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sessionKeys: {},
        };
        set(state => ({ rooms: [...state.rooms, room], activeRoomId: id }));
        return id;
      },

      deleteRoom: (roomId: string) => {
        set(state => ({
          rooms: state.rooms.filter(r => r.id !== roomId),
          activeRoomId: state.activeRoomId === roomId ? null : state.activeRoomId,
        }));
      },

      setActiveRoom: (roomId: string | null) => {
        set({ activeRoomId: roomId });
      },

      addMessage: (roomId: string, message: RoomMessage) => {
        set(state => ({
          rooms: state.rooms.map(r =>
            r.id === roomId
              ? { ...r, messages: [...r.messages, message], updatedAt: Date.now() }
              : r
          ),
        }));
      },

      updateMessage: (roomId: string, messageId: string, updates: Partial<RoomMessage>) => {
        set(state => ({
          rooms: state.rooms.map(r =>
            r.id === roomId
              ? {
                  ...r,
                  messages: r.messages.map(m =>
                    m.id === messageId ? { ...m, ...updates } : m
                  ),
                }
              : r
          ),
        }));
      },

      setSessionKey: (roomId: string, agentId: string, sessionKey: string) => {
        set(state => ({
          rooms: state.rooms.map(r =>
            r.id === roomId
              ? { ...r, sessionKeys: { ...r.sessionKeys, [agentId]: sessionKey } }
              : r
          ),
        }));
      },

      updateRoomAgents: (roomId: string, agents: string[]) => {
        set(state => ({
          rooms: state.rooms.map(r =>
            r.id === roomId ? { ...r, agents, updatedAt: Date.now() } : r
          ),
        }));
      },

      getActiveRoom: () => {
        const { rooms, activeRoomId } = get();
        return rooms.find(r => r.id === activeRoomId) || null;
      },
    }),
    {
      name: 'clawd-chat-rooms',
      partialize: (state) => ({
        rooms: state.rooms.map(r => ({
          ...r,
          // Don't persist streaming state
          messages: r.messages.map(m => ({ ...m, streaming: false })),
        })),
      }),
    }
  )
);
