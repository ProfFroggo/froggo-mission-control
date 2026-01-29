/**
 * UnifiedCommsInbox - Wrapper that switches between flat and threaded views
 * Provides toggle to switch between CommsInbox (flat) and ThreadedCommsInbox (threaded)
 */

import { useState } from 'react';
import { List, MessageCircle } from 'lucide-react';
import CommsInbox from './CommsInbox';
import ThreadedCommsInbox from './ThreadedCommsInbox';

export default function UnifiedCommsInbox() {
  // View mode: 'flat' for individual messages, 'threaded' for conversations
  const [viewMode, setViewMode] = useState<'flat' | 'threaded'>('threaded');

  return (
    <div className="h-full flex flex-col">
      {/* View toggle header */}
      <div className="bg-clawd-surface border-b border-clawd-border px-4 py-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Communications</h2>
          
          {/* View mode toggle */}
          <div className="flex items-center gap-2 bg-clawd-bg rounded-lg p-1">
            <button
              onClick={() => setViewMode('threaded')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
                viewMode === 'threaded'
                  ? 'bg-clawd-accent text-white shadow-sm'
                  : 'text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border'
              }`}
              title="Threaded view - Group related messages into conversations"
            >
              <MessageCircle size={14} />
              Threaded
            </button>
            
            <button
              onClick={() => setViewMode('flat')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
                viewMode === 'flat'
                  ? 'bg-clawd-accent text-white shadow-sm'
                  : 'text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border'
              }`}
              title="Flat view - Show all messages individually"
            >
              <List size={14} />
              Flat
            </button>
          </div>
        </div>
        
        {/* View description */}
        <p className="text-xs text-clawd-text-dim mt-1">
          {viewMode === 'threaded' 
            ? 'Conversations grouped by subject and participants across all platforms' 
            : 'All messages shown individually in chronological order'
          }
        </p>
      </div>

      {/* Render appropriate view */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'threaded' ? (
          <ThreadedCommsInbox />
        ) : (
          <CommsInbox />
        )}
      </div>
    </div>
  );
}
