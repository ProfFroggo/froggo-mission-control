import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  /** All artifacts in this room (immutable, versioned) */
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

export const useChatRoomStore = create<ChatRoomState>()(
  persist(
    (set, get) => ({
      rooms: [],
      activeRoomId: null,
      panelState: {},

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
          panelState: { ...state.panelState, [id]: { isOpen: false, width: 400 } }
        }));
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
              ? { ...r, messages: [...r.messages, message].slice(-MAX_MESSAGES_PER_ROOM), updatedAt: Date.now() }
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

      // Artifact Actions
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
                  updatedAt: Date.now()
                }
              : r
          ),
          panelState: { 
            ...state.panelState, 
            [roomId]: { ...state.panelState[roomId], isOpen: true }
          }
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
                  updatedAt: Date.now()
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
        
        // Find all versions of this artifact and return the highest version
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
              isOpen: !state.panelState[roomId]?.isOpen
            }
          }
        }));
      },

      setPanelWidth: (roomId: string, width: number) => {
        set(state => ({
          panelState: {
            ...state.panelState,
            [roomId]: {
              ...state.panelState[roomId],
              width
            }
          }
        }));
      },
    }),
    {
      name: 'clawd-chat-rooms',
      partialize: (state) => ({
        rooms: state.rooms.map(r => ({
          ...r,
          // Cap messages and clear streaming state for persistence
          messages: r.messages.slice(-MAX_MESSAGES_PER_ROOM).map(m => ({ ...m, streaming: false })),
          // Keep all artifacts (immutable, so no cleanup needed)
          artifacts: r.artifacts,
        })),
        panelState: state.panelState,
      }),
    }
  )
);
