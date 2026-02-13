# Finance AI-Powered Experience - Detailed Plan

**Created:** 2026-02-13
**Status:** Planning
**Priority:** High
**Owner:** Coding Team (Chief, Senior Coder, Coder)

## Executive Summary

Transform the Finance module from a static data dashboard into a fully AI-powered financial advisor where the Finance Manager agent actively analyzes, plans, and manages finances in real-time.

**User Vision:** "it should all be ai powered... i upload my bank statements ai process them makes a plan, every element should be fully ai powered"

## Current State Analysis

### ✅ What Works
- CSV upload (Revolut, N26, Binance, Coinbase, Generic)
- Transaction import and storage (7 database tables)
- Automatic categorization
- Budget tracking (family + crypto)
- Basic alerts system (backend)
- Toast notifications for alerts

### ❌ What's Missing
- **No AI analysis** - transactions stored but not analyzed
- **No planning** - no budget recommendations or financial plans
- **No agent integration** - Finance Manager exists but not connected to UI
- **No chat interface** - can't ask questions or get advice
- **Static insights** - alerts are rule-based, not AI-generated
- **No proactive features** - no continuous monitoring or suggestions

### 🎯 The Gap

Right now: **Data visualization tool**
Goal: **AI financial advisor living in the dashboard**

---

## Design Vision

### Core Principle
Every element in the Finance panel should be **AI-enhanced and contextual**. The Finance Manager agent is always watching, analyzing, and ready to help.

### User Experience Flow

```
┌─────────────────────────────────────────────────────┐
│  Upload CSV Statement                               │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  AI Analysis (30s)                                  │
│  • Categorize transactions                          │
│  • Detect patterns & anomalies                      │
│  • Compare to budget/history                        │
│  • Generate insights                                │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  AI Creates/Updates Plan                            │
│  • Budget recommendations                           │
│  • Savings opportunities                            │
│  • Cost reduction suggestions                       │
│  • Risk warnings                                    │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  UI Updates with AI Content                         │
│  • Insights panel shows findings                    │
│  • Budget cards show AI commentary                  │
│  • Transactions flagged with AI notes               │
│  • Alert toast for critical findings                │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  User Can Chat with Finance Manager                 │
│  • Ask questions about findings                     │
│  • Request custom reports                           │
│  • Get detailed explanations                        │
│  • Request plan adjustments                         │
└─────────────────────────────────────────────────────┘
```

### UI Layout Redesign

**Left Panel (60% width):** Main Finance View
- Budget Cards (with AI commentary)
- Insights Panel (AI-generated, prioritized)
- Transaction List (with AI flags/notes)
- Alerts & Warnings

**Right Panel (40% width):** AI Assistant Chat
- Sliding panel (collapsible)
- Direct connection to Finance Manager agent
- Context-aware (knows what you're viewing)
- Quick action buttons
- Message history
- Loading states during analysis

**Alternative:** Chat could be a bottom drawer or modal

---

## Technical Architecture

### Components & Data Flow

```
┌──────────────────────────────────────────────────────────┐
│  FinancePanel.tsx (React Component)                      │
├──────────────────────────────────────────────────────────┤
│  • Budget display (with AI commentary)                   │
│  • Transaction list (with AI flags)                      │
│  • Insights panel (AI-generated)                         │
│  • Chat interface component                              │
└────────────┬──────────────────────┬──────────────────────┘
             │                      │
             ▼                      ▼
┌────────────────────────┐  ┌────────────────────────┐
│  Finance IPC Bridge    │  │  Agent Session Bridge  │
│  (electron/main)       │  │  (sessions API)        │
├────────────────────────┤  ├────────────────────────┤
│  • uploadCSV           │  │  • sendMessage         │
│  • getTransactions     │  │  • getHistory          │
│  • getBudgetStatus     │  │  • subscribe to agent  │
│  • getAlerts           │  │  • agent → UI events   │
│  • getInsights         │  └────────────┬───────────┘
│  • triggerAnalysis     │               │
└────────────┬───────────┘               │
             │                           │
             ▼                           ▼
┌──────────────────────────────────────────────────────────┐
│  Finance Manager Agent Session                           │
│  (~/agent-finance-manager/)                              │
├──────────────────────────────────────────────────────────┤
│  • Access to finance database                            │
│  • Analysis capabilities                                 │
│  • Planning & recommendations                            │
│  • Natural language understanding                        │
│  • Context tracking                                      │
└────────────┬─────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────┐
│  SQLite Database                                         │
│  (~/froggo/data/ or dashboard data/)                     │
├──────────────────────────────────────────────────────────┤
│  • transactions                                          │
│  • accounts                                              │
│  • categories                                            │
│  • budgets, budget_categories                           │
│  • transaction_tags                                      │
│  • ai_insights (NEW)                                     │
│  • financial_plans (NEW)                                 │
└──────────────────────────────────────────────────────────┘
```

### New Database Tables

```sql
-- Store AI-generated insights
CREATE TABLE ai_insights (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- 'spending_pattern', 'anomaly', 'opportunity', 'warning'
  severity TEXT,       -- 'info', 'warning', 'critical'
  title TEXT NOT NULL,
  description TEXT,
  data JSON,           -- Structured insight data
  created_at INTEGER,
  expires_at INTEGER,  -- Auto-cleanup old insights
  dismissed INTEGER DEFAULT 0
);

-- Store financial plans and recommendations
CREATE TABLE financial_plans (
  id TEXT PRIMARY KEY,
  plan_type TEXT,      -- 'budget', 'savings', 'debt_reduction', 'investment'
  status TEXT,         -- 'draft', 'active', 'completed'
  goal TEXT,
  target_amount REAL,
  target_date INTEGER,
  progress REAL,
  recommendations JSON,
  created_at INTEGER,
  updated_at INTEGER
);

-- Track AI analysis runs
CREATE TABLE analysis_runs (
  id TEXT PRIMARY KEY,
  trigger TEXT,        -- 'csv_upload', 'scheduled', 'manual'
  started_at INTEGER,
  completed_at INTEGER,
  status TEXT,         -- 'running', 'completed', 'failed'
  insights_generated INTEGER,
  error TEXT
);
```

### IPC Methods (New)

```typescript
// electron/preload.ts additions

export interface FinanceAPI {
  // Existing methods...
  uploadCSV(csvText: string, filename: string): Promise<Result>;
  getTransactions(filters?: any): Promise<Result>;
  getBudgetStatus(type: 'family' | 'crypto'): Promise<Result>;
  getAlerts(): Promise<Result>;
  getInsights(): Promise<Result>;
  
  // NEW: Agent interaction
  triggerAnalysis(): Promise<{ success: boolean; analysisId: string }>;
  getAnalysisStatus(analysisId: string): Promise<{ status: string; progress: number }>;
  
  // NEW: AI insights
  getAIInsights(filters?: { type?: string; severity?: string }): Promise<Result>;
  dismissInsight(insightId: string): Promise<Result>;
  
  // NEW: Financial plans
  getPlans(): Promise<Result>;
  getPlan(planId: string): Promise<Result>;
  
  // NEW: Agent chat
  sendChatMessage(message: string, context?: any): Promise<Result>;
  subscribeToAgent(callback: (message: any) => void): () => void;
}
```

### Agent Integration

```typescript
// electron/finance-agent-bridge.ts (NEW FILE)

import { sessions_send, sessions_list } from './sessions-api';

export class FinanceAgentBridge {
  private agentSessionKey: string | null = null;
  private messageCallbacks: Set<Function> = new Set();
  
  async initialize() {
    // Find or create Finance Manager session
    const sessions = await sessions_list({ kinds: ['isolated'] });
    let financeSession = sessions.find(s => s.label === 'finance-manager');
    
    if (!financeSession) {
      // Spawn Finance Manager agent
      financeSession = await sessions_spawn({
        agentId: 'finance-manager',
        label: 'finance-manager',
        task: 'You are now active as the Finance Manager. Ready to analyze and advise.'
      });
    }
    
    this.agentSessionKey = financeSession.sessionKey;
  }
  
  async sendMessage(message: string, context?: any) {
    if (!this.agentSessionKey) await this.initialize();
    
    const contextStr = context ? `\n\nContext: ${JSON.stringify(context)}` : '';
    const fullMessage = `${message}${contextStr}`;
    
    return await sessions_send({
      sessionKey: this.agentSessionKey,
      message: fullMessage
    });
  }
  
  async triggerAnalysis() {
    return await this.sendMessage(
      'A new CSV statement has been uploaded. Please analyze the new transactions, update budget tracking, identify any issues or opportunities, and generate insights for the user.'
    );
  }
  
  subscribeToMessages(callback: Function) {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation & Chat Interface (Week 1)
**Goal:** Connect Finance Manager agent to the UI with basic chat

**Tasks:**
1. Create `FinanceAgentBridge` class
2. Add agent session initialization on panel load
3. Build chat UI component (right panel)
4. Wire up message sending/receiving
5. Add loading states and error handling
6. Test basic Q&A with agent

**Deliverables:**
- Chat interface visible in Finance panel
- Can send messages to Finance Manager
- Agent can access transaction data via tools
- Basic conversation works

**Success Criteria:**
- User asks "How much did I spend last month?" → Agent responds with accurate data
- Agent can query database via existing CLI tools
- UI updates in real-time when agent responds

---

### Phase 2: AI Analysis Pipeline (Week 2)
**Goal:** Automatically trigger agent analysis on CSV upload

**Tasks:**
1. Add `triggerAnalysis()` IPC method
2. Create `analysis_runs` database table
3. Hook CSV upload success → trigger analysis
4. Implement analysis status polling
5. Store AI-generated insights in database
6. Add "Analysis in progress..." UI state
7. Display insights in dedicated panel

**Deliverables:**
- Upload CSV → Agent automatically analyzes
- Progress indicator during analysis
- Insights stored and displayed in UI
- Toast notifications for critical findings

**Success Criteria:**
- Upload completes → Analysis starts within 5s
- Analysis completes within 30s for typical statement
- At least 3-5 insights generated per upload
- Critical issues trigger immediate toast notification

---

### Phase 3: AI-Enhanced UI Elements (Week 3)
**Goal:** Embed AI insights throughout the interface

**Tasks:**
1. Add AI commentary to budget cards
2. Flag unusual transactions with AI notes
3. Show spending trend AI analysis
4. Add "AI recommends..." sections
5. Implement insight dismissal
6. Add quick action buttons (e.g., "Explain this pattern")

**Deliverables:**
- Every budget card shows AI commentary
- Transactions have AI flags/notes where relevant
- Contextual recommendations throughout UI
- Quick actions trigger agent responses

**Success Criteria:**
- User can see AI insights without opening chat
- Insights are contextual and actionable
- UI feels intelligent, not just informative

---

### Phase 4: Proactive Planning (Week 4)
**Goal:** Agent creates and tracks financial plans

**Tasks:**
1. Implement `financial_plans` table
2. Build plan display UI
3. Agent generates budget recommendations
4. Track plan progress over time
5. Add goal-setting interface
6. Periodic plan review (weekly/monthly)

**Deliverables:**
- Agent suggests budgets based on history
- Plans tracked with progress indicators
- User can accept/modify recommendations
- Regular check-ins on plan status

**Success Criteria:**
- Agent generates realistic budget within 10% of optimal
- User can see progress toward goals
- Plan adjusts automatically as data changes

---

### Phase 5: Polish & Optimization (Week 5)
**Goal:** Production-ready experience

**Tasks:**
1. Performance optimization (analysis speed)
2. Error handling & edge cases
3. Offline/loading state improvements
4. Agent response formatting (markdown, tables, charts)
5. Keyboard shortcuts for chat
6. Settings panel (analysis frequency, notification preferences)
7. Export reports (PDF/CSV)
8. User testing & feedback iteration

**Deliverables:**
- Smooth, fast UX
- Beautiful formatting
- Comprehensive error handling
- Export capabilities
- User documentation

---

## Agent Capabilities & Training

### Finance Manager Agent Enhancements

**New Skills Required:**
1. **Database access** - Direct SQL queries or structured IPC calls
2. **CSV parsing** - Already exists via CLI
3. **Pattern recognition** - Analyze spending habits
4. **Budget optimization** - Math & reasoning
5. **Anomaly detection** - Flag unusual transactions
6. **Report generation** - Formatted markdown/tables
7. **Plan creation** - Structured recommendations

**Training Additions:**
- Add to `FINANCIAL_TOOLS_TRAINING.md`:
  - How to query transaction history
  - How to generate insights in JSON format
  - How to create financial plans
  - Response formatting guidelines
  - When to trigger alerts vs insights

**Example Agent Workflow:**

```
User uploads CSV
    ↓
Agent receives: "New transactions uploaded. Analyze."
    ↓
Agent queries database:
- Get all transactions for current month
- Compare to last 3 months average
- Check budget limits
- Look for unusual patterns
    ↓
Agent generates insights:
{
  "insights": [
    {
      "type": "spending_pattern",
      "severity": "info",
      "title": "Dining spending up 30% this month",
      "description": "You've spent $847 on dining vs $650 average. Main contributors: 5 UberEats orders ($230) and 3 restaurant visits ($350).",
      "data": { "category": "Dining", "current": 847, "average": 650 }
    },
    {
      "type": "warning",
      "severity": "warning",
      "title": "Groceries budget at 85%",
      "description": "You've spent $425 of your $500 monthly groceries budget with 8 days left in the month.",
      "data": { "category": "Groceries", "spent": 425, "limit": 500, "days_remaining": 8 }
    }
  ]
}
    ↓
Agent stores insights in database
    ↓
Agent sends UI update event
    ↓
UI refreshes and displays insights
```

---

## UI/UX Mockup Ideas

### Chat Interface Design

```
┌─────────────────────────────────────────────────┐
│ 💬 Finance Manager                       [−] [×] │
├─────────────────────────────────────────────────┤
│                                                 │
│  [AI] Analysis complete! Here's what I found:  │
│       • Dining up 30% vs last month            │
│       • Groceries budget at 85%                │
│       • Unusual transaction flagged: $450      │
│       Would you like details?                  │
│                                           10:32 │
│                                                 │
│  [Quick Actions]                               │
│  [Show detailed breakdown]                     │
│  [Adjust budgets]                              │
│  [Flag transaction]                            │
│                                                 │
│  You: Why did dining increase?                 │
│                                           10:33 │
│                                                 │
│  [AI] You ordered from UberEats 5 times this   │
│       week vs your usual 1-2 times/week.       │
│       • Mon: $42                               │
│       • Wed: $38                               │
│       • Thu: $51                               │
│       • Fri: $55                               │
│       • Sun: $44                               │
│       Pattern: All late evening (8-10pm)       │
│                                           10:33 │
│                                                 │
├─────────────────────────────────────────────────┤
│ Ask a question...                          [↑] │
└─────────────────────────────────────────────────┘
```

### Budget Card with AI Commentary

```
┌─────────────────────────────────────────────────┐
│ 💵 Family Budget                    January 2026│
├─────────────────────────────────────────────────┤
│                                                 │
│  $3,245 / $4,000                                │
│  ████████████████████░░░░ 81%                  │
│                                                 │
│  🤖 AI says: On track this month! You're       │
│     averaging $104/day vs $129 budget.         │
│     If you maintain this pace, you'll have     │
│     $755 remaining - perfect for the           │
│     upcoming vacation expenses.                │
│                                                 │
│  Top categories:                               │
│  🛒 Groceries     $650 / $800  ███████████░    │
│  🍽️ Dining        $520 / $600  ████████░░░    │
│  🚗 Transport     $380 / $400  █████████░░    │
│                                                 │
│  [Ask AI] [View Details]                       │
└─────────────────────────────────────────────────┘
```

### Insights Panel

```
┌─────────────────────────────────────────────────┐
│ 💡 AI Insights & Recommendations                │
├─────────────────────────────────────────────────┤
│                                                 │
│  ⚠️  Groceries budget at 85% (8 days left)     │
│      Consider stocking up on staples now       │
│      [Details] [Adjust budget]                 │
│                                                 │
│  💰  Savings opportunity: $127/month           │
│      Switch 3 UberEats orders → meal prep      │
│      [Show plan] [Dismiss]                     │
│                                                 │
│  📊  Spending trend: Transport -15%            │
│      Great job! You've reduced transport       │
│      costs by using Metro more often.          │
│      [Dismiss]                                 │
│                                                 │
│  🎯  Goal progress: Emergency fund 67%         │
│      $4,025 / $6,000 saved. On track!          │
│      [Details]                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Success Metrics

### Performance
- CSV upload → analysis complete: **< 30 seconds**
- Chat message response time: **< 3 seconds**
- UI update latency: **< 500ms**

### Quality
- **90%+** of insights are actionable and accurate
- **95%+** uptime for agent session
- **Zero** data loss during analysis
- **100%** of critical issues flagged

### User Experience
- User doesn't need to ask "what does this mean?" - insights are clear
- Agent responses feel conversational and helpful
- UI doesn't feel cluttered despite AI content
- Analysis happens transparently in background

---

## Risk Mitigation

### Technical Risks
**Risk:** Agent session crashes during analysis
**Mitigation:** 
- Implement analysis checkpoints
- Store partial results
- Auto-restart agent on crash
- Show error state with retry button

**Risk:** Analysis takes too long (>60s)
**Mitigation:**
- Show incremental progress
- Allow background analysis
- Cache common queries
- Optimize database queries

**Risk:** Agent gives bad financial advice
**Mitigation:**
- Disclaimers in UI
- Agent trained to suggest, not command
- User can always override
- Log all recommendations for review

### UX Risks
**Risk:** Chat interface feels bolted-on
**Mitigation:**
- Design chat as integral part of panel
- Contextual quick actions throughout UI
- Agent proactively surfaces insights
- Smooth animations and transitions

**Risk:** Too many notifications/insights
**Mitigation:**
- Intelligent priority ranking
- User controls notification frequency
- Insight dismissal and preferences
- Daily digest instead of real-time spam

---

## Future Enhancements (Post-MVP)

1. **Multi-account comparison** - Compare spending across accounts
2. **Predictive budgeting** - ML model predicts next month's spending
3. **Bill payment detection** - Auto-identify recurring bills
4. **Investment tracking** - Crypto portfolio analysis
5. **Voice interface** - Ask Finance Manager via voice
6. **Mobile notifications** - Push alerts for critical issues
7. **Shared budgets** - Family/team finance tracking
8. **Receipt OCR** - Upload receipt photos, auto-categorize
9. **Tax preparation** - Export tax-ready reports
10. **Integration with banks** - Auto-sync statements (beyond CSV)

---

## Resources & References

### Existing Code
- Finance backend: `~/froggo/finance-cli.ts` (CSV parser, categorization)
- Finance UI: `~/froggo-dashboard/src/components/FinancePanel.tsx`
- Agent workspace: `~/agent-finance-manager/`

### Dependencies
- `zustand` - State management
- `recharts` - Charts (if needed)
- `react-markdown` - Agent response formatting
- Database: SQLite (existing)

### Documentation
- OpenClaw Sessions API: For agent communication
- Finance CLI: For database queries
- IPC Bridge patterns: See writing-*-service.ts examples

---

## Sign-off

**Created by:** Froggo (AI)
**Requested by:** Kevin
**Date:** 2026-02-13

**Next Steps:**
1. Review and approve this plan
2. Assign to Chief for technical spec
3. Break into subtasks for Senior Coder / Coder
4. Begin Phase 1 implementation

**Questions for Kevin:**
- Chat panel placement preference: right sidebar, bottom drawer, or modal?
- Should analysis run automatically or require manual trigger after upload?
- Do you want push notifications for critical findings?
- Any specific financial metrics or KPIs you want tracked?
