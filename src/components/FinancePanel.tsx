import { useState, useEffect, useRef } from 'react';
import { Upload, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Coins, Bell, MessageSquare } from 'lucide-react';
import { showToast } from './Toast';
import FinanceAgentChat from './FinanceAgentChat';
import FinanceInsightsPanel from './FinanceInsightsPanel';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  account_id: string;
}

interface BudgetCategory {
  category: string;
  spent: number;
  limit: number;
  currency: string;
}

interface Budget {
  id: string;
  name: string;
  type: 'family' | 'crypto';
  total_spent: number;
  total_limit: number;
  currency: string;
  categories: BudgetCategory[];
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  timestamp: number;
  data?: any;
}

interface Insight {
  type: string;
  title: string;
  description: string;
  data?: any;
}

export default function FinancePanel() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [familyBudget, setFamilyBudget] = useState<Budget | null>(null);
  const [cryptoBudget, setCryptoBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [chatOpen, setChatOpen] = useState(true); // AI chat panel
  const lastAlertCheck = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadFinanceData();
    loadAlerts();
    
    // Check for new alerts every 30 seconds
    const alertInterval = setInterval(() => {
      loadAlerts();
    }, 30000);
    
    return () => clearInterval(alertInterval);
  }, []);

  const loadFinanceData = async () => {
    try {
      setLoading(true);
      
      // Load transactions
      const txResult = await (window as any).clawdbot?.finance?.getTransactions();
      if (txResult?.success) {
        setTransactions(txResult.transactions || []);
      }

      // Load family budget
      const familyResult = await (window as any).clawdbot?.finance?.getBudgetStatus('family');
      if (familyResult?.success) {
        setFamilyBudget(familyResult.budget);
      }

      // Load crypto budget
      const cryptoResult = await (window as any).clawdbot?.finance?.getBudgetStatus('crypto');
      if (cryptoResult?.success) {
        setCryptoBudget(cryptoResult.budget);
      }
    } catch (error) {
      console.error('[Finance] Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      // Load alerts
      const alertsResult = await (window as any).clawdbot?.finance?.getAlerts();
      if (alertsResult?.success) {
        const newAlerts = alertsResult.alerts || [];
        setAlerts(newAlerts);
        
        // Show toasts for new alerts
        newAlerts.forEach((alert: Alert) => {
          if (!lastAlertCheck.current.has(alert.id)) {
            const toastType = alert.severity === 'critical' ? 'error' : 
                            alert.severity === 'warning' ? 'warning' : 'info';
            showToast(toastType, alert.title, alert.message);
            lastAlertCheck.current.add(alert.id);
          }
        });
      }

      // Load insights
      const insightsResult = await (window as any).clawdbot?.finance?.getInsights();
      if (insightsResult?.success) {
        setInsights(insightsResult.insights || []);
      }
    } catch (error) {
      console.error('[Finance] Alerts load error:', error);
    }
  };

  const handleUploadClick = () => {
    setUploadModalOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    try {
      // Read file as text
      const text = await file.text();
      
      // Upload via IPC
      const result = await (window as any).clawdbot?.finance?.uploadCSV(text, file.name);
      
      if (result?.success) {
        showToast('success', 'Import Complete', `Imported ${result.imported} transactions (${result.skipped} duplicates skipped)`);
        await loadFinanceData(); // Reload data
        setUploadModalOpen(false);
      } else {
        showToast('error', 'Upload Failed', result?.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('[Finance] Upload error:', error);
      showToast('error', 'Upload Failed', error.message);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'SOL' || currency === 'ETH' || currency === 'BTC') {
      return `${amount.toFixed(4)} ${currency}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getCategoryEmoji = (category: string) => {
    const emojiMap: Record<string, string> = {
      'Groceries': '🛒',
      'Dining': '🍽️',
      'Transport': '🚗',
      'Utilities': '💡',
      'Entertainment': '📺',
      'Healthcare': '🏥',
      'Shopping': '🛍️',
      'Housing': '🏠',
      'Other': '📋',
      'Gas Fees': '⛽',
      'Trading': '💱',
      'NFTs': '🖼️',
      'Staking': '🔒',
      'DeFi': '🌐',
      'Bridge Fees': '🌉',
      'Income': '💰'
    };
    return emojiMap[category] || '💰';
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-clawd-bg text-clawd-text">
        <div className="text-center">
          <DollarSign size={48} className="mx-auto mb-4 text-clawd-text/50 animate-pulse" />
          <p className="text-lg">Loading finance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-clawd-bg text-clawd-text overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-clawd-border">
        <div className="flex items-center gap-2">
          <DollarSign size={24} className="text-success" />
          <h1 className="text-xl font-semibold">Finance Manager</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              chatOpen
                ? 'bg-success-subtle text-success hover:bg-green-500/30'
                : 'bg-clawd-bg-alt text-clawd-text-dim hover:bg-clawd-bg'
            }`}
          >
            <MessageSquare size={16} />
            AI Chat
          </button>
          <button
            onClick={handleUploadClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Upload size={16} />
            Upload Statement
          </button>
        </div>
      </div>

      {/* Main Content + Chat Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Finance Content */}
        <div className={`${chatOpen ? 'w-3/5' : 'w-full'} overflow-auto p-4 transition-all`}>
        {/* AI Insights Section */}
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4 mb-6">
          <FinanceInsightsPanel />
        </div>

        {/* Legacy Alerts (if any exist) */}
        {alerts.length > 0 && (
          <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={18} className="text-warning" />
              <h2 className="text-base font-semibold">System Alerts</h2>
            </div>
            
            <div className="space-y-2">
              {/* Critical alerts first */}
              {alerts.filter(a => a.severity === 'critical').map((alert) => (
                <div key={alert.id} className="flex items-start gap-2 p-3 bg-error-subtle border border-error-border rounded-lg">
                  <AlertTriangle size={16} className="text-error flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-error">{alert.title}</div>
                    <div className="text-xs text-error/80 mt-0.5">{alert.message}</div>
                  </div>
                </div>
              ))}
              
              {/* Warning alerts */}
              {alerts.filter(a => a.severity === 'warning').map((alert) => (
                <div key={alert.id} className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-warning-border rounded-lg">
                  <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-warning">{alert.title}</div>
                    <div className="text-xs text-warning/80 mt-0.5">{alert.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Budget Cards Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Family Budget */}
          <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign size={20} className="text-info" />
                Family Budget
              </h2>
              <span className="text-sm text-clawd-text/60">
                {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
            </div>

            {familyBudget ? (
              <>
                {/* Overall Progress */}
                <div className="mb-6">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-2xl font-bold">
                      {formatCurrency(familyBudget.total_spent, familyBudget.currency)}
                    </span>
                    <span className="text-sm text-clawd-text/60">
                      of {formatCurrency(familyBudget.total_limit, familyBudget.currency)}
                    </span>
                  </div>
                  <div className="w-full bg-clawd-bg rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${getProgressColor((familyBudget.total_spent / familyBudget.total_limit) * 100)}`}
                      style={{ width: `${Math.min((familyBudget.total_spent / familyBudget.total_limit) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="text-right mt-1 text-sm text-clawd-text/60">
                    {((familyBudget.total_spent / familyBudget.total_limit) * 100).toFixed(0)}%
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="space-y-3">
                  {familyBudget.categories.slice(0, 3).map((cat) => {
                    const percentage = (cat.spent / cat.limit) * 100;
                    return (
                      <div key={cat.category} className="text-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="flex items-center gap-1">
                            <span>{getCategoryEmoji(cat.category)}</span>
                            <span>{cat.category}</span>
                          </span>
                          <span className={percentage >= 90 ? 'text-error' : ''}>
                            {formatCurrency(cat.spent, cat.currency)} / {formatCurrency(cat.limit, cat.currency)}
                          </span>
                        </div>
                        <div className="w-full bg-clawd-bg rounded-full h-1.5">
                          <div
                            className={getProgressColor(percentage)}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button className="mt-4 w-full text-sm text-info hover:text-info transition-colors">
                  View All Categories →
                </button>
              </>
            ) : (
              <div className="text-center py-8 text-clawd-text/60">
                <p className="mb-2">No family budget set up</p>
                <button className="text-info hover:text-info text-sm">
                  Create Budget
                </button>
              </div>
            )}
          </div>

          {/* Crypto Budget */}
          <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Coins size={20} className="text-review" />
                Crypto Budget
              </h2>
              <span className="text-sm text-clawd-text/60">
                {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
            </div>

            {cryptoBudget ? (
              <>
                {/* Overall Progress */}
                <div className="mb-6">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-2xl font-bold">
                      {formatCurrency(cryptoBudget.total_spent, cryptoBudget.currency)}
                    </span>
                    <span className="text-sm text-clawd-text/60">
                      of {formatCurrency(cryptoBudget.total_limit, cryptoBudget.currency)}
                    </span>
                  </div>
                  <div className="w-full bg-clawd-bg rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${getProgressColor((cryptoBudget.total_spent / cryptoBudget.total_limit) * 100)}`}
                      style={{ width: `${Math.min((cryptoBudget.total_spent / cryptoBudget.total_limit) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="text-right mt-1 text-sm text-clawd-text/60">
                    {((cryptoBudget.total_spent / cryptoBudget.total_limit) * 100).toFixed(0)}%
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="space-y-3">
                  {cryptoBudget.categories.slice(0, 3).map((cat) => {
                    const percentage = (cat.spent / cat.limit) * 100;
                    return (
                      <div key={cat.category} className="text-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="flex items-center gap-1">
                            <span>{getCategoryEmoji(cat.category)}</span>
                            <span>{cat.category}</span>
                          </span>
                          <span className={percentage >= 90 ? 'text-error' : ''}>
                            {formatCurrency(cat.spent, cat.currency)} / {formatCurrency(cat.limit, cat.currency)}
                          </span>
                        </div>
                        <div className="w-full bg-clawd-bg rounded-full h-1.5">
                          <div
                            className={getProgressColor(percentage)}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button className="mt-4 w-full text-sm text-review hover:text-review transition-colors">
                  View All Categories →
                </button>
              </>
            ) : (
              <div className="text-center py-8 text-clawd-text/60">
                <p className="mb-2">No crypto budget set up</p>
                <button className="text-review hover:text-review text-sm">
                  Create Budget
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-clawd-surface border border-clawd-border rounded-xl">
          <div className="flex items-center justify-between p-4 border-b border-clawd-border">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            <button className="text-sm text-clawd-text/60 hover:text-clawd-text">
              Filter
            </button>
          </div>

          <div className="divide-y divide-clawd-border max-h-96 overflow-auto">
            {transactions.length > 0 ? (
              transactions.slice(0, 20).map((tx) => (
                <div key={tx.id} className="p-4 hover:bg-clawd-bg/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{getCategoryEmoji(tx.category)}</div>
                      <div>
                        <div className="font-medium">{tx.description}</div>
                        <div className="text-sm text-clawd-text/60">
                          {new Date(tx.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                          {' • '}
                          {tx.category}
                        </div>
                      </div>
                    </div>
                    <div className={`text-lg font-semibold ${tx.amount < 0 ? 'text-error' : 'text-success'}`}>
                      {tx.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount), tx.currency)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-clawd-text/60">
                <Upload size={48} className="mx-auto mb-4 text-clawd-text/30" />
                <p className="mb-2">No transactions yet</p>
                <p className="text-sm">Upload a bank statement to get started</p>
              </div>
            )}
          </div>
        </div>
        </div>

        {/* AI Chat Panel */}
        {chatOpen && (
          <div className="w-2/5">
            <FinanceAgentChat 
              isOpen={chatOpen} 
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Upload Bank Statement</h2>
            
            <div className="mb-4">
              <p className="text-sm text-clawd-text/60 mb-2">
                Supported formats: Revolut, N26, Binance, Coinbase, Generic CSV
              </p>
              
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg text-sm"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setUploadModalOpen(false)}
                className="px-4 py-2 text-sm bg-clawd-bg hover:bg-clawd-border rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
