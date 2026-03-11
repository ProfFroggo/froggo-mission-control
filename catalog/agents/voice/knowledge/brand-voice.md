# Voice Agent — Brand Voice Guide

Domain reference for brand personality, tone by channel and context, vocabulary guide, and copy transformation examples. Read this before producing or reviewing any user-facing copy.

---

## 1. Brand Personality Pillars

The brand voice is built on four stable pillars. These do not change between channels or contexts — only the expression of them does.

### Pillar 1: Genuinely Knowledgeable
We know this space deeply — not because we learned the vocabulary, but because we built something in it. The knowledge shows up as precision and specificity, not as name-dropping or credential-flashing. We explain things simply when that is what the audience needs, and in technical depth when they can absorb it.

How this sounds: specific over vague, accurate over approximate. "5-of-9 multisig" not "bank-grade security." "Non-custodial" not "you own your keys... you own your crypto!" (the latter is a marketing phrase; the former is how people in the community actually talk).

How this fails: buzzword stacking. "Leveraging cutting-edge blockchain technology to empower next-generation financial sovereignty" — no one in the community would say this, and they know when they are being marketed to.

---

### Pillar 2: Straightforwardly Honest
We say what is true. We do not oversell. We acknowledge trade-offs when they exist. The community has extremely high bullshit detection — one overstatement in a launch announcement can undermine months of credibility.

How this sounds: claim + evidence or qualifier. "Fast: median settlement under 3 seconds on Solana" not "lightning fast." "Supports most major wallets — check compatibility before connecting" not "works with all wallets."

How this fails: aspirational claims stated as current facts. "The most secure wallet in DeFi" — says who? "Zero fees forever" — under what conditions? Overstatements that the community can and will fact-check.

---

### Pillar 3: Peer-Level Respect
We write to our users as equals who are capable of understanding, not as marks to be convinced or novices to be hand-held. We do not condescend ("even your grandma can use this!"). We do not manipulate ("this opportunity won't last"). We trust the reader to make their own decisions when given accurate information.

How this sounds: explanatory without being patronizing. Assumes some familiarity. Does not over-explain community-native concepts to community-native audiences. Does explain them when the audience is genuinely new.

How this fails: "even non-technical users can..." — this is condescending. Or the reverse: dense technical copy for a general-audience email where the reader did not opt in to a technical deep-dive.

---

### Pillar 4: Direct and Efficient
We respect the reader's time. Every sentence earns its place. We lead with the point, then support it — not the other way around. Short over long when both would work. Active over passive always.

How this sounds: frontloaded, concrete, no padding. "We shipped transaction batching. Gas costs down ~40%." not "We are excited to announce that we have been working on a new feature that we believe will have a meaningful positive impact on your experience with our platform in terms of gas costs."

How this fails: preamble before the point. "Excited to share..." "We're thrilled to announce..." "Today marks an exciting new chapter..." — delete everything before the actual news.

---

## 2. Tone by Channel and Context

Personality is constant. Tone varies. Here is how each major channel sounds.

### X / Twitter
**Register**: Peer-level, direct, confident
**Sentence style**: Short. One idea per tweet in a thread. First clause carries the whole message — if someone reads only the first line, they should get the point.
**Length**: One tweet (280 chars) for announcements and reactions. 3-6 tweet threads for explanations. Threads should be skimmable — each tweet stands alone.
**What to avoid**: Marketing speak, hashtag abuse (#web3 #DeFi #crypto on every post is noise), hollow enthusiasm, passive voice

**Announcement format**:
```
[The thing that happened/is shipping], in one clause.

What it means for you: [1-2 specific benefits]

[CTA if applicable — one link, not three]
```

**Example**: "Transaction batching is live. Gas costs down ~40% on most swaps. Details in the thread."
**Not this**: "We're beyond excited to announce the launch of our revolutionary new transaction batching feature, which we believe will transform the way you experience gas costs on our platform!"

---

### Discord
**Register**: Community-native, conversational, warm but not sycophantic
**Sentence style**: Casual, can use fragments. Less formal than other channels. Match the energy of the channel — support channels are more calm and precise, general/announcements are warmer.
**Length**: Short. Discord is conversation. Long walls of text in Discord are a different medium — use them only for announcements in #announcements channels.
**What to avoid**: PR-speak, over-formal language, copy-pasted marketing messages, excessive emojis in official communications

**Support response format**:
```
[Acknowledge the specific problem they described]
[Explain what is happening]
[Specific next step they can take]
[Offer for follow-up if needed]
```

**Announcement format** (in #announcements):
```
[What shipped / what happened]
[1-3 bullets of what this means for users]
[Link for more]
[Where to ask questions: tag #support]
```

**Community chat format**:
Match the conversation. Short, direct, address their specific point. No need to formally introduce yourself in every message.

---

### Email / Newsletter
**Register**: Direct, informative, clear hierarchy
**Sentence style**: Structured paragraphs. Scannable — headers and short paragraphs over walls of text.
**Length**: Subject line is under 50 characters. Body is as long as it needs to be, but cut aggressively — every paragraph should earn its inclusion.
**What to avoid**: Clickbait subject lines that do not deliver on the promise, buried leads (the key information is in paragraph 4), walls of text without visual hierarchy

**Subject line formula**: What changed + why it matters for the reader. "Transaction batching is live — your gas costs just dropped" not "Exciting product update!"

**Email structure**:
```
Subject: [What happened] — [why it matters to reader]

[Lead paragraph: one sentence stating what happened]

[2-3 short paragraphs or bullets expanding on the most important points]

[CTA: one action, stated clearly]

[Footer: standard links, unsubscribe]
```

---

### Product UI copy
**Register**: Precise, minimal, direct
**Sentence style**: Imperative for actions ("Connect wallet"), declarative for states ("No transactions yet"), explanatory for errors.
**Length**: As short as possible. UI copy is not a place for personality — it is functional.
**What to avoid**: Vague error messages, generic placeholder text left in ("Coming soon"), cute labels that sacrifice clarity ("Let's get you set up!")

**Button labels**: Always a verb. "Connect" not "Connection." "Confirm swap" not "Yes." "Try again" not "OK."

**Error messages**: What happened + what to do next. "Swap failed — your balance is too low to cover gas fees. Add funds and try again." not "An error occurred."

**Empty states**: What the screen is for + how to get started. "No transactions yet — your confirmed swaps will appear here." not just "No transactions."

**Onboarding copy**: Direct, assumes some context, explains what the user needs to do. No infantilizing. No over-reassurance ("Don't worry, this is safe!").

---

### Press releases / formal announcements
**Register**: Third-person, factual, structured
**Sentence style**: Formal but not stuffy. The lead paragraph answers who/what/when/where/why.
**Length**: 400-600 words standard. No fluff — every word is there because it informs.
**What to avoid**: Self-congratulatory language without substance, adjective inflation ("groundbreaking," "revolutionary," "pioneering"), vague quotes attributed to the CEO that no human would actually say

**Press release format**:
```
FOR IMMEDIATE RELEASE

[HEADLINE: Announces/Launches/Reports [thing] — [impact or significance]]

[City, Date] — [Company] today [announced/launched/released] [what], [one-sentence context for why this matters].

[Lead paragraph: the news, the context, who it affects]

[Second paragraph: detail — how it works, key specifications, availability]

[Third paragraph: quote from relevant spokesperson — should sound like a human said it]

[Fourth paragraph: broader context — market, background, company positioning]

About [Company]: [2-3 sentence boilerplate]

Media contact: [contact info]
```

---

### Long-form content (blog, docs, explanations)
**Register**: Informative, depth-appropriate for audience, structured
**Length**: As long as the topic requires — but every section should earn its place. A section that does not add new information should be cut.
**Structure**: Clear headlines, scannable structure. Readers should be able to read headers only and understand the shape of the content.
**Tone calibration**: Match depth to the declared audience. Technical tutorials for developers can use precise technical language. Explainers for general audiences should assume no prior knowledge.

---

## 3. Vocabulary Guide

### Words we use

**For self-custody and ownership**: "non-custodial," "self-custody," "your keys," "on-chain balance," "held in your wallet"
**For transactions**: "swap," "transfer," "bridge," "sign," "confirm," "broadcast"
**For security**: "multisig," "threshold signatures," "seed phrase," "hardware wallet," "air-gapped"
**For community**: "builders," "users," "the community," "contributors" — avoid "holders" as the primary identity; people are users first
**For performance**: specific numbers over adjectives. "~40% reduction in gas costs" not "dramatically reduced fees"
**For product**: "live," "shipped," "available," "in beta" — not "launched" for every release. Not everything is a launch.
**For problems**: "issue," "bug," "limitation" — honest language. Not "minor inconvenience."

---

### Words we do not use

**Generic crypto marketing language** (these are red flags that copy sounds like every other project):
- "revolutionizing finance"
- "disrupting the [X] industry"
- "next-generation"
- "the future of [X]"
- "WAGMI" / "NGMI" / "LFG" in official communications
- "moon," "to the moon," "rocket" as serious statements
- "alpha" as a noun for insider information in marketing copy

**Vague security claims** (cannot be verified, will be fact-checked):
- "bank-grade security"
- "military-grade encryption"
- "unhackable"
- "completely safe"
- "the most secure"

**Hollow enthusiasm** (high adjective-to-substance ratio):
- "We're incredibly excited to announce..."
- "Thrilled to share..."
- "Proud to introduce the world to..."
- "Game-changing," "groundbreaking," "revolutionary," "pioneering"

**Condescending simplifications**:
- "Even non-technical users..."
- "Your grandma can use this"
- "No coding required!"
- "It's that simple!"

**Passive voice markers** (usually hiding agency or hedging):
- "It has been brought to our attention..."
- "Mistakes were made..."
- "Users have been experiencing..."
Active voice is almost always clearer: "We heard about [issue]..." "We made an error in..." "Some users experienced..."

---

## 4. Authenticity Test

Before finalizing any piece of copy, apply the authenticity test:

**The question**: Would a real person who genuinely believed in this product say this, this way?

**Applying it**: Imagine someone who has been working on this project for a year — someone who cares about it, understands it well, and is talking to a peer who would immediately call out BS. Would they use this phrasing? Or would they say it differently?

**Common authenticity failures**:
- "Leveraging cutting-edge blockchain technology" → No one actually talks like this
- "Our community-driven approach" → Every project says this; it means nothing without specifics
- "We're more than just a wallet" → What are you, then? This only passes the authenticity test if followed by a specific answer
- "The most secure solution in DeFi" → A real person with knowledge of the space would never say this without immediately qualifying it

**How to fix**: Replace the category-level claim with a specific fact. "Our open-source codebase has been audited by Trail of Bits and Halborn" passes the test. "The most secure wallet in DeFi" does not.

---

## 5. Copy Transformation Examples

These examples show the transformation from first draft to brand-aligned copy.

### Example 1: Product announcement

**Draft**: "We are thrilled to announce the launch of our revolutionary new batched transaction feature, which leverages advanced cryptography to dramatically reduce your gas fees and enhance your DeFi experience!"

**Transformation**: Remove lead-up preamble. Remove "thrilled," "revolutionary." Replace "dramatically reduce" with a number. Remove "leverage." Remove "enhance your DeFi experience."

**Revised**: "Transaction batching is live. Most swaps now cost ~40% less in gas fees."

---

### Example 2: Onboarding error message

**Draft**: "Oops! It seems like something went wrong. Please try again later!"

**Transformation**: Error messages need: what happened, why, what to do.

**Revised**: "Connection failed — your wallet isn't responding. Make sure it's unlocked and try again. If this keeps happening, check your network connection."

---

### Example 3: Discord announcement

**Draft**: "We are pleased to announce that effective immediately, users will now be able to access a brand new feature that allows for the convenient tracking of portfolio performance over time in a user-friendly dashboard format."

**Transformation**: Drastically shorter. Present tense. Lead with the thing, not the announcement of the thing.

**Revised**: "Portfolio tracking is live. See your balance history, PnL, and top positions in the new Portfolio tab."

---

### Example 4: Security copy (after an incident)

**Draft**: "We recently became aware of an issue that may have affected a small number of users. We take security very seriously and are working diligently to resolve any concerns."

**Transformation**: Passive voice removed. Vague "issue" replaced with specifics. "We take security seriously" is a meaningless statement (who would say they don't?).

**Revised**: "On [date], we identified a [specific type] bug that affected [X] accounts. No funds were at risk. We patched it within [timeframe]. Affected accounts were [specific action taken]. Here is the full incident report: [link]."

---

### Example 5: Tweet about a new integration

**Draft**: "We're excited to announce an exciting new partnership with @[Protocol] to bring an exciting new integration to our users that will provide exciting new opportunities!"

**Transformation**: Remove all instances of "exciting." Remove "partnership" unless it is genuinely a business partnership (vs. a technical integration). State the actual thing.

**Revised**: "@[Protocol] liquidity is now available directly in [product]. Swap [token] and [token] without leaving the app."

---

## 6. Voice Review Checklist

Use this when auditing copy for brand voice alignment:

- [ ] The copy leads with substance, not enthusiasm about the substance
- [ ] All claims are verifiable or appropriately qualified
- [ ] Vocabulary is accurate to the space — no community vocabulary used incorrectly
- [ ] Tone matches the channel's native register
- [ ] No hollow adjectives (revolutionary, groundbreaking, exciting) without specifics
- [ ] Passive voice used sparingly and intentionally, not by habit
- [ ] Error messages describe what happened and what to do next
- [ ] UI copy uses imperative verb labels for actions
- [ ] Authenticity test passed: a real person who believed in this would say it this way
- [ ] Length is appropriate for the channel — not padded, not truncated
