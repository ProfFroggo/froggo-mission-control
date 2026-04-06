// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Global TTS — unified Gemini Chirp 3 text-to-speech for all components.
// Replaces all Web Speech API speechSynthesis usage with server-proxied Gemini TTS.

import { geminiTts } from './geminiTts';
import { getGeminiVoiceForAgent } from './geminiLiveService';

/** Currently active AbortController — allows cancelling in-flight speech */
let activeController: AbortController | null = null;

export interface SpeakOptions {
  /** Playback volume 0.0–1.0 (default 1.0) */
  volume?: number;
  /** Audio output device ID (for setSinkId) */
  sinkId?: string;
  /** AbortSignal — caller-provided cancellation (merged with internal) */
  signal?: AbortSignal;
}

/**
 * Speak text using Gemini Chirp 3 TTS via server proxy.
 * Automatically maps agentId to the correct Chirp 3 voice.
 * Falls back gracefully — never rejects.
 *
 * @param text    Text to speak
 * @param agentId Agent ID for voice selection (default: 'main' → Puck)
 * @param options Volume, sinkId, signal
 */
export async function speak(
  text: string,
  agentId = 'main',
  options: SpeakOptions = {},
): Promise<void> {
  if (!text.trim()) return;

  // Cancel any currently playing speech
  stopSpeaking();

  const controller = new AbortController();
  activeController = controller;

  // If caller provided a signal, abort ours when theirs fires
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
      activeController = null;
      return;
    }
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const voiceName = getGeminiVoiceForAgent(agentId);

  try {
    await geminiTts(
      text,
      voiceName,
      options.volume ?? 1.0,
      options.sinkId,
      controller.signal,
    );
  } catch (err) {
    console.warn('[globalTts] Non-critical:', err);
    // Swallow — geminiTts already resolves on error, but guard edge cases
  } finally {
    if (activeController === controller) {
      activeController = null;
    }
  }
}

/**
 * Stop any currently playing Gemini TTS audio.
 * Also cancels any legacy Web Speech API speech as a safety net.
 */
export function stopSpeaking(): void {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
  // Safety net: cancel any lingering Web Speech API speech from legacy code paths
  try { window.speechSynthesis?.cancel(); } catch (err) { console.warn('[globalTts] Non-critical: Web Speech API cancel failed (SSR or unsupported):', err); }
}
