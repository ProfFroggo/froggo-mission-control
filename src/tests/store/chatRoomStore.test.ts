/**
 * Tests for src/store/chatRoomStore.ts
 *
 * Uses Zustand's getState() API so there is no React rendering needed.
 * State is explicitly reset before each test so tests are isolated.
 *
 * The store uses `persist` middleware which calls localStorage.setItem.
 * We patch localStorage with a no-op storage shim before importing the store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useChatRoomStore } from '../../store/chatRoomStore';
import type { RoomMessage } from '../../store/chatRoomStore';

// localStorage is patched in src/tests/setup.ts so Zustand's persist middleware
// can call setItem/getItem without throwing.

// Reset the entire store state before each test
function resetStore() {
  localStorage.clear();
  useChatRoomStore.setState({
    rooms: [],
    activeRoomId: null,
    panelState: {},
  });
}

describe('useChatRoomStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ─── createRoom ────────────────────────────────────────────────────────────

  describe('createRoom', () => {
    it('adds a room with the provided name and agents', () => {
      const { createRoom } = useChatRoomStore.getState();
      const id = createRoom('War Room', ['mission-control', 'coder']);

      const { rooms } = useChatRoomStore.getState();
      expect(rooms).toHaveLength(1);
      expect(rooms[0].id).toBe(id);
      expect(rooms[0].name).toBe('War Room');
      expect(rooms[0].agents).toEqual(['mission-control', 'coder']);
    });

    it('initializes room with empty messages array', () => {
      const { createRoom } = useChatRoomStore.getState();
      createRoom('Test Room', []);

      const { rooms } = useChatRoomStore.getState();
      expect(rooms[0].messages).toEqual([]);
    });

    it('initializes room with empty artifacts array', () => {
      const { createRoom } = useChatRoomStore.getState();
      createRoom('Test Room', []);

      const { rooms } = useChatRoomStore.getState();
      expect(rooms[0].artifacts).toEqual([]);
    });

    it('initializes room with empty sessionKeys', () => {
      const { createRoom } = useChatRoomStore.getState();
      createRoom('Test Room', ['mission-control']);

      const { rooms } = useChatRoomStore.getState();
      expect(rooms[0].sessionKeys).toEqual({});
    });

    it('sets activeRoomId to the new room id', () => {
      const { createRoom } = useChatRoomStore.getState();
      const id = createRoom('Active Room', []);

      expect(useChatRoomStore.getState().activeRoomId).toBe(id);
    });

    it('initializes panelState for the room with isOpen=false and width=400', () => {
      const { createRoom } = useChatRoomStore.getState();
      const id = createRoom('Panel Room', []);

      const { panelState } = useChatRoomStore.getState();
      expect(panelState[id]).toEqual({ isOpen: false, width: 400 });
    });

    it('returns a unique id each time', () => {
      const { createRoom } = useChatRoomStore.getState();
      const id1 = createRoom('Room A', []);
      const id2 = createRoom('Room B', []);
      expect(id1).not.toBe(id2);
    });

    it('can create multiple rooms', () => {
      const { createRoom } = useChatRoomStore.getState();
      createRoom('Room 1', ['mission-control']);
      createRoom('Room 2', ['coder']);
      createRoom('Room 3', ['clara']);

      expect(useChatRoomStore.getState().rooms).toHaveLength(3);
    });
  });

  // ─── addMessage ────────────────────────────────────────────────────────────

  describe('addMessage', () => {
    it('adds a message to the correct room', () => {
      const { createRoom, addMessage } = useChatRoomStore.getState();
      const roomId = createRoom('Chat Room', ['mission-control']);

      const msg: RoomMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello Mission Control!',
        timestamp: Date.now(),
      };
      addMessage(roomId, msg);

      const { rooms } = useChatRoomStore.getState();
      const room = rooms.find(r => r.id === roomId)!;
      expect(room.messages).toHaveLength(1);
      expect(room.messages[0].content).toBe('Hello Mission Control!');
    });

    it('does not modify other rooms', () => {
      const { createRoom, addMessage } = useChatRoomStore.getState();
      const room1Id = createRoom('Room 1', []);
      const room2Id = createRoom('Room 2', []);

      addMessage(room1Id, {
        id: 'msg-a',
        role: 'user',
        content: 'Only for room 1',
        timestamp: Date.now(),
      });

      const { rooms } = useChatRoomStore.getState();
      const room2 = rooms.find(r => r.id === room2Id)!;
      expect(room2.messages).toHaveLength(0);
    });

    it('appends messages in order', () => {
      const { createRoom, addMessage } = useChatRoomStore.getState();
      const roomId = createRoom('Ordered Room', []);

      addMessage(roomId, { id: 'msg-1', role: 'user', content: 'First', timestamp: 1000 });
      addMessage(roomId, { id: 'msg-2', role: 'agent', content: 'Second', timestamp: 2000 });
      addMessage(roomId, { id: 'msg-3', role: 'user', content: 'Third', timestamp: 3000 });

      const { rooms } = useChatRoomStore.getState();
      const msgs = rooms.find(r => r.id === roomId)!.messages;
      expect(msgs[0].content).toBe('First');
      expect(msgs[1].content).toBe('Second');
      expect(msgs[2].content).toBe('Third');
    });

    it('sets streaming flag on message when provided', () => {
      const { createRoom, addMessage } = useChatRoomStore.getState();
      const roomId = createRoom('Stream Room', []);

      addMessage(roomId, {
        id: 'msg-stream',
        role: 'agent',
        content: '',
        timestamp: Date.now(),
        streaming: true,
      });

      const { rooms } = useChatRoomStore.getState();
      expect(rooms.find(r => r.id === roomId)!.messages[0].streaming).toBe(true);
    });

    it('caps at MAX_MESSAGES_PER_ROOM (200)', () => {
      const { createRoom, addMessage } = useChatRoomStore.getState();
      const roomId = createRoom('Cap Room', []);

      for (let i = 0; i < 210; i++) {
        addMessage(roomId, {
          id: `msg-${i}`,
          role: 'user',
          content: `Message ${i}`,
          timestamp: i,
        });
      }

      const { rooms } = useChatRoomStore.getState();
      const msgs = rooms.find(r => r.id === roomId)!.messages;
      expect(msgs.length).toBe(200);
      // Should keep the most recent 200 messages (messages 10-209)
      expect(msgs[0].content).toBe('Message 10');
      expect(msgs[199].content).toBe('Message 209');
    });
  });

  // ─── updateMessage ─────────────────────────────────────────────────────────

  describe('updateMessage', () => {
    it('updates content of a message in the correct room', () => {
      const { createRoom, addMessage, updateMessage } = useChatRoomStore.getState();
      const roomId = createRoom('Update Room', []);

      addMessage(roomId, {
        id: 'msg-upd',
        role: 'agent',
        content: 'Partial...',
        timestamp: Date.now(),
        streaming: true,
      });

      updateMessage(roomId, 'msg-upd', { content: 'Completed response.', streaming: false });

      const { rooms } = useChatRoomStore.getState();
      const msg = rooms.find(r => r.id === roomId)!.messages[0];
      expect(msg.content).toBe('Completed response.');
      expect(msg.streaming).toBe(false);
    });

    it('only updates the targeted message, leaving others intact', () => {
      const { createRoom, addMessage, updateMessage } = useChatRoomStore.getState();
      const roomId = createRoom('Multi Room', []);

      addMessage(roomId, { id: 'msg-a', role: 'user', content: 'User msg', timestamp: 1 });
      addMessage(roomId, { id: 'msg-b', role: 'agent', content: 'Agent msg', timestamp: 2 });

      updateMessage(roomId, 'msg-b', { content: 'Updated agent msg' });

      const { rooms } = useChatRoomStore.getState();
      const msgs = rooms.find(r => r.id === roomId)!.messages;
      expect(msgs[0].content).toBe('User msg'); // unchanged
      expect(msgs[1].content).toBe('Updated agent msg');
    });

    it('does not affect messages in other rooms', () => {
      const { createRoom, addMessage, updateMessage } = useChatRoomStore.getState();
      const room1Id = createRoom('Room 1', []);
      const room2Id = createRoom('Room 2', []);

      addMessage(room1Id, { id: 'shared-id', role: 'user', content: 'Room 1 msg', timestamp: 1 });
      addMessage(room2Id, { id: 'shared-id', role: 'user', content: 'Room 2 msg', timestamp: 2 });

      updateMessage(room1Id, 'shared-id', { content: 'Updated in Room 1' });

      const { rooms } = useChatRoomStore.getState();
      const room2Msg = rooms.find(r => r.id === room2Id)!.messages[0];
      expect(room2Msg.content).toBe('Room 2 msg'); // untouched
    });

    it('can clear the streaming flag', () => {
      const { createRoom, addMessage, updateMessage } = useChatRoomStore.getState();
      const roomId = createRoom('Streaming Room', []);

      addMessage(roomId, {
        id: 'streaming-msg',
        role: 'agent',
        content: '',
        timestamp: Date.now(),
        streaming: true,
      });

      updateMessage(roomId, 'streaming-msg', { streaming: false });

      const msg = useChatRoomStore.getState().rooms
        .find(r => r.id === roomId)!.messages[0];
      expect(msg.streaming).toBe(false);
    });
  });

  // ─── deleteRoom ────────────────────────────────────────────────────────────

  describe('deleteRoom', () => {
    it('removes the specified room', () => {
      const { createRoom, deleteRoom } = useChatRoomStore.getState();
      const id1 = createRoom('Keep', []);
      const id2 = createRoom('Delete', []);

      deleteRoom(id2);

      const { rooms } = useChatRoomStore.getState();
      expect(rooms).toHaveLength(1);
      expect(rooms[0].id).toBe(id1);
    });

    it('sets activeRoomId to null when active room is deleted', () => {
      const { createRoom, deleteRoom } = useChatRoomStore.getState();
      const id = createRoom('Active', []);
      // createRoom auto-sets this as active
      expect(useChatRoomStore.getState().activeRoomId).toBe(id);

      deleteRoom(id);

      expect(useChatRoomStore.getState().activeRoomId).toBeNull();
    });

    it('preserves activeRoomId when a different room is deleted', () => {
      const { createRoom, deleteRoom } = useChatRoomStore.getState();
      const id1 = createRoom('Room 1', []);
      const id2 = createRoom('Room 2', []);
      // id2 is now active

      // Manually set id1 as active, then delete id2
      useChatRoomStore.setState({ activeRoomId: id1 });
      deleteRoom(id2);

      expect(useChatRoomStore.getState().activeRoomId).toBe(id1);
    });

    it('is a no-op when room id does not exist', () => {
      const { createRoom, deleteRoom } = useChatRoomStore.getState();
      createRoom('Keep', []);

      deleteRoom('nonexistent-room-id');

      expect(useChatRoomStore.getState().rooms).toHaveLength(1);
    });
  });

  // ─── setActiveRoom ─────────────────────────────────────────────────────────

  describe('setActiveRoom', () => {
    it('sets activeRoomId to the provided room id', () => {
      const { createRoom, setActiveRoom } = useChatRoomStore.getState();
      const id1 = createRoom('Room 1', []);
      createRoom('Room 2', []);

      setActiveRoom(id1);

      expect(useChatRoomStore.getState().activeRoomId).toBe(id1);
    });

    it('can set activeRoomId to null', () => {
      const { createRoom, setActiveRoom } = useChatRoomStore.getState();
      createRoom('Room', []);

      setActiveRoom(null);

      expect(useChatRoomStore.getState().activeRoomId).toBeNull();
    });

    it('switches active room between multiple rooms', () => {
      const { createRoom, setActiveRoom } = useChatRoomStore.getState();
      const id1 = createRoom('Room 1', []);
      const id2 = createRoom('Room 2', []);

      setActiveRoom(id1);
      expect(useChatRoomStore.getState().activeRoomId).toBe(id1);

      setActiveRoom(id2);
      expect(useChatRoomStore.getState().activeRoomId).toBe(id2);
    });
  });

  // ─── getActiveRoom ─────────────────────────────────────────────────────────

  describe('getActiveRoom', () => {
    it('returns the active room', () => {
      const { createRoom, getActiveRoom } = useChatRoomStore.getState();
      const id = createRoom('Active', ['mission-control']);

      const room = getActiveRoom();
      expect(room).not.toBeNull();
      expect(room!.id).toBe(id);
      expect(room!.name).toBe('Active');
    });

    it('returns null when activeRoomId is null', () => {
      useChatRoomStore.setState({ activeRoomId: null });
      const { getActiveRoom } = useChatRoomStore.getState();
      expect(getActiveRoom()).toBeNull();
    });

    it('returns null when activeRoomId points to nonexistent room', () => {
      useChatRoomStore.setState({ activeRoomId: 'ghost-room', rooms: [] });
      const { getActiveRoom } = useChatRoomStore.getState();
      expect(getActiveRoom()).toBeNull();
    });
  });

  // ─── setSessionKey ─────────────────────────────────────────────────────────

  describe('setSessionKey', () => {
    it('stores a session key for an agent in a room', () => {
      const { createRoom, setSessionKey } = useChatRoomStore.getState();
      const roomId = createRoom('Session Room', ['mission-control']);

      setSessionKey(roomId, 'mission-control', 'session-abc-123');

      const room = useChatRoomStore.getState().rooms.find(r => r.id === roomId)!;
      expect(room.sessionKeys['mission-control']).toBe('session-abc-123');
    });

    it('can store session keys for multiple agents', () => {
      const { createRoom, setSessionKey } = useChatRoomStore.getState();
      const roomId = createRoom('Multi Agent', ['mission-control', 'coder']);

      setSessionKey(roomId, 'mission-control', 'mission-control-session');
      setSessionKey(roomId, 'coder', 'coder-session');

      const room = useChatRoomStore.getState().rooms.find(r => r.id === roomId)!;
      expect(room.sessionKeys['mission-control']).toBe('mission-control-session');
      expect(room.sessionKeys['coder']).toBe('coder-session');
    });
  });

  // ─── updateRoomAgents ──────────────────────────────────────────────────────

  describe('updateRoomAgents', () => {
    it('replaces the agents array for the specified room', () => {
      const { createRoom, updateRoomAgents } = useChatRoomStore.getState();
      const roomId = createRoom('Agent Room', ['mission-control']);

      updateRoomAgents(roomId, ['mission-control', 'coder', 'clara']);

      const room = useChatRoomStore.getState().rooms.find(r => r.id === roomId)!;
      expect(room.agents).toEqual(['mission-control', 'coder', 'clara']);
    });

    it('does not affect other rooms', () => {
      const { createRoom, updateRoomAgents } = useChatRoomStore.getState();
      const room1Id = createRoom('Room 1', ['mission-control']);
      const room2Id = createRoom('Room 2', ['coder']);

      updateRoomAgents(room1Id, ['mission-control', 'clara']);

      const room2 = useChatRoomStore.getState().rooms.find(r => r.id === room2Id)!;
      expect(room2.agents).toEqual(['coder']);
    });
  });

  // ─── Panel Actions ─────────────────────────────────────────────────────────

  describe('togglePanel', () => {
    it('opens a closed panel', () => {
      const { createRoom, togglePanel } = useChatRoomStore.getState();
      const roomId = createRoom('Panel Room', []);

      // Panel starts closed (isOpen: false from createRoom)
      expect(useChatRoomStore.getState().panelState[roomId].isOpen).toBe(false);

      togglePanel(roomId);

      expect(useChatRoomStore.getState().panelState[roomId].isOpen).toBe(true);
    });

    it('closes an open panel', () => {
      const { createRoom, togglePanel } = useChatRoomStore.getState();
      const roomId = createRoom('Panel Room', []);

      togglePanel(roomId); // open
      togglePanel(roomId); // close

      expect(useChatRoomStore.getState().panelState[roomId].isOpen).toBe(false);
    });
  });

  describe('setPanelWidth', () => {
    it('sets the panel width for a room', () => {
      const { createRoom, setPanelWidth } = useChatRoomStore.getState();
      const roomId = createRoom('Width Room', []);

      setPanelWidth(roomId, 600);

      expect(useChatRoomStore.getState().panelState[roomId].width).toBe(600);
    });
  });

  // ─── Artifact Actions ──────────────────────────────────────────────────────

  describe('createArtifact', () => {
    it('creates an artifact in the room and returns its id', () => {
      const { createRoom, createArtifact } = useChatRoomStore.getState();
      const roomId = createRoom('Artifact Room', []);

      const artifactId = createArtifact(roomId, {
        type: 'code',
        createdAt: Date.now(),
        createdBy: 'coder',
        messageId: 'msg-1',
        title: 'Hello World',
        data: { type: 'code', language: 'typescript', code: 'console.log("hi")' },
      });

      expect(artifactId).toBeDefined();
      const room = useChatRoomStore.getState().rooms.find(r => r.id === roomId)!;
      expect(room.artifacts).toHaveLength(1);
      expect(room.artifacts[0].id).toBe(artifactId);
      expect(room.artifacts[0].version).toBe(1);
    });

    it('sets activeArtifactId and opens the panel', () => {
      const { createRoom, createArtifact } = useChatRoomStore.getState();
      const roomId = createRoom('Artifact Room', []);

      const artifactId = createArtifact(roomId, {
        type: 'code',
        createdAt: Date.now(),
        createdBy: 'user',
        messageId: 'msg-2',
        data: { type: 'code', language: 'python', code: 'print("hi")' },
      });

      const state = useChatRoomStore.getState();
      const room = state.rooms.find(r => r.id === roomId)!;
      expect(room.activeArtifactId).toBe(artifactId);
      expect(state.panelState[roomId].isOpen).toBe(true);
    });
  });

  describe('getArtifact', () => {
    it('retrieves an artifact by id', () => {
      const { createRoom, createArtifact, getArtifact } = useChatRoomStore.getState();
      const roomId = createRoom('Get Artifact Room', []);

      const artifactId = createArtifact(roomId, {
        type: 'diagram',
        createdAt: Date.now(),
        createdBy: 'designer',
        messageId: 'msg-d',
        data: { type: 'diagram', format: 'mermaid', source: 'graph TD; A --> B' },
      });

      const artifact = getArtifact(roomId, artifactId);
      expect(artifact).not.toBeNull();
      expect(artifact!.id).toBe(artifactId);
    });

    it('returns null for unknown artifact id', () => {
      const { createRoom, getArtifact } = useChatRoomStore.getState();
      const roomId = createRoom('Empty Room', []);

      expect(getArtifact(roomId, 'nonexistent')).toBeNull();
    });
  });
});
