#!/usr/bin/env python3
"""
Pass 2: Aggressive v4.2 Optimization
Target: Additional 10-15% reduction
"""

import re
from pathlib import Path

def optimize_pass2(input_file, output_file):
    """Second aggressive optimization pass"""

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    original_size = len(content)
    original_lines = len(content.split('\n'))

    print(f"Pass 2 Starting: {original_lines:,} lines, {original_size:,} bytes")

    # Stage 1: Consolidate verbose methodology sections
    print("\n[Stage 1] Condensing methodology sections...")
    content = condense_methodologies(content)

    # Stage 2: Reduce corner/edge analysis requirements
    print("[Stage 2] Streamlining analysis requirements...")
    content = streamline_analysis_requirements(content)

    # Stage 3: Consolidate OUTPUT FORMAT sections
    print("[Stage 3] Compacting output format sections...")
    content = compact_output_formats(content)

    # Stage 4: Reduce holder type recognition verbosity
    print("[Stage 4] Condensing holder detection...")
    content = condense_holder_detection(content)

    # Stage 5: Simplify image quality criteria
    print("[Stage 5] Streamlining image quality...")
    content = streamline_image_quality(content)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)

    final_size = len(content)
    final_lines = len(content.split('\n'))

    lines_saved = original_lines - final_lines
    bytes_saved = original_size - final_size
    percent_reduction = (bytes_saved / original_size) * 100

    print(f"\n{'='*60}")
    print(f"PASS 2 COMPLETE")
    print(f"{'='*60}")
    print(f"Before Pass 2: {original_lines:,} lines, {original_size:,} bytes")
    print(f"After Pass 2:  {final_lines:,} lines, {final_size:,} bytes")
    print(f"This Pass:     {lines_saved:,} lines ({percent_reduction:.1f}%)")
    print(f"{'='*60}")

def condense_methodologies(content):
    """Consolidate verbose methodology walkthroughs"""

    # Reduce METHOD 1, 2, 3 verbosity in centering
    compact_methods = """**METHOD 1: BORDER MEASUREMENT** (card has printed border)
Measure border widths L/R and T/B, calculate ratios, use worst axis.

**METHOD 2: DESIGN ANCHOR** (no border, clear elements)
Use logos/nameplates/patterns as reference, measure to edges.

**METHOD 3: ASYMMETRIC DESIGN** (action shots, artistic)
Find available anchors, assign conservative scores (cap 9.0), note "Asymmetric design limits precision"."""

    pattern = r'\*\*METHOD 1: BORDER MEASUREMENT\*\*.*?(?=🆕 CENTERING VALIDATION)'
    content = re.sub(pattern, compact_methods + "\n\n", content, flags=re.DOTALL)

    return content

def streamline_analysis_requirements(content):
    """Reduce verbose "how to analyze" instructions"""

    # Consolidate the verbose "METHODOLOGY FOR CORNER ANALYSIS" section
    compact_corner_methodology = """**CORNER ANALYSIS METHODOLOGY:**
1. Observe corner location + nearby design elements + actual colors
2. Assess geometry (sharp/rounded/blunted, white fiber visible?)
3. Identify color transitions (how wear shows)
4. Note unique features (what makes THIS corner distinct)
5. Vary description (different wording per corner, no copy-paste)

**REQUIREMENTS:** State actual colors | Reference specific features | Unique structure | Explain assessment method"""

    pattern = r'\*\*METHODOLOGY FOR CORNER ANALYSIS:\*\*.*?(?=\*\*OUTPUT FORMAT:\*\*)'
    content = re.sub(pattern, compact_corner_methodology + "\n\n", content, flags=re.DOTALL)

    # Consolidate verbose "HOW TO CREATE ACCEPTABLE OUTPUT" section
    compact_output_guidance = """**ANALYSIS REQUIREMENTS:**
• **Observe actual colors** - Don't assume, state what you see
• **Identify design elements** - Note nearby features at each location
• **Vary sentence structure** - Different opening/verbs per description
• **Unique characteristics** - What makes each area distinct
• **Explain method** - How features helped assessment"""

    pattern = r'\*\*HOW TO CREATE ACCEPTABLE OUTPUT:\*\*.*?(?=\*\*MANDATORY FOR ALL ANALYSIS:\*\*)'
    content = re.sub(pattern, compact_output_guidance + "\n\n", content, flags=re.DOTALL)

    # Consolidate "STEP 1-5" detailed walkthroughs
    pattern = r'\*\*STEP 1: OBSERVE ACTUAL CARD COLORS\*\*.*?(?=\*\*MANDATORY FOR ALL ANALYSIS:\*\*)'
    content = re.sub(pattern, "", content, flags=re.DOTALL)

    return content

def compact_output_formats(content):
    """Consolidate repetitive OUTPUT FORMAT sections"""

    # Many output format sections repeat similar requirements
    # Consolidate into briefer format

    compact_centering_output = """**OUTPUT:**
• left_right: ratio | top_bottom: ratio | method: border-present/design-anchor/asymmetric
• worst_axis: left_right/top_bottom | score: 0-10
• analysis: MINIMUM 2 SENTENCES - (1) Measured ratios + worst axis (2) How measured (borders/features used, card characteristics)"""

    pattern = r'\*\*OUTPUT FORMAT:\*\*\n• left_right:.*?(?=\n────────────────────────────────────────────\nB\. CORNERS)'
    content = re.sub(pattern, compact_centering_output + "\n\n", content, flags=re.DOTALL)

    compact_corner_output = """**OUTPUT:** For each corner (top_left, top_right, bottom_left, bottom_right):
• condition: MIN 2 SENTENCES - (1) Describe with actual colors/elements (2) How characteristics affect assessment
• defects: Array of issues or []
• summary: MIN 2 SENTENCES - (1) Overall condition (2) How determined grade
• score: 0-10"""

    pattern = r'\*\*OUTPUT FORMAT:\*\*\nFor each corner.*?(?=\n────────────────────────────────────────────\nC\. EDGES)'
    content = re.sub(pattern, compact_corner_output + "\n\n", content, flags=re.DOTALL)

    return content

def condense_holder_detection(content):
    """Reduce verbose holder type descriptions"""

    compact_holder = """**HOLDER TYPE RECOGNITION:**

**none** (raw): No plastic, edges visible | **penny_sleeve**: Thin plastic, subtle glare | **top_loader**: Rigid plastic, open top | **one_touch**: Magnetic, often colored borders | **semi_rigid**: Stiff plastic sandwich | **slab**: Professional case with label

Impact on uncertainty: none → minor (±0.25) → moderate (±0.5) → high (±1.0)

🚨 **MANDATORY JSON OUTPUT:** Include "case_detection" object with: case_type, visibility, impact_level, notes

────────────────────────────────────────────
IMAGE CONFIDENCE TO UNCERTAINTY MAPPING"""

    pattern = r'🆕 HOLDER TYPE RECOGNITION\n────────────────────────────────────────────.*?(?=IMAGE CONFIDENCE TO UNCERTAINTY MAPPING)'
    content = re.sub(pattern, compact_holder + "\n", content, flags=re.DOTALL)

    return content

def streamline_image_quality(content):
    """Reduce verbose image quality criteria tables"""

    compact_image_quality = """Rate visual clarity and assign confidence letter.

**RATING CRITERIA:**

| Grade | Key Characteristics | Confidence | Uncertainty |
|-------|---------------------|------------|-------------|
| **A (Excellent)** | All features visible, <10% glare, sharp focus, even lighting, micro-defects assessable | A | ±0.25 |
| **B (Good)** | Most visible, 10-30% glare, good clarity, uneven/moderate shadows | B | ±0.5 |
| **C (Fair)** | Major features visible, 30-60% glare, noticeable blur, heavy shadows | C | ±1.0 |
| **D (Poor)** | Limited visibility, >60% glare, severe blur, one side missing | D | ±1.5 |

🆕 **Grade A Requirements:** <10% glare, high-res zoom capable, even lighting, all 4 corners visible, sub-mm defects detectable

Protective holders (penny sleeves, top loaders, one-touch, semi-rigid, slabs) acceptable if card fully visible."""

    pattern = r'Rate overall visual clarity and assign image confidence letter\..*?(?=────────────────────────────────────────────\nCLEAR DEFINITIONS)'
    content = re.sub(pattern, compact_image_quality + "\n\n", content, flags=re.DOTALL)

    # Consolidate "CLEAR DEFINITIONS - WHAT DISQUALIFIES GRADE A"
    compact_disqualifiers = """**GRADE A DISQUALIFIERS:**
• **Obstruction:** Any corner/edge hidden or cut off
• **Glare:** >20% surface glare
• **Lighting:** Heavy shadows >25%, color distortion
• **Focus:** Cannot read small text or assess texture

**Protective Cases Grade A OK If:** Full visibility, <20% glare, all corners visible"""

    pattern = r'────────────────────────────────────────────\nCLEAR DEFINITIONS - WHAT DISQUALIFIES GRADE A\n────────────────────────────────────────────.*?(?=🆕 PATCH 9:)'
    content = re.sub(pattern, compact_disqualifiers + "\n\n", content, flags=re.DOTALL)

    return content

if __name__ == "__main__":
    input_file = Path("prompts/conversational_grading_v4_2_ENHANCED_STRICTNESS.txt")
    output_file = Path("prompts/conversational_grading_v4_2_ENHANCED_STRICTNESS.txt")

    print("="*60)
    print("PASS 2: AGGRESSIVE OPTIMIZATION")
    print("="*60)

    optimize_pass2(input_file, output_file)
    print("\nPass 2 complete!")
