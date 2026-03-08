import { create } from 'zustand';

const MAX_MESSAGES_PER_ROOM = 200;

// Artifact types
export type ArtifactType = 'canvas' | 'code' | 'diagram' | 'interactive';

export interface CanvasData {
  type: 'canvas';
  width: number;
  height: number;
  elements: any[]; // Canvas elements - shapes, lines, text, etc.
}

export interface CodeData {
  type: 'code';
  language: string;
  code: string;
  filename?: string;
}

export interface DiagramData {
  type: 'diagram';
  format: 'mermaid' | 'excalidraw' | 'lucid';
  source: string;
}

export interface InteractiveData {
  type: 'interactive';
  componentId: string;
  props: Record<string, any>;
}

export type ArtifactData = CanvasData | CodeData | DiagramData | InteractiveData;

export interface Artifact {
  id: string; // artifact-{timestamp}-{random}
  type: ArtifactType;
  version: number;
  createdAt: number;
  createdBy: string; // agent ID or 'user'
  messageId: string; // which message created this
  title?: string;
  data: ArtifactData;
  metadata?: Record<string, any>;
}

export interface RoomMessage {
  id: string;
  role: 'user' | 'agent';
  agentId?: string; // which agent sent it (for agent messages)
  content: string;
  timestamp: number;
  streaming?: boolean;
  /** If this message is addressing another agent */
  mentionedAgents?: string[];
  /** Reference to artifact created by this message */
  artifactId?: string;
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
  /** All artifacts in this room (session-only, not persisted) */
  artifacts: Artifact[];
  /** Currently displayed artifact */
  activeArtifactId?: string;
}

interface ChatRoomState {
  rooms: ChatRoom[];
  activeRoomId: string | null;
  // Panel state per room
  panelState: Record<string, { isOpen: boolean; width: number }>;

  // Room Actions
  loadRooms: () => Promise<void>;
  loadMessages: (roomId: string) => Promise<void>;
  createRoom: (name: string, agents: string[]) => string;
  deleteRoom: (roomId: string) => void;
  setActiveRoom: (roomId: string | null) => void;
  addMessage: (roomId: string, message: RoomMessage) => void;
  updateMessage: (roomId: string, messageId: string, updates: Partial<RoomMessage>) => void;
  setSessionKey: (roomId: string, agentId: string, sessionKey: string) => void;
  updateRoomAgents: (roomId: string, agents: string[]) => void;
  getActiveRoom: () => ChatRoom | null;

  // Artifact Actions
  createArtifact: (roomId: string, artifact: Omit<Artifact, 'id' | 'version'>) => string;
  updateArtifact: (roomId: string, artifactId: string, data: ArtifactData) => string;
  setActiveArtifact: (roomId: string, artifactId: string | null) => void;
  getArtifact: (roomId: string, artifactId: string) => Artifact | null;
  getLatestArtifactVersion: (roomId: string, baseId: string) => Artifact | null;

  // Panel Actions
  togglePanel: (roomId: string) => void;
  setPanelWidth: (roomId: string, width: number) => void;
}

/** Fire-and-forget save of a completed message to the DB */
function saveMessageToDb(roomId: string, message: RoomMessage) {
  if (!message.content) return; // skip empty — server rejects with 400
  fetch(`/api/chat-rooms/${roomId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messageId: message.id,
      agentId: message.role === 'user' ? 'user' : (message.agentId ?? 'agent'),
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      mentionedAgents: message.mentionedAgents ?? [],
    }),
  }).catch(e => console.warn('[chatRoomStore] Failed to save message to DB:', e));
}

export const useChatRoomStore = create<ChatRoomState>()(
  (set, get) => ({
    rooms: [],
    activeRoomId: null,
    panelState: {},

    loadRooms: async () => {
      try {
        const res = await fetch('/api/chat-rooms');
        if (!res.ok) return;
        const dbRooms: any[] = await res.json();
        set(state => {
          const existingIds = new Set(state.rooms.map(r => r.id));
          const newRooms: ChatRoom[] = dbRooms
            .filter(r => !existingIds.has(r.id))
            .map(r => ({
              id: r.id,
              name: r.name,
              agents: (() => { try { return JSON.parse(r.agents || '[]'); } catch { return []; } })(),
              messages: [],
              createdAt: r.createdAt,
              updatedAt: r.updatedAt || r.createdAt,
              sessionKeys: (() => { try { return JSON.parse(r.sessionKeys || '{}'); } catch { return {}; } })(),
              artifacts: [],
            }));
          const panelAdditions: Record<string, { isOpen: boolean; width: number }> = {};
          for (const r of newRooms) {
            if (!state.panelState[r.id]) {
              panelAdditions[r.id] = { isOpen: false, width: 400 };
            }
          }
          return {
            rooms: [...state.rooms, ...newRooms],
            panelState: { ...state.panelState, ...panelAdditions },
          };
        });
      } catch (e) {
        console.warn('[chatRoomStore] Failed to load rooms from DB:', e);
      }
    },

    loadMessages: async (roomId: string) => {
      try {
        const res = await fetch(`/api/chat-rooms/${roomId}/messages`);
        if (!res.ok) return;
        const dbMessages: any[] = await res.json();
        const seen = new Set<string>();
        const deduped = dbMessages
          .map(m => ({
            id: m.messageId || String(m.id),
            role: (m.role ?? 'agent') as 'user' | 'agent',
            agentId: m.agentId !== 'user' ? m.agentId : undefined,
            content: m.content,
            timestamp: m.timestamp,
            mentionedAgents: (() => { try { return JSON.parse(m.mentionedAgents || '[]'); } catch { return []; } })(),
          }))
          .filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; })
          .slice(-MAX_MESSAGES_PER_ROOM);
        set(state => ({
          rooms: state.rooms.map(r =>
            r.id === roomId ? { ...r, messages: deduped } : r
          ),
        }));
      } catch (e) {
        console.warn('[chatRoomStore] Failed to load messages from DB:', e);
      }
    },

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
        artifacts: [],
      };
      set(state => ({
        rooms: [...state.rooms, room],
        activeRoomId: id,
        panelState: { ...state.panelState, [id]: { isOpen: false, width: 400 } },
      }));
      // Persist to DB (fire-and-forget)
      fetch('/api/chat-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, agents }),
      }).catch(e => console.warn('[chatRoomStore] Failed to create room in DB:', e));
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
            ? {
                ...r,
                messages: r.messages.some(m => m.id === message.id)
                  ? r.messages // already present — skip to avoid duplicate key errors
                  : [...r.messages, message].slice(-MAX_MESSAGES_PER_ROOM),
                updatedAt: Date.now(),
              }
            : r
        ),
      }));
      // Save to DB immediately if not streaming
      if (!message.streaming) {
        saveMessageToDb(roomId, message);
      }
    },

    updateMessage: (roomId: string, messageId: string, updates: Partial<RoomMessage>) => {
      // Capture message before update if we need to save to DB
      let messageToSave: RoomMessage | null = null;
      if (updates.streaming === false) {
        const room = get().rooms.find(r => r.id === roomId);
        const msg = room?.messages.find(m => m.id === messageId);
        if (msg) messageToSave = { ...msg, ...updates };
      }

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

      if (messageToSave) {
        saveMessageToDb(roomId, messageToSave);
      }
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

    // Artifact Actions (session-only, not persisted to DB)
    createArtifact: (roomId: string, artifact: Omit<Artifact, 'id' | 'version'>) => {
      const id = `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newArtifact: Artifact = {
        ...artifact,
        id,
        version: 1,
      };

      set(state => ({
        rooms: state.rooms.map(r =>
          r.id === roomId
            ? {
                ...r,
                artifacts: [...r.artifacts, newArtifact],
                activeArtifactId: id,
                updatedAt: Date.now(),
              }
            : r
        ),
        panelState: {
          ...state.panelState,
          [roomId]: { ...state.panelState[roomId], isOpen: true },
        },
      }));

      return id;
    },

    updateArtifact: (roomId: string, artifactId: string, data: ArtifactData) => {
      const room = get().rooms.find(r => r.id === roomId);
      if (!room) return artifactId;

      const artifact = room.artifacts.find(a => a.id === artifactId);
      if (!artifact) return artifactId;

      // Create new version (immutable approach)
      const newVersion: Artifact = {
        ...artifact,
        version: artifact.version + 1,
        data,
        createdAt: Date.now(),
      };

      set(state => ({
        rooms: state.rooms.map(r =>
          r.id === roomId
            ? {
                ...r,
                artifacts: [...r.artifacts, newVersion],
                activeArtifactId: artifactId, // Keep same base ID
                updatedAt: Date.now(),
              }
            : r
        ),
      }));

      return artifactId;
    },

    setActiveArtifact: (roomId: string, artifactId: string | null) => {
      set(state => ({
        rooms: state.rooms.map(r =>
          r.id === roomId
            ? { ...r, activeArtifactId: artifactId ?? undefined }
            : r
        ),
      }));
    },

    getArtifact: (roomId: string, artifactId: string) => {
      const room = get().rooms.find(r => r.id === roomId);
      if (!room) return null;
      return room.artifacts.find(a => a.id === artifactId) || null;
    },

    getLatestArtifactVersion: (roomId: string, baseId: string) => {
      const room = get().rooms.find(r => r.id === roomId);
      if (!room) return null;

      const versions = room.artifacts.filter(a => a.id === baseId);
      if (versions.length === 0) return null;

      return versions.reduce((latest, current) =>
        current.version > latest.version ? current : latest
      );
    },

    // Panel Actions
    togglePanel: (roomId: string) => {
      set(state => ({
        panelState: {
          ...state.panelState,
          [roomId]: {
            ...state.panelState[roomId],
            isOpen: !state.panelState[roomId]?.isOpen,
          },
        },
      }));
    },

    setPanelWidth: (roomId: string, width: number) => {
      set(state => ({
        panelState: {
          ...state.panelState,
          [roomId]: {
            ...state.panelState[roomId],
            width,
          },
        },
      }));
    },
  })
);
