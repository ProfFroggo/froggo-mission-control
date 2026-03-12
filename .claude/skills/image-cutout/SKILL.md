---
name: image-cutout
description: High-quality programmatic background removal — covers tool selection by use case, Python and Node.js implementations, alpha matting for hair/fur, edge refinement, and output best practices.
---

# Image Cutout (Background Removal)

## When to Use This Skill

Any time a task involves:
- Removing a background from a photo, product image, or illustration
- Creating transparent-background PNGs for UI, marketing, or compositing
- Preparing subject isolations for further design work (collages, mockups, overlays)
- Batch-processing image assets

Always output **PNG with alpha channel**. Never output JPEG for cutouts.

---

## Tool Selection by Use Case

| Use case | Best tool | Quality |
|----------|-----------|---------|
| Products / hard edges | `rembg` (u2net) | Excellent |
| People / portraits | `rembg` (birefnet-general) + alpha matte | Excellent |
| Hair / fur / fine detail | `rembg` + `pymatting` alpha matting | Best possible |
| Batch / CI pipeline | `rembg` CLI or Python loop | Fast |
| Maximum quality, paid | remove.bg API | Reference quality |
| Browser / Edge runtime | `@imgly/background-removal` (Node/WASM) | Good |

**Default pick**: `rembg` with `birefnet-general` model covers 90% of cases with no API cost.

---

## Python — rembg (primary approach)

### Install

```bash
pip install rembg[gpu] pillow  # GPU (CUDA) — fastest
pip install rembg pillow       # CPU — no GPU needed
```

### Basic removal

```python
from rembg import remove
from PIL import Image
import io

def remove_background(input_path: str, output_path: str) -> None:
    with open(input_path, 'rb') as f:
        input_data = f.read()
    output_data = remove(input_data)
    with open(output_path, 'wb') as f:
        f.write(output_data)
    print(f"Saved: {output_path}")

remove_background("photo.jpg", "photo_cutout.png")
```

### Model selection (quality vs speed trade-off)

```python
from rembg import remove, new_session

# Best overall quality (default recommendation)
session = new_session("birefnet-general")

# Fastest, still good for products/objects
session = new_session("u2net")

# Optimised for human portraits
session = new_session("u2net_human_seg")

# Best for animals
session = new_session("birefnet-general")  # also handles animals well

result = remove(input_data, session=session)
```

### With PIL post-processing

```python
from rembg import remove
from PIL import Image, ImageFilter
import io

def high_quality_cutout(input_path: str, output_path: str) -> Image.Image:
    img = Image.open(input_path).convert("RGBA")

    with open(input_path, 'rb') as f:
        result_bytes = remove(f.read())

    result = Image.open(io.BytesIO(result_bytes)).convert("RGBA")

    # Slight edge feathering to reduce harsh aliasing
    r, g, b, a = result.split()
    a_smoothed = a.filter(ImageFilter.SMOOTH_MORE)
    result = Image.merge("RGBA", (r, g, b, a_smoothed))

    result.save(output_path, "PNG")
    return result

high_quality_cutout("portrait.jpg", "portrait_cutout.png")
```

---

## Alpha Matting — for hair, fur, and fine edges

Standard segmentation leaves fringe on fine detail. Alpha matting recovers sub-pixel transparency.

```bash
pip install pymatting rembg pillow numpy
```

```python
from rembg import remove
from PIL import Image
import numpy as np
from pymatting import estimate_alpha_cf, stack_images
import io

def cutout_with_alpha_matting(
    input_path: str,
    output_path: str,
    foreground_threshold: int = 240,
    background_threshold: int = 10,
    erode_size: int = 10,
) -> None:
    """
    Two-pass cutout:
    1. rembg produces a coarse mask
    2. pymatting refines the alpha matte in the transition zone (hair/fur/glass)
    """
    img = Image.open(input_path).convert("RGBA")

    # Pass 1: coarse mask from rembg
    with open(input_path, 'rb') as f:
        coarse_bytes = remove(
            f.read(),
            alpha_matting=True,                        # rembg built-in matting
            alpha_matting_foreground_threshold=foreground_threshold,
            alpha_matting_background_threshold=background_threshold,
            alpha_matting_erode_size=erode_size,
        )

    result = Image.open(io.BytesIO(coarse_bytes)).convert("RGBA")
    result.save(output_path, "PNG")
    print(f"Alpha matte saved: {output_path}")

cutout_with_alpha_matting("model_hair.jpg", "model_hair_cutout.png")
```

> `alpha_matting=True` activates rembg's built-in PyMatting pipeline. Use foreground_threshold 240 / background_threshold 10 as starting defaults, then tune if edges are too aggressive or too soft.

---

## Batch processing

```python
from pathlib import Path
from rembg import remove, new_session

def batch_remove_bg(
    input_dir: str,
    output_dir: str,
    model: str = "birefnet-general",
    exts: tuple = (".jpg", ".jpeg", ".png", ".webp"),
) -> None:
    session = new_session(model)
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    inputs = [p for p in Path(input_dir).iterdir() if p.suffix.lower() in exts]
    print(f"Processing {len(inputs)} images...")

    for i, path in enumerate(inputs, 1):
        output_path = out / (path.stem + "_cutout.png")
        if output_path.exists():
            print(f"  [{i}/{len(inputs)}] Skip (exists): {path.name}")
            continue
        with open(path, 'rb') as f:
            result = remove(f.read(), session=session)
        with open(output_path, 'wb') as f:
            f.write(result)
        print(f"  [{i}/{len(inputs)}] Done: {path.name}")

    print("Batch complete.")

batch_remove_bg("./raw_images", "./cutouts")
```

---

## Node.js / TypeScript

```bash
npm install @imgly/background-removal-node sharp
```

```typescript
import removeBackground from "@imgly/background-removal-node";
import sharp from "sharp";
import path from "path";

async function cutout(inputPath: string, outputPath: string): Promise<void> {
  // removeBackground accepts a file URL or Buffer
  const result: Blob = await removeBackground(`file://${path.resolve(inputPath)}`);
  const arrayBuffer = await result.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Use sharp for any post-processing (trim transparent edges, resize, etc.)
  await sharp(buffer)
    .trim()           // remove transparent border pixels
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(outputPath);

  console.log(`Saved: ${outputPath}`);
}

await cutout("./photo.jpg", "./photo_cutout.png");
```

---

## remove.bg API (maximum quality, paid)

Use when quality is critical and cost is acceptable (e.g. hero product shots, key marketing assets).

```python
import requests

def removebg_api(input_path: str, output_path: str, api_key: str, size: str = "auto") -> None:
    """
    size: 'preview' (0.25MP free), 'full' (full resolution, costs credits), 'auto'
    """
    with open(input_path, 'rb') as f:
        response = requests.post(
            'https://api.remove.bg/v1.0/removebg',
            files={'image_file': f},
            data={'size': size},
            headers={'X-Api-Key': api_key},
        )
    if response.status_code == requests.codes.ok:
        with open(output_path, 'wb') as out:
            out.write(response.content)
        print(f"Saved: {output_path}")
    else:
        raise RuntimeError(f"remove.bg error {response.status_code}: {response.text}")
```

---

## Output quality checklist

Before delivering a cutout, verify:

- [ ] **Format**: PNG with alpha channel (never JPEG)
- [ ] **Resolution**: same as input — never downsample before cutting out
- [ ] **Fringe check**: zoom in on hair/fur edges — no colour fringing (white halo or dark rim)
- [ ] **Edge smoothness**: no jagged pixel staircasing on curved edges
- [ ] **Semi-transparent areas**: glass, hair, wisps retain partial alpha, not hard-clipped
- [ ] **Defringe if needed**: if a colour halo persists, apply PIL `ImageChops` or use `rembg`'s post-processing flags
- [ ] **Compositing test**: drop subject onto a solid colour (white, black, mid-grey) to spot halo or missing detail
- [ ] **File size**: PNG compression level 9 for delivery assets

### Quick defringe in PIL

```python
from PIL import Image

def defringe(image: Image.Image, iterations: int = 1) -> Image.Image:
    """Reduces colour contamination from the original background at edges."""
    r, g, b, a = image.split()
    for _ in range(iterations):
        # Slightly contract the alpha to cut into the fringe zone
        from PIL import ImageFilter
        a = a.filter(ImageFilter.MinFilter(3))
    return Image.merge("RGBA", (r, g, b, a))
```

---

## Common mistakes to avoid

- **Downsampling before removal** — always run at full input resolution; resize output afterwards
- **Saving as JPEG after removal** — JPEG has no alpha channel; the background turns white
- **Using basic threshold masks** — never use simple colour-key or brightness threshold; always use a model
- **Skipping alpha matting on portraits** — hair requires matting; basic segmentation leaves a harsh halo
- **Not testing on dark + light backgrounds** — always composite-test on both before declaring done
