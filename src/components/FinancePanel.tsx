import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, AlertTriangle, DollarSign, Coins, Bell, MessageSquare, Wallet, Plus, X, Calculator, ChevronDown, UtensilsCrossed, Lightbulb, ShoppingBag, ImageIcon, ShoppingCart, Car, Tv, Cross, Home, Clipboard, Fuel, ArrowLeftRight, Lock, Globe, ArrowRightLeft } from 'lucide-react';
import EmptyState from './EmptyState';
import WidgetLoading from './WidgetLoading';
import { showToast } from './Toast';
import { financeApi } from '../lib/api';
import FinanceAgentChat from './FinanceAgentChat';
import FinanceInsightsPanel from './FinanceInsightsPanel';
import FinanceCategoryBreakdown from './FinanceCategoryBreakdown';
import FinanceScenarioPanel from './FinanceScenarioPanel';

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

interface AccountBalance {
  id: string;
  name: string;
  type: string;
  currency: string;
  computed_balance: number;
  transaction_count: number;
}

export default function FinancePanel() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [familyBudget, setFamilyBudget] = useState<Budget | null>(null);
  const [cryptoBudget, setCryptoBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [chatOpen, setChatOpen] = useState(true); // AI chat panel
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [budgetModalType, _setBudgetModalType] = useState<'family' | 'crypto'>('family');
  const [budgetName, setBudgetName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetCurrency, setBudgetCurrency] = useState('EUR');
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [chatPrefill, setChatPrefill] = useState('');
  const lastAlertCheck = useRef<Set<string>>(new Set());

  // ── Account State ──
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null); // null = "All Accounts"
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<string>('bank');
  const [newAccountCurrency, setNewAccountCurrency] = useState('EUR');

  // ── Recurring State ──
  const [recurringItems, setRecurringItems] = useState<FinanceRecurring[]>([]);

  // ── Export State ──
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportAccountId, setExportAccountId] = useState<string>('');  // '' = all accounts
  const [exportDateFrom, setExportDateFrom] = useState<string>('');    // YYYY-MM-DD string
  const [exportDateTo, setExportDateTo] = useState<string>('');        // YYYY-MM-DD string
  const [exportLoading, setExportLoading] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);

  // ── Category breakdown + scenario state ──
  const [showScenarios, setShowScenarios] = useState(false);
  const [editingCategoryTxId, setEditingCategoryTxId] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<Array<{ name: string }>>([]);

  // ── Upload modal account selector ──
  const [uploadAccountId, setUploadAccountId] = useState<string>('acc-default');

  // ── Budget modal account selector ──
  const [budgetAccountId, setBudgetAccountId] = useState<string>('');

  const loadAccounts = useCallback(async () => {
    try {
      const result = await financeApi.getAccounts();
      if (Array.isArray(result)) {
        setAccounts(result as AccountBalance[]);
      }
    } catch { /* accounts not available yet */ }
  }, []);

  const loadRecurring = useCallback(async () => {
    // Recurring items not available via REST yet
    setRecurringItems([]);
  }, [selectedAccountId]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.pdf'))) {
      handleFileUpload(file);
    } else if (file) {
      showToast('error', 'Unsupported File', 'Please drop a CSV or PDF bank statement');
    }
  };

  const loadFinanceData = useCallback(async () => {
    try {
      setLoading(true);

      // Load transactions (filtered by selected account)
      const params: Record<string, string> = { limit: '50' };
      if (selectedAccountId) params.accountId = selectedAccountId;
      const txResult = await financeApi.getTransactions(params);
      if (Array.isArray(txResult)) {
        setTransactions(txResult as Transaction[]);
      }

      // Load budget
      try {
        const budgetResult: any = await financeApi.getBudget();
        if (budgetResult) {
          const budgets = Array.isArray(budgetResult) ? budgetResult : budgetResult?.budgets || [];
          const family = budgets.find((b: any) => b.type === 'family') || null;
          const crypto = budgets.find((b: any) => b.type === 'crypto') || null;
          setFamilyBudget(family as Budget | null);
          setCryptoBudget(crypto as Budget | null);
        }
      } catch { /* budgets not available */ }
    } catch (error) {
      // Finance load error
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    loadFinanceData();
    loadAccounts();
    loadRecurring();
    loadAlerts();

    // Category options not available via REST
    setCategoryOptions([]);

    // Check for new alerts every 30 seconds
    const alertInterval = setInterval(() => {
      loadAlerts();
    }, 30000);

    return () => {
      clearInterval(alertInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload transactions + budgets + recurring when selectedAccountId changes
  useEffect(() => {
    loadFinanceData();
    loadRecurring();
  }, [selectedAccountId, loadFinanceData, loadRecurring]);

  const loadAlerts = async () => {
    // Alerts not available via REST — use empty
    setAlerts([]);
  };

  const handleUploadClick = () => {
    setUploadAccountId(selectedAccountId || 'acc-default');
    setUploadModalOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    setUploadModalOpen(false);
    showToast('info', 'Upload not available', 'File upload requires the backend to be configured');
  };

  const handleCreateBudget = async () => {
    if (!budgetName.trim() || !budgetAmount || Number(budgetAmount) <= 0) {
      showToast('error', 'Please enter a valid budget name and amount');
      return;
    }
    showToast('info', 'Budget creation not available in web mode');
    setBudgetSubmitting(false);
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      showToast('error', 'Please enter an account name');
      return;
    }
    showToast('info', 'Account creation not available in web mode');
  };

  const handleArchiveAccount = async (accountId: string, accountName: string) => {
    if (!window.confirm(`Archive account "${accountName}"? Transactions will be preserved.`)) {
      return;
    }
    showToast('info', 'Account archiving not available in web mode');
  };

  const openBudgetModal = (type: 'family' | 'crypto') => {
    // Open AI chat with a budget creation prompt instead of a form
    if (!chatOpen) setChatOpen(true);
    const budgetContext = type === 'family'
      ? `I want to create a family/household budget. Guide me through it conversationally -- ask me one question at a time. Start by asking about my monthly income, then ask about spending categories (rent, groceries, utilities, transport, dining, entertainment, subscriptions, savings, etc.). For each category, ask what I currently spend and what limit I'd like to set. Suggest reasonable limits based on my income if I'm unsure. Once we've covered the categories, summarize the budget and create it using mission-control-db.`
      : `I want to create a crypto/investment budget. Guide me through it conversationally -- ask me one question at a time. Start by asking about my total investment allocation, then ask about categories (BTC, ETH, altcoins, DeFi, trading fees, gas fees, etc.). For each category, ask my target allocation and spending limit. Warn me about risk if allocations seem high. Once we've covered everything, summarize and create it using mission-control-db.`;
    setChatPrefill(budgetContext);
  };

  const handleConfirmRecurring = async (id: string) => {
    setRecurringItems(prev => prev.map(r => r.id === id ? { ...r, status: 'confirmed' } : r));
  };

  const handleDismissRecurring = async (id: string) => {
    setRecurringItems(prev => prev.filter(r => r.id !== id));
  };

  const handleExport = async () => {
    setExportLoading(true);
    setExportResult(null);
    try {
      // Export transactions as JSON download
      const params: Record<string, string> = {};
      if (exportAccountId) params.accountId = exportAccountId;
      const txData = await financeApi.getTransactions(params);
      const blob = new Blob([JSON.stringify(txData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportResult('Export downloaded.');
    } catch {
      setExportResult('Export failed.');
    } finally {
      setExportLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency?: string) => {
    if (!currency) return `${(amount || 0).toFixed(2)}`;
    if (currency === 'SOL' || currency === 'ETH' || currency === 'BTC') {
      return `${amount.toFixed(4)} ${currency}`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-error';
    if (percentage >= 80) return 'bg-warning';
    return 'bg-success';
  };

  const getCategoryIcon = (category: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'Groceries': <ShoppingCart size={18} />,
      'Dining': <UtensilsCrossed size={18} />,
      'Transport': <Car size={18} />,
      'Utilities': <Lightbulb size={18} />,
      'Entertainment': <Tv size={18} />,
      'Healthcare': <Cross size={18} />,
      'Shopping': <ShoppingBag size={18} />,
      'Housing': <Home size={18} />,
      'Other': <Clipboard size={18} />,
      'Gas Fees': <Fuel size={18} />,
      'Trading': <ArrowLeftRight size={18} />,
      'NFTs': <ImageIcon size={18} />,
      'Staking': <Lock size={18} />,
      'DeFi': <Globe size={18} />,
      'Bridge Fees': <ArrowRightLeft size={18} />,
      'Income': <DollarSign size={18} />,
    };
    return iconMap[category] || <DollarSign size={18} />;
  };

  if (loading && transactions.length === 0) {
    return (
      <WidgetLoading
        variant="spinner"
        title="Loading finance data..."
        icon={DollarSign}
      />
    );
  }

  return (
    <div
      className="h-full flex flex-col bg-mission-control-bg text-mission-control-text overflow-hidden relative"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
      onDrop={handleDrop}
    >
      {/* Drop Overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-50 bg-mission-control-bg/80 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-mission-control-accent rounded-lg">
          <div className="text-center">
            <Upload size={48} className="mx-auto mb-3 text-mission-control-accent" />
            <p className="text-lg font-semibold text-mission-control-text">Drop bank statement here</p>
            <p className="text-sm text-mission-control-text-dim">CSV or PDF supported</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-mission-control-border">
        <div className="flex items-center gap-2">
          <DollarSign size={24} className="text-success" />
          <h1 className="text-heading-2">Finance Manager</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              chatOpen
                ? 'bg-success-subtle text-success hover:bg-success/30'
                : 'bg-mission-control-bg-alt text-mission-control-text-dim hover:bg-mission-control-bg'
            }`}
            aria-label={chatOpen ? "Close AI chat" : "Open AI chat"}
          >
            <MessageSquare size={16} />
            AI Chat
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text rounded-lg text-sm transition-colors"
            aria-label="Export transactions to XLSX"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Export
          </button>
          <button
            onClick={handleUploadClick}
            className="flex items-center gap-2 px-4 py-2 bg-info hover:bg-info-dim text-white rounded-lg transition-colors"
            aria-label="Upload bank statement"
          >
            <Upload size={16} />
            Upload Statement
          </button>
        </div>
      </div>

      {/* Account Tab Strip */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-mission-control-border overflow-x-auto flex-shrink-0">
        {/* All Accounts tab */}
        <button
          onClick={() => setSelectedAccountId(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedAccountId === null
              ? 'bg-mission-control-accent text-white'
              : 'bg-mission-control-surface border border-mission-control-border text-mission-control-text hover:bg-mission-control-bg-alt'
          }`}
          aria-label="View all accounts"
        >
          All Accounts
        </button>

        {/* Individual account tabs */}
        {accounts.map((acc) => (
          <div key={acc.id} className="flex-shrink-0 flex items-center group">
            <button
              onClick={() => setSelectedAccountId(acc.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedAccountId === acc.id
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-surface border border-mission-control-border text-mission-control-text hover:bg-mission-control-bg-alt'
              }`}
              aria-label={`View ${acc.name} account`}
            >
              {acc.name}
              <span className={`ml-1.5 text-xs ${
                selectedAccountId === acc.id ? 'text-white/80' : 'text-mission-control-text-dim'
              }`}>
                {formatCurrency(acc.computed_balance, acc.currency)}
              </span>
            </button>
            {/* Archive button (not for default account) */}
            {acc.id !== 'acc-default' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchiveAccount(acc.id, acc.name);
                }}
                className="ml-1 p-0.5 rounded-full text-mission-control-text-dim hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-all"
                aria-label={`Archive ${acc.name}`}
                title={`Archive ${acc.name}`}
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}

        {/* + New Account button */}
        <button
          onClick={() => setShowCreateAccountModal(true)}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-dashed border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent transition-colors"
          aria-label="Create new account"
        >
          <Plus size={14} />
          New Account
        </button>
      </div>

      {/* Main Content + Chat Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Finance Content */}
        <div className={`${chatOpen ? 'w-3/5' : 'w-full'} overflow-auto p-4 transition-all`}>
        {/* AI Processing Banner */}
        {aiProcessing && (
          <div className="bg-mission-control-surface border border-mission-control-accent/30 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-mission-control-accent border-t-transparent rounded-full" />
              <div className="flex-1">
                <div className="text-sm font-medium">{aiMessage || 'AI is processing...'}</div>
                <div className="mt-2 w-full bg-mission-control-bg rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-mission-control-accent rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Insights Section */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-4 mb-6">
          <FinanceInsightsPanel />
        </div>

        {/* Legacy Alerts (if any exist) */}
        {alerts.length > 0 && (
          <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={18} className="text-warning" />
              <h2 className="text-heading-3">System Alerts</h2>
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
                <div key={alert.id} className="flex items-start gap-2 p-3 bg-warning/10 border border-warning-border rounded-lg">
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
          <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-heading-3 flex items-center gap-2">
                <DollarSign size={20} className="text-info" />
                Family Budget
              </h2>
              <span className="text-sm text-mission-control-text/60">
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
                    <span className="text-sm text-mission-control-text/60">
                      of {formatCurrency(familyBudget.total_limit, familyBudget.currency)}
                    </span>
                  </div>
                  <div className="w-full bg-mission-control-bg rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${getProgressColor((familyBudget.total_spent / familyBudget.total_limit) * 100)}`}
                      style={{ width: `${Math.min((familyBudget.total_spent / familyBudget.total_limit) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="text-right mt-1 text-sm text-mission-control-text/60">
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
                            <span>{getCategoryIcon(cat.category)}</span>
                            <span>{cat.category}</span>
                          </span>
                          <span className={percentage >= 90 ? 'text-error' : ''}>
                            {formatCurrency(cat.spent, cat.currency)} / {formatCurrency(cat.limit, cat.currency)}
                          </span>
                        </div>
                        <div className="w-full bg-mission-control-bg rounded-full h-1.5">
                          <div
                            className={getProgressColor(percentage)}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button className="mt-4 w-full text-sm text-info hover:text-info transition-colors" aria-label="View all budget categories">
                  View All Categories →
                </button>
              </>
            ) : (
              <div className="text-center py-8 text-mission-control-text/60">
                <p className="mb-2">
                  {selectedAccountId ? 'No family budget for this account' : 'No family budget set up'}
                </p>
                <button onClick={() => openBudgetModal('family')} className="text-info hover:text-info text-sm" aria-label="Create family budget">
                  Create Budget
                </button>
              </div>
            )}
          </div>

          {/* Crypto Budget */}
          <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-heading-3 flex items-center gap-2">
                <Coins size={20} className="text-review" />
                Crypto Budget
              </h2>
              <span className="text-sm text-mission-control-text/60">
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
                    <span className="text-sm text-mission-control-text/60">
                      of {formatCurrency(cryptoBudget.total_limit, cryptoBudget.currency)}
                    </span>
                  </div>
                  <div className="w-full bg-mission-control-bg rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${getProgressColor((cryptoBudget.total_spent / cryptoBudget.total_limit) * 100)}`}
                      style={{ width: `${Math.min((cryptoBudget.total_spent / cryptoBudget.total_limit) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="text-right mt-1 text-sm text-mission-control-text/60">
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
                            <span>{getCategoryIcon(cat.category)}</span>
                            <span>{cat.category}</span>
                          </span>
                          <span className={percentage >= 90 ? 'text-error' : ''}>
                            {formatCurrency(cat.spent, cat.currency)} / {formatCurrency(cat.limit, cat.currency)}
                          </span>
                        </div>
                        <div className="w-full bg-mission-control-bg rounded-full h-1.5">
                          <div
                            className={getProgressColor(percentage)}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button className="mt-4 w-full text-sm text-review hover:text-review transition-colors" aria-label="View all crypto budget categories">
                  View All Categories →
                </button>
              </>
            ) : (
              <div className="text-center py-8 text-mission-control-text/60">
                <p className="mb-2">
                  {selectedAccountId ? 'No crypto budget for this account' : 'No crypto budget set up'}
                </p>
                <button onClick={() => openBudgetModal('crypto')} className="text-review hover:text-review text-sm" aria-label="Create crypto budget">
                  Create Budget
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recurring Transactions Section */}
        {recurringItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-mission-control-text-dim uppercase tracking-wide mb-3">
              Recurring Detected ({recurringItems.filter(r => r.status === 'pending').length} pending)
            </h3>
            <div className="space-y-2">
              {recurringItems.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-mission-control-surface border border-mission-control-border rounded-lg px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-mission-control-text font-medium truncate">{item.description}</span>
                      {item.status === 'confirmed' && (
                        <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-2 py-0.5">Confirmed</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-mission-control-text-dim text-sm font-mono">{item.currency} {Math.abs(item.amount).toFixed(2)}</span>
                      <span className="text-xs bg-mission-control-accent/20 text-mission-control-accent border border-mission-control-accent/30 rounded-full px-2 py-0.5 capitalize">{item.frequency}</span>
                      {item.next_expected_date && (
                        <span className="text-mission-control-text-dim text-xs">Next: {new Date(item.next_expected_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  {item.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleConfirmRecurring(item.id)}
                        className="text-xs px-3 py-1.5 bg-mission-control-accent text-white rounded-md hover:bg-mission-control-accent/80 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleDismissRecurring(item.id)}
                        className="text-xs px-3 py-1.5 bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text rounded-md transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl">
          <div className="flex items-center justify-between p-4 border-b border-mission-control-border">
            <h2 className="text-heading-3">Recent Transactions</h2>
            <span className="text-sm text-mission-control-text-dim">
              {selectedAccountId
                ? accounts.find(a => a.id === selectedAccountId)?.name || 'Account'
                : 'All Accounts'}
            </span>
          </div>

          <div className="divide-y divide-mission-control-border max-h-96 overflow-auto">
            {transactions.length > 0 ? (
              transactions.slice(0, 20).map((tx) => (
                <div key={tx.id} className="p-4 hover:bg-mission-control-bg/50 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="text-mission-control-text-dim">{getCategoryIcon(tx.category)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{tx.description}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm text-mission-control-text/60">
                            {new Date(tx.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                          {/* Inline category editor */}
                          {editingCategoryTxId === tx.id ? (
                            <select
                              value={tx.category}
                              onChange={async (e) => {
                                const newCat = e.target.value;
                                // Update category in local state only (REST stub, no backend persistence)
                                setTransactions((prev) =>
                                  prev.map((t) => t.id === tx.id ? { ...t, category: newCat } : t)
                                );
                                setEditingCategoryTxId(null);
                                showToast('success', `Recategorized to ${newCat}`);
                              }}
                              onBlur={() => setEditingCategoryTxId(null)}
                              className="bg-mission-control-surface border border-mission-control-border rounded-lg px-2 py-0.5 text-xs text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                              aria-label={`Change category for ${tx.description}`}
                            >
                              {categoryOptions.length > 0
                                ? categoryOptions.map((c) => (
                                    <option key={c.name} value={c.name}>{c.name}</option>
                                  ))
                                : <option value={tx.category}>{tx.category}</option>
                              }
                            </select>
                          ) : (
                            <button
                              className="text-xs px-2 py-0.5 bg-mission-control-bg-alt border border-mission-control-border rounded-full capitalize cursor-pointer hover:border-mission-control-accent hover:text-mission-control-accent transition-colors"
                              onClick={() => setEditingCategoryTxId(tx.id)}
                              title="Click to recategorize"
                              aria-label={`Recategorize ${tx.description} (currently ${tx.category || 'other'})`}
                            >
                              {tx.category || 'other'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`text-lg font-semibold flex-shrink-0 ${tx.amount < 0 ? 'text-error' : 'text-success'}`}>
                      {tx.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount), tx.currency)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={Wallet}
                title="No transactions yet"
                description={selectedAccountId ? "No transactions found for this account." : "Upload a bank statement to get started tracking your finances."}
                action={{
                  label: "Upload Statement",
                  onClick: () => setUploadModalOpen(true),
                  variant: "primary"
                }}
              />
            )}
          </div>
        </div>
        {/* Category Spend Breakdown */}
        <div className="mt-6">
          <FinanceCategoryBreakdown selectedAccountId={selectedAccountId} />
        </div>

        {/* Scenario Projections (collapsible) */}
        <div className="mt-2 mb-6">
          <button
            onClick={() => setShowScenarios(!showScenarios)}
            className="flex items-center gap-2 text-sm font-semibold text-mission-control-text-dim uppercase tracking-wide mb-3 hover:text-mission-control-text transition-colors w-full text-left"
            aria-label={showScenarios ? 'Collapse scenario projections' : 'Expand scenario projections'}
          >
            <Calculator className="w-4 h-4" />
            Scenario Projections
            <ChevronDown className={`w-4 h-4 transition-transform ml-auto ${showScenarios ? 'rotate-180' : ''}`} />
          </button>
          {showScenarios && <FinanceScenarioPanel />}
        </div>
        </div>

        {/* AI Chat Panel */}
        {chatOpen && (
          <div className="w-2/5">
            <FinanceAgentChat
              isOpen={chatOpen}
              onClose={() => setChatOpen(false)}
              prefillMessage={chatPrefill}
              onPrefillConsumed={() => setChatPrefill('')}
            />
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-heading-3 mb-4">Upload Bank Statement</h2>

            <div className="space-y-4">
              {/* Account selector */}
              <div>
                <label htmlFor="upload-account-id" className="block text-sm text-mission-control-text-dim mb-1">Import to Account</label>
                <select
                  id="upload-account-id"
                  value={uploadAccountId}
                  onChange={(e) => setUploadAccountId(e.target.value)}
                  className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-mission-control-text focus:border-mission-control-accent outline-none text-sm"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-sm text-mission-control-text/60 mb-2">
                  Supported formats: CSV (Revolut, N26, Binance, Coinbase, Generic) and PDF bank statements
                </p>

                <input
                  type="file"
                  accept=".csv,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="w-full px-3 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => setUploadModalOpen(false)}
                className="px-4 py-2 text-sm bg-mission-control-bg hover:bg-mission-control-border rounded-lg transition-colors"
                aria-label="Cancel upload"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Creation Modal */}
      {budgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-heading-3 mb-4">
              Create {budgetModalType === 'family' ? 'Family' : 'Crypto'} Budget
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="budget-name" className="block text-sm text-mission-control-text-dim mb-1">Budget Name</label>
                <input
                  id="budget-name"
                  type="text"
                  value={budgetName}
                  onChange={(e) => setBudgetName(e.target.value)}
                  placeholder="e.g., February 2026 Family Budget"
                  className="w-full px-3 py-2 bg-mission-control-bg-alt border border-mission-control-border rounded-lg text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                />
              </div>

              {/* Account scope selector */}
              <div>
                <label htmlFor="budget-account-id" className="block text-sm text-mission-control-text-dim mb-1">Scope to Account</label>
                <select
                  id="budget-account-id"
                  value={budgetAccountId}
                  onChange={(e) => setBudgetAccountId(e.target.value)}
                  className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-mission-control-text focus:border-mission-control-accent outline-none text-sm"
                >
                  <option value="">All Accounts (Global)</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="budget-amount" className="block text-sm text-mission-control-text-dim mb-1">Total Budget</label>
                <div className="flex gap-2">
                  <input
                    id="budget-amount"
                    type="number"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="flex-1 px-3 py-2 bg-mission-control-bg-alt border border-mission-control-border rounded-lg text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                  />
                  <select
                    value={budgetCurrency}
                    onChange={(e) => setBudgetCurrency(e.target.value)}
                    className="px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="block text-sm text-mission-control-text-dim mb-1">Period</div>
                <p className="text-sm text-mission-control-text">
                  {new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  {' - '}
                  {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setBudgetModalOpen(false)}
                className="px-4 py-2 text-sm bg-mission-control-bg hover:bg-mission-control-border rounded-lg transition-colors"
                aria-label="Cancel budget creation"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBudget}
                disabled={budgetSubmitting || !budgetName.trim() || !budgetAmount}
                className="px-4 py-2 text-sm bg-mission-control-accent hover:opacity-90 disabled:opacity-50 text-white rounded-lg transition-colors"
                aria-label="Create budget"
              >
                {budgetSubmitting ? 'Creating...' : 'Create Budget'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-heading-3 mb-4">Create Account</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="new-account-name" className="block text-sm text-mission-control-text-dim mb-1">Account Name</label>
                <input
                  id="new-account-name"
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g., Chase Checking"
                  className="w-full px-3 py-2 bg-mission-control-bg-alt border border-mission-control-border rounded-lg text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                />
              </div>

              <div>
                <label htmlFor="new-account-type" className="block text-sm text-mission-control-text-dim mb-1">Account Type</label>
                <select
                  id="new-account-type"
                  value={newAccountType}
                  onChange={(e) => setNewAccountType(e.target.value)}
                  className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-mission-control-text focus:border-mission-control-accent outline-none text-sm"
                >
                  <option value="bank">Bank</option>
                  <option value="crypto_wallet">Crypto Wallet</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div>
                <label htmlFor="new-account-currency" className="block text-sm text-mission-control-text-dim mb-1">Currency</label>
                <input
                  id="new-account-currency"
                  type="text"
                  value={newAccountCurrency}
                  onChange={(e) => setNewAccountCurrency(e.target.value.toUpperCase())}
                  placeholder="EUR"
                  className="w-full px-3 py-2 bg-mission-control-bg-alt border border-mission-control-border rounded-lg text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => {
                  setShowCreateAccountModal(false);
                  setNewAccountName('');
                  setNewAccountType('bank');
                  setNewAccountCurrency('EUR');
                }}
                className="px-4 py-2 text-sm bg-mission-control-bg hover:bg-mission-control-border rounded-lg transition-colors"
                aria-label="Cancel account creation"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAccount}
                disabled={!newAccountName.trim()}
                className="px-4 py-2 text-sm bg-mission-control-accent hover:opacity-90 disabled:opacity-50 text-white rounded-lg transition-colors"
                aria-label="Create account"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-mission-control-bg border border-mission-control-border rounded-lg p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-heading-3 mb-4">Export Transactions</h2>

            <div className="space-y-4">
              {/* Account filter */}
              <div>
                <label htmlFor="export-account-id" className="block text-sm text-mission-control-text-dim mb-1">Account</label>
                <select
                  id="export-account-id"
                  value={exportAccountId}
                  onChange={e => setExportAccountId(e.target.value)}
                  className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-mission-control-text focus:border-mission-control-accent outline-none"
                >
                  <option value="">All Accounts</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="export-date-from" className="block text-sm text-mission-control-text-dim mb-1">From</label>
                  <input
                    id="export-date-from"
                    type="date"
                    value={exportDateFrom}
                    onChange={e => setExportDateFrom(e.target.value)}
                    className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-mission-control-text focus:border-mission-control-accent outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="export-date-to" className="block text-sm text-mission-control-text-dim mb-1">To</label>
                  <input
                    id="export-date-to"
                    type="date"
                    value={exportDateTo}
                    onChange={e => setExportDateTo(e.target.value)}
                    className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-mission-control-text focus:border-mission-control-accent outline-none"
                  />
                </div>
              </div>

              {/* Result message */}
              {exportResult && (
                <p className={`text-sm ${exportResult.startsWith('Export failed') ? 'text-red-400' : 'text-green-400'}`}>
                  {exportResult}
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="flex-1 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/80 transition-colors disabled:opacity-50 font-medium"
              >
                {exportLoading ? 'Exporting...' : 'Export XLSX'}
              </button>
              <button
                onClick={() => { setShowExportModal(false); setExportResult(null); }}
                className="px-4 py-2 bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
