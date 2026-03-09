// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';

export interface ReadStateSummary {
  platform: string;
  chatId: string;
  chatName?: string;
  unreadCount: number;
  unrepliedCount: number;
  lastMessageTimestamp?: string;
  oldestUnreplied?: string;
}

export interface ReadStateStats {
  totalUnread: number;
  totalUnreplied: number;
  byPlatform: Record<string, { unread: number; unreplied: number }>;
  chats: ReadStateSummary[];
}

const API_BASE = 'http://localhost:8182';

export function useReadState(refreshInterval = 5000) {
  const [stats, setStats] = useState<ReadStateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReadState = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/read-state/summary`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      // '[useReadState] Failed to fetch:', err;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReadState();
    
    if (refreshInterval > 0) {
      const interval = setInterval(fetchReadState, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchReadState, refreshInterval]);

  const markRead = useCallback(async (platform: string, chatId: string, messageId?: string) => {
    try {
      await fetch(`${API_BASE}/api/read-state/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, chatId, messageId }),
      });
      fetchReadState(); // Refresh after marking
    } catch (err) {
      // '[useReadState] Failed to mark read:', err;
    }
  }, [fetchReadState]);

  const markReplied = useCallback(async (platform: string, chatId: string, messageId?: string) => {
    try {
      await fetch(`${API_BASE}/api/read-state/mark-replied`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, chatId, messageId }),
      });
      fetchReadState(); // Refresh after marking
    } catch (err) {
      // '[useReadState] Failed to mark replied:', err;
    }
  }, [fetchReadState]);

  return {
    stats,
    loading,
    error,
    refresh: fetchReadState,
    markRead,
    markReplied,
  };
}

export function useChatReadState(platform: string, chatId: string) {
  const [unreadMessages, setUnreadMessages] = useState<any[]>([]);
  const [unrepliedMessages, setUnrepliedMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChatState = useCallback(async () => {
    try {
      setLoading(true);
      const [unreadRes, unrepliedRes] = await Promise.all([
        fetch(`${API_BASE}/api/read-state/chat-unread?platform=${platform}&chatId=${encodeURIComponent(chatId)}`),
        fetch(`${API_BASE}/api/read-state/chat-unreplied?platform=${platform}&chatId=${encodeURIComponent(chatId)}`),
      ]);

      const unread = unreadRes.ok ? await unreadRes.json() : [];
      const unreplied = unrepliedRes.ok ? await unrepliedRes.json() : [];

      setUnreadMessages(unread);
      setUnrepliedMessages(unreplied);
    } catch (err) {
      // '[useChatReadState] Failed to fetch:', err;
    } finally {
      setLoading(false);
    }
  }, [platform, chatId]);

  useEffect(() => {
    if (platform && chatId) {
      fetchChatState();
    }
  }, [platform, chatId, fetchChatState]);

  return {
    unreadMessages,
    unrepliedMessages,
    loading,
    refresh: fetchChatState,
  };
}
