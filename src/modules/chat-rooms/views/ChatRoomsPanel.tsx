'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  messageCount?: number;
  lastActivity?: number;
}

interface ChatMessage {
  id: number;
  roomId: string;
  agentId: string;
  content: string;
  timestamp: number;
  replyTo?: number;
  replyCount?: number;
}

export default function ChatRoomsPanel() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Load rooms on mount
  useEffect(() => {
    fetchRooms();
  }, []);

  // Poll messages when room selected
  useEffect(() => {
    if (!selectedRoom) return;
    fetchMessages(selectedRoom);
    pollRef.current = setInterval(() => fetchMessages(selectedRoom), 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedRoom]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchRooms() {
    try {
      const res = await fetch('/api/chat-rooms');
      if (res.ok) setRooms(await res.json());
    } catch {}
  }

  async function fetchMessages(roomId: string) {
    try {
      const res = await fetch(`/api/chat-rooms/${roomId}/messages?limit=50`);
      if (res.ok) setMessages(await res.json());
    } catch {}
  }

  async function sendMessage() {
    if (!input.trim() || !selectedRoom) return;
    setLoading(true);
    try {
      await fetch(`/api/chat-rooms/${selectedRoom}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input, agentId: 'human' }),
      });
      setInput('');
      await fetchMessages(selectedRoom);
    } catch {}
    setLoading(false);
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const activeRoom = rooms.find(r => r.id === selectedRoom);

  return (
    <div className="flex h-full bg-gray-900 text-gray-100">
      {/* Room List */}
      <div className="w-56 flex-shrink-0 border-r border-gray-700 flex flex-col">
        <div className="p-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Chat Rooms</h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${
                selectedRoom === room.id ? 'bg-gray-800 text-white' : 'text-gray-400'
              }`}
            >
              <span className="text-gray-500">#</span> {room.name}
              {room.messageCount !== undefined && room.messageCount > 0 && (
                <span className="ml-1 text-xs text-gray-500">({room.messageCount})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedRoom ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
              <span className="text-gray-400">#</span>
              <span className="font-medium">{activeRoom?.name}</span>
              {activeRoom?.description && (
                <span className="text-sm text-gray-500">— {activeRoom.description}</span>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-sm text-center mt-8">No messages yet</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className="flex gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      msg.agentId === 'human' ? 'bg-blue-600' : 'bg-emerald-700'
                    }`}>
                      {msg.agentId[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-200">{msg.agentId}</span>
                        <span className="text-xs text-gray-500">{formatTime(msg.timestamp)}</span>
                      </div>
                      <p className="text-sm text-gray-300 break-words">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={`Message #${activeRoom?.name ?? ''}`}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-400"
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500">Select a room to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
