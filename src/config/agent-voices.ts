// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Agent voice profiles for TTS selection
// Maps agent IDs to gender and age characteristics for voice synthesis

export interface VoiceProfile {
  gender: 'male' | 'female';
  age: 'young' | 'middle-aged' | 'older';
  qualities?: string[]; // Additional voice qualities (e.g., 'deep')
}

// Default voice profile for unknown agents
export const defaultVoiceProfile: VoiceProfile = {
  gender: 'male',
  age: 'middle-aged',
};

export const agentVoices: Record<string, VoiceProfile> = {
  chief: {
    gender: 'female',
    age: 'older',
  },
  clara: {
    gender: 'female',
    age: 'young',
  },
  coder: {
    gender: 'male',
    age: 'middle-aged',
  },
  designer: {
    gender: 'female',
    age: 'young',
  },
  'mission-control': {
    gender: 'male',
    age: 'middle-aged',
  },
  main: {
    gender: 'male',
    age: 'middle-aged',
  },
  'growth-director': {
    gender: 'male',
    age: 'young',
  },
  hr: {
    gender: 'female',
    age: 'middle-aged',
  },
  jess: {
    gender: 'female',
    age: 'young',
    qualities: ['calm', 'warm'],
  },
  ox: {
    gender: 'male',
    age: 'middle-aged',
    qualities: ['deep'],
  },
  researcher: {
    gender: 'female',
    age: 'middle-aged',
  },
  'social-media-manager': {
    gender: 'male',
    age: 'young',
  },
  'social-manager': {
    gender: 'male',
    age: 'young',
  },
  voice: {
    gender: 'male',
    age: 'young',
  },
  writer: {
    gender: 'male',
    age: 'middle-aged',
  },
  'degen-frog': {
    gender: 'male',
    age: 'young',
    qualities: ['cocky', 'fast'],
  },
};

export function getVoiceProfile(agentId: string): VoiceProfile {
  return agentVoices[agentId.toLowerCase()] || defaultVoiceProfile;
}

// Helper to get a voice description string
export function getVoiceDescription(agentId: string): string {
  const profile = getVoiceProfile(agentId);
  if (!profile) return 'default voice';
  
  const age = profile.age === 'middle-aged' ? 'middle-aged' : profile.age;
  const qualities = profile.qualities ? ` (${profile.qualities.join(', ')})` : '';
  
  return `${age} ${profile.gender}${qualities}`;
}
