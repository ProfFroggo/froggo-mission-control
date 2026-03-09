// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import {
  FolderKanban, Rocket, Zap, Target, Lightbulb, Flame, Wrench,
  BarChart2, Star, Palette, FlaskConical, Building2, Globe, Code2,
  Shield, Megaphone, TrendingUp, Database, type LucideIcon,
} from 'lucide-react';

export const PROJECT_ICON_OPTIONS: { id: string; icon: LucideIcon }[] = [
  { id: 'folder',   icon: FolderKanban },
  { id: 'rocket',   icon: Rocket },
  { id: 'zap',      icon: Zap },
  { id: 'target',   icon: Target },
  { id: 'bulb',     icon: Lightbulb },
  { id: 'flame',    icon: Flame },
  { id: 'wrench',   icon: Wrench },
  { id: 'chart',    icon: BarChart2 },
  { id: 'star',     icon: Star },
  { id: 'palette',  icon: Palette },
  { id: 'flask',    icon: FlaskConical },
  { id: 'building', icon: Building2 },
  { id: 'globe',    icon: Globe },
  { id: 'code',     icon: Code2 },
  { id: 'shield',   icon: Shield },
  { id: 'mega',     icon: Megaphone },
  { id: 'trend',    icon: TrendingUp },
  { id: 'db',       icon: Database },
];

export function getProjectIcon(iconId: string): LucideIcon {
  return (PROJECT_ICON_OPTIONS.find(i => i.id === iconId) ?? PROJECT_ICON_OPTIONS[0]).icon;
}
