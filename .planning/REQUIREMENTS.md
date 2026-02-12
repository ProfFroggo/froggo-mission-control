# Requirements: Writing System v2.0

**Defined:** 2026-02-12
**Core Value:** Kevin can write a complete memoir using AI-collaborative inline feedback -- highlight any passage, get contextual alternatives from the right agent, and maintain consistency across hundreds of chapters.

## v2 Requirements

Requirements for writing system milestone. Each maps to roadmap phases.

### Foundation

- [x] **FOUND-01**: User can create a new writing project with title and type (memoir/novel)
- [x] **FOUND-02**: User can see a list of all writing projects with stats (word count, chapter count)
- [x] **FOUND-03**: User can open a writing project and see its chapter list
- [x] **FOUND-04**: User can create, rename, and delete chapters within a project
- [x] **FOUND-05**: User can edit chapter content in a rich text editor with markdown support
- [x] **FOUND-06**: Chapter content auto-saves with debounce (no manual save button needed)
- [x] **FOUND-07**: User can navigate between chapters via outline sidebar
- [x] **FOUND-08**: Writing workspace accessible from main dashboard sidebar navigation
- [x] **FOUND-09**: User can see word count per chapter and total project word count
- [x] **FOUND-10**: Writing projects stored as file-based structure (markdown chapters, JSON metadata)

### Editor

- [x] **EDIT-01**: Rich text editor supports headings, bold, italic, lists, blockquotes, links
- [x] **EDIT-02**: Editor loads from and saves to markdown files (bidirectional)
- [x] **EDIT-03**: Editor handles 10k+ word chapters without performance degradation
- [x] **EDIT-04**: User can undo/redo changes with standard keyboard shortcuts
- [x] **EDIT-05**: Editor toolbar shows formatting options (headings, bold, italic, lists)

### Inline Feedback

- [ ] **FEED-01**: User can highlight text in the editor and see a feedback popover
- [ ] **FEED-02**: User can type feedback/instructions in the popover and send to an AI agent
- [ ] **FEED-03**: AI agent responds with 2-3 alternative versions of the highlighted text
- [ ] **FEED-04**: User can accept an alternative (replaces highlighted text) or dismiss
- [ ] **FEED-05**: User can select which agent to send feedback to (Writer, Researcher, Jess)
- [ ] **FEED-06**: AI response streams in real-time (not blank screen then full response)
- [ ] **FEED-07**: Feedback interactions are logged per chapter (JSONL append-only)
- [ ] **FEED-08**: AI context includes current chapter, outline, and memory store data

### Memory Store

- [ ] **MEM-01**: User can create/edit/delete character profiles (name, relationship, description, traits)
- [ ] **MEM-02**: User can create/edit/delete timeline events (date, description, chapter refs)
- [ ] **MEM-03**: User can create/edit/delete verified facts (claim, source, status)
- [ ] **MEM-04**: Memory store displays in context panel alongside editor
- [ ] **MEM-05**: Memory store data is automatically injected into AI agent context for feedback
- [ ] **MEM-06**: Memory store persists as JSON files per project

### Research Library

- [ ] **RES-01**: User can add research sources (title, author, type, URL, notes)
- [ ] **RES-02**: User can link sources to specific facts in the memory store
- [ ] **RES-03**: User can mark facts as verified/disputed/needs-source
- [ ] **RES-04**: Research data stored in per-project SQLite database
- [ ] **RES-05**: Researcher agent can be asked to fact-check highlighted claims

### Outline & Versions

- [ ] **OUT-01**: User can see project outline with collapsible chapter tree
- [ ] **OUT-02**: User can reorder chapters via drag-and-drop
- [ ] **OUT-03**: User can save version snapshots of chapters before major edits
- [ ] **OUT-04**: User can view and restore previous chapter versions
- [ ] **OUT-05**: Version comparison shows differences between versions

### Agent Integration

- [ ] **AGENT-01**: Writer agent provides style, pacing, and narrative feedback
- [ ] **AGENT-02**: Researcher agent provides fact-checking and source verification
- [ ] **AGENT-03**: Jess agent provides emotional guidance and memoir-specific support
- [ ] **AGENT-04**: Each agent has project-scoped sessions (context persists within project)
- [ ] **AGENT-05**: Agent communication uses existing OpenClaw Gateway WebSocket

## v3 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Advanced Features

- **ADV-01**: PDF/ePub export for publication-ready manuscripts
- **ADV-02**: Vector search for semantic retrieval across chapters
- **ADV-03**: Story arc visualization across chapters
- **ADV-04**: Auto-detection of characters/events from chapter text
- **ADV-05**: Timeline visualization (chronological + narrative order)
- **ADV-06**: Character relationship graphs
- **ADV-07**: Writing session statistics and productivity tracking
- **ADV-08**: Focus/distraction-free writing mode
- **ADV-09**: Sensitivity/boundary annotations for memoir content
- **ADV-10**: Style guide enforcement via AI

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time multi-user collaboration | Single-user workflow, CRDT complexity unjustified |
| AI autocomplete/ghost text | Research confirms it destroys creative voice -- anti-feature |
| AI-generated first drafts | User writes, AI assists -- never the other way around |
| Custom markdown editor (split-pane) | TipTap WYSIWYG is better for prose writing |
| Gamification (streaks, badges) | Research shows it pressures and stresses writers |
| electron/main.ts monolith breakup | Separate effort, not writing-related |
| preload namespace rename | Cosmetic, deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 5 | Complete |
| FOUND-02 | Phase 5 | Complete |
| FOUND-03 | Phase 5 | Complete |
| FOUND-04 | Phase 5 | Complete |
| FOUND-05 | Phase 5 | Complete |
| FOUND-06 | Phase 5 | Complete |
| FOUND-07 | Phase 5 | Complete |
| FOUND-08 | Phase 5 | Complete |
| FOUND-09 | Phase 5 | Complete |
| FOUND-10 | Phase 5 | Complete |
| EDIT-01 | Phase 5 | Complete |
| EDIT-02 | Phase 5 | Complete |
| EDIT-03 | Phase 5 | Complete |
| EDIT-04 | Phase 5 | Complete |
| EDIT-05 | Phase 5 | Complete |
| FEED-01 | Phase 6 | Pending |
| FEED-02 | Phase 6 | Pending |
| FEED-03 | Phase 6 | Pending |
| FEED-04 | Phase 6 | Pending |
| FEED-05 | Phase 6 | Pending |
| FEED-06 | Phase 6 | Pending |
| FEED-07 | Phase 6 | Pending |
| FEED-08 | Phase 6 | Pending |
| MEM-01 | Phase 7 | Pending |
| MEM-02 | Phase 7 | Pending |
| MEM-03 | Phase 7 | Pending |
| MEM-04 | Phase 7 | Pending |
| MEM-05 | Phase 7 | Pending |
| MEM-06 | Phase 7 | Pending |
| RES-01 | Phase 8 | Pending |
| RES-02 | Phase 8 | Pending |
| RES-03 | Phase 8 | Pending |
| RES-04 | Phase 8 | Pending |
| RES-05 | Phase 8 | Pending |
| OUT-01 | Phase 9 | Pending |
| OUT-02 | Phase 9 | Pending |
| OUT-03 | Phase 9 | Pending |
| OUT-04 | Phase 9 | Pending |
| OUT-05 | Phase 9 | Pending |
| AGENT-01 | Phase 6 | Pending |
| AGENT-02 | Phase 8 | Pending |
| AGENT-03 | Phase 10 | Pending |
| AGENT-04 | Phase 6 | Pending |
| AGENT-05 | Phase 6 | Pending |

**Coverage:**
- v2 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-12 — Phase 5 requirements complete*
