// Voice profiles for multi-agent voice meetings
// Each agent gets distinct pitch/rate so voices are distinguishable

export interface AgentVoiceProfile {
  pitch: number;   // 0.0 - 2.0, default 1.0
  rate: number;    // 0.1 - 10.0, default 1.0
  preferFemale: boolean;
}

// Default profile for unknown agents
export const DEFAULT_VOICE_PROFILE: AgentVoiceProfile = {
  pitch: 1.0,
  rate: 1.0,
  preferFemale: false,
};

// Agent ID patterns → voice profiles
// These are best-effort: actual voice depends on OS-installed voices
const VOICE_PROFILES: Record<string, AgentVoiceProfile> = {
  // Kevin / user — not used for TTS but defined for completeness
  'mission-control': { pitch: 1.0,  rate: 1.0,  preferFemale: false },

  // Technical agents — deeper, faster
  'coder':           { pitch: 0.70, rate: 1.10, preferFemale: false },
  'engineer':        { pitch: 0.65, rate: 1.05, preferFemale: false },
  'developer':       { pitch: 0.75, rate: 1.08, preferFemale: false },

  // Creative/writing agents — higher, slightly slower
  'writer':          { pitch: 1.35, rate: 0.92, preferFemale: true  },
  'designer':        { pitch: 1.30, rate: 0.95, preferFemale: true  },
  'creative':        { pitch: 1.28, rate: 0.97, preferFemale: true  },

  // Research/analytical — measured, clear
  'researcher':      { pitch: 1.10, rate: 0.88, preferFemale: true  },
  'analyst':         { pitch: 0.90, rate: 0.85, preferFemale: false },
  'data':            { pitch: 0.85, rate: 0.90, preferFemale: false },

  // Leadership — noticeably deeper and deliberate
  'chief':           { pitch: 0.60, rate: 0.82, preferFemale: false },
  'director':        { pitch: 0.65, rate: 0.85, preferFemale: false },
  'manager':         { pitch: 0.75, rate: 0.88, preferFemale: false },

  // Support/HR — warm, accessible
  'hr':              { pitch: 1.25, rate: 0.90, preferFemale: true  },
  'support':         { pitch: 1.20, rate: 0.93, preferFemale: true  },

  // Growth/marketing — energetic
  'growth':          { pitch: 1.05, rate: 1.15, preferFemale: false },
  'marketing':       { pitch: 1.15, rate: 1.10, preferFemale: true  },

  // Reply/social
  'reply-guy':       { pitch: 0.90, rate: 1.18, preferFemale: false },
  'social':          { pitch: 1.05, rate: 1.10, preferFemale: true  },

  // Clara (project manager / reviewer)
  'clara':           { pitch: 1.20, rate: 0.90, preferFemale: true  },
  'project-manager': { pitch: 1.10, rate: 0.92, preferFemale: false },

  // Named agents from agent-voices config
  'jess':            { pitch: 1.30, rate: 0.90, preferFemale: true  },
  'ox':              { pitch: 0.60, rate: 0.85, preferFemale: false },
  'degen-frog':      { pitch: 0.90, rate: 1.20, preferFemale: false },
  'voice':           { pitch: 1.0,  rate: 1.05, preferFemale: false },
};

/**
 * Get voice profile for an agent by ID.
 * Does partial/fuzzy matching so 'coder-v2' matches 'coder'.
 */
export function getVoiceProfile(agentId: string): AgentVoiceProfile {
  const id = agentId.toLowerCase();

  // Exact match first
  if (VOICE_PROFILES[id]) return VOICE_PROFILES[id];

  // Partial match (e.g. 'growth-director' matches 'director')
  for (const [key, profile] of Object.entries(VOICE_PROFILES)) {
    if (id.includes(key) || key.includes(id)) return profile;
  }

  // Hash-based deterministic fallback so same agent always gets same voice
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return {
    pitch: 0.65 + (hash % 9) * 0.10,  // 0.65 – 1.45
    rate:  0.82 + (hash % 6) * 0.06,  // 0.82 – 1.12
    preferFemale: hash % 2 === 0,
  };
}

/**
 * Speak text with agent-specific voice profile using Web Speech API.
 * Returns a promise that resolves when speaking is done (or fails gracefully).
 */
export function speakWithAgentVoice(
  text: string,
  agentId: string,
  volume = 1.0,
  onBoundary?: (charIndex: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }

    const profile = getVoiceProfile(agentId);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = profile.pitch;
    utterance.rate = profile.rate;
    utterance.volume = Math.min(1, Math.max(0, volume));

    // Try to assign a voice matching gender preference
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const lang = 'en';
      const gendered = voices.filter(v =>
        v.lang.startsWith(lang) &&
        (profile.preferFemale
          ? v.name.match(/female|zira|susan|samantha|victoria|karen|moira|tessa|fiona|allison|ava|serena/i)
          : v.name.match(/male|daniel|david|alex|tom|fred|jorge|diego|rishi|reed|evan/i))
      );
      const fallback = voices.filter(v => v.lang.startsWith(lang));
      utterance.voice = gendered[0] ?? fallback[0] ?? null;
    }

    if (onBoundary) utterance.onboundary = (e) => onBoundary(e.charIndex);
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();  // Never reject — always continue meeting

    window.speechSynthesis.cancel();  // Clear any queued speech first
    window.speechSynthesis.speak(utterance);
  });
}
