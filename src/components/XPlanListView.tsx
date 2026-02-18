import { useState, useEffect } from 'react';
import { FileText, Plus, ArrowLeft } from 'lucide-react';
import XPlanThreadComposer from './XPlanThreadComposer';

interface ContentPlan {
  id: string;
  title: string;
  content_type: string;
  thread_length: number;
  status: string;
  proposed_by: string;
  created_at: number;
}

export default function XPlanListView() {
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const result = await window.clawdbot?.xPlan?.list({ limit: 50 });
      if (result?.success) {
        setPlans((result.plans || []) as ContentPlan[]);
      }
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-success-subtle text-success';
      case 'rejected':
        return 'bg-error-subtle text-error';
      default:
        return 'bg-warning-subtle text-warning';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-clawd-bg">
        <div className="w-8 h-8 border-2 border-info border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showComposer) {
    return (
      <div className="flex flex-col h-full bg-clawd-bg">
        <div className="p-4 border-b border-clawd-border">
          <button
            onClick={() => { setShowComposer(false); loadPlans(); }}
            className="flex items-center gap-2 text-sm text-clawd-text-dim hover:text-clawd-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to list
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <XPlanThreadComposer />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-clawd-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-clawd-border">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-info" />
          <h3 className="text-lg font-semibold text-clawd-text">Content Plans</h3>
        </div>
        <button
          onClick={() => setShowComposer(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-info hover:bg-info/80 text-clawd-text rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Plan
        </button>
      </div>

      {/* List */}
      {plans.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-clawd-text-dim">
            <FileText className="w-12 h-12 mx-auto mb-3 text-clawd-text-dim" />
            <p className="font-medium text-clawd-text">No content plans yet</p>
            <p className="text-sm mt-1">Create a content plan to start drafting tweets.</p>
            <button
              onClick={() => setShowComposer(true)}
              className="mt-4 px-4 py-2 text-sm bg-info hover:bg-info/80 text-clawd-text rounded-lg transition-colors"
            >
              Create your first plan
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-clawd-bg-alt border border-clawd-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-bold text-clawd-text">{plan.title}</h4>
              </div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="px-2 py-1 text-xs bg-info-subtle text-info rounded-full">
                  {plan.content_type}
                </span>
                <span className="px-2 py-1 text-xs bg-review-subtle text-review rounded-full">
                  {plan.thread_length} tweet{plan.thread_length > 1 ? 's' : ''}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(plan.status)}`}>
                  {plan.status}
                </span>
              </div>
              <p className="text-xs text-clawd-text-dim">
                Proposed by {plan.proposed_by} &middot; {new Date(plan.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
