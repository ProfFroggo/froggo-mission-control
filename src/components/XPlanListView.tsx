import { useState, useEffect } from 'react';
import { FileText, Plus, ArrowLeft } from 'lucide-react';
import { Button, Spinner, Flex } from '@radix-ui/themes';

import XPlanThreadComposer from './XPlanThreadComposer';
import { scheduleApi } from '../lib/api';

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
      const allItems = await scheduleApi.getAll();
      const plans = (Array.isArray(allItems) ? allItems : [])
        .filter((item: any) => item.type === 'plan');
      setPlans(plans as ContentPlan[]);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-mission-control-bg">
        <Spinner size="3" />
      </div>
    );
  }

  if (showComposer) {
    return (
      <div className="flex flex-col h-full bg-mission-control-bg">
        <div className="p-4 border-b border-mission-control-border">
          <button
            onClick={() => { setShowComposer(false); loadPlans(); }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
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
    <Flex direction="column" height="100%" className="bg-mission-control-bg">
      {/* Header */}
      <Flex align="center" justify="between" className="p-4 border-b border-mission-control-border">
        <Flex align="center" gap="2">
          <FileText className="w-5 h-5 text-[var(--color-info)]" />
          <h3 className="text-lg font-semibold text-mission-control-text">Content Plans</h3>
        </Flex>
        <Button
          onClick={() => setShowComposer(true)}
          variant="solid"
          color="blue"
          size="2"
        >
          <Plus className="w-4 h-4" />
          New Plan
        </Button>
      </Flex>

      {/* List */}
      {plans.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-mission-control-text-dim">
            <FileText className="w-12 h-12 mx-auto mb-3 text-mission-control-text-dim" />
            <p className="font-medium text-mission-control-text">No content plans yet</p>
            <p className="text-sm mt-1">Create a content plan to start drafting tweets.</p>
            <Button
              onClick={() => setShowComposer(true)}
              variant="solid"
              color="blue"
              size="2"
              className="mt-4"
            >
              Create your first plan
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 hover:border-mission-control-accent/20 transition-colors">
              <Flex align="start" justify="between" className="mb-2">
                <h4 className="text-sm font-bold text-mission-control-text">{plan.title}</h4>
              </Flex>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--color-info)]/10 text-[var(--color-info)]">
                  {plan.content_type}
                </span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-mission-control-accent/10 text-mission-control-accent">
                  {plan.thread_length} tweet{plan.thread_length > 1 ? 's' : ''}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  plan.status === 'approved' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' :
                  plan.status === 'rejected' ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]' :
                  'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                }`}>
                  {plan.status}
                </span>
              </div>
              <p className="text-xs text-mission-control-text-dim">
                Proposed by {plan.proposed_by} &middot; {new Date(plan.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </Flex>
  );
}
