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

interface ContentPlan {
  id: string;
  research_idea_id: string;
  title: string;
  content_type: string;
  thread_length: number;
  proposed_by: string;
  created_at: number;
}

interface Draft {
  id: string;
  plan_id: string;
  version: string;
  content: string;
  proposed_by: string;
  created_at: number;
}

type QueueItem = (ResearchIdea | ContentPlan | Draft) & { itemType: 'research' | 'plan' | 'draft' };

export default function XApprovalQueuePane({ tab }: XApprovalQueuePaneProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'research') {
      loadResearchIdeas();
    } else if (tab === 'plan') {
      loadContentPlans();
    } else if (tab === 'drafts') {
      loadDrafts();
    } else {
      setItems([]);
    }
  }, [tab]);

  const loadResearchIdeas = async () => {
    try {
      setLoading(true);
      const result = await (window as any).clawdbot.xResearch.list({ status: 'proposed', limit: 20 });
      
      if (result.success) {
        setItems((result.ideas || []).map((idea: any) => ({ ...idea, itemType: 'research' as const })));
      }
    } catch (error) {
      console.error('[XApprovalQueue] Load research error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContentPlans = async () => {
    try {
      setLoading(true);
      const result = await (window as any).clawdbot.xPlan.list({ status: 'proposed', limit: 20 });
      
      if (result.success) {
        setItems((result.plans || []).map((plan: any) => ({ ...plan, itemType: 'plan' as const })));
      }
    } catch (error) {
      console.error('[XApprovalQueue] Load plans error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDrafts = async () => {
    try {
      setLoading(true);
      const result = await (window as any).clawdbot.xDraft.list({ status: 'draft', limit: 20 });
      
      if (result.success) {
        setItems((result.drafts || []).map((draft: any) => ({ ...draft, itemType: 'draft' as const })));
      }
    } catch (error) {
      console.error('[XApprovalQueue] Load drafts error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, itemType: 'research' | 'plan' | 'draft') => {
    try {
      const api = itemType === 'research' 
        ? (window as any).clawdbot.xResearch 
        : itemType === 'plan'
        ? (window as any).clawdbot.xPlan
        : (window as any).clawdbot.xDraft;
      
      const result = await api.approve({
        id,
        approvedBy: 'kevin', // TODO: Get from user context
      });

      if (result.success) {
        const itemLabel = itemType === 'research' ? 'Research idea' : itemType === 'plan' ? 'Content plan' : 'Draft';
        showToast('success', `${itemLabel} approved`);
        
        // Refresh appropriate list
        if (tab === 'research') loadResearchIdeas();
        else if (tab === 'plan') loadContentPlans();
        else if (tab === 'drafts') loadDrafts();
      } else {
        throw new Error(result.error || 'Failed to approve');
      }
    } catch (error: any) {
      console.error('[XApprovalQueue] Approve error:', error);
      showToast('error', `Failed to approve: ${error.message}`);
    }
  };

  const handleReject = async (id: string, itemType: 'research' | 'plan' | 'draft') => {
    const reason = prompt('Rejection reason (optional):');
    
    try {
      const api = itemType === 'research' 
        ? (window as any).clawdbot.xResearch 
        : itemType === 'plan'
        ? (window as any).clawdbot.xPlan
        : (window as any).clawdbot.xDraft;
      
      const result = await api.reject({
        id,
        reason: reason || undefined,
      });

      if (result.success) {
        const itemLabel = itemType === 'research' ? 'Research idea' : itemType === 'plan' ? 'Content plan' : 'Draft';
        showToast('success', `${itemLabel} rejected`);
        
        // Refresh appropriate list
        if (tab === 'research') loadResearchIdeas();
        else if (tab === 'plan') loadContentPlans();
        else if (tab === 'drafts') loadDrafts();
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
          <span className="px-2 py-1 text-xs bg-warning-subtle text-warning rounded-full">
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
                
                {/* Badges for plans */}
                {item.itemType === 'plan' && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 text-xs bg-info-subtle text-info rounded-full">
                      {(item as ContentPlan).content_type}
                    </span>
                    <span className="px-2 py-1 text-xs bg-review-subtle text-review rounded-full">
                      {(item as ContentPlan).thread_length} tweet{(item as ContentPlan).thread_length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                
                {/* Badges for drafts */}
                {item.itemType === 'draft' && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 text-xs bg-success-subtle text-success rounded-full">
                      Version {(item as Draft).version}
                    </span>
                    <span className="px-2 py-1 text-xs bg-review-subtle text-review rounded-full">
                      {(() => {
                        try {
                          const parsed = JSON.parse((item as Draft).content);
                          return parsed.tweets?.length || 1;
                        } catch {
                          return 1;
                        }
                      })()} tweet{(() => {
                        try {
                          const parsed = JSON.parse((item as Draft).content);
                          return (parsed.tweets?.length || 1) > 1 ? 's' : '';
                        } catch {
                          return '';
                        }
                      })()}
                    </span>
                  </div>
                )}
                
                {/* Content preview */}
                {item.itemType === 'draft' ? (
                  <div className="text-sm text-gray-300 mb-3 space-y-2">
                    {(() => {
                      try {
                        const parsed = JSON.parse((item as Draft).content);
                        return (parsed.tweets || []).slice(0, 2).map((tweet: string, idx: number) => (
                          <div key={idx} className="p-2 bg-gray-900 rounded border border-gray-700">
                            <span className="text-xs text-gray-500">Tweet {idx + 1}:</span>
                            <p className="line-clamp-2">{tweet}</p>
                          </div>
                        ));
                      } catch {
                        return <p className="line-clamp-4">{(item as Draft).content}</p>;
                      }
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 mb-3 line-clamp-4">
                    {'description' in item ? item.description : ''}
                  </p>
                )}
                
                {/* Citations (research only) */}
                {item.itemType === 'research' && 'citations' in item && item.citations && item.citations.length > 0 && (
                  <div className="mb-3 pb-3 border-b border-gray-700">
                    <p className="text-xs font-medium text-gray-400 mb-2">Citations:</p>
                    <div className="space-y-1">
                      {item.citations.slice(0, 3).map((citation, idx) => (
                        <a
                          key={idx}
                          href={citation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-info hover:text-blue-300 truncate"
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
                    onClick={() => handleApprove(item.id, item.itemType)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(item.id, item.itemType)}
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
