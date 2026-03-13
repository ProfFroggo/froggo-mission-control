// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { Instagram, Twitter, Linkedin, Youtube, Mail, Search, DollarSign, Globe, MessageCircle, Video } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const CHANNEL_ICONS: Record<string, LucideIcon> = {
  instagram: Instagram,
  x: Twitter,
  tiktok: Video,
  linkedin: Linkedin,
  youtube: Youtube,
  email: Mail,
  seo: Search,
  google_ads: DollarSign,
  meta_ads: DollarSign,
  whatsapp: MessageCircle,
  web: Globe,
};

export const CHANNEL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  x: 'X / Twitter',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  email: 'Email',
  seo: 'SEO',
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  whatsapp: 'WhatsApp',
  web: 'Website',
};

export const ALL_CHANNELS = Object.keys(CHANNEL_LABELS);
