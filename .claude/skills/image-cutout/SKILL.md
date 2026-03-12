---
name: image-cutout
description: High-quality programmatic background removal — covers tool selection by use case, SAM 2 maximum quality pipeline, BiRefNet-HD, alpha matting for hair/fur, FBA Matting, edge refinement, and output best practices.
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

## Quality Tiers

| Tier | Approach | When to use |
|------|----------|-------------|
| **Maximum** | SAM 2 + FBA Matting | Hero shots, complex hair, precise control |
| **Excellent** | `rembg` birefnet-hd + alpha matte | High-res assets, portraits, products |
| **Good / fast** | `rembg` birefnet-general | Batch, standard web assets |
| **Paid API** | remove.bg / PhotoRoom API | Client deliverables where quality is non-negotiable |
| **Browser/Edge** | `@imgly/background-removal` | Frontend / Node.js pipelines |

**Default pick for most work**: `rembg` with `birefnet-hd` (high-res input) or `birefnet-general` (standard). Upgrade to SAM 2 + FBA Matting when hair, fur, or fine translucent detail matters.

---

## Tool Selection by Use Case

| Use case | Best tool | Quality |
|----------|-----------|---------|
| Products / hard edges | `rembg` (birefnet-general) | Excellent |
| Portraits, standard res | `rembg` (birefnet-general) + alpha matte | Excellent |
| High-res portraits / large images | `rembg` (birefnet-hd) + alpha matte | Superior |
| Hair / fur / fine detail — maximum quality | SAM 2 + FBA Matting | Best possible |
| Batch / CI pipeline | `rembg` (birefnet-general) loop | Fast |
| Maximum quality, paid | remove.bg or PhotoRoom API | Reference |
| Browser / Edge runtime | `@imgly/background-removal` (WASM) | Good |

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

# BEST quality for high-res inputs (>1 MP) — recommended for professional work
session = new_session("birefnet-hd")

# Best overall for standard resolution — covers most use cases
session = new_session("birefnet-general")

# Fastest, still good for products/objects on a deadline
session = new_session("u2net")

# Optimised for human portraits at standard resolution
session = new_session("u2net_human_seg")

result = remove(input_data, session=session)
```

> **birefnet-hd vs birefnet-general**: use `hd` for source images larger than ~1 megapixel or when you need the sharpest possible edge retention. It processes slower but recovers finer detail.

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

## Maximum Quality (Free) — SAM 2 + FBA Matting

This is the best result achievable without any API cost. Use it for hero shots, fashion cutouts, complex hair, or any time the output will be prominent.

**How it works:**
1. **SAM 2** (Segment Anything Model 2) generates a pixel-perfect segmentation mask using automatic or point-guided prompting — handles complex subjects far better than any automatic-only model
2. **FBA Matting** (F, B, Alpha decomposition) runs a learned alpha matte over the SAM 2 mask transition zone, recovering sub-pixel transparency in hair, fur, and wispy edges

```bash
pip install segment-anything-2 torch torchvision pillow numpy requests
# FBA Matting — clone and install
git clone https://github.com/MarcoForte/FBA_Matting.git
pip install -e FBA_Matting/
# Download SAM 2 checkpoint (choose one):
# sam2_hiera_large.pt  ← best quality
# sam2_hiera_base_plus.pt  ← good balance
wget https://dl.fbaipublicfiles.com/segment_anything_2/072824/sam2_hiera_large.pt
```

```python
import torch
import numpy as np
from PIL import Image
from sam2.build_sam import build_sam2
from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator
import cv2

def sam2_cutout(
    input_path: str,
    output_path: str,
    checkpoint: str = "sam2_hiera_large.pt",
    config: str = "sam2_hiera_l.yaml",
    use_fba_matting: bool = True,
) -> None:
    """
    Maximum quality cutout pipeline:
    1. SAM 2 automatic segmentation to get the primary subject mask
    2. Optional FBA Matting refinement on the edge transition zone
    """
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    # Load image
    img = np.array(Image.open(input_path).convert("RGB"))
    h, w = img.shape[:2]

    # --- Step 1: SAM 2 segmentation ---
    sam2 = build_sam2(config, checkpoint, device=device)
    mask_generator = SAM2AutomaticMaskGenerator(
        model=sam2,
        points_per_side=64,          # more points = finer coverage
        pred_iou_thresh=0.88,
        stability_score_thresh=0.95,
        crop_n_layers=1,
        crop_n_points_downscale_factor=2,
    )

    masks = mask_generator.generate(img)

    # Pick the largest mask (primary subject)
    primary = max(masks, key=lambda m: m["area"])
    coarse_mask = primary["segmentation"].astype(np.uint8) * 255  # H x W, uint8

    if not use_fba_matting:
        # Fast path: apply coarse mask directly
        rgba = np.dstack([img, coarse_mask])
        Image.fromarray(rgba, "RGBA").save(output_path, "PNG")
        print(f"Saved (SAM 2 only): {output_path}")
        return

    # --- Step 2: FBA Matting refinement ---
    # Build trimap from SAM 2 mask: erode for definite FG, dilate for unknown zone
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    fg_mask  = cv2.erode(coarse_mask, kernel, iterations=3)   # definite foreground
    bg_mask  = cv2.dilate(coarse_mask, kernel, iterations=3)  # outside = definite background
    trimap = np.full((h, w), 128, dtype=np.uint8)             # 128 = unknown
    trimap[fg_mask == 255] = 255                              # definite FG
    trimap[bg_mask == 0]   = 0                                # definite BG

    # FBA Matting expects normalised float32
    img_f32 = img.astype(np.float32) / 255.0
    tri_f32 = trimap.astype(np.float32) / 255.0

    from FBA_Matting.demo import pred  # from the cloned repo
    alpha = pred(img_f32, tri_f32)     # returns H x W float32 alpha [0,1]

    alpha_u8 = (alpha * 255).clip(0, 255).astype(np.uint8)
    rgba = np.dstack([img, alpha_u8])
    Image.fromarray(rgba, "RGBA").save(output_path, "PNG")
    print(f"Saved (SAM 2 + FBA Matting): {output_path}")


sam2_cutout("portrait.jpg", "portrait_cutout.png")
```

> **SAM 2 with point prompts** (when you know where the subject is):
> ```python
> from sam2.sam2_image_predictor import SAM2ImagePredictor
> predictor = SAM2ImagePredictor(build_sam2(config, checkpoint, device=device))
> predictor.set_image(img)
> # Click on the subject — (x, y) pixel coordinates
> masks, scores, _ = predictor.predict(
>     point_coords=np.array([[w//2, h//2]]),  # centre of image
>     point_labels=np.array([1]),             # 1 = foreground
>     multimask_output=True,
> )
> best_mask = masks[np.argmax(scores)]
> ```
> Point prompts give far more precise control than automatic mode when the background is complex.

---

## Alpha Matting — rembg built-in (good, fast)

For most portraits and products, rembg's built-in PyMatting is sufficient and much simpler to set up than the full SAM 2 pipeline.

```bash
pip install rembg pillow
```

```python
from rembg import remove
from PIL import Image
import io

def cutout_with_alpha_matting(
    input_path: str,
    output_path: str,
    foreground_threshold: int = 240,
    background_threshold: int = 10,
    erode_size: int = 10,
) -> None:
    with open(input_path, 'rb') as f:
        coarse_bytes = remove(
            f.read(),
            alpha_matting=True,
            alpha_matting_foreground_threshold=foreground_threshold,
            alpha_matting_background_threshold=background_threshold,
            alpha_matting_erode_size=erode_size,
        )
    result = Image.open(io.BytesIO(coarse_bytes)).convert("RGBA")
    result.save(output_path, "PNG")
    print(f"Saved: {output_path}")

cutout_with_alpha_matting("portrait.jpg", "portrait_cutout.png")
```

> Tune: raise `foreground_threshold` if too much fringe is kept; lower `background_threshold` if background bleeds in. `erode_size` controls how wide the uncertain transition zone is.

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

## remove.bg API (paid — skip if using SAM 2)

The SAM 2 + FBA Matting pipeline above matches or exceeds remove.bg quality at zero cost. Only use this if you need a fast one-liner with no GPU setup, or if the project has a budget for API credits.

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
