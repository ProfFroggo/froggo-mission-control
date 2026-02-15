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
  froggo:     { color: '#4CAF50', border: 'border-green-500/40',  bg: 'bg-green-500/8',   text: 'text-green-400',  ring: 'ring-green-500/50',  dot: 'bg-green-400', pic: 'froggo.png' },
  main:       { color: '#4CAF50', border: 'border-green-500/40',  bg: 'bg-green-500/8',   text: 'text-green-400',  ring: 'ring-green-500/50',  dot: 'bg-green-400', pic: 'froggo.png' },
  coder:      { color: '#2196F3', border: 'border-blue-500/40',   bg: 'bg-blue-500/8',    text: 'text-blue-400',   ring: 'ring-blue-500/50',   dot: 'bg-blue-400',  pic: 'coder.png' },
  researcher: { color: '#FF9800', border: 'border-orange-500/40', bg: 'bg-orange-500/8',  text: 'text-orange-400', ring: 'ring-orange-500/50', dot: 'bg-orange-400', pic: 'researcher.png' },
  writer:     { color: '#9C27B0', border: 'border-purple-500/40', bg: 'bg-purple-500/8',  text: 'text-purple-400', ring: 'ring-purple-500/50', dot: 'bg-purple-400', pic: 'writer.png' },
  chief:      { color: '#F44336', border: 'border-red-500/40',    bg: 'bg-red-500/8',     text: 'text-red-400',    ring: 'ring-red-500/50',    dot: 'bg-red-400',   pic: 'chief.png' },
  hr:         { color: '#00897B', border: 'border-teal-500/40',   bg: 'bg-teal-500/8',    text: 'text-teal-400',   ring: 'ring-teal-500/50',   dot: 'bg-teal-400',  pic: 'hr.png' },
  designer:   { color: '#EC4899', border: 'border-pink-500/40',   bg: 'bg-pink-500/8',    text: 'text-pink-400',   ring: 'ring-pink-500/50',   dot: 'bg-pink-400',  pic: 'designer.png' },
  social_media_manager: { color: '#1DA1F2', border: 'border-sky-500/40', bg: 'bg-sky-500/8', text: 'text-sky-400', ring: 'ring-sky-500/50', dot: 'bg-sky-400', pic: 'social_media_manager.png' },
  clara:    { color: '#6B46C1', border: 'border-violet-500/40', bg: 'bg-violet-500/8', text: 'text-violet-400', ring: 'ring-violet-500/50', dot: 'bg-violet-400', pic: 'clara.png' },
  'growth-director': { color: '#E65100', border: 'border-amber-600/40', bg: 'bg-amber-600/8', text: 'text-amber-400', ring: 'ring-amber-600/50', dot: 'bg-amber-400', pic: 'growth-director.png' },
  'social-manager': { color: '#1DA1F2', border: 'border-sky-500/40', bg: 'bg-sky-500/8', text: 'text-sky-400', ring: 'ring-sky-500/50', dot: 'bg-sky-400', pic: 'social-manager.png' },
  voice: { color: '#E91E63', border: 'border-rose-500/40', bg: 'bg-rose-500/8', text: 'text-rose-400', ring: 'ring-rose-500/50', dot: 'bg-rose-400', pic: 'voice.png' },
  'degen-frog': { color: '#00BCD4', border: 'border-cyan-500/40', bg: 'bg-cyan-500/8', text: 'text-cyan-400', ring: 'ring-cyan-500/50', dot: 'bg-cyan-400', pic: 'degen-frog.png' },
  jess: { color: '#8B5CF6', border: 'border-indigo-500/40', bg: 'bg-indigo-500/8', text: 'text-indigo-400', ring: 'ring-indigo-500/50', dot: 'bg-indigo-400', pic: 'jess.png' },
  'senior-coder': { color: '#1565C0', border: 'border-blue-700/40', bg: 'bg-blue-700/8', text: 'text-blue-300', ring: 'ring-blue-700/50', dot: 'bg-blue-300', pic: 'senior-coder.png' },
  'finance-manager': { color: '#F9A825', border: 'border-yellow-600/40', bg: 'bg-yellow-600/8', text: 'text-yellow-400', ring: 'ring-yellow-600/50', dot: 'bg-yellow-400', pic: 'finance-manager.png' },
};

export const defaultTheme: AgentTheme = {
  color: '#666',
  border: 'border-clawd-border',
  bg: 'bg-clawd-surface',
  text: 'text-clawd-text-dim',
  ring: 'ring-clawd-border',
  dot: 'bg-clawd-text-dim',
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

  const r = parseInt(hexMatch[1], 16);
  const g = parseInt(hexMatch[2], 16);
  const b = parseInt(hexMatch[3], 16);

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

/**
 * Get agent theme with fallback chain:
 * 1. Hardcoded theme (known agents)
 * 2. Runtime cache (newly registered agents)
 * 3. Default theme
 */
export function getAgentTheme(id: string): AgentTheme {
  const normalizedId = id.toLowerCase();

  // Check hardcoded themes first
  if (agentThemes[normalizedId]) {
    return agentThemes[normalizedId];
  }

  // Check runtime cache
  if (dynamicThemeCache[normalizedId]) {
    return dynamicThemeCache[normalizedId];
  }

  // Default fallback
  return defaultTheme;
}

/**
 * Get agent color hex value
 * Useful for components that need raw color value
 */
export function getAgentColor(id: string): string {
  const theme = getAgentTheme(id);
  return theme.color;
}
