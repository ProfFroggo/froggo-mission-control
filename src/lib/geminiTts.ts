// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Gemini TTS — REST-based text-to-speech using Chirp 3 voices.
// Uses generateContent with responseModalities:AUDIO instead of Gemini Live WebSocket.

/** Parse sample rate and bit depth from a Gemini audio MIME type string.
 *  e.g. "audio/L16;rate=24000" → { sampleRate: 24000, bitsPerSample: 16 }
 */
function parseAudioMime(mimeType: string): { sampleRate: number; bitsPerSample: number } {
  let sampleRate = 24000;
  let bitsPerSample = 16;
  const parts = mimeType.split(';');
  for (const part of parts) {
    const p = part.trim();
    if (p.toLowerCase().startsWith('rate=')) {
      const n = parseInt(p.split('=')[1], 10);
      if (!isNaN(n)) sampleRate = n;
    } else if (/^audio\/L\d+$/i.test(p)) {
      const n = parseInt(p.split('L')[1], 10);
      if (!isNaN(n)) bitsPerSample = n;
    }
  }
  return { sampleRate, bitsPerSample };
}

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

  // Parse sample rate and bit depth from MIME type (e.g. "audio/L16;rate=24000")
  const { sampleRate, bitsPerSample } = parseAudioMime(part.mimeType ?? '');

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

  let ctx: AudioContext;
  try {
    ctx = new AudioContext({ sampleRate });
    if (sinkId && typeof (ctx as any).setSinkId === 'function') {
      await (ctx as any).setSinkId(sinkId).catch(() => {});
    }
  } catch {
    return;
  }

  // Decode raw PCM — signed little-endian, mono
  const divisor = Math.pow(2, bitsPerSample - 1);
  const pcm = bitsPerSample === 16
    ? new Int16Array(bytes.buffer)
    : new Int8Array(bytes.buffer);
  const audioBuffer = ctx.createBuffer(1, pcm.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) {
    channelData[i] = pcm[i] / divisor;
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
