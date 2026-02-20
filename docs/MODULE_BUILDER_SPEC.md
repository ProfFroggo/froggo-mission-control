# Module Builder — Conversational Spec Builder

**Task:** task-1771576637025  
**Author:** Chief  
**Date:** 2026-02-20  
**Status:** Design spec

---

## 1. Overview

A new dashboard page where users build module specifications through a conversational AI interview. Left panel: chat interface. Right panel: live spec preview/wireframe. When the conversation completes, the system auto-generates all froggo-db tasks needed to build the module.

## 2. UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Module Builder                                    [New] [⋮] │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│   Conversation Panel     │     Spec Preview Panel           │
│                          │                                  │
│  🤖 What kind of module  │  ┌─────────────────────────┐    │
│     are you building?    │  │ Module: Social Analytics │    │
│                          │  │ Type: Full page          │    │
│  👤 A social media       │  │ Views: 2                 │    │
│     analytics dashboard  │  │                          │    │
│                          │  │ ┌─────┐ ┌─────┐         │    │
│  🤖 What data sources    │  │ │Chart│ │Table│          │    │
│     should it connect?   │  │ └─────┘ └─────┘         │    │
│                          │  │                          │    │
│  👤 Twitter/X API and    │  │ Services: 2              │    │
│     Instagram API        │  │ • x-api-client           │    │
│                          │  │ • instagram-service      │    │
│  [Type your answer...]   │  │                          │    │
│                          │  │ IPC Handlers: ~8         │    │
│                          │  └─────────────────────────┘    │
│                          │                                  │
│                          │  [Generate Tasks] [Export JSON]  │
├──────────────────────────┴──────────────────────────────────┤
│ Progress: ████████░░ 80% — 4/5 sections complete            │
└─────────────────────────────────────────────────────────────┘
```

## 3. Conversation Flow

### 3.1 Sections (Sequential)

1. **Module Identity** — name, description, category, icon
2. **Module Type** — full page, widget, service-only, hybrid
3. **Features & UI** — what components, layout, interactions
4. **Data & Integrations** — APIs, IPC handlers, store needs, external services
5. **Settings & Permissions** — user-configurable settings, required API keys, permission level

### 3.2 AI Interview Logic

The AI agent uses a structured questionnaire with follow-up questions based on answers. It builds a `ModuleSpec` object progressively:

```typescript
interface ModuleSpec {
  // Section 1: Identity
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  
  // Section 2: Type
  type: 'page' | 'widget' | 'service' | 'hybrid';
  hasNavigation: boolean;
  
  // Section 3: Features & UI
  views: ViewSpec[];
  components: ComponentSpec[];
  layout: 'single-panel' | 'split' | 'tabs' | 'grid';
  
  // Section 4: Data & Integrations
  ipcChannels: { handle: string[]; on: string[] };
  services: ServiceSpec[];
  storeSlice: StoreSpec | null;
  externalApis: string[];
  
  // Section 5: Settings & Permissions
  permissions: string[];
  settings: SettingSpec[];
  requiredApiKeys: ApiKeySpec[];
}
```

### 3.3 Question Examples per Section

**Section 1 — Identity:**
- "What's the name of your module?"
- "Describe what it does in one sentence."
- "What category? (productivity, social, finance, dev-tools, communication, other)"

**Section 2 — Type:**
- "Is this a full dashboard page, a widget panel, or a background service?"
- "Should it appear in the sidebar navigation?"

**Section 3 — Features & UI:**
- "What are the main features? List them."
- "Describe the layout — single panel, split view, tabs?"
- "Does it need charts, tables, forms, lists, or custom components?"

**Section 4 — Data:**
- "What data sources does it need? (database, APIs, gateway events)"
- "Does it need its own Electron IPC handlers?"
- "What external APIs should it connect to?"

**Section 5 — Settings:**
- "What should users be able to configure?"
- "Does it need API keys from the user?"
- "What permissions does it require? (storage, network, filesystem, etc.)"

## 4. Spec Preview Panel

Real-time rendering as the conversation progresses:

- **Section headers** with completion checkmarks
- **Module manifest preview** (rendered from current spec state)
- **Component wireframe** — simple box diagrams showing layout
- **Dependency graph** — shows services, IPC channels, external APIs
- **Estimated complexity** — effort indicator based on spec

## 5. Task Generation Pipeline

When user clicks "Generate Tasks", system creates:

### 5.1 Generated Task Structure

```
Main Task: "Build Module: <module-name>"
├── Subtask 1: "Create module scaffold (manifest.json, directory structure)"
├── Subtask 2: "Implement <view-name> view component"  (per view)
├── Subtask 3: "Implement <service-name> Electron service" (per service)
├── Subtask 4: "Implement store slice for <module-name>"  (if has store)
├── Subtask 5: "Add IPC handlers for <namespace>"  (if has IPC)
├── Subtask 6: "Integrate external API: <api-name>"  (per API)
├── Subtask 7: "Add settings UI for <module-name>"  (if has settings)
├── Subtask 8: "Write tests for <module-name>"
├── Subtask 9: "Register module in CoreViews and sidebar"
└── Subtask 10: "Commit and push to dev branch"
```

### 5.2 Task Generation Rules

- Main task assigned to `senior-coder` (or `coder` for simple modules)
- Priority inherited from complexity: simple=p2, medium=p1, complex=p0
- Each subtask gets acceptance criteria from the spec
- Deliverable = module directory path + manifest.json

## 6. Technical Implementation

### 6.1 New Files

```
src/components/ModuleBuilder/
├── ModuleBuilderPage.tsx        # Main page component (registered in CoreViews)
├── ConversationPanel.tsx        # Left panel — chat UI
├── SpecPreviewPanel.tsx         # Right panel — live preview
├── useModuleSpec.ts             # Hook managing ModuleSpec state
├── useConversationFlow.ts       # Hook managing interview sections/questions
├── TaskGenerator.ts             # Generates froggo-db tasks from spec
├── types.ts                     # ModuleSpec, ViewSpec, etc.
└── questionBank.ts              # All questions organized by section
```

### 6.2 AI Integration

- Uses OpenClaw gateway to send conversation messages
- System prompt instructs AI to follow the questionnaire flow
- AI extracts structured data from user responses
- Parsed data updates ModuleSpec in real-time

### 6.3 Task Generation API

```typescript
// TaskGenerator.ts
async function generateTasks(spec: ModuleSpec): Promise<void> {
  // Uses electron IPC to call froggo-db commands
  const mainTaskId = await ipc.invoke('froggo-db:task-add', {
    title: `Build Module: ${spec.name}`,
    description: buildDescription(spec),
    assign: spec.type === 'service' ? 'senior-coder' : 'coder',
    priority: estimatePriority(spec),
    deliverable: `src/modules/${spec.id}/`
  });
  
  // Generate subtasks based on spec
  for (const subtask of buildSubtasks(spec)) {
    await ipc.invoke('froggo-db:subtask-add', {
      taskId: mainTaskId,
      title: subtask.title,
      description: subtask.description
    });
  }
}
```

## 7. Registration

Add to `CoreViews.tsx`:
```typescript
{ id: 'modulebuilder', label: 'Module Builder', icon: Boxes, component: ModuleBuilderPage },
```

## 8. Implementation Plan

| Phase | Work | Agent | Effort |
|-------|------|-------|--------|
| 1 | Types, question bank, conversation flow hook | Chief/Coder | 4h |
| 2 | ConversationPanel UI | Coder | 6h |
| 3 | SpecPreviewPanel UI | Coder | 6h |
| 4 | AI integration (gateway conversation) | Senior Coder | 8h |
| 5 | TaskGenerator + IPC bridge | Coder | 4h |
| 6 | ModuleBuilderPage assembly + CoreViews registration | Coder | 2h |
| 7 | Testing + polish | Coder | 4h |
| 8 | Commit + push | Coder | 1h |

**Total: ~35 hours**
