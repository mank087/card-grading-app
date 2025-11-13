# Stage 1 Card Observation and Analysis (OpenCV)

This module performs pixel-first analysis of trading card images. It is designed to be used before your LLM grading step.

## Features
- Card detection, perspective correction, and normalization
- Centering measurement as left/right and top/bottom ratios and border thickness in pixels
- Edge whitening and chip detection per side and per segment
- Corner rounding and whitening estimation per corner
- Surface analysis for white dots, scratches, and crease-like lines
- Sleeve/top-loader/slab indicators and glare masking
- Focus, lighting uniformity, and color bias diagnostics
- JSON output plus overlay images for UI visualization

## Install
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install opencv-python numpy
```

## Run
```bash
python card_cv_stage1.py --front path/to/front.jpg --back path/to/back.jpg --outdir ./out
```

Outputs will include:
- stage1_metrics.json with structured metrics
- front_normalized.png, back_normalized.png
- front_overlay.png, back_overlay.png
- front_glare_mask.png, back_glare_mask.png
- front_card_mask.png, back_card_mask.png

## Feeding into your LLM
Pass stage1_metrics.json and the normalized images to your LLM with an instruction such as:
- "Use numeric metrics when present, fall back to visual estimation only when a metric is missing or marked obstructed."
- Apply your grading caps and uncertainty logic based on sleeve flags and glare percentages.
