# Voice Guide — Reference Guide

Brand voice principles, writing for crypto/developer audiences, tone variations by content type, common terminology, and an editing checklist. This is the operational guide — specific enough that two writers applying it produce consistent output.

---

## 1. Brand Voice Principles

### Core Voice Characteristics

**Clear before clever.** Clarity is the primary obligation. A sentence that's technically impressive but confusing fails its purpose. A sentence that's simple but clear serves the reader. When forced to choose between an elegant turn of phrase and a clearer but plainer alternative, choose clear.

**Specific before general.** Vague claims signal that nobody thought hard about what they're saying. "Powerful automation" means nothing. "Runs 32 task types autonomously" means something. Specificity is proof. Generality is filler.

**Direct.** Say the thing. Don't warm up to it. "We built Froggo because AI agent management is painful" — not "In today's rapidly evolving landscape of artificial intelligence..." Get to the point in the first sentence.

**Honest about tradeoffs.** The crypto/developer audience has excellent BS detection. Overselling damages trust irreparably. Acknowledge limitations. Explain who the product is for and who it isn't for. This counterintuitively builds more trust than claiming it's perfect for everyone.

**Human, not corporate.** The brand voice should sound like a smart person who knows the domain, not a corporate communications department. Contractions are fine. First-person is fine. The occasional frank opinion is fine.

### What the Voice Is NOT

- Not hype-driven ("revolutionary," "game-changing," "disrupting")
- Not corporate ("we are pleased to announce," "leverage," "utilize," "ecosystem," "synergies")
- Not condescending (explaining things the audience knows; treating users as less technical than they are)
- Not falsely humble ("we're just a small team trying to...") — state things with appropriate confidence
- Not all-caps enthusiasm ("AMAZING NEW FEATURE!!!")
- Not passive voice as default ("the task was completed" vs. "the agent completed the task")

---

## 2. Writing for Crypto/Developer Audiences

### Audience Intelligence Profile

**Crypto/DeFi builders and technical users**:
- High technical literacy — can read code, understand architecture, don't need basic concepts explained
- Sophisticated BS detectors — have seen many projects overclaim and underdeliver
- Value transparency — appreciate knowing how something works, not just that it works
- Community-minded — trust comes from reputation within their networks, not from marketing materials
- Skeptical of marketing language — the word "decentralized" has been overused to meaninglessness; other crypto terms are following
- Self-directed learners — want reference material, not hand-holding

**Indie hackers and startup builders (non-crypto)**:
- Technically capable but breadth more than depth
- Value speed and autonomy — want to get things working fast
- Cost-conscious — LTV of a self-hosted tool user depends on solving a real pain
- Community-oriented (build-in-public, indie hacker forums, Hacker News)
- Respond well to "I built this because I had this problem" framing

### Vocabulary Decisions

**Crypto/DeFi terms — use correctly or don't use**:

| Term | Correct usage | Incorrect/overused |
|------|--------------|-------------------|
| Non-custodial | User holds private keys, no third-party custody | Calling any crypto feature "non-custodial" loosely |
| Smart contract | Self-executing code on a blockchain | Generic "automated agreement" |
| Gas fees | Transaction fees on EVM-compatible chains | "Service fees" (euphemism) |
| Decentralized | Genuinely distributed with no single point of control | Marketing synonym for "crypto" |
| Self-custody | User controls their own private keys | Synonym for "secure" |
| DeFi | Financial services built on public blockchains without centralized intermediaries | Any fintech with "blockchain features" |
| Mint / burn | Creating / destroying tokens | Generic "create / delete" in non-token contexts |
| Bridge | Moving assets between different blockchains | Metaphorical usage |
| Liquidity | Availability of assets for trading in a pool | Generic synonym for "money" |
| Yield | Returns from providing liquidity, staking, etc. | Any kind of gain |

**AI/agent terms — use precisely**:

| Term | What it means | When to use |
|------|--------------|-------------|
| Agent | An AI system that perceives, decides, and acts autonomously | When the system takes actions without step-by-step instruction |
| Autonomous | Acting independently based on goals, not instructions | When the user doesn't need to be present for the system to work |
| Orchestration | Coordinating multiple agents or systems toward a goal | When describing the platform's coordination function |
| Tool use | Agent's ability to call external APIs, read files, run code | When describing agent capabilities precisely |
| Context window | The information an LLM can consider at once | When explaining why long tasks require different architecture |
| Prompt | Instruction given to an LLM | Fine to use; avoid conflating with "agent instructions" |

### Explaining Complex Concepts

**The layered explanation**:
1. Plain-language definition first (10 words or fewer): "A non-custodial wallet means you hold your own keys."
2. Why it matters: "If we get hacked, your funds aren't affected."
3. Technical detail for those who want it: "We never store your private key — it's generated and encrypted on your device."

This structure serves all readers. Technical readers skip the first layer; new users don't get lost in the third.

**The analogy trap**: Analogies help with unfamiliar concepts. The trap: using analogies that are imprecise enough to mislead. "It's like a bank account but..." is dangerous in DeFi writing because banks provide guarantees DeFi doesn't. Test analogies against edge cases before using them.

**Assume competence at the right level**: For developer documentation, assume the reader can read code but may not know our specific API. For user-facing copy, assume the reader understands the product category but may not know our specific implementation. For general-audience content, assume interest but not domain expertise.

---

## 3. Tone Variations by Content Type

Brand voice is consistent. Tone adjusts to context. The underlying personality (direct, honest, specific, human) doesn't change — the register does.

### Technical Documentation

**Tone**: Authoritative, precise, procedural. No flourish.
**Sentence length**: Short to medium. One instruction per sentence in procedural content.
**Voice**: Second person ("you") or imperative ("Run the following command").
**Examples**: Always include working examples. Code blocks for code. No pseudo-code that doesn't run.
**Caveats**: Include relevant warnings and edge cases. Not every possible caveat — only ones that would affect a real user.

**Example (bad)**: "The user should then proceed to configure the environment variables as required by the platform."
**Example (good)**: "Set the required environment variables before starting the server: `OPENAI_API_KEY`, `DATABASE_URL`, `PORT`."

### Marketing Copy (Website, Landing Pages)

**Tone**: Confident, benefit-forward, specific. Slightly warmer than docs.
**Sentence length**: Short. Punchy subheads. Scannable.
**Voice**: Second person ("your agents," "you can") or direct statement ("Froggo runs your...")
**Structure**: Lead with the outcome, not the feature. "Run 32 types of tasks without writing orchestration code" beats "Froggo Mission Control includes 32 built-in task types."
**Social proof**: Include specific numbers where possible. "Trusted by 1,200 builders" beats "trusted by thousands."

**Example (bad)**: "Our cutting-edge AI agent orchestration platform provides a comprehensive solution for autonomous task management."
**Example (good)**: "Your AI agents run tasks while you build. No orchestration code. No babysitting prompts."

### Blog Posts / Long-Form Editorial

**Tone**: Thoughtful, analytical, occasionally opinionated. Teaches without condescending.
**Sentence length**: Varied — short for emphasis, medium for explanation, long only when the complexity warrants it.
**Voice**: First person ("we") for company perspective; second person ("you") for reader-facing instruction; third person for analysis.
**Lead**: The most important point goes in the first paragraph. Not after two paragraphs of scene-setting.
**Structure**: Problem → insight → evidence → implication. Not background → background → maybe a point.

**Lede test**: If the first paragraph were cut, would the reader have lost anything essential? If yes, restructure so the essential comes first.

### Product Announcements

**Tone**: Direct, specific about what's new and why it matters. Not a PR release.
**Structure**:
  1. What changed (specific, not vague)
  2. Why it matters to the user (their benefit, not our achievement)
  3. How to use it / where to find it
  4. What's next (optional)

**Example (bad)**: "We're excited to announce the launch of our new advanced task scheduling feature, which represents a major milestone in our mission to revolutionize AI agent management."
**Example (good)**: "Task scheduling is live. Set agents to run on a schedule — daily, weekly, on a trigger — without writing cron jobs or monitoring manually."

### Release Notes / Changelog

**Tone**: Factual, brief, user-impact-first. Not a git commit log.
**Format**: Start with what changed, follow with why it matters if not obvious.
**Scope**: Write from the user's perspective. Engineering jargon is fine if the audience uses it. Generic jargon is not.

**Example (bad)**: "Fixed a race condition in the task queue processor that caused intermittent failures."
**Example (good)**: "Fixed: Tasks occasionally got stuck in 'running' without completing. If you saw tasks that never finished, this was the cause — they'll now complete reliably."

### Email Copy

**Tone**: Personal, direct. Written as if from a person, not a brand.
**From line**: A person's name where possible ("Kevin from Froggo"), not "Froggo Mission Control Team"
**Subject line**: Specific > clever. "New: task scheduling is live" beats "You asked for it — and we delivered"
**Body**: Short. One main point. One CTA. If you're writing more than 200 words, reconsider whether email is the right format.

### Error Messages / In-App Copy

**Tone**: Helpful, non-blaming, action-oriented. Not apologetic to the point of uselessness.
**Structure**: What happened + why (briefly) + what to do.
**Example (bad)**: "An error occurred. Please try again or contact support."
**Example (good)**: "This agent couldn't complete the task because the API key has expired. Update your API key in Settings to continue."

---

## 4. Common Crypto/DeFi/AI Terminology Reference

### Terms to use naturally (audience knows them)
`wallet`, `transaction`, `blockchain`, `token`, `smart contract`, `gas`, `ETH/BTC/SOL` (specific chain tokens), `NFT` (when relevant), `DeFi`, `protocol`, `dApp`, `agent`, `LLM`, `API`, `SDK`, `open source`, `self-hosted`

### Terms to explain on first use
`non-custodial`, `private key`, `seed phrase`, `EVM`, `layer 2`, `liquidity pool`, `staking`, `yield farming`, `governance token`, `multi-sig`, `autonomous agent`, `tool use`, `orchestration`, `context window`

### Terms to avoid (overused / meaningless)
`revolutionary`, `game-changing`, `disrupting`, `ecosystem` (when used vaguely), `synergy`, `leverage` (as a verb), `utilize` (use "use"), `seamless`, `robust` (without specifics), `world-class`, `next-generation`, `cutting-edge`, `innovative`

---

## 5. Editing Checklist

Run every piece of content through this checklist before marking it done.

### Structure
- [ ] Does the piece lead with the most important point?
- [ ] Is every section in the right order (does section 3 require knowledge from section 4)?
- [ ] Are headers and subheads descriptive (tell you what the section says, not just "Introduction")?
- [ ] Does the conclusion add something, or just repeat what was already said?

### Clarity
- [ ] Is every technical term either already familiar to the audience or explained on first use?
- [ ] Is every sentence doing one job?
- [ ] Can any sentence be split into two without losing meaning?
- [ ] Is there any sentence where you're not sure what it means? (If you're not sure, the reader isn't either)

### Voice
- [ ] Does this sound like the brand, or does it sound generic?
- [ ] Is it in active voice? (Flag and review every passive construction)
- [ ] Are any of the banned phrases present? (leverage, seamless, robust, revolutionary, etc.)
- [ ] Does the tone match the content type (docs vs. marketing copy vs. blog)?

### Audience
- [ ] Is this written for a specific reader, or for "everyone"?
- [ ] Does the content assume the right level of expertise for the audience?
- [ ] Is every piece of information included because the reader needs it?
- [ ] Is there anything included that's there to impress or cover all bases, rather than to serve the reader?

### Specificity
- [ ] Is every claim backed by something specific (number, example, evidence)?
- [ ] Is every benefit stated in terms of what the reader gets, not what the product does?
- [ ] Are examples concrete and real, not abstract ("for example, if you want to do a thing...")?

### Editing
- [ ] Has it been read out loud? (Awkward phrasing shows up in reading; it's invisible in silent scanning)
- [ ] Has every paragraph been reviewed for whether the piece is stronger without it?
- [ ] Is the word count appropriate for the topic and format? (No padding; no artificial brevity that leaves gaps)
- [ ] Are all links working and pointing to the right destination?

### Approval
- [ ] Is this saved with `_draft` suffix until approval is confirmed?
- [ ] Has the approval request been submitted via `mcp__mission-control_db__approval_create`?
