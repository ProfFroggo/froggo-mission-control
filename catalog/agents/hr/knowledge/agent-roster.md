# Agent Roster — Knowledge Reference
### HR — Froggo Mission Control

This document is the living record of the Mission Control team. Every installed agent, their role, trust tier, specialty, current status, and collaboration patterns. HR maintains this document. Updated whenever an agent is added, modified, promoted, demoted, or decommissioned.

**Last updated**: See git log for latest modification date.
**Maintained by**: HR agent

---

## Team Overview

| Agent ID | Display Name | Role | Trust Tier | Status |
|----------|-------------|------|-----------|--------|
| mission-control | Mission Control | Platform Orchestrator | Principal | Active |
| clara | Clara | Quality Assurance Lead | Principal | Active |
| hr | HR | Team Architect | Principal | Active |
| inbox | Inbox | Message Triage | Worker | Active |
| coder | Coder | Software Engineer | Worker | Active |
| chief | Chief | Technical Lead | Worker | Active |
| designer | Designer | UI/UX Designer | Worker | Active |
| researcher | Researcher | Research Analyst | Worker | Active |
| writer | Writer | Content & Docs | Worker | Active |
| social-manager | Social Manager | X/Twitter Manager | Worker | Active |
| growth-director | Growth Director | Growth Strategy | Worker | Active |
| performance-marketer | Performance Marketer | Paid Media | Worker | Active |
| product-manager | Product Manager | Product Roadmap | Worker | Active |
| qa-engineer | QA Engineer | Quality & Testing | Worker | Active |
| data-analyst | Data Analyst | Analytics | Worker | Active |
| devops | DevOps | Infrastructure | Worker | Active |
| customer-success | CS | Customer Success | Worker | Active |
| project-manager | Project Manager | Coordination | Worker | Active |
| security | Security | Security & Compliance | Worker | Active |
| content-strategist | Content Strategist | Content Planning | Worker | Active |
| finance-manager | Finance Manager | CFO & Treasury | Worker | Active |
| discord-manager | Discord Manager | Community | Worker | Active |

---

## Trust Tier Definitions

| Tier | `permissionMode` | Meaning |
|------|-----------------|---------|
| **Principal** | `bypassPermissions` | Platform-level trust. Mission-critical agents. Can self-approve minor actions, manage team structure, run QA gates. |
| **Worker** | `bypassPermissions` (standard) | Proven, reliable agents with well-defined scope. Operates independently within their domain. |
| **Apprentice** | `default` | New or recently reset agents. All file writes and external actions require approval. Default for all new agent installations. |

**Promotion path**: Apprentice → Worker requires 30 tasks completed, zero scope violations, Clara quality-pass, HR review.
**Principal tier**: Reserved for Mission Control, Clara, HR. Not open to other agents without explicit governance decision.

---

## Agent Detail Cards

---

### Mission Control
- **Role**: Platform Orchestrator — receives all inbound tasks, routes them to the correct agent, manages the task pipeline, serves as the final approval authority for all external actions and fund movements
- **Trust tier**: Principal
- **Specialty**: Routing, task decomposition, approval gate, inter-agent coordination
- **Tools**: Full access — Read, Write, Edit, Bash, Glob, Grep, MCP (all servers)
- **Current status**: Active
- **Key collaboration patterns**:
  - Receives work from: all agents (via task board and chat)
  - Routes work to: every agent depending on task type
  - Approval authority for: external actions, fund movements, agent installations, trust tier changes
- **Notes**: The only agent that can mark tasks `done`. The only agent that can approve external-facing actions. Single point of orchestration — if routing is unclear, it goes to Mission Control.

---

### Clara
- **Role**: Quality Assurance Lead — reviews all agent work before it is marked done; enforces quality standards; runs internal-review gate before work starts and agent-review gate after completion
- **Trust tier**: Principal
- **Specialty**: Output quality, standards enforcement, cross-functional review, task pipeline integrity
- **Tools**: Read, Glob, Grep, Bash, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Receives work from: all agents (for review)
  - Does not route work to other agents; flags issues back to originating agent or escalates to Mission Control
  - Primary signal source for HR agent health reviews
- **Notes**: Clara is the gatekeeper of `done`. Nothing moves to `done` without her review. Her quality signals are the input HR uses for agent evaluation.

---

### HR
- **Role**: Team Architect — manages agent onboarding, trust tiers, capability definitions, team health, and organizational design
- **Trust tier**: Principal
- **Specialty**: Agent definition, onboarding process, trust evaluation, role clarity, team structure analysis
- **Tools**: Read, Glob, Grep, Write, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Works with: Mission Control (approval for structural changes), Clara (quality signal for agent evaluation), all agents (soul file accuracy, capability definition)
  - Escalates to: Mission Control for any team structure change requiring a decision
- **Notes**: HR recommends; Mission Control authorizes. HR does not unilaterally modify agent definitions or trust tiers.

---

### Inbox
- **Role**: Message Triage — first handler for all inbound messages; categorizes, prioritizes, and routes to the correct agent
- **Trust tier**: Worker
- **Specialty**: Message categorization, routing, urgency triage, queue management
- **Tools**: Read, Grep, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Receives: all inbound messages (email, Discord escalations, platform notifications)
  - Routes to: correct agent based on content type (bugs → Coder, product requests → PM, billing → Finance Manager, community → Discord Manager, etc.)
- **Notes**: Inbox does not resolve — it routes. Speed and accuracy of routing is the primary metric.

---

### Coder
- **Role**: Software Engineer — implements features, fixes bugs, reviews code, writes and maintains tests
- **Trust tier**: Worker
- **Specialty**: Next.js, TypeScript, React, better-sqlite3, API development, bug diagnosis
- **Tools**: Read, Edit, Write, Bash, Glob, Grep, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Receives bug reports from: Inbox, Discord Manager, Customer Success
  - Receives feature specs from: Product Manager
  - Hands off to: QA Engineer (for testing), DevOps (for deployment), Chief (for architecture review)
- **Notes**: Reads `froggo-coding-standards` and `froggo-testing-patterns` skills before any implementation work.

---

### Chief
- **Role**: Technical Lead — makes architecture decisions, reviews complex engineering work, sets technical standards, advises on system design
- **Trust tier**: Worker
- **Specialty**: System architecture, technical decision-making, engineering standards, code review for complex PRs
- **Tools**: Read, Edit, Write, Bash, Glob, Grep, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Receives escalations from: Coder (for architectural questions), DevOps (for infrastructure decisions)
  - Advises: Product Manager (on technical feasibility), Mission Control (on engineering risk)
- **Notes**: Chief doesn't do day-to-day implementation. Chief resolves architectural decisions and reviews high-risk changes.

---

### Designer
- **Role**: UI/UX Designer — creates and maintains design system, designs new features, produces assets for marketing and product
- **Trust tier**: Worker
- **Specialty**: UI design, Figma, component design, brand consistency, accessibility, dark/light theme
- **Tools**: Read, Write, Bash, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Receives briefs from: Product Manager (feature design), Growth Director (campaign assets), Content Strategist (editorial assets)
  - Hands designs to: Coder (for implementation), Writer (for brand guidelines)
- **Notes**: Platform design rule: no emojis in UI — Lucide icons only. All form elements must use global `forms.css` CSS variables.

---

### Researcher
- **Role**: Research Analyst — conducts market research, competitive analysis, user research, and data-gathering to inform strategy
- **Trust tier**: Worker
- **Specialty**: Web research, competitive intelligence, user survey analysis, data synthesis, research briefs
- **Tools**: Read, Write, WebSearch, WebFetch, Glob, Grep, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Receives research requests from: Growth Director, Product Manager, Finance Manager
  - Delivers research to: requestor + library (always saves to `library/docs/research/`)

---

### Writer
- **Role**: Content & Docs — writes all long-form content, documentation, help articles, email copy, and platform copy
- **Trust tier**: Worker
- **Specialty**: Technical writing, help documentation, email copy, blog posts, brand voice
- **Tools**: Read, Write, Glob, Grep, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Receives content requests from: Product Manager (docs), Customer Success (help articles), Content Strategist (blog/newsletter)
  - Shares content with: Designer (for design treatment), Social Manager (for X/Twitter adaptation)

---

### Social Manager
- **Role**: X/Twitter Manager — executes all X/Twitter content, manages posting schedule, monitors engagement, DMs, and community sentiment on X
- **Trust tier**: Worker
- **Specialty**: X/Twitter posting, engagement, DM management, real-time culture, crypto Twitter (CT) fluency
- **Tools**: Read, Write, WebSearch, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Receives content from: Content Strategist (strategy), Writer (long-form to adapt), Discord Manager (community sentiment)
  - Reports to: Growth Director (performance data)
- **Notes**: All external posts require `approval_create` before execution.

---

### Growth Director
- **Role**: Growth Strategy — owns the growth strategy, defines OKRs, manages acquisition and retention strategy, coordinates across marketing, product, and data
- **Trust tier**: Worker
- **Specialty**: Growth strategy, OKRs, acquisition strategy, retention strategy, cohort analysis, cross-functional growth planning
- **Tools**: Read, Write, Glob, Grep, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Directs: Performance Marketer, Social Manager, Content Strategist, Discord Manager
  - Works with: Product Manager (product-led growth), Data Analyst (metrics), Finance Manager (budget)

---

### Performance Marketer
- **Role**: Paid Media — executes and optimizes paid acquisition campaigns across channels
- **Trust tier**: Worker
- **Specialty**: Paid social, paid search, programmatic, campaign optimization, attribution
- **Tools**: Read, Write, WebSearch, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Receives strategy from: Growth Director
  - Receives creative from: Designer, Writer
  - Reports to: Growth Director + Finance Manager (budget tracking)
- **Notes**: All paid campaign launches require approval.

---

### Product Manager
- **Role**: Product Roadmap — owns the product roadmap, writes specs, prioritizes the backlog, synthesizes feedback from CS and community into product decisions
- **Trust tier**: Worker
- **Specialty**: Product specs, backlog management, user story writing, roadmap planning, stakeholder communication
- **Tools**: Read, Write, Glob, Grep, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Receives feedback from: Customer Success, Discord Manager, Researcher
  - Writes specs for: Coder, Designer
  - Coordinates with: Growth Director (product-led growth features), Chief (technical feasibility)

---

### QA Engineer
- **Role**: Quality & Testing — writes and maintains tests, validates builds before release, manages test coverage and regression
- **Trust tier**: Worker
- **Specialty**: Test writing, regression testing, bug reproduction, test coverage analysis, testing frameworks
- **Tools**: Read, Write, Bash, Glob, Grep, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Receives builds from: Coder
  - Reports issues to: Coder (bugs), Chief (systemic test coverage gaps)
  - Coordinates with: DevOps (CI/CD pipeline)

---

### Data Analyst
- **Role**: Analytics — builds and maintains data pipelines, analytics dashboards, and reporting infrastructure; answers data questions
- **Trust tier**: Worker
- **Specialty**: SQL, data pipelines, dashboard design, cohort analysis, financial metrics, product analytics
- **Tools**: Read, Write, Bash, Glob, Grep, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Receives data requests from: Growth Director, Finance Manager, Product Manager
  - Maintains dashboards for: all agents (via library outputs)

---

### DevOps
- **Role**: Infrastructure — manages cloud infrastructure, deployment pipelines, uptime, monitoring, and infrastructure cost optimization
- **Trust tier**: Worker
- **Specialty**: AWS/GCP, CI/CD, Docker, Kubernetes, monitoring, infrastructure-as-code
- **Tools**: Read, Write, Bash, Glob, Grep, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Works with: Coder and Chief (deployment pipeline), Finance Manager (infrastructure cost)
  - Escalates to: Chief (architecture decisions), Security (security incident response)

---

### Customer Success (CS)
- **Role**: Customer Success Manager — handles all user support, designs onboarding flows, manages retention strategy, and surfaces product feedback to the team
- **Trust tier**: Worker
- **Specialty**: Support response, onboarding design, churn analysis, NPS/CSAT, feedback synthesis, DeFi user empathy
- **Tools**: Read, Write, Glob, Grep, WebSearch, WebFetch, TodoRead, TodoWrite, MCP (mission-control_db, memory, google-workspace)
- **Current status**: Active
- **Key collaboration patterns**:
  - Escalates bugs to: Coder
  - Escalates billing issues to: Finance Manager
  - Routes product feedback to: Product Manager
  - Routes content gaps to: Writer
  - Shares sentiment data with: Discord Manager, Growth Director
- **Notes**: First responder for all user-facing issues. Maxes out at 50 turns per session (complex support cases).

---

### Project Manager
- **Role**: Coordination — manages cross-functional project timelines, dependencies, and progress tracking for larger initiatives
- **Trust tier**: Worker
- **Specialty**: Project planning, milestone tracking, dependency management, stakeholder communication
- **Tools**: Read, Write, Glob, Grep, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Coordinates: large multi-agent projects at Mission Control's direction
  - Reports progress to: Mission Control

---

### Security
- **Role**: Security & Compliance — conducts security reviews, manages security audits, maintains security policies, responds to security incidents
- **Trust tier**: Worker
- **Specialty**: Smart contract security, application security, key management, incident response, compliance review
- **Tools**: Read, Write, Bash, Glob, Grep, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Reviews: Coder's output for security issues (on request or scheduled)
  - Advises: DevOps (infrastructure security), Finance Manager (crypto transaction security)
  - Escalates P0 incidents to: Mission Control immediately

---

### Content Strategist
- **Role**: Content Planning — develops content strategy, editorial calendar, content themes, and content briefs for all channels
- **Trust tier**: Worker
- **Specialty**: Content strategy, editorial calendar, content brief writing, SEO/distribution strategy, brand voice
- **Tools**: Read, Write, Glob, Grep, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Directs: Writer (content briefs), Social Manager (social content themes), Designer (creative direction)
  - Receives direction from: Growth Director (strategy), Product Manager (product launches)

---

### Finance Manager
- **Role**: CFO & Treasury — manages operating budget, tracks treasury, produces financial reporting, evaluates all expense requests, forecasts runway
- **Trust tier**: Worker
- **Specialty**: Budget management, unit economics, cash flow forecasting, treasury management, crypto accounting, vendor management
- **Tools**: Read, Glob, Grep, Bash, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Reports to: Mission Control (all fund movements require approval)
  - Works with: Growth Director (marketing budget), DevOps (infrastructure costs), HR (headcount costs)
  - Receives escalations from: Customer Success (billing issues)

---

### Discord Manager
- **Role**: Community — manages the Discord server, moderates the community, runs community events, and surfaces community intelligence to the team
- **Trust tier**: Worker
- **Specialty**: Discord architecture, moderation, community health metrics, DeFi community culture, bot management, community events
- **Tools**: Read, Glob, Grep, Bash, MCP (mission-control_db, memory)
- **Current status**: Active
- **Key collaboration patterns**:
  - Surfaces community intelligence to: Product Manager, Growth Director, Customer Success
  - Coordinates with: Social Manager (cross-channel sentiment), Customer Success (escalated support issues)
  - Escalates security incidents to: Mission Control + Security

---

## Collaboration Patterns Map

```
INBOUND FLOW
External world → Inbox → Mission Control → [correct agent]

PRODUCT DELIVERY FLOW
Product Manager → Designer → Coder → QA Engineer → DevOps → (release)
                    ↑                                   ↓
              Customer Success              Mission Control (approval)
              (user feedback)

CONTENT FLOW
Content Strategist → Writer → Social Manager → X/Twitter
                           → Designer → Campaign assets
Growth Director ←←←← (performance data) ←←←← Data Analyst

FINANCIAL FLOW
Any agent (expense request) → Finance Manager (recommendation) → Mission Control (approval)
Finance Manager (monthly report) → Mission Control + Growth Director

COMMUNITY FLOW
Discord Manager → Customer Success (support escalations)
Discord Manager → Product Manager (feature requests, confusion patterns)
Discord Manager → Growth Director (sentiment data)
Discord Manager → Social Manager (community moments to amplify)

TRUST & TEAM FLOW
Any agent (quality issue) → Clara (review) → HR (evaluation)
HR (recommendation) → Mission Control (approval) → agent (change)
```

---

## Trust Incident Log

Track all trust-relevant events here. Add entries chronologically.

```
Format per entry:
DATE: [YYYY-MM-DD]
AGENT: [agent-id]
EVENT TYPE: [Promotion / Demotion / Scope Violation / Scope Change / Capability Update / Installation / Decommission]
DESCRIPTION: [What happened]
ACTION TAKEN: [What was done in response]
APPROVED BY: [Mission Control or HR as appropriate]
OUTCOME: [Result / current status]
```

---

## Capability Gap Register

When a gap in team coverage is identified, document it here. HR brings these to Mission Control with a recommendation.

```
Format per entry:
DATE IDENTIFIED: [YYYY-MM-DD]
GAP DESCRIPTION: [What can't currently be done, or what is done poorly due to missing capability]
IDENTIFIED BY: [which agent or who]
CURRENT WORKAROUND: [how it's being handled now]
PROPOSED RESOLUTION: [new agent, scope expansion of existing agent, or skill addition]
PRIORITY: [P0 critical / P1 high / P2 medium / P3 low]
STATUS: [Under evaluation / Recommendation made / Resolved]
```

---

## Decommission Records

When an agent is removed from the team, document here for institutional memory.

```
Format per entry:
AGENT ID: [id]
DISPLAY NAME: [name]
DECOMMISSION DATE: [YYYY-MM-DD]
REASON: [Role no longer needed / Replaced by / Scope merged into / Other]
MERGED INTO: [agent-id if scope absorbed by another agent, else N/A]
APPROVED BY: Mission Control
OUTSTANDING TASKS AT DECOMMISSION: [list or "none"]
NOTES: [anything worth remembering about why this agent existed and why it was removed]
```
