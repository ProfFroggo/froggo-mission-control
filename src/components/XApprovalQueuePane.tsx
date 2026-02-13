import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { showToast } from './Toast';
import type { XTab } from './XTwitterPage';

interface XApprovalQueuePaneProps {
  tab: XTab;
}

interface ResearchIdea {
  id: string;
  title: string;
  description: string;
  citations: string[];
  proposed_by: string;
  created_at: number;
}

export default function XApprovalQueuePane({ tab }: XApprovalQueuePaneProps) {
  const [items, setItems] = useState<ResearchIdea[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'research') {
      loadResearchIdeas();
    } else {
      setItems([]);
    }
  }, [tab]);

  const loadResearchIdeas = async () => {
    try {
      setLoading(true);
      const result = await (window as any).clawdbot.xResearch.list({ status: 'proposed', limit: 20 });
      
      if (result.success) {
        setItems(result.ideas || []);
      }
    } catch (error) {
      console.error('[XApprovalQueue] Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const result = await (window as any).clawdbot.xResearch.approve({
        id,
        approvedBy: 'kevin', // TODO: Get from user context
      });

      if (result.success) {
        showToast('success', 'Research idea approved');
        loadResearchIdeas(); // Refresh list
      } else {
        throw new Error(result.error || 'Failed to approve');
      }
    } catch (error: any) {
      console.error('[XApprovalQueue] Approve error:', error);
      showToast('error', `Failed to approve: ${error.message}`);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason (optional):');
    
    try {
      const result = await (window as any).clawdbot.xResearch.reject({
        id,
        reason: reason || undefined,
      });

      if (result.success) {
        showToast('success', 'Research idea rejected');
        loadResearchIdeas(); // Refresh list
      } else {
        throw new Error(result.error || 'Failed to reject');
      }
    } catch (error: any) {
      console.error('[XApprovalQueue] Reject error:', error);
      showToast('error', `Failed to reject: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Approval Queue</h3>
          <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
            {items.length} pending
          </span>
        </div>
      </div>

      {/* Queue Items */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <Clock className="w-12 h-12 text-gray-600 mb-3" />
            <p className="font-medium text-gray-300">No items pending approval</p>
            <p className="text-sm mt-1">Items will appear here when agents propose content</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Proposed by {item.proposed_by} • {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <p className="text-sm text-gray-300 mb-3 line-clamp-4">{item.description}</p>
                
                {/* Citations */}
                {item.citations && item.citations.length > 0 && (
                  <div className="mb-3 pb-3 border-b border-gray-700">
                    <p className="text-xs font-medium text-gray-400 mb-2">Citations:</p>
                    <div className="space-y-1">
                      {item.citations.slice(0, 3).map((citation, idx) => (
                        <a
                          key={idx}
                          href={citation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 truncate"
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{citation}</span>
                        </a>
                      ))}
                      {item.citations.length > 3 && (
                        <p className="text-xs text-gray-500">+{item.citations.length - 3} more</p>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(item.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
