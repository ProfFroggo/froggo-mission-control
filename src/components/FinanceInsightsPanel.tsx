import { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, Lightbulb, Bell, Target, BarChart3, X, Loader2 } from 'lucide-react';
import { showToast } from './Toast';

interface Insight {
  id: string;
  type: string;
  title: string;
  content: string;
  severity: string;
  generated_at: number;
}

export default function FinanceInsightsPanel() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInsights();
    
    // Refresh insights every 30 seconds
    const interval = setInterval(loadInsights, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await (window as any).clawdbot?.invoke('finance:getInsights');
      
      if (result?.success) {
        setInsights(result.insights || []);
      } else {
        throw new Error(result?.error || 'Failed to load insights');
      }
    } catch (err: any) {
      console.error('[FinanceInsights] Load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const dismissInsight = async (insightId: string) => {
    try {
      const result = await (window as any).clawdbot?.invoke('finance:dismissInsight', insightId);
      
      if (result?.success) {
        // Remove from UI
        setInsights(prev => prev.filter(i => i.id !== insightId));
        showToast('success', 'Insight dismissed');
      } else {
        throw new Error(result?.error || 'Failed to dismiss insight');
      }
    } catch (err: any) {
      console.error('[FinanceInsights] Dismiss error:', err);
      showToast('error', 'Failed to dismiss insight');
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'spending_pattern':
        return <BarChart3 className="w-5 h-5" />;
      case 'anomaly':
        return <AlertTriangle className="w-5 h-5" />;
      case 'recommendation':
        return <Lightbulb className="w-5 h-5" />;
      case 'alert':
        return <Bell className="w-5 h-5" />;
      case 'budget_status':
        return <TrendingUp className="w-5 h-5" />;
      case 'goal_progress':
        return <Target className="w-5 h-5" />;
      default:
        return <Lightbulb className="w-5 h-5" />;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-300';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300';
      default:
        return 'bg-blue-500/10 border-blue-500/30 text-blue-300';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (loading && insights.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-400">Loading AI insights...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-300">
          <AlertTriangle className="w-5 h-5" />
          <span>Failed to load insights: {error}</span>
        </div>
        <button
          onClick={loadInsights}
          className="mt-2 text-sm text-red-400 hover:text-red-300"
        >
          Retry
        </button>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-600" />
        <p className="text-sm">No AI insights yet</p>
        <p className="text-xs mt-1">Upload transactions to get analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          AI Insights
          <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
            {insights.length}
          </span>
        </h3>
      </div>

      {insights.map((insight) => (
        <div
          key={insight.id}
          className={`rounded-lg border p-4 ${getSeverityStyles(insight.severity)}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="mt-0.5">
                {getInsightIcon(insight.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold mb-1">{insight.title}</h4>
                <div className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                  {insight.content}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {formatTimestamp(insight.generated_at)}
                </div>
              </div>
            </div>
            <button
              onClick={() => dismissInsight(insight.id)}
              className="p-1 hover:bg-gray-800/50 rounded transition-colors flex-shrink-0"
              title="Dismiss insight"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
