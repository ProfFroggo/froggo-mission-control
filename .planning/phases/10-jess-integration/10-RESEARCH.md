# Phase 10: Jess Integration - Research

**Researched:** 2026-02-13
**Domain:** Agent-specific prompt engineering + UI differentiation in existing inline feedback system
**Confidence:** HIGH

## Summary

Phase 10 is a configuration/prompt-engineering phase, not an infrastructure phase. The inline feedback system built in Phase 6 already has full support for Jess as a selectable agent -- `AgentPicker.tsx` lists her with a Heart icon, `feedbackStore.ts` types her as a valid agent, and `buildPrompt()` in `FeedbackPopover.tsx` already has a Jess-specific preamble. The gateway session routing (`agent:jess:writing:{projectId}`) already works. The Jess OpenClaw agent exists at `~/.openclaw/agents/jess/` with configured auth profiles and models.

The work is making Jess's feedback **contextually distinct** from Writer. Currently, the only difference is a single preamble line. Writer and Jess both return 3 rewritten alternatives in the same format with the same instructions. This misses Jess's value: emotional impact assessment, boundary awareness, pacing of sensitive content, and memoir-specific tone guidance.

**Primary recommendation:** Expand the prompt system to give Jess a fundamentally different response format -- not just 3 rewrites, but alternatives that include emotional commentary (why a change matters for the reader/writer), boundary flags, and memoir-specific tone notes. Adjust `parseAlternatives()` and `FeedbackAlternative` to render this richer format when Jess is the selected agent.

## Standard Stack

### Core

No new libraries needed. This phase modifies existing code only.

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React | existing | UI components | Already installed |
| Zustand | existing | feedbackStore state | Already installed |
| TipTap | existing | Editor + BubbleMenu | Already installed |
| Lucide React | existing | Heart icon for Jess | Already installed |

### Supporting

No new dependencies required.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Agent-specific prompt in FeedbackPopover | Separate JessFeedbackPopover component | Over-engineering -- a few conditional branches in the existing component suffice |
| Jess-specific response parsing | Generic markdown parser | Over-kill -- structured headers work fine for the 3-alternative format |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure

No new files needed. All changes are to existing files:

```
src/components/writing/
  FeedbackPopover.tsx     # Modify: Jess-specific prompt, Jess-specific response parsing
  FeedbackAlternative.tsx # Modify: Support optional commentary field
  AgentPicker.tsx         # No changes (Jess already listed)
src/store/
  feedbackStore.ts        # No changes (Jess already typed)
```

### Pattern 1: Agent-Specific Prompt Branching

**What:** The `buildPrompt()` function already has an `agentPreamble` record keyed by agent ID. Extend this pattern to also vary the response format instructions and the prompt body per agent.

**When to use:** When agents need fundamentally different output structures, not just different personality.

**Current state (line 65-69 of FeedbackPopover.tsx):**
```typescript
const agentPreamble: Record<string, string> = {
  writer: 'You are a skilled writing editor focused on style, pacing, and narrative craft.',
  researcher: 'You are a meticulous research editor focused on accuracy, fact-checking, and clarity.',
  jess: 'You are Jess, a compassionate editorial guide focused on emotional impact, sensitivity, and memoir-specific tone.',
};
```

**Target state:** Jess preamble is much richer, drawing from SOUL.md concepts:
```typescript
jess: [
  'You are Jess, a therapist and editorial guide who understands memoir as psychological integration, not just storytelling.',
  'You focus on: emotional impact on the reader, emotional cost to the writer, pacing of sensitive disclosure,',
  'boundary awareness (what to reveal vs. protect), tone calibration (honesty without trauma performance),',
  'and the relationship between how something is written and what it does for the person writing it.',
  'You are warm but not soft. You say hard things when they need saying. You are precise, not verbose.',
].join(' '),
```

### Pattern 2: Agent-Specific Response Format

**What:** Instead of always requesting "3 alternative versions," Jess's prompt should request alternatives that include emotional commentary alongside the rewrite.

**Jess response format:**
```
### Alternative 1
[rewritten text]

**Why:** [1-2 sentences on emotional impact -- what this version does differently for the reader/writer]

### Alternative 2
[rewritten text]

**Why:** [1-2 sentences]

### Alternative 3
[rewritten text]

**Why:** [1-2 sentences]
```

**Parser change:** `parseAlternatives()` (line 126-129) currently splits on `### Alternative N` and returns plain strings. For Jess, the parser should also extract the `**Why:**` commentary and return structured objects. The `FeedbackAlternative` component should conditionally render the commentary below the alternative text.

### Pattern 3: Researcher Had Precedent -- Agent-Specific Actions

**What:** The Researcher agent already has a separate code path (`handleFactCheck` + `buildFactCheckPrompt`). This shows the pattern: agents can have dedicated prompt builders and UI actions. Jess should get a similar but lighter treatment -- not a separate handler, but a modified prompt and enriched display.

### Anti-Patterns to Avoid

- **Duplicating the entire FeedbackPopover for Jess:** The component is 430 lines. Creating a separate JessFeedbackPopover would be pure duplication. Use conditional logic within the existing component instead.
- **Making Jess identical to Writer with a different preamble:** This is the current state and it fails the success criteria. The response *format* must differ -- emotional commentary is what makes Jess contextually distinct.
- **Overloading Jess's prompt with full SOUL.md text:** The SOUL.md is 73 lines of therapeutic context. Only the writing/memoir-relevant concepts should go into the prompt preamble -- emotional impact, boundary awareness, narrative therapy framing, tone calibration.
- **Breaking the alternatives parsing for Writer/Researcher:** Changes to `parseAlternatives` must be backward-compatible. Writer and Researcher should continue to work exactly as they do now.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Jess agent session management | Custom session handler | Existing `agent:jess:writing:{projectId}` key pattern | Already works via gateway.sendChatWithCallbacks |
| Jess agent authentication | New auth flow | Existing OpenClaw agent config at `~/.openclaw/agents/jess/` | Already has auth profiles + models configured |
| Agent picker UI | New component | Existing AgentPicker.tsx (already lists Jess with Heart icon) | No changes needed |
| Feedback logging for Jess | Separate logging | Existing JSONL logging in FeedbackPopover (lines 237-248) | Already logs agentId field |

**Key insight:** 95% of the infrastructure is already built. This phase is about prompt engineering and one UI enrichment (commentary display), not about building systems.

## Common Pitfalls

### Pitfall 1: Jess Feedback Indistinguishable From Writer

**What goes wrong:** If Jess only differs by a one-line preamble (current state), users cannot tell the difference between Writer and Jess feedback. The alternatives look the same -- just rewrites with no emotional dimension.
**Why it happens:** The response format is identical ("provide exactly 3 alternative versions"), and a one-line preamble gets diluted by the rest of the prompt.
**How to avoid:** Give Jess a fundamentally different response format that includes emotional commentary (`**Why:**` blocks). The preamble should also be 3-5 sentences covering memoir-specific concepts (boundary awareness, emotional cost, tone calibration).
**Warning signs:** If you highlight text, send to Jess, then switch to Writer and send the same request, and the outputs are near-identical, the differentiation has failed.

### Pitfall 2: Jess Commentary Breaks parseAlternatives

**What goes wrong:** Adding `**Why:**` blocks to Jess responses means the parser needs to handle extra content after each alternative's rewrite text. If the parser just splits on `### Alternative N`, the commentary gets included in the alternative text itself.
**Why it happens:** `parseAlternatives` (line 126-129) uses a simple regex split: `response.split(/###\s*Alternative\s*\d+\s*/i)`. Everything between alternative headers is treated as one block.
**How to avoid:** When agent is `jess`, split each block further on `**Why:**` to separate the rewrite from the commentary. Return a structured format `{ text: string, commentary?: string }` or handle it in the display layer.
**Warning signs:** Jess alternatives show commentary text concatenated with the rewrite text in the accept-able area.

### Pitfall 3: Jess Prompt Token Bloat

**What goes wrong:** Trying to include too much therapeutic context (full SOUL.md, full MEMORY.md, full IDENTITY.md) in every feedback prompt. This wastes tokens and dilutes the instruction.
**Why it happens:** Jess has rich context files -- SOUL.md alone is 73 lines.
**How to avoid:** Extract only memoir-relevant therapeutic concepts into the preamble (5-8 sentences max). The gateway session already maintains conversation history, so context accumulates naturally across interactions within a project.
**Warning signs:** Jess feedback prompts exceed 2000 tokens before any chapter context is added.

### Pitfall 4: Breaking Writer/Researcher Backward Compatibility

**What goes wrong:** Changes to `buildPrompt`, `parseAlternatives`, or `FeedbackAlternative` break the existing Writer and Researcher flows.
**Why it happens:** Making changes that affect all agents instead of branching on `agentId`.
**How to avoid:** All Jess-specific logic should be gated by `if (agentId === 'jess')` checks. Use TypeScript discriminated unions or optional fields rather than replacing the existing data structures.
**Warning signs:** Writer alternatives stop parsing correctly, or Researcher fact-check display breaks.

### Pitfall 5: Jess Gateway Session Not Connecting

**What goes wrong:** Selecting Jess and sending feedback results in an error or empty response because the gateway cannot route to the Jess agent.
**Why it happens:** The Jess agent might not be properly configured in OpenClaw, or the session key pattern might not match.
**How to avoid:** Verify that `openclaw agent --agent jess --message "test" --json` works before writing any code. The session key `agent:jess:writing:{projectId}` follows the same pattern as `agent:writer:writing:{projectId}`.
**Warning signs:** Error state appears in FeedbackPopover when Jess is selected and a request is sent.

## Code Examples

### Example 1: Enhanced Jess Preamble

```typescript
// Source: Derived from ~/agent-jess/SOUL.md therapeutic concepts
const jessPreamble = [
  'You are Jess, a therapist and editorial guide who understands memoir as psychological integration, not just storytelling.',
  'You focus on: emotional impact on the reader, emotional cost to the writer, pacing of sensitive disclosure,',
  'boundary awareness (what to reveal vs. what to protect), tone calibration (honesty without trauma performance),',
  'and the relationship between how something is written and what it does psychologically for the person writing it.',
  'You are warm but direct. You name what you see clearly and precisely. You do not use therapy cliches or empty validation.',
  'When you suggest alternatives, explain WHY each version handles the emotional dimension differently.',
].join(' ');
```

### Example 2: Jess-Specific Response Format in Prompt

```typescript
// In buildPrompt(), when agentId === 'jess':
const jessResponseFormat = [
  '## Response Format',
  'Provide exactly 3 alternative versions of the highlighted text.',
  'For each alternative, include a brief explanation of the emotional dimension.',
  'Format each alternative as:',
  '',
  '### Alternative 1',
  '[rewritten text]',
  '',
  '**Why:** [1-2 sentences explaining the emotional impact, boundary consideration, or tone shift this version achieves]',
  '',
  '### Alternative 2',
  '[rewritten text]',
  '',
  '**Why:** [1-2 sentences]',
  '',
  '### Alternative 3',
  '[rewritten text]',
  '',
  '**Why:** [1-2 sentences]',
].join('\n');
```

### Example 3: Enhanced parseAlternatives for Jess Commentary

```typescript
interface FeedbackAlternative {
  text: string;
  commentary?: string;  // Only present for Jess
}

function parseAlternativesWithCommentary(response: string): FeedbackAlternative[] {
  const parts = response.split(/###\s*Alternative\s*\d+\s*/i);
  return parts.slice(1).map(p => {
    const whyMatch = p.match(/\*\*Why:\*\*\s*([\s\S]*?)$/i);
    if (whyMatch) {
      const text = p.slice(0, whyMatch.index).trim();
      const commentary = whyMatch[1].trim();
      return { text, commentary };
    }
    return { text: p.trim() };
  }).filter(a => a.text).slice(0, 3);
}
```

### Example 4: FeedbackAlternative With Commentary

```typescript
// In FeedbackAlternative.tsx, add optional commentary prop:
interface FeedbackAlternativeProps {
  index: number;
  text: string;
  commentary?: string;  // Jess emotional commentary
  onAccept: (text: string) => void;
}

// Render commentary below the alternative text when present:
{commentary && (
  <p className="text-xs text-indigo-400/80 mt-1 italic">{commentary}</p>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Identical prompt for all agents (pre-Phase 6) | Agent-specific preamble (Phase 6) | 2026-02-12 | Minimal differentiation via single-line preamble |
| N/A | Agent-specific response format + commentary (this phase) | Phase 10 | Full Jess differentiation with emotional dimension |

**Current state:**
- Jess is listed in AgentPicker with Heart icon and "Emotional guidance" description
- Jess has a one-line preamble in `buildPrompt()`: "compassionate editorial guide focused on emotional impact, sensitivity, and memoir-specific tone"
- Jess uses the same response format as Writer (3 plain alternatives)
- Jess has a fully configured OpenClaw agent with auth profiles and model access
- Jess has rich SOUL.md (73 lines) and IDENTITY.md (108 lines) with detailed therapeutic approach
- Jess has MEMORY.md with active therapeutic threads for Kevin

## Open Questions

1. **Should Jess have a dedicated action button like Researcher's "Fact Check"?**
   - What we know: Researcher has `handleFactCheck` with a dedicated prompt (`buildFactCheckPrompt`). Jess could have a similar dedicated action, e.g., "Boundary Check" or "Emotional Read" that provides non-rewrite feedback.
   - What's unclear: Whether this is in scope for Phase 10 or would be a separate enhancement.
   - Recommendation: Out of scope for initial Phase 10. The core requirement (AGENT-03) is that Jess provides emotionally attuned feedback specific to memoir writing. Alternatives with commentary achieves this. A dedicated Jess action button could be a follow-up.

2. **Should Jess's commentary affect the "accept" behavior?**
   - What we know: When accepting an alternative, only the rewrite text replaces the selection. Commentary is informational.
   - What's unclear: Whether commentary should be logged but not inserted (current plan), or whether commentary should be preserved somewhere (e.g., as a margin note or in the feedback JSONL).
   - Recommendation: Log commentary in the JSONL entry (it's already captured as part of the response) but do not insert it into the editor. Commentary is for the writer's awareness, not for the manuscript.

3. **Should Jess's prompt include therapeutic context from MEMORY.md?**
   - What we know: MEMORY.md has active therapeutic threads (sustainability, centralization, memoir, sleep, permanence, pattern interruption). These would make Jess's feedback deeply contextual.
   - What's unclear: Whether including this in every feedback prompt is token-efficient, and whether it's appropriate to mix therapeutic context into a writing feedback flow.
   - Recommendation: Do not include MEMORY.md in the prompt for Phase 10. The gateway session already accumulates context across interactions. If Jess needs deeper context, it can be added as a follow-up. Keep the prompt lean: preamble + selected text + instructions + chapter context.

4. **Placeholder text for Jess input**
   - What we know: Current placeholder is "How should this be rewritten?" for all agents.
   - What's unclear: Whether Jess should have a different placeholder, e.g., "What emotional guidance do you need?"
   - Recommendation: Change placeholder to agent-specific text. Jess: "How should this feel?" or "What guidance do you need?" Writer: keep current. Researcher: "What should be checked?" This is a small but meaningful UX signal.

## Sources

### Primary (HIGH confidence)

- **Codebase inspection** - Direct reading of all relevant source files:
  - `/Users/worker/froggo-dashboard/src/components/writing/FeedbackPopover.tsx` (434 lines) - Complete feedback system with buildPrompt, parseAlternatives, handleSend, handleFactCheck, handleAccept, handleDismiss
  - `/Users/worker/froggo-dashboard/src/components/writing/AgentPicker.tsx` (38 lines) - Agent selection with writer/researcher/jess
  - `/Users/worker/froggo-dashboard/src/store/feedbackStore.ts` (47 lines) - Zustand store with selectedAgent typed for jess
  - `/Users/worker/froggo-dashboard/src/lib/gateway.ts` (850 lines) - Gateway client with sendChatWithCallbacks
  - `/Users/worker/froggo-dashboard/src/components/writing/FeedbackAlternative.tsx` (27 lines) - Alternative card with accept button
  - `/Users/worker/froggo-dashboard/src/components/writing/ChapterEditor.tsx` (155 lines) - BubbleMenu integration
  - `/Users/worker/froggo-dashboard/src/store/memoryStore.ts` (224 lines) - Memory context (characters, timeline, facts)
  - `/Users/worker/froggo-dashboard/src/store/writingStore.ts` - Writing state management
  - `/Users/worker/froggo-dashboard/src/utils/agentThemes.ts` (124 lines) - Jess theme already configured (indigo)
  - `/Users/worker/froggo-dashboard/src/config/agent-voices.ts` (99 lines) - Jess voice profile already configured

- **Jess agent files:**
  - `/Users/worker/agent-jess/SOUL.md` (73 lines) - Therapeutic identity, modalities, session architecture
  - `/Users/worker/agent-jess/IDENTITY.md` (108 lines) - Clinical profile, personality, boundaries
  - `/Users/worker/agent-jess/MEMORY.md` (92 lines) - Active therapeutic threads, clinical notes, working patterns

- **OpenClaw agent config:**
  - `/Users/worker/.openclaw/agents/jess/agent/models.json` - Configured with anthropic/claude-sonnet-4-5
  - `/Users/worker/.openclaw/agents/jess/agent/auth-profiles.json` - Anthropic + Google auth configured

- **Phase 6 verification:**
  - `/Users/worker/froggo-dashboard/.planning/phases/06-inline-feedback/06-VERIFICATION.md` (277 lines) - Confirms all infrastructure is built and verified

### Secondary (MEDIUM confidence)

- None needed - all findings are from direct codebase inspection

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries, all existing code inspected directly
- Architecture: HIGH - Clear pattern from Phase 6 (agent-specific preamble) and Researcher precedent (agent-specific prompt builder)
- Pitfalls: HIGH - Identified from direct code reading (parseAlternatives regex, backward compatibility concerns, token budget)

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (stable -- no external dependencies, all internal code)
