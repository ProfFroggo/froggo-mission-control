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
  main:       { color: '#4CAF50', border: 'border-green-500/40',  bg: 'bg-green-500/8',   text: 'text-green-400',  ring: 'ring-green-500/50',  dot: 'bg-green-400', pic: 'froggo.png' },
  froggo:     { color: '#4CAF50', border: 'border-green-500/40',  bg: 'bg-green-500/8',   text: 'text-green-400',  ring: 'ring-green-500/50',  dot: 'bg-green-400', pic: 'froggo.png' },
  coder:      { color: '#2196F3', border: 'border-blue-500/40',   bg: 'bg-blue-500/8',    text: 'text-blue-400',   ring: 'ring-blue-500/50',   dot: 'bg-blue-400',  pic: 'coder.png' },
  researcher: { color: '#FF9800', border: 'border-orange-500/40', bg: 'bg-orange-500/8',  text: 'text-orange-400', ring: 'ring-orange-500/50', dot: 'bg-orange-400', pic: 'researcher.png' },
  writer:     { color: '#9C27B0', border: 'border-purple-500/40', bg: 'bg-purple-500/8',  text: 'text-purple-400', ring: 'ring-purple-500/50', dot: 'bg-purple-400', pic: 'writer.png' },
  chief:      { color: '#F44336', border: 'border-red-500/40',    bg: 'bg-red-500/8',     text: 'text-red-400',    ring: 'ring-red-500/50',    dot: 'bg-red-400',   pic: 'chief.png' },
  hr:         { color: '#00897B', border: 'border-teal-500/40',   bg: 'bg-teal-500/8',    text: 'text-teal-400',   ring: 'ring-teal-500/50',   dot: 'bg-teal-400',  pic: 'hr.png' },
  designer:   { color: '#EC4899', border: 'border-pink-500/40',   bg: 'bg-pink-500/8',    text: 'text-pink-400',   ring: 'ring-pink-500/50',   dot: 'bg-pink-400',  pic: 'designer.png' },
  social_media_manager: { color: '#1DA1F2', border: 'border-sky-500/40', bg: 'bg-sky-500/8', text: 'text-sky-400', ring: 'ring-sky-500/50', dot: 'bg-sky-400', pic: 'social_media_manager.png' },
  clara:    { color: '#6B46C1', border: 'border-violet-500/40', bg: 'bg-violet-500/8', text: 'text-violet-400', ring: 'ring-violet-500/50', dot: 'bg-violet-400', pic: 'clara.png' },
};

export const defaultTheme: AgentTheme = { color: '#666', border: 'border-clawd-border', bg: 'bg-clawd-surface', text: 'text-clawd-text-dim', ring: 'ring-clawd-border', dot: 'bg-gray-400', pic: '' };

export function getAgentTheme(id: string): AgentTheme {
  return agentThemes[id.toLowerCase()] || defaultTheme;
}
