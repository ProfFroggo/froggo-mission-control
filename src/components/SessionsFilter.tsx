import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Search, RefreshCw, Clock, ArrowRight, X, Tag, Bell, BellOff, Pin, CheckSquare, Square, Trash2, Archive, FolderPlus, Moon, AlertCircle } from 'lucide-react';
import { useStore } from '../store/store';
import { showToast } from './Toast';
import FolderSelector from './FolderSelector';
import FolderManager from './FolderManager';
import FolderTabs from './FolderTabs';
import DraggableSession from './DraggableSession';
import NotificationSettingsModal from './NotificationSettingsModal';
import BulkFolderAssign from './BulkFolderAssign';
import SnoozeModal from './SnoozeModal';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS as DndCSS } from '@dnd-kit/utilities';

type ChannelFilter = 'all' | 'whatsapp' | 'telegram' | 'discord' | 'webchat' | 'agents';

interface MessageFolder {
  id: number;
  name: string;
  icon: string;
  color: string;
  conversation_count: number;
}

// Sortable session component for pinned items
function SortableSession({ sessionKey, children }: { sessionKey: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sessionKey });

  const style = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

const CHANNELS: { id: ChannelFilter; label: string; icon: string; color: string }[] = [
  { id: 'all', label: 'All', icon: '📋', color: 'text-clawd-text' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬', color: 'text-success' },
  { id: 'telegram', label: 'Telegram', icon: '✈️', color: 'text-info' },
  { id: 'discord', label: 'Discord', icon: '🎮', color: 'text-review' },
  { id: 'webchat', label: 'Webchat', icon: '💻', color: 'text-clawd-text-dim' },
  { id: 'agents', label: 'Agents', icon: '🤖', color: 'text-warning' },
];

export default function SessionsFilter() {
  const { sessions, fetchSessions, connected } = useStore();
  const [filter, setFilter] = useState<ChannelFilter>('all');
  const [search, setSearch] = useState('');
  const [folders, setFolders] = useState<MessageFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [folderAssignments, setFolderAssignments] = useState<Record<string, number[]>>({});
  const [showFolderSelector, setShowFolderSelector] = useState<string | null>(null);
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<Record<string, any>>({});
  const [showNotificationSettings, setShowNotificationSettings] = useState<{ key: string; name: string } | null>(null);
  const [pinnedSessions, setPinnedSessions] = useState<Set<string>>(new Set());
  const [pinnedOrder, setPinnedOrder] = useState<string[]>([]); // Ordered list of pinned session keys
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [showBulkFolderAssign, setShowBulkFolderAssign] = useState(false);
  const [snoozedSessions, setSnoozedSessions] = useState<Record<string, any>>({});
  const [showSnoozeModal, setShowSnoozeModal] = useState<{ key: string; name: string } | null>(null);
  const [showSnoozed, setShowSnoozed] = useState(true);

  // Request deduplication and backoff state
  const fetchingRef = useRef(false);
  const [failCount, setFailCount] = useState(0);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (connected) {
      // Initial load
      const poll = async () => {
        // Skip if already fetching (request deduplication)
        if (fetchingRef.current) {
          console.log('[SessionsFilter] Skipping poll - request already in flight');
          return;
        }
        
        fetchingRef.current = true;
        try {
          await fetchSessions();
          await loadFolders();
          await loadNotificationSettings();
          await loadPinnedSessions();
          await loadSnoozedSessions();
          // Reset fail count on success
          setFailCount(0);
        } catch (error) {
          console.error('[SessionsFilter] Poll failed:', error);
          // Increment fail count for exponential backoff
          setFailCount(f => Math.min(f + 1, 6)); // Max 6 = 64x backoff
        } finally {
          fetchingRef.current = false;
        }
      };

      // Initial poll
      poll();

      // Calculate interval with exponential backoff: 30s, 60s, 120s, 240s, 480s, 960s max
      const interval = 30000 * Math.pow(2, failCount);
      console.log(`[SessionsFilter] Setting poll interval to ${interval}ms (failCount=${failCount})`);
      
      const timer = setInterval(poll, interval);
      return () => clearInterval(timer);
    }
  }, [connected, fetchSessions, failCount]);

  const loadFolders = async () => {
    try {
      const result = await window.clawdbot?.folders.list();
      if (result?.success) {
        setFolders(result?.folders || []);
        
        // Load folder assignments for all sessions
        const assignments: Record<string, number[]> = {};
        for (const session of sessions) {
          const folderResult = await window.clawdbot?.folders.forConversation(session.key);
          if (folderResult?.success && folderResult?.folders.length > 0) {
            assignments[session.key] = folderResult?.folders.map((f: any) => f.id);
          }
        }
        setFolderAssignments(assignments);
      }
    } catch (error) {
      console.error('[SessionsFilter] Failed to load folders:', error);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const settings: Record<string, any> = {};
      for (const session of sessions) {
        const result = await window.clawdbot?.notificationSettings.getEffective(session.key);
        if (result?.success && result?.settings) {
          settings[session.key] = result?.settings;
        }
      }
      setNotificationSettings(settings);
    } catch (error) {
      console.error('[SessionsFilter] Failed to load notification settings:', error);
    }
  };

  const loadPinnedSessions = async () => {
    try {
      const result = await window.clawdbot?.pins.list();
      if (result?.success && result?.pins) {
        // Pins are already sorted by pin_order ASC from the backend
        const orderedKeys = result?.pins.map((p: any) => p.session_key);
        const pinSet = new Set(orderedKeys);
        setPinnedSessions(pinSet);
        setPinnedOrder(orderedKeys);
      }
    } catch (error) {
      console.error('[SessionsFilter] Failed to load pinned sessions:', error);
    }
  };

  const loadSnoozedSessions = async () => {
    try {
      const result = await window.clawdbot?.snooze.list();
      if (result?.success && result.snoozes) {
        const snoozeMap: Record<string, any> = {};
        result?.snoozes.forEach((snooze: any) => {
          snoozeMap[snooze.session_id] = snooze;
        });
        setSnoozedSessions(snoozeMap);
      }
    } catch (error) {
      console.error('[SessionsFilter] Failed to load snoozed sessions:', error);
    }
  };

  const togglePin = async (sessionKey: string) => {
    try {
      const result = await window.clawdbot?.pins.toggle(sessionKey);
      if (result?.success) {
        // Reload pins to update UI
        await loadPinnedSessions();
      } else if (result?.error) {
        // Show error if pin limit reached
        showToast('error', 'Pin Failed', result.error);
      }
    } catch (error) {
      console.error('[SessionsFilter] Failed to toggle pin:', error);
    }
  };

  // Handle drag end for pin reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    // Only handle reordering if both are pinned
    const activeKey = String(active.id);
    const overKey = String(over.id);
    
    if (!pinnedSessions.has(activeKey) || !pinnedSessions.has(overKey)) {
      return;
    }
    
    // Reorder in local state
    const oldIndex = pinnedOrder.indexOf(activeKey);
    const newIndex = pinnedOrder.indexOf(overKey);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const newOrder = [...pinnedOrder];
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, activeKey);
    
    // Optimistically update UI
    setPinnedOrder(newOrder);
    
    // Save to backend
    try {
      const result = await window.clawdbot?.pins.reorder(newOrder);
      if (!result?.success) {
        console.error('[SessionsFilter] Failed to reorder pins:', result?.error);
        // Reload to restore correct order
        await loadPinnedSessions();
      }
    } catch (error) {
      console.error('[SessionsFilter] Failed to reorder pins:', error);
      await loadPinnedSessions();
    }
  };

  const getSessionChannel = (session: any): ChannelFilter => {
    const key = session.key || '';
    const channel = session.channel || '';
    
    if (channel === 'whatsapp' || key.includes('whatsapp')) return 'whatsapp';
    if (channel === 'telegram' || key.includes('telegram')) return 'telegram';
    if (channel === 'discord' || key.includes('discord')) return 'discord';
    if (key.includes('subagent') || key.includes('agent') || key.includes('cron')) return 'agents';
    return 'webchat';
  };

  const filteredSessions = sessions.filter((s: any) => {
    // Channel filter
    if (filter !== 'all' && getSessionChannel(s) !== filter) return false;
    
    // Folder filter
    if (selectedFolder !== null) {
      const sessionFolders = folderAssignments[s.key] || [];
      if (!sessionFolders.includes(selectedFolder)) return false;
    }
    
    // Snooze filter
    const snoozeData = snoozedSessions[s.key];
    if (snoozeData && !showSnoozed) {
      const isExpired = snoozeData.snooze_until <= Date.now();
      // Show expired snoozes (need attention), hide active snoozes
      if (!isExpired) return false;
    }
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const key = (s.key || '').toLowerCase();
      const channel = (s.channel || '').toLowerCase();
      return key.includes(searchLower) || channel.includes(searchLower);
    }
    
    return true;
  }).sort((a: any, b: any) => {
    // Sort by priority:
    // 1. Expired snoozes (reminders) - highest priority
    const aSnooze = snoozedSessions[a.key];
    const bSnooze = snoozedSessions[b.key];
    const aExpired = aSnooze && aSnooze.snooze_until <= Date.now();
    const bExpired = bSnooze && bSnooze.snooze_until <= Date.now();
    
    if (aExpired && !bExpired) return -1;
    if (!aExpired && bExpired) return 1;
    
    // 2. Pinned sessions (ordered by pinnedOrder)
    const aPinned = pinnedSessions.has(a.key);
    const bPinned = pinnedSessions.has(b.key);
    
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    
    // If both pinned, sort by pinnedOrder
    if (aPinned && bPinned) {
      const aIndex = pinnedOrder.indexOf(a.key);
      const bIndex = pinnedOrder.indexOf(b.key);
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
    }
    
    // 3. Active snoozes (push to bottom if not showing snoozed)
    const aSnoozed = aSnooze && aSnooze.snooze_until > Date.now();
    const bSnoozed = bSnooze && bSnooze.snooze_until > Date.now();
    
    if (!showSnoozed) {
      if (aSnoozed && !bSnoozed) return 1;
      if (!aSnoozed && bSnoozed) return -1;
    }
    
    // 4. Within same category, sort by updatedAt (most recent first)
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  const channelCounts = CHANNELS.map(ch => ({
    ...ch,
    count: ch.id === 'all' 
      ? sessions.length 
      : sessions.filter((s: any) => getSessionChannel(s) === ch.id).length
  }));

  const formatTimeAgo = (ts: number) => {
    if (!ts) return 'unknown';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  const getSessionName = (session: any) => {
    const key = session.key || '';
    const parts = key.split(':');
    const last = parts[parts.length - 1];
    if (last.includes('-') && last.length > 20) {
      return last.slice(0, 12) + '...';
    }
    return last || session.channel || 'Unknown';
  };

  // Bulk action handlers
  const toggleSessionSelection = (sessionKey: string) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionKey)) {
      newSelected.delete(sessionKey);
    } else {
      newSelected.add(sessionKey);
    }
    setSelectedSessions(newSelected);
  };

  const selectAll = () => {
    const allKeys = new Set(filteredSessions.map((s: any) => s.key));
    setSelectedSessions(allKeys);
  };

  const selectNone = () => {
    setSelectedSessions(new Set());
  };

  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    if (bulkMode) {
      // Exiting bulk mode, clear selection
      setSelectedSessions(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSessions.size === 0) return;
    if (!confirm(`⚠️ DELETE ${selectedSessions.size} conversation(s)?\n\nThis will permanently remove all messages and cannot be undone.\n\nConsider using Archive instead to preserve conversations.`)) return;
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      // Delete each selected session
      for (const sessionKey of selectedSessions) {
        try {
          const result = await window.clawdbot?.conversations.delete(sessionKey);
          if (result?.success) {
            successCount++;
          } else {
            errorCount++;
            console.error(`[SessionsFilter] Failed to delete ${sessionKey}:`, result?.error);
          }
        } catch (error) {
          errorCount++;
          console.error(`[SessionsFilter] Error deleting ${sessionKey}:`, error);
        }
      }
      
      // Show result
      if (errorCount === 0) {
        showToast('success', 'Deleted', `Successfully deleted ${successCount} conversation(s)`);
      } else {
        showToast('warning', 'Partial Success', `Deleted ${successCount} conversation(s), ${errorCount} failed`);
      }
      
      // Refresh and clear selection
      await fetchSessions();
      await loadFolders();
      setSelectedSessions(new Set());
    } catch (error) {
      console.error('[SessionsFilter] Bulk delete error:', error);
      showToast('error', 'Delete Failed', 'Failed to delete conversations');
    }
  };

  const handleBulkArchive = async () => {
    if (selectedSessions.size === 0) return;
    if (!confirm(`Archive ${selectedSessions.size} session(s)?`)) return;
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      // Archive each selected session
      for (const sessionKey of selectedSessions) {
        try {
          const result = await window.clawdbot?.conversations.archive(sessionKey);
          if (result?.success) {
            successCount++;
          } else {
            errorCount++;
            console.error(`[SessionsFilter] Failed to archive ${sessionKey}:`, result?.error);
          }
        } catch (error) {
          errorCount++;
          console.error(`[SessionsFilter] Error archiving ${sessionKey}:`, error);
        }
      }
      
      // Show result
      if (errorCount === 0) {
        showToast('success', 'Archived', `Successfully archived ${successCount} session(s)`);
      } else {
        showToast('warning', 'Partial Success', `Archived ${successCount} session(s), ${errorCount} failed`);
      }
      
      // Refresh and clear selection
      await fetchSessions();
      await loadFolders();
      setSelectedSessions(new Set());
    } catch (error) {
      console.error('[SessionsFilter] Bulk archive error:', error);
      showToast('error', 'Archive Failed', 'Failed to archive sessions');
    }
  };

  const handleBulkMarkRead = async () => {
    if (selectedSessions.size === 0) return;
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      // Mark each selected session as read
      for (const sessionKey of selectedSessions) {
        try {
          const result = await window.clawdbot?.conversations.markRead(sessionKey);
          if (result?.success) {
            successCount++;
          } else {
            errorCount++;
            console.error(`[SessionsFilter] Failed to mark ${sessionKey} as read:`, result?.error);
          }
        } catch (error) {
          errorCount++;
          console.error(`[SessionsFilter] Error marking ${sessionKey} as read:`, error);
        }
      }
      
      // Show result
      if (errorCount === 0) {
        showToast('success', 'Marked as Read', `Marked ${successCount} conversation(s) as read`);
      } else {
        showToast('warning', 'Partial Success', `Marked ${successCount} conversation(s) as read, ${errorCount} failed`);
      }
      
      // Refresh and clear selection
      await fetchSessions();
      setSelectedSessions(new Set());
    } catch (error) {
      console.error('[SessionsFilter] Bulk mark read error:', error);
      showToast('error', 'Action Failed', 'Failed to mark conversations as read');
    }
  };

  const handleBulkFolderAssign = () => {
    if (selectedSessions.size === 0) return;
    setShowBulkFolderAssign(true);
  };

  // Handle conversation drop on folder tab
  const handleConversationDrop = async (sessionKey: string, folderId: number) => {
    try {
      console.log('[SessionsFilter] Dropping conversation', sessionKey, 'on folder', folderId);
      const result = await window.clawdbot?.folders.assign(folderId, sessionKey);
      if (result?.success) {
        // Refresh folders and assignments
        await loadFolders();
      } else {
        console.error('[SessionsFilter] Failed to assign folder:', result?.error);
        showToast('error', 'Assignment Failed', 'Failed to assign to folder');
      }
    } catch (error) {
      console.error('[SessionsFilter] Error assigning folder:', error);
      showToast('error', 'Assignment Failed', 'Failed to assign to folder');
    }
  };

  // Separate pinned and unpinned sessions for rendering
  const pinnedSessionsList = filteredSessions.filter((s: any) => pinnedSessions.has(s.key));
  const unpinnedSessionsList = filteredSessions.filter((s: any) => !pinnedSessions.has(s.key));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare size={20} />
            Sessions
            <span className="text-sm font-normal text-clawd-text-dim">
              ({filteredSessions.length})
            </span>
            {selectedSessions.size > 0 && (
              <span className="text-sm font-medium text-clawd-accent">
                {selectedSessions.size} selected
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSnoozed(!showSnoozed)}
              className={`p-2 rounded-lg transition-colors ${
                showSnoozed 
                  ? 'hover:bg-clawd-border' 
                  : 'bg-info-subtle text-info border border-info-border'
              }`}
              title={showSnoozed ? 'Hide snoozed conversations' : 'Show snoozed conversations'}
            >
              <Moon size={16} />
            </button>
            <button
              onClick={toggleBulkMode}
              className={`p-2 rounded-lg transition-colors ${
                bulkMode 
                  ? 'bg-clawd-accent text-white' 
                  : 'hover:bg-clawd-border'
              }`}
              title={bulkMode ? 'Exit bulk mode' : 'Enter bulk mode'}
            >
              {bulkMode ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
            <button
              onClick={fetchSessions}
              className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Bulk Action Toolbar */}
        {bulkMode && (
          <div className="mb-4 p-3 bg-clawd-bg border border-clawd-border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs px-3 py-1.5 bg-clawd-border hover:bg-clawd-accent hover:text-white rounded-lg transition-colors"
                >
                  Select All ({filteredSessions.length})
                </button>
                <button
                  onClick={selectNone}
                  className="text-xs px-3 py-1.5 bg-clawd-border hover:bg-clawd-accent hover:text-white rounded-lg transition-colors"
                  disabled={selectedSessions.size === 0}
                >
                  Clear Selection
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkMarkRead}
                  disabled={selectedSessions.size === 0}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-success-subtle text-success border border-success-border hover:bg-green-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckSquare size={14} />
                  Mark Read ({selectedSessions.size})
                </button>
                <button
                  onClick={handleBulkFolderAssign}
                  disabled={selectedSessions.size === 0}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-info-subtle text-info border border-info-border hover:bg-blue-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FolderPlus size={14} />
                  Assign to Folders
                </button>
                <button
                  onClick={handleBulkArchive}
                  disabled={selectedSessions.size === 0}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-yellow-500/10 text-warning border border-warning-border hover:bg-yellow-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Archive size={14} />
                  Archive ({selectedSessions.size})
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedSessions.size === 0}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-error-subtle text-error border border-error-border hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                  Delete ({selectedSessions.size})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="w-full bg-clawd-bg border border-clawd-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-clawd-accent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-clawd-text-dim hover:text-clawd-text"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Channel Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {channelCounts.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setFilter(ch.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                filter === ch.id
                  ? 'bg-clawd-accent text-white'
                  : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              <span>{ch.icon}</span>
              <span>{ch.label}</span>
              {ch.count > 0 && (
                <span className={`text-xs px-1.5 rounded-full ${
                  filter === ch.id ? 'bg-white/20' : 'bg-clawd-bg'
                }`}>
                  {ch.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Folder Tabs (Telegram-style) */}
      <FolderTabs
        selectedFolder={selectedFolder}
        onSelectFolder={setSelectedFolder}
        onRefresh={loadFolders}
        onConversationDrop={handleConversationDrop}
      />

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="p-8 text-center text-clawd-text-dim">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
            <p>{search || filter !== 'all' ? 'No matching sessions' : 'No active sessions'}</p>
          </div>
        ) : (
          <>
            {/* Pinned Sessions Section */}
            {pinnedSessionsList.length > 0 && (
              <div className="bg-gradient-to-b from-clawd-accent/5 to-transparent">
                <div className="sticky top-0 z-10 px-4 py-2 bg-clawd-surface/95 backdrop-blur-sm border-b border-clawd-accent/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pin size={14} className="text-clawd-accent fill-current" />
                    <span className="text-xs font-semibold text-clawd-accent uppercase tracking-wide">
                      Pinned ({pinnedSessionsList.length}/10)
                    </span>
                  </div>
                  <span className="text-xs text-clawd-text-dim flex items-center gap-1">
                    <span className="hidden sm:inline">Drag to reorder</span>
                    <span className="text-clawd-accent">⇅</span>
                  </span>
                </div>
                <SortableContext items={pinnedOrder} strategy={verticalListSortingStrategy}>
                  <div className="divide-y divide-clawd-border/50">
                    {pinnedSessionsList.map((session: any) => {
                      const channel = getSessionChannel(session);
                      const channelInfo = CHANNELS.find(c => c.id === channel) || CHANNELS[0];
                      const isActive = Date.now() - (session.updatedAt || 0) < 300000;
                      const notifSettings = notificationSettings[session.key];
                      const isMuted = notifSettings?.is_effectively_muted === 1;
                      const snoozeData = snoozedSessions[session.key];
                      const isSnoozed = snoozeData && snoozeData.snooze_until > Date.now();
                      const isSnoozeExpired = snoozeData && snoozeData.snooze_until <= Date.now();
                      
                      return (
                        <SortableSession key={session.key} sessionKey={session.key}>
                  <div
                    className={`p-4 transition-colors group ${
                      selectedSessions.has(session.key) 
                        ? 'bg-clawd-accent/10 border-l-2 border-clawd-accent' 
                        : 'hover:bg-clawd-bg/50'
                    }`}
                  >
                  <div className="flex items-start gap-3">
                    {bulkMode && (
                      <div className="pt-1">
                        <input
                          type="checkbox"
                          checked={selectedSessions.has(session.key)}
                          onChange={() => toggleSessionSelection(session.key)}
                          className="w-4 h-4 rounded border-clawd-border bg-clawd-bg text-clawd-accent focus:ring-clawd-accent focus:ring-offset-0 cursor-pointer"
                        />
                      </div>
                    )}
                    <div className="text-2xl">{channelInfo.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-clawd-bg0'}`} />
                        <span className="font-medium truncate">{getSessionName(session)}</span>
                        {pinnedSessions.has(session.key) && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-clawd-accent/10 text-clawd-accent border border-clawd-accent/30 rounded-full text-xs">
                            <Pin size={14} className="fill-current" />
                            Pinned
                          </span>
                        )}
                        {isMuted && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-warning border border-warning-border rounded-full text-xs">
                            <BellOff size={14} />
                            Muted
                          </span>
                        )}
                        {isSnoozeExpired && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-error-subtle text-error border border-error-border rounded-full text-xs animate-pulse">
                            <AlertCircle size={14} />
                            Reminder
                          </span>
                        )}
                        {isSnoozed && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-info-subtle text-info border border-info-border rounded-full text-xs">
                            <Moon size={14} />
                            Snoozed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-clawd-text-dim flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full ${channelInfo.color} bg-clawd-border`}>
                          {channelInfo.label}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatTimeAgo(session.updatedAt)}
                        </span>
                        <span>{(session.totalTokens || 0).toLocaleString()} tokens</span>
                      </div>
                      {/* Folder Tags */}
                      {folderAssignments[session.key]?.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {folderAssignments[session.key].map((folderId) => {
                            const folder = folders.find((f) => f.id === folderId);
                            if (!folder) return null;
                            return (
                              <span
                                key={folderId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                                style={{ backgroundColor: folder.color }}
                              >
                                {folder.icon}
                                {folder.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {session.model && (
                        <div className="text-xs text-clawd-text-dim mt-1 truncate">
                          {session.model.split('/').pop()}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(session.key);
                        }}
                        className={`p-2 hover:bg-clawd-border rounded-lg transition-colors ${pinnedSessions.has(session.key) ? 'text-clawd-accent' : ''}`}
                        title={pinnedSessions.has(session.key) ? 'Unpin conversation' : 'Pin conversation'}
                      >
                        <Pin size={14} className={pinnedSessions.has(session.key) ? 'fill-current' : ''} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSnoozeModal({ key: session.key, name: getSessionName(session) });
                        }}
                        className={`p-2 hover:bg-clawd-border rounded-lg transition-colors ${isSnoozed ? 'text-info' : ''} ${isSnoozeExpired ? 'text-error animate-pulse' : ''}`}
                        title={isSnoozed ? 'Update snooze' : isSnoozeExpired ? 'Expired reminder - click to manage' : 'Snooze conversation'}
                      >
                        {isSnoozeExpired ? <AlertCircle size={14} /> : <Moon size={14} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowNotificationSettings({ key: session.key, name: getSessionName(session) });
                        }}
                        className={`p-2 hover:bg-clawd-border rounded-lg transition-colors ${isMuted ? 'text-warning' : ''}`}
                        title="Notification settings"
                      >
                        {isMuted ? <BellOff size={14} /> : <Bell size={14} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFolderSelector(session.key);
                        }}
                        className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                        title="Assign to folders"
                      >
                        <Tag size={14} />
                      </button>
                      <ArrowRight size={16} className="text-clawd-text-dim mt-2" />
                          </div>
                        </div>
                      </div>
                    </SortableSession>
                  );
                })}
              </div>
            </SortableContext>
          </div>
        )}

        {/* Unpinned Sessions Section */}
        {unpinnedSessionsList.length > 0 && (
          <>
            {pinnedSessionsList.length > 0 && (
              <div className="sticky top-0 z-10 px-4 py-2 bg-clawd-surface border-b border-clawd-border">
                <span className="text-xs font-medium text-clawd-text-dim uppercase tracking-wide">
                  All Conversations ({unpinnedSessionsList.length})
                </span>
              </div>
            )}
            <div className="divide-y divide-clawd-border">
              {unpinnedSessionsList.map((session: any) => {
                const channel = getSessionChannel(session);
                const channelInfo = CHANNELS.find(c => c.id === channel) || CHANNELS[0];
                const isActive = Date.now() - (session.updatedAt || 0) < 300000;
                const notifSettings = notificationSettings[session.key];
                const isMuted = notifSettings?.is_effectively_muted === 1;
                const snoozeData = snoozedSessions[session.key];
                const isSnoozed = snoozeData && snoozeData.snooze_until > Date.now();
                const isSnoozeExpired = snoozeData && snoozeData.snooze_until <= Date.now();
                
                return (
                  <DraggableSession
                    key={session.key}
                    sessionKey={session.key}
                    disabled={bulkMode}
                  >
                    <div
                      className={`p-4 transition-colors group ${
                        selectedSessions.has(session.key) 
                          ? 'bg-clawd-accent/10 border-l-2 border-clawd-accent' 
                          : 'hover:bg-clawd-bg/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {bulkMode && (
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              checked={selectedSessions.has(session.key)}
                              onChange={() => toggleSessionSelection(session.key)}
                              className="w-4 h-4 rounded border-clawd-border bg-clawd-bg text-clawd-accent focus:ring-clawd-accent focus:ring-offset-0 cursor-pointer"
                            />
                          </div>
                        )}
                        <div className="text-2xl">{channelInfo.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-clawd-bg0'}`} />
                            <span className="font-medium truncate">{getSessionName(session)}</span>
                            {isMuted && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-warning border border-warning-border rounded-full text-xs">
                                <BellOff size={14} />
                                Muted
                              </span>
                            )}
                            {isSnoozeExpired && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-error-subtle text-error border border-error-border rounded-full text-xs animate-pulse">
                                <AlertCircle size={14} />
                                Reminder
                              </span>
                            )}
                            {isSnoozed && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-info-subtle text-info border border-info-border rounded-full text-xs">
                                <Moon size={14} />
                                Snoozed
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-clawd-text-dim flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full ${channelInfo.color} bg-clawd-border`}>
                              {channelInfo.label}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {formatTimeAgo(session.updatedAt)}
                            </span>
                            <span>{(session.totalTokens || 0).toLocaleString()} tokens</span>
                          </div>
                          {/* Folder Tags */}
                          {folderAssignments[session.key]?.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {folderAssignments[session.key].map((folderId) => {
                                const folder = folders.find((f) => f.id === folderId);
                                if (!folder) return null;
                                return (
                                  <span
                                    key={folderId}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                                    style={{ backgroundColor: folder.color }}
                                  >
                                    {folder.icon}
                                    {folder.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {session.model && (
                            <div className="text-xs text-clawd-text-dim mt-1 truncate">
                              {session.model.split('/').pop()}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin(session.key);
                            }}
                            className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                            title="Pin conversation"
                          >
                            <Pin size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowSnoozeModal({ key: session.key, name: getSessionName(session) });
                            }}
                            className={`p-2 hover:bg-clawd-border rounded-lg transition-colors ${isSnoozed ? 'text-info' : ''} ${isSnoozeExpired ? 'text-error animate-pulse' : ''}`}
                            title={isSnoozed ? 'Update snooze' : isSnoozeExpired ? 'Expired reminder - click to manage' : 'Snooze conversation'}
                          >
                            {isSnoozeExpired ? <AlertCircle size={14} /> : <Moon size={14} />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowNotificationSettings({ key: session.key, name: getSessionName(session) });
                            }}
                            className={`p-2 hover:bg-clawd-border rounded-lg transition-colors ${isMuted ? 'text-warning' : ''}`}
                            title="Notification settings"
                          >
                            {isMuted ? <BellOff size={14} /> : <Bell size={14} />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowFolderSelector(session.key);
                            }}
                            className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                            title="Assign to folders"
                          >
                            <Tag size={14} />
                          </button>
                          <ArrowRight size={16} className="text-clawd-text-dim mt-2" />
                        </div>
                      </div>
                    </div>
                  </DraggableSession>
                );
              })}
            </div>
          </>
        )}
      </>
    )}
  </div>

      {/* Folder Selector Modal */}
      {showFolderSelector && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowFolderSelector(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <FolderSelector
              sessionKey={showFolderSelector}
              onClose={() => {
                setShowFolderSelector(null);
                loadFolders(); // Refresh folder data
              }}
            />
          </div>
        </div>
      )}

      {/* Folder Manager Modal */}
      {showFolderManager && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowFolderManager(false)}
        >
          <div
            className="w-full max-w-3xl h-[80vh] bg-clawd-surface rounded-lg shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <FolderManager
              onClose={() => {
                setShowFolderManager(false);
                loadFolders(); // Refresh folder data
              }}
            />
          </div>
        </div>
      )}

      {/* Notification Settings Modal */}
      {showNotificationSettings && (
        <NotificationSettingsModal
          sessionKey={showNotificationSettings.key}
          sessionName={showNotificationSettings.name}
          onClose={() => {
            setShowNotificationSettings(null);
            loadNotificationSettings(); // Refresh notification settings
          }}
        />
      )}

      {/* Bulk Folder Assignment Modal */}
      {showBulkFolderAssign && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowBulkFolderAssign(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <BulkFolderAssign
              sessionKeys={Array.from(selectedSessions)}
              onClose={() => {
                setShowBulkFolderAssign(false);
                loadFolders(); // Refresh folder data
                setSelectedSessions(new Set()); // Clear selection after assignment
              }}
            />
          </div>
        </div>
      )}

      {/* Snooze Modal */}
      {showSnoozeModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowSnoozeModal(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <SnoozeModal
              sessionKey={showSnoozeModal.key}
              sessionName={showSnoozeModal.name}
              onClose={() => {
                setShowSnoozeModal(null);
                loadSnoozedSessions(); // Refresh snooze data
              }}
            />
          </div>
        </div>
      )}
    </div>
    </DndContext>
  );
}
