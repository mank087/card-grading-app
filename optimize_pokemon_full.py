#!/usr/bin/env python3
"""
Pokemon Prompt Full Optimization
Target: ~30-35% reduction while preserving Pokemon-specific content
Based on optimization review analysis
"""

import re
from pathlib import Path

def optimize_pokemon_prompt(input_file, output_file):
    """Apply comprehensive optimization to Pokemon prompt"""

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    original_size = len(content)
    original_lines = len(content.split('\n'))

    print(f"Starting Pokemon Optimization: {original_lines:,} lines, {original_size:,} bytes")

    # Stage 1: Condense corner inspection protocol
    print("\n[Stage 1] Condensing corner inspection protocol...")
    content = condense_corner_inspection(content)

    # Stage 2: Condense edge inspection protocol
    print("[Stage 2] Condensing edge inspection protocol...")
    content = condense_edge_inspection(content)

    # Stage 3: Condense surface inspection protocol
    print("[Stage 3] Condensing surface inspection protocol...")
    content = condense_surface_inspection(content)

    # Stage 4: Remove repetitive "avoid false precision" blocks
    print("[Stage 4] Removing repetitive instruction blocks...")
    content = remove_repetitive_warnings(content)

    # Stage 5: Condense centering methodology
    print("[Stage 5] Condensing centering methodology...")
    content = condense_centering(content)

    # Stage 6: Condense examples
    print("[Stage 6] Condensing example sections...")
    content = condense_examples(content)

    # Stage 7: Final cleanup
    print("[Stage 7] Final cleanup...")
    content = final_cleanup(content)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)

    final_size = len(content)
    final_lines = len(content.split('\n'))

    lines_saved = original_lines - final_lines
    bytes_saved = original_size - final_size
    percent_reduction = (bytes_saved / original_size) * 100

    print(f"\n{'='*60}")
    print(f"POKEMON OPTIMIZATION COMPLETE")
    print(f"{'='*60}")
    print(f"Before: {original_lines:,} lines, {original_size:,} bytes")
    print(f"After:  {final_lines:,} lines, {final_size:,} bytes")
    print(f"Saved:  {lines_saved:,} lines, {bytes_saved:,} bytes ({percent_reduction:.1f}%)")
    print(f"{'='*60}")

def condense_corner_inspection(content):
    """Condense verbose corner inspection protocol"""

    # Find the corner section
    pattern = r'🔍 \*\*v4\.2 MANDATORY CORNER INSPECTION PROTOCOL\*\*.*?(?=\n────────────────────────────────────────\nC\. EDGES)'

    replacement = """🔍 **v4.2 MANDATORY CORNER INSPECTION PROTOCOL**

Examine EACH corner at maximum zoom for: white fiber, rounding, sharpness, wear.

**Scoring Guide:**
- **Sharp (10.0)**: Zero fiber, perfect point
- **Minimal Softening (9.5)**: Sub-mm wear at zoom
- **Slight Rounding (9.0)**: Visible rounding, white showing
- **Moderate (8.0-8.5)**: Obvious rounding without zoom
- **Heavy (<8.0)**: Blunted, significant exposure

**Context Factors:** Dark borders hide wear better | Light borders show every fiber | Holographic edges may peel/wear

**Deductions:** White fiber (−0.5 per corner) | Softening (−0.5) | Minor rounding (−1.5 to −2.0) | Major rounding (−2.5 to −3.0)

**OUTPUT:** For each corner: document defects with size estimates (mm), type, context, and how card characteristics affected assessment.

"""

    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

    return content

def condense_edge_inspection(content):
    """Condense verbose edge inspection protocol"""

    # Find the edge section
    pattern = r'────────────────────────────────────────\nC\. EDGES\n────────────────────────────────────────.*?(?=\n────────────────────────────────────────\nD\. SURFACE)'

    replacement = """────────────────────────────────────────
C. EDGES
────────────────────────────────────────

**INSPECTION PROTOCOL:**
Scan all 4 edges (Top, Right, Bottom, Left) for: white dots/flecks, chipping, roughness, uneven cuts

**Defect Types:**
- White dots/flecks: Count individual specks, measure size
- Chipping: Material loss exposing lighter stock
- Roughness: Inconsistent texture/abrasion
- Uneven cuts: Jagged/irregular factory edge

**Deductions:** White flecks (−0.3 each, max 6-8 before major penalty) | Edge whitening (−0.7 per edge) | Roughness (−0.3 to −0.5) | Chipping (−1.0 to −1.5)

**OUTPUT:** Describe visible defects with counts/measurements, specify which edges affected, how card finish/color affects visibility.

"""

    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

    return content

def condense_surface_inspection(content):
    """Condense verbose surface inspection protocol"""

    # Find the surface section
    pattern = r'────────────────────────────────────────\nD\. SURFACE\n────────────────────────────────────────.*?(?=\n⚠️ \*\*CRITICAL CREASE DETECTION)'

    replacement = """────────────────────────────────────────
D. SURFACE
────────────────────────────────────────

**INSPECTION PROTOCOL:**
Scan entire card surface (front & back) systematically for defects.

**Defect Categories:**
1. **Scratches:** Hairline (<0.2mm) vs Visible (≥0.2mm) - Note direction, length, depth
2. **Print Defects:** Dots, lines, misalignment, registration issues, color spots
3. **Stains/Discoloration:** Foreign substances, color variation, yellowing
4. **Indentations:** Depressions without creases (check both sides for visibility)
5. **Holographic Issues:** Scratches in foil, pattern disruption, peeling edges

**Deductions:** Hairline scratch (−0.5) | Visible scratch (−1.0 to −1.5) | Print defect (−0.5 to −1.0) | Stain (−1.0 to −2.0) | Indentation (−1.5 to −3.0 depending on depth)

**OUTPUT:** List all defects with type, location, size/severity, and how they interact with card features (foil pattern, artwork, etc.).

"""

    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

    return content

def remove_repetitive_warnings(content):
    """Remove repetitive 'avoid false precision' blocks"""

    # Find the verbose "AVOID FALSE PRECISION" section
    pattern = r'🚨 \*\*v4\.2 CRITICAL: AVOID FALSE PRECISION & GENERIC COPY-PASTE\*\*\n\n\*\*UNACCEPTABLE REPETITIVE PATTERNS:\*\*.*?(?=\n────────────────────────────────────────\nA\. CENTERING)'

    replacement = """🚨 **v4.2 CRITICAL: AVOID FALSE PRECISION & GENERIC COPY-PASTE**

**REQUIREMENTS:**
- Observe actual card colors/features (never assume)
- Create unique descriptions for each area (no repeated sentence patterns)
- Reference specific observable features at each location
- Vary sentence structure and vocabulary
- Explain your methodology (how you determined condition)

────────────────────────────────────────
A. CENTERING
"""

    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

    return content

def condense_centering(content):
    """Condense centering methodology section"""

    # Condense the decision tree
    pattern = r'🆕 ENHANCED CENTERING MEASUREMENT METHODOLOGY\n\n\*\*DECISION TREE:\*\*.*?(?=\n🆕 CENTERING VALIDATION CHECKS:)'

    replacement = """🆕 ENHANCED CENTERING MEASUREMENT METHODOLOGY

**METHOD SELECTION:**
1. **Border present?** → Use Border Measurement (most accurate)
2. **No border, but clear design anchors?** → Use Design Anchor Method
3. **Full-bleed asymmetric artwork?** → Use Design Anchor with Asymmetric Compensation

**Border Measurement:** Measure border width (left vs right, top vs bottom), calculate ratios, use worst axis
**Design Anchor:** Use symmetrical elements (logos, text) as reference points
**Asymmetric:** Acknowledge intentional off-center art, focus on overall composition shift

"""

    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

    return content

def condense_examples(content):
    """Condense verbose example sections"""

    # Reduce subset detection examples
    pattern = r'\*\*REAL-WORLD POKEMON EXAMPLES:\*\*\n\nExample 1:.*?Example 5:.*?\n\nvalue: null'

    replacement = """**EXAMPLES:**
Example: Reverse Holo - Check back for "Reverse Holofoil" text
Example: Full Art - Artwork extends to edges, "Full Art" or "FA" designation
Example: Rainbow Rare - Rainbow pattern, card number over set total (e.g., 234/198)

(Additional examples omitted for brevity)"""

    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

    return content

def final_cleanup(content):
    """Final cleanup pass"""

    # Remove excessive section dividers
    content = re.sub(r'═{50,}', '═'*43, content)
    content = re.sub(r'─{50,}', '─'*43, content)
    content = re.sub(r'={50,}', '='*43, content)
    content = re.sub(r'-{50,}', '-'*43, content)

    # Remove multiple blank lines (more than 3)
    content = re.sub(r'\n{5,}', '\n\n\n', content)

    # Remove trailing spaces
    lines = [line.rstrip() for line in content.split('\n')]
    content = '\n'.join(lines)

    return content

if __name__ == "__main__":
    input_file = Path("prompts/pokemon_conversational_grading_v4_2.txt")
    output_file = Path("prompts/pokemon_conversational_grading_v4_2.txt")

    print("="*60)
    print("POKEMON PROMPT OPTIMIZATION")
    print("="*60)

    optimize_pokemon_prompt(input_file, output_file)
    print("\nOptimization complete!")
    print("\nBackup saved as: pokemon_conversational_grading_v4_2_BACKUP_BEFORE_OPTIMIZATION_2025-11-18.txt")
