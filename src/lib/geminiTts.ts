// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Gemini TTS — text-to-speech using Chirp 3 voices via server-side proxy.
// Calls /api/gemini/tts to keep the API key on the server (F-02 fix).

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

/**
 * Speak text via Gemini TTS using a named Chirp 3 voice.
 * Calls the server-side /api/gemini/tts proxy — API key never leaves the server.
 * Falls back gracefully — resolves (never rejects) so callers don't crash.
 *
 * @param text      Text to speak
 * @param voiceName Chirp 3 voice name (e.g. 'Puck', 'Zephyr', 'Kore')
 * @param volume    0.0 – 1.0 playback gain (default 1.0)
 * @param sinkId    Optional audio output device ID (setSinkId)
 * @param signal    Optional AbortSignal — aborts fetch and stops playback
 */
export async function geminiTts(
  text: string,
  voiceName: string,
  volume = 1.0,
  sinkId?: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!text.trim()) return;

  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { authHeaders } = await import('./api');
    headers = { ...headers, ...authHeaders() };
  } catch (err) {
    console.warn('[geminiTts] Non-critical: auth module unavailable:', err);
  }

  let response: Response;
  try {
    response = await fetch('/api/gemini/tts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, voiceName }),
      signal,
    });
  } catch (err) {
    console.warn('[geminiTts] Non-critical:', err);
    // Fetch failed or aborted — resolve silently
    return;
  }

  if (!response.ok) return; // HTTP error — resolve silently

  let data: any;
  try {
    data = await response.json();
  } catch (err) {
    console.warn('[geminiTts] Non-critical:', err);
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
  } catch (err) {
    console.warn('[geminiTts] Non-critical:', err);
    return;
  }

  if (signal?.aborted) return;

  let ctx: AudioContext;
  try {
    ctx = new AudioContext({ sampleRate });
    if (sinkId && typeof (ctx as any).setSinkId === 'function') {
      await (ctx as any).setSinkId(sinkId).catch(err => console.warn('[geminiTts] Non-critical:', err));
    }
  } catch (err) {
    console.warn('[geminiTts] Non-critical:', err);
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
    if (signal?.aborted) { ctx.close().catch(err => console.warn('[geminiTts] Non-critical:', err)); resolve(); return; }

    const gainNode = ctx.createGain();
    gainNode.gain.value = Math.min(1, Math.max(0, volume));
    gainNode.connect(ctx.destination);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);

    const onAbort = () => {
      try { source.stop(); } catch (err) { console.warn('[geminiTts] Non-critical: audio source already stopped:', err); }
      ctx.close().catch(err => console.warn('[geminiTts] Non-critical: AudioContext close failed:', err));
      resolve();
    };

    signal?.addEventListener('abort', onAbort, { once: true });

    source.onended = () => {
      signal?.removeEventListener('abort', onAbort);
      ctx.close().catch(err => console.warn('[geminiTts] Non-critical: AudioContext close failed:', err));
      resolve();
    };

    source.start();
  });
}
