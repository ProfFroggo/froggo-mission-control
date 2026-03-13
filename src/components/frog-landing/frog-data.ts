// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.

/**
 * Frog Landing Page — static data layer.
 * All content for the landing page lives here so components stay pure presentation.
 */

export interface FrogStat {
  value: string;
  label: string;
  icon: string; // Lucide icon name
}

export interface FrogSpecies {
  name: string;
  scientificName: string;
  description: string;
  fact: string;
  imageUrl: string;
  imageAlt: string;
}

export interface GalleryImage {
  src: string;
  alt: string;
  span: 'normal' | 'wide' | 'tall';
}

export interface HabitatRegion {
  name: string;
  description: string;
  speciesCount: number;
  x: number; // percentage position on map
  y: number;
}

export const FROG_STATS: FrogStat[] = [
  { value: '7,000+', label: 'Known Species', icon: 'Bug' },
  { value: '200M', label: 'Years on Earth', icon: 'Clock' },
  { value: '33%', label: 'Species Threatened', icon: 'AlertTriangle' },
];

export const FROG_SPECIES: FrogSpecies[] = [
  {
    name: 'Red-Eyed Tree Frog',
    scientificName: 'Agalychnis callidryas',
    description:
      'Perhaps the most iconic frog in the world, the red-eyed tree frog uses its vivid crimson eyes as a startle defense — a strategy called deimatic behaviour.',
    fact: 'Their red eyes are thought to shock predators, giving the frog a split second to escape.',
    imageUrl: '/frog-landing/red-eyed-tree-frog.jpg',
    imageAlt: 'A red-eyed tree frog perched on a green leaf',
  },
  {
    name: 'Poison Dart Frog',
    scientificName: 'Dendrobatidae',
    description:
      'These tiny, jewel-toned frogs carry enough toxin to deter any predator. Indigenous peoples of South America have used their secretions on blowdart tips for centuries.',
    fact: 'The golden poison frog has enough venom to kill 10 grown adults.',
    imageUrl: '/frog-landing/poison-dart-frog.jpg',
    imageAlt: 'A bright blue poison dart frog on a mossy rock',
  },
  {
    name: 'Glass Frog',
    scientificName: 'Centrolenidae',
    description:
      'Named for their translucent skin, glass frogs reveal their internal organs when viewed from below — a surreal and beautiful adaptation.',
    fact: 'You can see a glass frog\'s beating heart through its transparent belly skin.',
    imageUrl: '/frog-landing/glass-frog.jpg',
    imageAlt: 'A glass frog showing its translucent underside',
  },
];

export const GALLERY_IMAGES: GalleryImage[] = [
  { src: '/frog-landing/gallery-1.jpg', alt: 'Tree frog clinging to a branch in the rain', span: 'tall' },
  { src: '/frog-landing/gallery-2.jpg', alt: 'Poison dart frog on a vibrant leaf', span: 'normal' },
  { src: '/frog-landing/gallery-3.jpg', alt: 'Bullfrog half-submerged in a pond', span: 'wide' },
  { src: '/frog-landing/gallery-4.jpg', alt: 'Tiny frog perched on a human fingertip', span: 'normal' },
  { src: '/frog-landing/gallery-5.jpg', alt: 'Frog camouflaged among dead leaves', span: 'normal' },
  { src: '/frog-landing/gallery-6.jpg', alt: 'Chorus of frogs on a lily pad at sunset', span: 'wide' },
];

export const HABITAT_REGIONS: HabitatRegion[] = [
  { name: 'Central America', description: 'Dense tropical rainforests host over 800 species', speciesCount: 800, x: 22, y: 42 },
  { name: 'Amazon Basin', description: 'The world\'s most biodiverse frog habitat', speciesCount: 1500, x: 30, y: 58 },
  { name: 'Southeast Asia', description: 'Ancient forests harbour unique tree frog lineages', speciesCount: 900, x: 75, y: 45 },
  { name: 'Madagascar', description: 'Island isolation created 350+ endemic species', speciesCount: 350, x: 62, y: 62 },
  { name: 'Australia', description: 'From desert burrowers to rainforest canopy dwellers', speciesCount: 240, x: 82, y: 68 },
  { name: 'West Africa', description: 'Tropical wetlands with goliath and reed frogs', speciesCount: 400, x: 48, y: 48 },
];
