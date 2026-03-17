// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/meetings/diarize — Diarize transcript via Gemini (text or audio)
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';

async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch { /* ignore */ }
  return process.env.GEMINI_API_KEY ?? null;
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const apiKey = await getGeminiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 400 });
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    const rawTranscript = formData.get('rawTranscript') as string | null;

    // Determine input mode
    const hasAudio = audioFile && audioFile.size > 1000;
    const hasText = rawTranscript && rawTranscript.trim().length > 10;

    if (!hasAudio && !hasText) {
      return NextResponse.json({ error: 'Need audio or transcript text' }, { status: 400 });
    }

    const parts: Array<Record<string, unknown>> = [];

    if (hasAudio) {
      // Upload audio to Gemini File API first, then reference it
      const buffer = await audioFile!.arrayBuffer();

      // Step 1: Upload via File API
      const uploadRes = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': audioFile!.type || 'audio/webm',
            'X-Goog-Upload-Protocol': 'raw',
            'X-Goog-Upload-Command': 'upload, finalize',
          },
          body: buffer,
        }
      );

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        const fileUri = uploadData?.file?.uri;

        if (fileUri) {
          // Wait for file processing
          let fileReady = false;
          for (let i = 0; i < 10; i++) {
            const checkRes = await fetch(`${fileUri}?key=${apiKey}`);
            if (checkRes.ok) {
              const fileData = await checkRes.json();
              if (fileData.state === 'ACTIVE') { fileReady = true; break; }
            }
            await new Promise(r => setTimeout(r, 2000));
          }

          if (fileReady) {
            parts.push({ fileData: { mimeType: audioFile!.type || 'audio/webm', fileUri } });
          }
        }
      }
    }

    // Build prompt
    const prompt = parts.length > 0
      ? `Transcribe this meeting audio with speaker diarization.
Label each speaker consistently (Speaker 1, Speaker 2, etc.). If names are mentioned, use them.
Format: **Speaker 1 (Name):** What they said...
Be accurate. Preserve conversation flow.`
      : `This is a raw meeting transcript from speech-to-text (no speaker labels).
Add speaker labels based on context — topic changes, different perspectives, questions vs answers.
Label as Speaker 1, Speaker 2, etc. Use names if mentioned in context.
Format: **Speaker 1:** What they said...

Transcript:
${rawTranscript}`;

    parts.push({ text: prompt });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[diarize] Gemini error:', err.slice(0, 300));
      // Fallback: return raw transcript if Gemini fails
      return NextResponse.json({ success: true, diarizedTranscript: rawTranscript || '' });
    }

    const data = await res.json();
    const diarized = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    return NextResponse.json({
      success: true,
      diarizedTranscript: diarized || rawTranscript || '',
    });
  } catch (err) {
    console.error('[meetings/diarize]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
