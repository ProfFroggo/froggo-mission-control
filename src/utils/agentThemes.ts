// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Shared agent theme config — colors, profile pics, accent rings

export interface AgentTheme {
  color: string;
  border: string;
  bg: string;
  text: string;
  ring: string;
  dot: string;
  pic: string;
}

export const agentThemes: Record<string, AgentTheme> = {
  'mission-control':     { color: '#4CAF50', border: 'border-[#4CAF5066]',  bg: 'bg-[#4CAF5014]',   text: 'text-[#4CAF50]',  ring: 'ring-[#4CAF5080]',  dot: 'bg-[#4CAF50]', pic: 'mission-control.webp' },
  main:       { color: '#4CAF50', border: 'border-[#4CAF5066]',  bg: 'bg-[#4CAF5014]',   text: 'text-[#4CAF50]',  ring: 'ring-[#4CAF5080]',  dot: 'bg-[#4CAF50]', pic: 'mission-control.webp' },
  coder:      { color: '#2196F3', border: 'border-[#2196F366]',   bg: 'bg-[#2196F314]',    text: 'text-[#2196F3]',   ring: 'ring-[#2196F380]',   dot: 'bg-[#2196F3]',  pic: 'coder.webp' },
  researcher: { color: '#FF9800', border: 'border-[#FF980066]', bg: 'bg-[#FF980014]',  text: 'text-[#FF9800]', ring: 'ring-[#FF980080]', dot: 'bg-[#FF9800]', pic: 'researcher.webp' },
  writer:     { color: '#9C27B0', border: 'border-[#9C27B066]', bg: 'bg-[#9C27B014]',  text: 'text-[#9C27B0]', ring: 'ring-[#9C27B080]', dot: 'bg-[#9C27B0]', pic: 'writer.webp' },
  chief:      { color: '#F44336', border: 'border-[#F4433666]',    bg: 'bg-[#F4433614]',     text: 'text-[#F44336]',    ring: 'ring-[#F4433680]',    dot: 'bg-[#F44336]',   pic: 'chief.webp' },
  hr:         { color: '#00897B', border: 'border-[#00897B66]',   bg: 'bg-[#00897B14]',    text: 'text-[#00897B]',   ring: 'ring-[#00897B80]',   dot: 'bg-[#00897B]',  pic: 'hr.webp' },
  inbox:      { color: '#F59E0B', border: 'border-[#F59E0B66]',  bg: 'bg-[#F59E0B14]',   text: 'text-[#F59E0B]',  ring: 'ring-[#F59E0B80]',  dot: 'bg-[#F59E0B]', pic: 'inbox.webp' },
  designer:   { color: '#EC4899', border: 'border-[#EC489966]',   bg: 'bg-[#EC489914]',    text: 'text-[#EC4899]',   ring: 'ring-[#EC489980]',   dot: 'bg-[#EC4899]',  pic: 'designer.webp' },
  social_media_manager: { color: '#1DA1F2', border: 'border-[#1DA1F266]', bg: 'bg-[#1DA1F214]', text: 'text-[#1DA1F2]', ring: 'ring-[#1DA1F280]', dot: 'bg-[#1DA1F2]', pic: 'social_media_manager.webp' },
  clara:    { color: '#6B46C1', border: 'border-[#6B46C166]', bg: 'bg-[#6B46C114]', text: 'text-[#6B46C1]', ring: 'ring-[#6B46C180]', dot: 'bg-[#6B46C1]', pic: 'clara.webp' },
  'growth-director': { color: '#E65100', border: 'border-[#E6510066]', bg: 'bg-[#E6510014]', text: 'text-[#E65100]', ring: 'ring-[#E6510080]', dot: 'bg-[#E65100]', pic: 'growth-director.webp' },
  'social-manager': { color: '#1DA1F2', border: 'border-[#1DA1F266]', bg: 'bg-[#1DA1F214]', text: 'text-[#1DA1F2]', ring: 'ring-[#1DA1F280]', dot: 'bg-[#1DA1F2]', pic: 'social-manager.webp' },
  voice: { color: '#E91E63', border: 'border-[#E91E6366]', bg: 'bg-[#E91E6314]', text: 'text-[#E91E63]', ring: 'ring-[#E91E6380]', dot: 'bg-[#E91E63]', pic: 'voice.webp' },
  'degen-frog': { color: '#00BCD4', border: 'border-[#00BCD466]', bg: 'bg-[#00BCD414]', text: 'text-[#00BCD4]', ring: 'ring-[#00BCD480]', dot: 'bg-[#00BCD4]', pic: 'degen-frog.webp' },
  jess: { color: '#8B5CF6', border: 'border-[#8B5CF666]', bg: 'bg-[#8B5CF614]', text: 'text-[#8B5CF6]', ring: 'ring-[#8B5CF680]', dot: 'bg-[#8B5CF6]', pic: 'jess.webp' },
  'senior-coder': { color: '#1565C0', border: 'border-[#1565C066]', bg: 'bg-[#1565C014]', text: 'text-[#1565C0]', ring: 'ring-[#1565C080]', dot: 'bg-[#1565C0]', pic: 'senior-coder.webp' },
  'finance-manager':  { color: '#F9A825', border: 'border-[#F9A82566]', bg: 'bg-[#F9A82514]',  text: 'text-[#F9A825]', ring: 'ring-[#F9A82580]', dot: 'bg-[#F9A825]', pic: 'finance-manager.webp' },
  'discord-manager':  { color: '#5865F2', border: 'border-[#5865F266]', bg: 'bg-[#5865F214]', text: 'text-[#5865F2]', ring: 'ring-[#5865F280]', dot: 'bg-[#5865F2]', pic: 'discord-manager.webp' },
};

export const defaultTheme: AgentTheme = {
  color: '#666',
  border: 'border-mission-control-border',
  bg: 'bg-mission-control-surface',
  text: 'text-mission-control-text-dim',
  ring: 'ring-mission-control-border',
  dot: 'bg-gray-400',
  pic: ''
};

// Runtime theme generation from hex color
const dynamicThemeCache: Record<string, AgentTheme> = {};

/**
 * Generate agent theme from hex color
 * Creates Tailwind-compatible inline styles for unknown agents
 */
export function generateThemeFromColor(hex: string, pic?: string): AgentTheme {
  // Cache to avoid redundant conversions
  if (dynamicThemeCache[hex]) {
    return dynamicThemeCache[hex];
  }

  // Parse hex color to RGB
  const hexMatch = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!hexMatch) {
    return defaultTheme;
  }

  // Generate theme with varying opacity levels
  const theme: AgentTheme = {
    color: hex,
    // Using inline style approach since Tailwind can't generate dynamic classes at runtime
    border: `border-[${hex}40]`, // 40 = 25% opacity
    bg: `bg-[${hex}14]`,          // 14 = ~8% opacity
    text: `text-[${hex}]`,
    ring: `ring-[${hex}80]`,      // 80 = 50% opacity
    dot: `bg-[${hex}]`,
    pic: pic || '',
  };

  dynamicThemeCache[hex] = theme;
  return theme;
}

/**
 * Register runtime theme for an agent
 * Called when new agent is loaded from DB with color field
 */
export function registerAgentTheme(id: string, color: string, pic?: string) {
  if (!agentThemes[id.toLowerCase()]) {
    const theme = generateThemeFromColor(color, pic);
    dynamicThemeCache[id.toLowerCase()] = theme;
  }
}

const FALLBACK_PALETTE = [
  { color: '#4CAF50', border: 'border-[#4CAF5066]',  bg: 'bg-[#4CAF5014]',   text: 'text-[#4CAF50]',  ring: 'ring-[#4CAF5080]',  dot: 'bg-[#4CAF50]' },
  { color: '#2196F3', border: 'border-[#2196F366]',   bg: 'bg-[#2196F314]',    text: 'text-[#2196F3]',   ring: 'ring-[#2196F380]',   dot: 'bg-[#2196F3]' },
  { color: '#9C27B0', border: 'border-[#9C27B066]', bg: 'bg-[#9C27B014]',  text: 'text-[#9C27B0]', ring: 'ring-[#9C27B080]', dot: 'bg-[#9C27B0]' },
  { color: '#F44336', border: 'border-[#F4433666]',    bg: 'bg-[#F4433614]',     text: 'text-[#F44336]',    ring: 'ring-[#F4433680]',    dot: 'bg-[#F44336]' },
  { color: '#FF9800', border: 'border-[#FF980066]', bg: 'bg-[#FF980014]',  text: 'text-[#FF9800]', ring: 'ring-[#FF980080]', dot: 'bg-[#FF9800]' },
  { color: '#00BCD4', border: 'border-[#00BCD466]',   bg: 'bg-[#00BCD414]',    text: 'text-[#00BCD4]',   ring: 'ring-[#00BCD480]',   dot: 'bg-[#00BCD4]' },
  { color: '#E91E63', border: 'border-[#E91E6366]',   bg: 'bg-[#E91E6314]',    text: 'text-[#E91E63]',   ring: 'ring-[#E91E6380]',   dot: 'bg-[#E91E63]' },
  { color: '#00897B', border: 'border-[#00897B66]',   bg: 'bg-[#00897B14]',    text: 'text-[#00897B]',   ring: 'ring-[#00897B80]',   dot: 'bg-[#00897B]' },
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Get agent theme with fallback chain:
 * 1. Hardcoded theme (known agents)
 * 2. Runtime cache (newly registered agents with explicit color)
 * 3. Deterministic palette theme derived from agent ID hash
 */
export function getAgentTheme(id: string): AgentTheme {
  const normalizedId = id.toLowerCase();

  // Check hardcoded themes first
  if (agentThemes[normalizedId]) {
    return agentThemes[normalizedId];
  }

  // Check runtime cache (agents registered with explicit hex color)
  if (dynamicThemeCache[normalizedId]) {
    return dynamicThemeCache[normalizedId];
  }

  // Deterministic palette fallback — new/unknown agents get a stable color
  const palette = FALLBACK_PALETTE[hashId(normalizedId) % FALLBACK_PALETTE.length];
  return { ...palette, pic: `${id}.webp` };
}

/**
 * Get agent color hex value
 * Useful for components that need raw color value
 */
export function getAgentColor(id: string): string {
  const theme = getAgentTheme(id);
  return theme.color;
}
