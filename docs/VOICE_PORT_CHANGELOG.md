# Multi-Agent Voice System — Ox → Froggo Port

**Date:** 2026-02-01  
**Source:** `~/clawd/ox-voice-reference/`  
**Target:** `~/clawd/clawd-dashboard/`

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/multiAgentVoice.ts` | Core voice system + Gemini transcription service |
| `src/components/MultiAgentVoicePanel.tsx` | Main voice UI panel (6 agents) |
| `src/components/MeetingTranscriptionPanel.tsx` | Audio upload → Gemini transcription + summarization |
| `src/services/voiceLogService.ts` | Voice action logging to froggo.db |
| `voice-schema.sql` | Database schema with migration notes |

## Changes from Ox

### 1. Froggo as 6th Agent
- Added `'froggo'` to `AgentType` union
- Config: voice `Puck`, pitch 1.0, rate 1.0
- System instruction: orchestrator role, delegates to specialists
- Default agent on connect (was `coder` in Ox)
- Icon: `Smile` (lucide), color: `text-emerald-400`

### 2. Gemini AI Transcription (NOT OpenAI Whisper)
- `GeminiTranscriptionService` class in `multiAgentVoice.ts`
- Uses `gemini-2.5-flash` multimodal for audio → text
- Meeting summarization with structured JSON output (summary, action items, decisions, participants)
- Dedicated `MeetingTranscriptionPanel` component for file upload workflow

### 3. Adapted Imports & Paths
- `import { useStore } from '../store/store'` (Froggo Dashboard structure)
- `import MarkdownMessage from './MarkdownMessage'` (existing component)
- `logVoiceAction` moved to `src/services/voiceLogService.ts` (new, API-based)
- localStorage keys changed: `ox-multiagent-*` → `froggo-multiagent-*`

### 4. Database Schema
- Applied to `~/clawd/data/froggo.db`
- Agent CHECK constraints include `'froggo'`
- New `meeting_transcriptions` table for Gemini transcriptions
- New action types: `transcription_start`, `transcription_complete`, `meeting_summarize`
- Migration notes included in SQL comments

### 5. UI Theming
- Green accent → Emerald (Froggo branding 🐸)
- Header shows frog emoji
- Connect button shows target agent name

## Dependencies Added
- `@google/genai` — Google Generative AI SDK (Live API + content generation)

## What's Preserved from Ox
- Full Google Live API integration (bidirectional audio streaming)
- Agent switching with shared context injection
- Screen share + webcam frame capture at 1fps
- PCM audio encoding/decoding pipeline
- All 5 original agents (Coder, Writer, Researcher, HR, Chief) unchanged
- Analytics views and triggers in schema
