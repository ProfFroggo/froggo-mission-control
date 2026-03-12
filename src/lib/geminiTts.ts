// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Gemini TTS — REST-based text-to-speech using Chirp 3 voices.
// Uses generateContent with responseModalities:AUDIO instead of Gemini Live WebSocket.

const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const TTS_URL = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`;

/**
 * Speak text via Gemini TTS REST API using a named Chirp 3 voice.
 * Falls back gracefully — resolves (never rejects) so callers don't crash.
 *
 * @param text      Text to speak
 * @param voiceName Chirp 3 voice name (e.g. 'Puck', 'Zephyr', 'Kore')
 * @param apiKey    Gemini API key
 * @param volume    0.0 – 1.0 playback gain (default 1.0)
 * @param sinkId    Optional audio output device ID (setSinkId)
 * @param signal    Optional AbortSignal — aborts fetch and stops playback
 */
export async function geminiTts(
  text: string,
  voiceName: string,
  apiKey: string,
  volume = 1.0,
  sinkId?: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!text.trim() || !apiKey) return;

  let response: Response;
  try {
    response = await fetch(`${TTS_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      }),
      signal,
    });
  } catch {
    // Fetch failed or aborted — resolve silently
    return;
  }

  if (!response.ok) return; // HTTP error — resolve silently

  let data: any;
  try {
    data = await response.json();
  } catch {
    return;
  }

  const part = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!part?.data) return;

  // Decode base64 → bytes
  let bytes: Uint8Array;
  try {
    const binary = atob(part.data);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    return;
  }

  if (signal?.aborted) return;

  // Gemini TTS returns raw PCM: 16-bit signed little-endian, 24000 Hz, mono
  const sampleRate = 24000;
  let ctx: AudioContext;
  try {
    ctx = new AudioContext({ sampleRate });
    if (sinkId && typeof (ctx as any).setSinkId === 'function') {
      await (ctx as any).setSinkId(sinkId).catch(() => {});
    }
  } catch {
    return;
  }

  const pcm = new Int16Array(bytes.buffer);
  const audioBuffer = ctx.createBuffer(1, pcm.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) {
    channelData[i] = pcm[i] / 32768;
  }

  return new Promise((resolve) => {
    if (signal?.aborted) { ctx.close().catch(() => {}); resolve(); return; }

    const gainNode = ctx.createGain();
    gainNode.gain.value = Math.min(1, Math.max(0, volume));
    gainNode.connect(ctx.destination);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);

    const onAbort = () => {
      try { source.stop(); } catch { /* already stopped */ }
      ctx.close().catch(() => {});
      resolve();
    };

    signal?.addEventListener('abort', onAbort, { once: true });

    source.onended = () => {
      signal?.removeEventListener('abort', onAbort);
      ctx.close().catch(() => {});
      resolve();
    };

    source.start();
  });
}
