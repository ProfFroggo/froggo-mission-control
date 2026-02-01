/**
 * Google Cloud Text-to-Speech API client
 * Uses REST API with API key authentication
 */

// Voice configurations per agent personality
export const AGENT_VOICES: Record<string, { name: string; languageCode: string; ssmlGender: string }> = {
  main:       { name: 'en-US-Neural2-F', languageCode: 'en-US', ssmlGender: 'FEMALE' },
  coder:      { name: 'en-US-Neural2-D', languageCode: 'en-US', ssmlGender: 'MALE' },
  researcher: { name: 'en-US-Neural2-C', languageCode: 'en-US', ssmlGender: 'FEMALE' },
  writer:     { name: 'en-US-Neural2-A', languageCode: 'en-US', ssmlGender: 'MALE' },
  chief:      { name: 'en-US-Neural2-J', languageCode: 'en-US', ssmlGender: 'MALE' },
};

const DEFAULT_VOICE = { name: 'en-US-Neural2-F', languageCode: 'en-US', ssmlGender: 'FEMALE' };

let cachedApiKey: string = '';

async function getApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;
  
  // Try to get from electron IPC
  try {
    if ((window as any).clawdbot?.getGoogleCloudKey) {
      const key = await (window as any).clawdbot.getGoogleCloudKey();
      if (key) { cachedApiKey = key; return cachedApiKey; }
    }
  } catch {}
  
  // Try settings
  try {
    if ((window as any).clawdbot?.settings?.get) {
      const result = await (window as any).clawdbot.settings.get();
      if (result?.success && result.settings?.googleApiKey) {
        cachedApiKey = result.settings.googleApiKey;
        return cachedApiKey;
      }
    }
  } catch {}

  // Try reading from config file via exec
  try {
    if ((window as any).clawdbot?.exec?.run) {
      const result = await (window as any).clawdbot.exec.run(
        'cat ~/.clawdbot/google-api-key 2>/dev/null || echo $GOOGLE_API_KEY 2>/dev/null || echo ""'
      );
      if (result?.success && result.stdout?.trim()) {
        cachedApiKey = result.stdout.trim();
        return cachedApiKey;
      }
    }
  } catch {}
  
  // No valid key found — return empty string so callers can fall back gracefully
  console.warn('[GoogleTTS] No Google Cloud API key configured. Set GOOGLE_API_KEY env var or save to ~/.clawdbot/google-api-key');
  return '';
}

/** Allow external code to set the API key */
export function setGoogleTTSApiKey(key: string) {
  cachedApiKey = key;
}

/** Check if a valid API key is available */
export async function hasGoogleTTSApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return !!key;
}

/**
 * Synthesize speech using Google Cloud TTS API
 * Returns an AudioBuffer ready to play
 */
export async function synthesizeSpeech(
  text: string, 
  agentId?: string
): Promise<ArrayBuffer | null> {
  const apiKey = await getApiKey();
  const voice = agentId ? (AGENT_VOICES[agentId] || DEFAULT_VOICE) : DEFAULT_VOICE;
  
  // Clean text for speech
  const cleanText = text
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/`[^`]+`/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#+\s*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[<>]/g, '')
    .trim();
  
  if (!cleanText) return null;
  
  if (!apiKey) {
    console.warn('[GoogleTTS] No API key — falling back to browser TTS');
    return null;
  }
  
  // Truncate very long responses
  const truncated = cleanText.slice(0, 4000);
  
  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: truncated },
          voice: {
            languageCode: voice.languageCode,
            name: voice.name,
            ssmlGender: voice.ssmlGender,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.05,
            pitch: 0,
          },
        }),
      }
    );
    
    if (!response.ok) {
      const errText = await response.text();
      console.error('[GoogleTTS] API error:', response.status, errText);
      // Fall back to browser TTS
      return null;
    }
    
    const data = await response.json();
    if (data.audioContent) {
      // Decode base64 to ArrayBuffer
      const binary = atob(data.audioContent);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }
  } catch (err) {
    console.error('[GoogleTTS] Error:', err);
  }
  
  return null;
}

/**
 * Play audio from ArrayBuffer, returns a promise that resolves when done
 * Also provides an analyser node for waveform visualization
 */
export function playAudio(
  audioBuffer: ArrayBuffer,
  onAnalyser?: (analyser: AnalyserNode) => void
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const audioContext = new AudioContext();
      const decoded = await audioContext.decodeAudioData(audioBuffer.slice(0));
      
      const source = audioContext.createBufferSource();
      source.buffer = decoded;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      
      if (onAnalyser) onAnalyser(analyser);
      
      source.onended = () => {
        audioContext.close();
        resolve();
      };
      
      source.start(0);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Fallback: use browser's built-in speech synthesis
 */
export function speakBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    
    window.speechSynthesis.cancel();
    
    const clean = text
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/`[^`]+`/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#+\s*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .slice(0, 500);
    
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name.includes('Samantha') || v.lang === 'en-US');
    if (voice) utterance.voice = voice;
    
    window.speechSynthesis.speak(utterance);
  });
}

/** Stop any playing audio */
export function stopSpeaking() {
  window.speechSynthesis.cancel();
}
