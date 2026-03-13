#!/usr/bin/env node
// Write memory note for the frog landing page task
const fs = require('fs');
const path = require('path');

const VAULT_PATH = '/Users/kevin.macarthur/mission-control';
const category = 'task';
const agent = 'coder';
const title = '2026-03-12-frog-landing-page';

const folder = path.join('memory', 'agents', agent);
const destDir = path.join(VAULT_PATH, folder);

// Ensure directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const date = new Date().toISOString().slice(0, 10);
const content = `Built cottagecore frog landing page at /frog in froggo-mission-control Next.js app. 11 files total. Key patterns: server component page with metadata exports for OG/Twitter cards, 'use client' only on ShareButton. CSS via separate frog.css with CSS custom properties for palette. SVG illustrations used throughout (no emojis as UI elements per project rules). Web Share API with clipboard + execCommand fallbacks. Sections: hero, feature cards (4), frog facts (6), wisdom quotes (3), pond SVG scene, share CTA, footer.`;

const frontmatter = `---\ndate: ${date}\nagent: ${agent}\ntags: []\n---\n\n`;
const finalContent = frontmatter + content;

const filePath = path.join(destDir, `${title}.md`);
fs.writeFileSync(filePath, finalContent, 'utf-8');

console.log(`Memory written to: ${filePath}`);
