# Features Research: AI Writing System

**Domain:** AI-collaborative long-form writing (memoir/novel, 1000+ pages)
**Researched:** 2026-02-12
**Context:** Module inside Froggo.app (Electron), agents Writer/Researcher/Jess, single user (Kevin)

---

## Table Stakes: Long-Form Writing

Features every long-form writing tool needs. Missing any of these = product feels broken, not just incomplete. These are the baseline set by Scrivener, iA Writer, and Google Docs over the past decade.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Chapter/section-based document structure** | Scrivener established this as standard. No writer manages a 1000-page document as one file. Users expect a tree of chapters/scenes they can navigate, reorder, and work on individually. | Medium | Already in Chief's design. Folder-per-project with markdown chapters is right. |
| **Rich text editing with markdown** | Writers expect bold, italic, headings, block quotes, lists. Markdown is the modern standard for portable, AI-friendly text. | Medium | TipTap (ProseMirror-based) is the right choice. Handles selection tracking, inline widgets, and has AI extension support. |
| **Autosave** | Losing work is unforgivable. Every modern editor autosaves. Writers should never have to think about saving. CKEditor research shows autosave should throttle (1-10s intervals), batch frequent changes, and block window close during pending saves. | Simple | Electron makes this easy -- write to filesystem on debounced change events. |
| **Undo/redo with deep history** | Writers expect Cmd+Z to work across many operations. Not just text changes but structural changes (moving paragraphs, accepting AI suggestions). | Simple | TipTap/ProseMirror has built-in undo/redo via history extension. |
| **Word count and progress stats** | Every writing tool from Scrivener to iA Writer shows word count. Writers use it to track progress, set goals, and estimate completion. Per-chapter and project-wide totals are expected. | Simple | Count words in markdown per chapter, aggregate for project. |
| **Outline/navigation panel** | Scrivener's binder, Notion's sidebar, iA Writer's file list. Writers need to see structure and jump between chapters without scrolling. Collapsible tree view is the standard pattern. | Medium | Left sidebar with chapter tree. Already in Chief's design. |
| **Version history** | Writers rewrite extensively. They need to see previous versions of chapters and restore if needed. Google Docs and Scrivener both provide this. Not git-level granularity -- more like named snapshots. | Medium | Snapshot on explicit save points + before AI edits. Store as versioned markdown files. |
| **Full-text search across project** | Writers need to find references to a character, location, or event across all chapters. "Find in project" is table stakes in Scrivener and every IDE. | Simple | Search markdown files in project directory. Electron can do this natively. |
| **Distraction-free / focus mode** | iA Writer's defining feature: dim everything except the current sentence or paragraph. Writers in flow state need zero visual noise. At minimum: a clean, minimal editor with option to hide sidebars. | Simple | Hide sidebars + focus mode CSS (dim non-active paragraphs). TipTap supports custom decorations for this. |
| **Export** | Writers need to get their work OUT. At minimum: copy as plain text, export as markdown, export as single combined document. PDF/ePub is a differentiator, not table stakes for MVP. | Simple (basic) | Concatenate chapter markdown files. PDF/ePub deferred to v3 per PROJECT.md. |
| **Drag-drop chapter reordering** | Scrivener's corkboard made this standard. Writers restructure constantly, especially in memoir where chronological order vs narrative order is a core decision. | Medium | Already in Chief's design for outline mode. |
| **Reading time estimate** | Writers and editors use this to pace chapters. Standard feature in iA Writer, Medium, and most modern writing tools. | Simple | ~265 words/minute average. Trivial calculation. |

**Confidence:** HIGH -- these features are consistent across every tool surveyed (Scrivener, iA Writer, Google Docs, Notion, Sudowrite, NovelCrafter).

---

## AI Collaboration Table Stakes

Features that make AI writing collaboration actually useful rather than annoying. Informed by patterns from Cursor (code), Notion AI (docs), Sudowrite (fiction), and NovelCrafter (novels).

| Feature | Why Essential | Complexity | Notes |
|---------|--------------|------------|-------|
| **On-demand AI only (no unsolicited suggestions)** | The single most important design decision. Research overwhelmingly shows that unsolicited AI suggestions break creative flow. Hacker News users describe autocomplete as "a focus destroyer" and "like someone constantly trying to finish your sentences." Creative writing is NOT code -- writers need to think, pause, and find their own words. AI should respond ONLY when asked. | Simple (restraint) | This means: NO ghost text autocomplete, NO proactive suggestions, NO "AI detected you paused" triggers. The user highlights text and explicitly invokes AI. This is the Cursor Cmd+K pattern applied to prose. |
| **Highlight-to-chat (inline feedback)** | The core innovation from Chief's design. User selects text, opens a chat panel anchored to that selection, describes what they want, gets alternatives. This is Cursor's inline edit (Cmd+K) adapted for prose. Notion AI does a simpler version (highlight -> menu of preset commands). Our version is conversational, which is better for creative work where the request is nuanced. | High | This is the hardest feature to get right. Requires: selection tracking in TipTap, floating panel anchored to selection, chat interface, streaming AI responses, diff display for alternatives, accept/reject UX. |
| **Multiple alternative versions** | When AI suggests changes, show 2-3 alternatives, not just one. Writers need choices. Sudowrite does this well with its "Rewrite" feature showing multiple options. One option feels like "take it or leave it" -- multiple options feel like collaboration. | Medium | Generate N alternatives in parallel or sequence. Display as tabs or stacked cards. Each shows the rewritten passage. |
| **Agent routing (ask the right AI)** | Different feedback needs different expertise. "Fix the pacing" goes to Writer. "Is this date accurate?" goes to Researcher. "Am I being too vulnerable here?" goes to Jess. Users should choose which agent to ask, with smart defaults based on the type of request. | Medium | Agent selector in feedback panel. Could use keyword detection for defaults (e.g., "fact" -> Researcher, "feel" -> Jess). Already have 3 agents defined. |
| **Context-aware responses** | AI must know what chapter you're in, who the characters are, what happened before, and what the outline says. Without context, AI gives generic responses that don't fit the story. This is NovelCrafter's key insight with their Codex -- AI that knows your world gives dramatically better results. | High | Multi-tier context system from Chief's design. Hot context (current chapter + outline + memory store) loaded into every AI request. This is the most architecturally complex feature. |
| **Show-don't-tell reasoning** | When AI suggests a change, it should explain WHY. Not just "here's a rewrite" but "I tightened the pacing by cutting the setup and starting in the action, because the previous 3 paragraphs established the setting already." This turns AI from a black box into a collaborator. | Simple | Add "reasoning" field to AI response format. Prompt engineering, not code complexity. |
| **Accept/reject with undo** | Accepting an AI suggestion should be a single click. Rejecting should be zero-effort (just close the panel). And accepting must be undoable -- writers sometimes accept, re-read in context, and decide it was wrong. | Medium | TipTap transaction-based editing supports this natively. Accept = apply transaction. Undo = reverse transaction. |
| **Conversation threading per selection** | Feedback on a passage should be a multi-turn conversation, not a one-shot. "Make it more tense" -> [AI suggests] -> "Good but the dialogue feels forced" -> [AI adjusts]. The dialogue history for that selection should persist. | Medium | JSONL feedback log per chapter (from Chief's design). Load previous feedback for a text range when reopening. |
| **Streaming responses** | AI responses must stream in real-time, not appear all at once after a long wait. Writers are watching for the AI's direction and want to interrupt if it's going wrong. This is standard in every AI chat interface. | Medium | OpenClaw gateway supports streaming. Pipe to feedback panel as tokens arrive. |
| **Preserve author voice** | The most critical quality requirement. AI rewrites must sound like Kevin, not like generic AI. Multiple sources document the "homogenization problem" where AI strips personality and produces bland, corporate-sounding text. Prevention: include writing samples in the system prompt as style reference; prompt AI to match voice; let user flag when AI sounds wrong. | Simple (prompt engineering) | Include 2-3 paragraphs of Kevin's existing writing as style examples in the system prompt. Add a "match my voice" instruction. Let user save "voice samples" as part of project settings. |

**Confidence:** HIGH -- these patterns are well-established across Cursor, Notion AI, Sudowrite, and NovelCrafter. The inline feedback pattern specifically is validated by Cursor's massive adoption for code.

---

## Differentiators

Features that would make this notably better than existing tools. These are not expected -- they're what makes users say "nothing else does this."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Multi-agent collaboration in one editor** | No existing writing tool has multiple specialized AI agents with different expertise accessible from the same editor. Sudowrite has one AI. Notion has one AI. NovelCrafter has one AI (with different models). Having Writer/Researcher/Jess with distinct personalities and knowledge is genuinely novel. | Medium | Agent routing already designed. The differentiator is that each agent has persistent memory about the project and distinct response patterns. |
| **Memory store with consistency checking** | NovelCrafter's Codex is the closest comparison, but it's manually maintained. Our system should auto-detect when new characters, events, or facts appear and prompt the user to add them to the memory store. Then cross-reference on every chapter load. "You mentioned Sarah has blue eyes in Chapter 3, but brown eyes in Chapter 15." | High | Requires: entity extraction from chapter text, comparison against stored profiles, contradiction flagging UI. Can start with manual memory management and add auto-detection later. |
| **Emotional/therapeutic guidance (Jess)** | No writing tool has a psychology-informed agent that helps with the emotional challenges of memoir writing. Memoir is uniquely demanding -- writing about trauma, family conflict, personal failure. Jess can guide pacing of difficult content, suggest when to take breaks, help with boundary-setting ("how much to reveal"), and provide narrative therapy frameworks. | Medium | Mostly prompt engineering for Jess's personality. UI is just another agent in the feedback panel. The value is in the guidance quality, not the code. |
| **Research library with source-to-passage linking** | Researchers need to track where facts come from. Our system can link specific passages to source citations, so when a reader asks "how do you know that?" the answer is one click away. No existing memoir tool does bidirectional linking between text and sources. | Medium | SQLite source database + chapter-position links. Researcher agent can populate this during fact-checking. |
| **Timeline visualization** | Memoir writers specifically struggle with chronology. A visual timeline showing when events happened and which chapters cover which time periods would be extremely valuable. Writers can see gaps, overlaps, and pacing issues at a glance. Plottr and Aeon Timeline exist as standalone tools, but integration with the writing environment is the differentiator. | High | Interactive timeline component, linked to memory store events. Click an event -> jump to the chapter that covers it. |
| **Feedback history as learning signal** | Every highlight-to-chat interaction is logged. Over time, this builds a dataset of what Kevin prefers. "Kevin always rejects verbose rewrites." "Kevin prefers short, punchy dialogue." This data can be used to improve AI suggestions without explicit configuration. | Medium (v3) | Start by logging everything in JSONL. Analysis/learning is a future feature. The logging itself has near-zero cost. |
| **Smart context injection (what NovelCrafter calls "Detection")** | When writing about a character, the system automatically loads that character's profile, relationships, and arc into the AI context. When a timeline event is referenced, load its details. This happens invisibly -- the writer just writes, and the AI always has the right context. | High | Requires entity detection in real-time as user types/navigates. Can start with manual tagging and build toward auto-detection. |
| **Writing session statistics** | Track words written per session, time spent, chapters touched. Visualize productivity over days/weeks. This is partially table stakes (word count) but the session-level tracking with historical charts is a differentiator for serious writers who want to understand their patterns. | Simple | Log session start/end times and word count changes. Basic chart component. |

**Confidence:** MEDIUM -- the competitive landscape analysis is solid, but "differentiator" status depends on what competitors ship between now and when this launches. The multi-agent and Jess integration are the strongest differentiators because they leverage existing Froggo infrastructure that competitors can't replicate.

---

## Anti-Features

Things that seem useful but actively hurt the writing experience. Deliberately do NOT build these.

| Anti-Feature | Why It Seems Good | Why It's Bad | What to Do Instead |
|--------------|-------------------|-------------|-------------------|
| **AI autocomplete / ghost text while typing** | Feels like the obvious AI feature. Every code editor does it (Copilot, Cursor Tab). Seems like it would speed up writing. | Creative writing is fundamentally different from code. Writers need to FIND their words, not accept suggestions. Ghost text trains writers to evaluate AI output instead of thinking. Hacker News users call it "a focus destroyer." Multiple sources document "metacognitive laziness" where writers stop thinking critically. In memoir specifically, authenticity requires the author's own language. | On-demand only. User must explicitly highlight text and request help. Never show ghost text, never autocomplete sentences. |
| **Auto-generate entire chapters** | Sudowrite and Squibler offer this. "Give me a prompt, get a chapter." Seems like a time-saver. | Generated chapters have no authentic voice. Multiple reviews note AI prose is "bland, abstract, repetitive" and "lacks big-picture context." For memoir, the entire point is Kevin's personal perspective -- AI-generated memoir is an oxymoron. This also creates a toxic editing loop where the writer rewrites AI output instead of writing. | AI assists with the writer's drafts. It suggests, rewrites passages, and helps edit. It never writes from scratch. The human always produces the first draft. |
| **Proactive AI suggestions ("I noticed your pacing is slow here...")** | Seems helpful -- like having an editor watching over your shoulder. Many AI tools do this. | Interrupts flow state. Research shows it takes 23+ minutes to regain focus after an interruption. Creative writers need sustained uninterrupted time. Proactive suggestions make the tool feel like it's judging you while you work. | All feedback is on-demand. The writer asks for feedback when ready. Exception: non-intrusive indicators (like a small dot on the consistency panel showing "2 potential issues") that the writer can check whenever they want. |
| **Grammar/spelling correction as primary feature** | Every writing tool does this. Grammarly built a billion-dollar business on it. Seems essential. | This already exists in the OS (macOS spellcheck) and in any editor. Building it would duplicate effort. More importantly, positioning the AI as a grammar cop trivializes its actual value (narrative collaboration). Writers also intentionally break grammar rules for voice. | Rely on OS-level spellcheck. AI agents should focus on narrative, emotional, and factual feedback -- not grammar. If grammar feedback is requested explicitly, the AI can provide it. |
| **Gamification of writing (badges, streaks, experience points)** | Apps like 4TheWords do this. Seems motivating. | Gamification is insulting for a serious memoir writer. It trivializes deeply personal work. Extrinsic motivation (badges) undermines intrinsic motivation (telling your story). Kevin is writing about his life, not playing a game. | Simple, honest statistics: words written today, chapters completed, total word count. No badges, no streaks, no celebratory animations. |
| **"AI Score" or quality metrics** | Automated readability scores (Flesch-Kincaid, etc.), AI-generated quality ratings. Seems data-driven. | Quality in memoir is subjective and personal. A readability score says nothing about emotional impact. An "AI quality score" is meaningless and anxiety-inducing. These metrics are for SEO content, not literature. | Let the human decide quality. AI agents provide qualitative feedback ("this paragraph loses momentum after the third sentence") not quantitative scores. |
| **Collaborative real-time editing (CRDT/OT)** | Google Docs does it. Seems modern. Already scoped out in PROJECT.md. | Single-user workflow. Building CRDT adds massive complexity (TipTap Hocuspocus, conflict resolution, websocket infrastructure) for zero benefit. Kevin is the sole writer. | Already correctly out of scope. Revisit only if workflow changes to include a human editor. |
| **"Make it better" button** | One-click AI improvement. Several tools offer this. | "Better" is undefined. This encourages lazy interaction and generic results. Multiple sources note the biggest mistake is asking AI to "make this better" instead of specifying how. | Force specific feedback. The user must describe what they want changed. The feedback panel requires a text input, not a button. |
| **Overly aggressive consistency checking** | Check everything against everything on every save. | Slow, noisy, and creates false positives that the writer learns to ignore. Consistency checking should be deliberate, not ambient. | Run consistency checks on-demand or at chapter completion milestones, not on every keystroke. Show results in a dedicated panel, not as inline warnings. |

**Confidence:** HIGH -- these anti-patterns are well-documented across writing tool reviews, writer community discussions, and AI writing criticism. The autocomplete/ghost text finding is especially strong with multiple independent sources agreeing.

---

## Memoir-Specific Features

Features that memoir writers specifically need, distinct from fiction writers. Informed by memoir writing tools (Memowrite, AutoCrit, Squibler memoir mode), memoir writing guides, and the unique challenges of personal narrative.

| Feature | Why Memoir-Specific | Complexity | Notes |
|---------|---------------------|------------|-------|
| **Chronological timeline of real events** | Fiction writers invent timelines. Memoir writers RECONSTRUCT them from memory. A timeline tool that lets the writer place real life events (with approximate dates, ages, locations) and then map chapters to time periods is essential for structural planning. | Medium | Timeline visualization with: event name, date range, chapter mapping. Unlike fiction timelines, these represent real history, so dates may be approximate ("summer 1995" not "June 15, 1995"). |
| **Dual chronology support** | Memoirs often have two timelines: narrative time (how the story is told, which may jump around) and chronological time (when events actually happened). Writers need to see both and understand the relationship. | Medium | Two views of the same events: chronological order and narrative order. The chapter tree shows narrative order; the timeline shows chronological order. |
| **People/relationship profiles** | Memoir characters are real people. Profiles need: real name, relationship to author, how they're referred to in the text (which may be pseudonymized), key interactions, and emotional significance. This is different from fiction character sheets which focus on invented traits. | Simple | JSON profiles in memory store. Fields: name, pseudonym (if used), relationship, description, emotional significance, chapters appeared in. |
| **Photo/media reference panel** | Memoir writers often work from photographs, letters, and documents. A reference panel that can display images alongside the text helps trigger memories and maintain accuracy. Memowrite specifically offers multimedia integration for this reason. | Medium | Store image references in project folder. Display in right sidebar when relevant chapter is active. Not a photo editor -- just reference viewing. |
| **Sensitivity/boundary annotations** | Memoir involves real people who may be alive. Writers need to mark passages as "sensitive" (e.g., discusses family member's addiction, names a real person in negative context). These annotations help during editing and before publication. Jess can specifically help with boundary decisions. | Simple | Custom annotation type in TipTap. Mark text ranges as "sensitive" with notes. Filter view to see all sensitive passages. |
| **Emotional arc tracking** | Memoirs need emotional pacing -- not just plot pacing. Too many heavy chapters in a row exhausts readers. Jess can help assess emotional weight per chapter and suggest pacing adjustments. Simple metadata: each chapter gets a "tone" tag (heavy, light, reflective, humorous, etc.). | Simple | Chapter metadata tag for emotional tone. Visualize as a bar chart showing emotional weight distribution across the book. |
| **"What really happened" vs "what I wrote" notes** | Memoir writers often change details for narrative purposes or to protect privacy. A private notes field per chapter that captures "what actually happened" (never shown to readers) helps the writer maintain their own clarity. | Simple | Hidden notes field per chapter. Stored in project folder but excluded from export. |
| **Trauma-pacing guidance** | Writing about trauma is psychologically demanding. Research on narrative therapy shows that pacing trauma exposure (in writing, not just reading) matters for the writer's wellbeing. Jess can suggest when to take breaks, when to write something lighter between heavy chapters, and how to frame traumatic events without retraumatization. | Simple (prompt) | Jess-specific system prompt patterns. When user is writing in chapters tagged as "heavy," Jess's guidance includes wellbeing-aware suggestions. |
| **Source verification for personal claims** | Memoirs get challenged on facts. "Did that really happen?" Having source evidence linked to claims (photos, documents, third-party accounts) strengthens the narrative and helps the writer distinguish reliable memory from reconstruction. Researcher agent is perfectly suited for this. | Medium | Extension of the research library. Researcher can flag claims as: verified (with source), plausible (no source but consistent), or uncertain (possibly reconstructed memory). |

**Confidence:** MEDIUM -- memoir-specific tools are less numerous and well-documented than fiction tools. The timeline and relationship features are clearly needed (multiple memoir guides emphasize them). The emotional/boundary features are less tested but logically sound given the domain.

---

## Existing Tool Patterns

What we can learn from established tools, organized by what each tool does best and where they fall short.

### Scrivener: The Long-Form Standard

**What it does best:**
- Binder (outline tree) for navigating large projects. The gold standard for chapter/scene navigation.
- Corkboard view: index cards representing chapters that can be physically rearranged. Writers love the spatial metaphor.
- Split view: two documents side by side (e.g., research notes + chapter draft).
- Compile: flexible export that combines all chapters into one formatted document with configurable output formats.
- Research folder: store PDFs, images, web pages alongside your manuscript. Everything in one project.
- Snapshot: manual version snapshots before major edits. Simple, reliable.

**Where it falls short:**
- Zero AI integration. Writers must copy/paste to ChatGPT and back.
- Looks dated. UI is from 2012. Learning curve is steep.
- No web/mobile version. Desktop only (macOS/Windows).
- No collaboration features whatsoever.

**Lesson for us:** The project structure and navigation patterns are proven over 15+ years. Copy the binder/outline pattern. Do NOT copy the UI complexity -- Scrivener has too many features and modes. Our editor should be simpler with AI filling the gap.

### Notion AI: Inline AI Done Simply

**What it does best:**
- Hit space on an empty line or highlight text -> AI menu appears. Extremely low-friction invocation.
- Preset commands: summarize, translate, change tone, expand, shorten. Covers common needs.
- Results appear inline, replacing or below the selected text. No separate panel needed for simple operations.
- Deeply integrated into the document editing experience -- not a sidebar chat.

**Where it falls short:**
- AI is generic -- it knows nothing about your project, characters, or story arc. Zero context awareness.
- No long-form structure (chapters, outline, corkboard). Notion pages are individual documents, not a coherent project.
- No memory or consistency management across documents.
- Single AI model with no specialization. Can't ask different "experts" for different types of feedback.

**Lesson for us:** The invocation pattern (highlight -> AI menu) is good for simple operations. For our complex conversational feedback, we need more than a command menu -- we need a chat panel. But for quick operations ("make this shorter," "rephrase formally"), a command menu could be a nice shortcut alongside the full chat panel.

### Sudowrite: AI Fiction Writing Leader

**What it does best:**
- Story Bible: structured knowledge base for characters, worldbuilding, plot. AI references it during generation.
- Multiple AI writing modes: Rewrite (alternatives for selected text), Describe (expand a brief note into prose), Expand (lengthen a passage), Shrinkray (compress/summarize).
- Smart detection: shows which Story Bible elements the AI is referencing in real-time (eyeball icon on character cards).
- Draft tool: generates scene prose from scene beats/outlines, using Story Bible for consistency.
- Series support: Story Bible shared across multiple books.

**Where it falls short:**
- Encourages AI-generated first drafts, which produces bland, voice-less prose.
- Credit-based pricing creates anxiety about using the tool freely.
- Single AI model (Muse) -- no specialized agents for different types of feedback.
- No emotional/therapeutic guidance for memoir-style personal writing.
- Limited to their cloud platform -- not a desktop-first experience.

**Lesson for us:** The Story Bible / Codex pattern is exactly right. Our "memory store" (characters, timeline, facts) serves the same purpose. The key difference: our agents reference the memory store automatically in every interaction, rather than requiring the writer to manually tag references. Also, Sudowrite's "Detection" feature (showing which story elements AI is referencing) is a good transparency pattern we should adopt.

### NovelCrafter: Best Context Management

**What it does best:**
- The Codex: robust internal wiki for characters, locations, lore, items. Auto-detects references in manuscript and shows inline previews.
- Progressions: track how characters/relationships/world change over time across the story. This is the evolution of static character sheets.
- BYOK (Bring Your Own Key): works with multiple AI providers. No credit system -- use your own API keys.
- Smart Highlighting: flags weak points and common AI-generated patterns in the text.
- AI automatically injects relevant Codex info into prompts, maintaining world consistency without manual context management.

**Where it falls short:**
- UI is complex. Steep learning curve.
- No memoir-specific features (timeline of real events, emotional guidance, sensitivity marking).
- No agent specialization -- one AI assistant for everything.
- Desktop-only via Electron (same as us, so not a disadvantage for our case).

**Lesson for us:** The automatic Codex injection is the pattern to follow for our context management. When the writer mentions "Sarah," the AI should automatically have Sarah's profile, relationships, and arc in context. NovelCrafter's "Progressions" feature (how things change over time) is an interesting advanced feature to consider for v3 -- in memoir, this would track how Kevin's relationship with someone evolved.

### iA Writer: Focus and Simplicity

**What it does best:**
- Focus Mode: dims everything except the current sentence or paragraph. Forces the writer into the present moment.
- Extremely minimal UI: no buttons, no popups, no title bar. Just text.
- Markdown-native with live preview.
- Syntax highlighting for prose: marks adjectives, adverbs, and other style elements to help writers self-edit.
- Content blocks: include other files inline (great for assembling chapters into a manuscript).

**Where it falls short:**
- No project structure (it's a single-file editor with a file browser, not a project manager).
- No AI features at all.
- No collaboration.
- No character/timeline/consistency management.

**Lesson for us:** The Focus Mode and minimal design philosophy should be available as an option. When Kevin is in flow state writing a chapter, he should be able to hide EVERYTHING (sidebars, panels, memory store) and just see text. The syntax highlighting for prose (marking adverbs, etc.) is an interesting edit-mode feature but probably anti-feature for first-draft writing.

### Cursor (Code) -> Prose Adaptation

**What it does best (adapted for prose):**
- **Cmd+K inline edit:** Select code, type instruction, get modified version inline. This is the EXACT pattern for our inline feedback, but for prose instead of code.
- **Diff display:** Shows what changed clearly (added/removed/modified). For prose, this means showing the original passage alongside the AI alternative with differences highlighted.
- **Chat sidebar:** Conversation about the codebase. For prose, this becomes conversation about the manuscript -- "What's the emotional arc of Part 2?" or "Summarize all scenes with Sarah."
- **Context indexing:** Cursor indexes the entire codebase so AI has full-project awareness. We need the same for the manuscript -- the AI should "know" the whole book even when only one chapter is in the active window.

**Key differences between prose and code editors for AI:**
- Code has a correct/incorrect dimension (does it compile, pass tests). Prose does not. AI code suggestions can be validated objectively; AI prose suggestions are inherently subjective.
- Code editors can safely autocomplete (Tab to accept). Prose editors should NOT autocomplete (it kills voice).
- Code changes are typically small, mechanical, and local. Prose changes ripple through tone, voice, and narrative arc.
- Code review is about correctness. Prose review is about quality, which is subjective and personal.
- Code context is structural (files, functions, types). Prose context is narrative (characters, events, themes).

**Lesson for us:** The Cmd+K pattern (select -> instruct -> get alternatives -> accept/reject) is the right interaction model. The diff display needs adaptation -- for prose, show the full rewritten passage with highlighting rather than line-by-line diff. The chat sidebar maps to our agent panel. The context indexing maps to our multi-tier context system.

### Google Docs + Gemini: Lightweight AI

**What it does best:**
- "Help me write" prompt box: type what you want, get generated content. Low friction for starting.
- Refine suggestions: after generation, options to adjust tone, expand, shorten, or regenerate.
- Source grounding: Gemini can reference documents linked in the doc and emails in Gmail for factual accuracy.
- Suggestion mode (track changes): AI suggestions appear as tracked changes that can be accepted or rejected individually.

**Where it falls short:**
- Generic AI with no project awareness. Doesn't know your characters, timeline, or story arc.
- Optimized for business documents (emails, reports), not creative writing.
- No long-form project structure. A 1000-page memoir in Google Docs would be unmanageable.
- The AI is Gemini, which is weaker at creative writing than Claude.

**Lesson for us:** The source grounding pattern (AI can reference linked sources) maps to our research library. The "refine" options (adjust tone, expand, shorten) could be quick-action buttons in our feedback panel alongside the full chat input. Keeps simple operations fast while allowing complex instructions when needed.

---

## Feature Dependency Map

Some features must be built before others. This informs phase ordering.

```
Project Structure (folders, chapters, metadata)
    |
    +-- Chapter Editor (TipTap, markdown, autosave)
    |       |
    |       +-- Inline Feedback (highlight -> chat -> alternatives)
    |       |       |
    |       |       +-- Agent Routing (Writer / Researcher / Jess)
    |       |       |
    |       |       +-- Multiple Alternatives display
    |       |       |
    |       |       +-- Accept/Reject with undo
    |       |
    |       +-- Version History (snapshots before AI edits)
    |       |
    |       +-- Focus Mode (distraction-free CSS)
    |       |
    |       +-- Word Count / Progress Stats
    |
    +-- Outline Navigation (chapter tree, drag-drop)
    |
    +-- Memory Store (characters, timeline, facts -- JSON)
    |       |
    |       +-- Context Injection (auto-load relevant memory into AI)
    |       |
    |       +-- Consistency Checking (compare memory vs chapter text)
    |
    +-- Research Library (sources, citations -- SQLite)
    |       |
    |       +-- Source-to-passage linking
    |       |
    |       +-- Fact verification workflow
    |
    +-- Search (full-text across project)
    |
    +-- Export (combine chapters, basic formats)
```

**Critical path:** Project Structure -> Chapter Editor -> Inline Feedback -> Context-aware Agent Responses

The editor must exist before inline feedback can work. The memory store must exist before context injection can work. But the memory store can be manually populated initially (auto-detection is an enhancement, not a blocker).

---

## MVP Feature Recommendation

For the first usable version, prioritize:

**Must have (Phase 1):**
1. Project creation and chapter-based file structure
2. TipTap chapter editor with markdown, autosave, undo/redo
3. Inline feedback: highlight -> chat panel -> Writer agent responds -> accept/reject
4. Outline sidebar with chapter navigation
5. Word count (per chapter and project)

**Must have (Phase 2):**
6. Memory store: character profiles and timeline (manually managed JSON)
7. Context injection: load memory store into AI context automatically
8. Researcher agent integration with basic fact-checking
9. Version snapshots before AI edits

**Should have (Phase 3):**
10. Full-text search across project
11. Research library with source tracking
12. Jess agent integration for emotional guidance
13. Focus mode
14. Multiple AI alternatives (2-3 per request)
15. Consistency checking (manual trigger)

**Defer to later:**
- Auto-detection of characters/events from text (complex NLP, start with manual)
- Timeline visualization (medium complexity, needed but not blocking)
- Photo/media reference panel (nice to have)
- Writing session statistics and productivity charts
- PDF/ePub export (already deferred to v3)
- Story arc visualization (already deferred to v3)
- Feedback history analysis / learning signal (v3)

---

## Sources

### Primary (HIGH confidence)
- [Scrivener Official Overview](https://www.literatureandlatte.com/scrivener/overview)
- [NovelCrafter Codex Feature](https://www.novelcrafter.com/features/codex)
- [NovelCrafter Full Features](https://www.novelcrafter.com/features)
- [Sudowrite Story Bible Docs](https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC)
- [Sudowrite Characters Docs](https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/characters/a7tdE1ZB8KvAwMD3Mopwpd)
- [Notion AI FAQ](https://www.notion.com/help/notion-ai-faqs)
- [Notion AI for Docs Guide](https://www.notion.com/help/guides/notion-ai-for-docs)
- [iA Writer Official](https://ia.net/writer)
- [iA Writer Focus Mode](https://ia.net/writer/support/editor/focus-mode)
- [Tiptap Content AI](https://tiptap.dev/product/content-ai)
- [Tiptap AI Generation Docs](https://tiptap.dev/docs/editor/extensions/functionality/ai-generation)
- [CKEditor Autosave Docs](https://ckeditor.com/docs/ckeditor5/latest/features/autosave.html)
- [Google Docs Gemini Writing Features](https://support.google.com/docs/answer/13951448?hl=en)
- [Cursor AI Getting Started](https://www.datacamp.com/tutorial/cursor-ai-code-editor)

### Secondary (MEDIUM confidence)
- [Kindlepreneur: Best AI Writing Tools 2026](https://kindlepreneur.com/best-ai-writing-tools/)
- [Kindlepreneur: Sudowrite Review](https://kindlepreneur.com/sudowrite-review/)
- [Kindlepreneur: NovelCrafter Review](https://kindlepreneur.com/novelcrafter-review/)
- [Best AI for Writing Fiction 2026](https://blog.mylifenote.ai/the-11-best-ai-tools-for-writing-fiction-in-2026/)
- [Sudowrite No-BS 2026 Guide](https://sudowrite.com/blog/best-ai-for-novelists-the-no-bs-2026-guide/)
- [Scrivener Review 2026](https://www.softwarehow.com/scrivener-review/)
- [Notion AI Inline Guide](https://www.eesel.ai/blog/notion-ai-inline)
- [Memoir Writing Tools - Memowrite](https://www.getmemowrite.com/advertorial/top-6-tools-for-writing-personal-memoirs-in-2025)
- [AutoCrit for Memoir](https://www.autocrit.com/autocrit-writing-biography-memoir/)
- [How to Create Life Timeline for Memoir](https://meminto.com/blog/how-to-create-a-life-timeline-for-your-memoir-writing-project/)
- [Preserving Voice with AI - Lawline](https://blog.lawline.com/on-writing-preserving-your-voice-in-ai-generated-writing)
- [AI Homogenization Problem - Scale](https://scale.com/blog/using-llms-while-preserving-your-voice)
- [AI Writing Weaknesses - Wordrake](https://www.wordrake.com/blog/weaknesses-of-ai-generated-writing)
- [Flow State Writing - FunBlocks](https://www.funblocks.net/blog/2025/10/12/Flow-State-Writing-How-Immersive-Writing-Tools-Unlock-Your-Creative-Potential)
- [CKEditor Performance Optimization](https://ckeditor.com/blog/how-we-made-our-rich-text-editor-load-faster-part-1/)
- [Novel.sh vs Tiptap](https://tiptap.dev/alternatives/novel-vs-tiptap)
- [Tiptap AI Agent Release](https://tiptap.dev/blog/release-notes/introducing-the-tiptap-ai-agent)

### Community/Opinion (LOW confidence -- patterns, not facts)
- [Hacker News: AI autocomplete as focus destroyer](https://news.ycombinator.com/item?id=44295017)
- [Why AI Writing Is Mid - Nathan Lambert](https://www.interconnects.ai/p/why-ai-writing-is-mid)
- [AI Should Be a Tool Not a Ghostwriter](https://www.samwoolfe.com/2025/07/ai-should-be-a-writing-tool-not-a-ghostwriter.html)
- [ChatGPT and Homogenization of Language - ASCCC](https://www.asccc.org/content/chatgpt-and-homogenization-language-how-adoption-ai-silences-student-voices)
