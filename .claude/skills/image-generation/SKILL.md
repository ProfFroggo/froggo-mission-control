---
name: image-generation
description: Generate images using the Gemini AI image generation tool — covers prompt crafting, style guidance, and inline delivery of results.
---

# Image Generation

## Purpose

Generate high-quality images via Gemini AI and deliver them inline in chat or embed them in deliverables. Use this skill whenever a task requires visual assets: illustrations, hero images, mockups, diagrams, Pixar-style characters, social graphics, etc.

## CRITICAL — How to call the tool

**Call it directly. Never use ToolSearch.**

```
mcp__mission-control-db__image_generate {
  "prompt": "...",
  "agentId": "your-agent-id",
  "filename": "short-descriptive-name"
}
```

- Tool name: `mcp__mission-control-db__image_generate` (hyphen between every word)
- This tool is **directly callable** — it does not need to be loaded via ToolSearch first
- If you find yourself calling ToolSearch to find this tool, stop immediately and call it directly instead
- Do not explore the codebase to find the tool — it is always available in your session

Returns a markdown image string — paste it directly into your response:
`![description](/api/library?action=raw&id=...)`

## Prompt Crafting Guide

### Structure
`[Subject] · [Style] · [Lighting] · [Composition] · [Color palette] · [Mood]`

### Style Presets

**Pixar / 3D Cartoon**
> "Pixar 3D animated style, expressive cartoon character, soft studio lighting, vibrant saturated colors, smooth stylized textures, clean gradient background, square crop face and shoulders"

**Flat UI / Product**
> "Flat design illustration, clean minimal style, soft pastel colors, white background, product screenshot aesthetic"

**Hero / Marketing**
> "Professional marketing hero image, bold composition, high contrast, cinematic lighting, photorealistic"

**Isometric / Tech**
> "Isometric 3D illustration, tech aesthetic, blue and purple palette, clean lines, white background"

**Social Media**
> "Bold graphic design, high contrast, eye-catching composition, optimized for social media, square format"

### Tips
- Be specific about style, not just subject
- Include lighting direction (soft, dramatic, studio, natural)
- Specify background (gradient, white, transparent, scene)
- Mention crop/format (square, portrait, landscape, face only)
- For characters: describe expression, pose, clothing color

## Workflow

1. Craft prompt using the guide above
2. Call `mcp__mission-control-db__image_generate` directly
3. Paste the returned markdown string directly in your response
4. If result isn't right, iterate with a refined prompt — be more specific

## For multiple images

Call the tool multiple times in parallel — one call per image. Do not wait for one to finish before starting the next.
