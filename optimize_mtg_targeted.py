#!/usr/bin/env python3
"""
MTG Prompt Targeted Optimization
Aggressive condensation of verbose inspection protocols
Preserves critical MTG-specific content (foil inspection, card types, mana system)
"""

import re
from pathlib import Path
import shutil

def optimize_mtg_targeted(input_file, output_file):
    """Apply targeted optimization to verbose sections"""

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    original_size = len(content)
    original_lines = len(content.split('\n'))

    print(f"Starting: {original_lines:,} lines, {original_size:,} bytes")

    # Stage 1: Condense corner inspection protocol
    print("\n[Stage 1] Condensing corner inspection protocol...")
    pattern1 = r'🔍 \*\*v4\.2 MANDATORY CORNER INSPECTION PROTOCOL\*\*\n\nFor EACH of the 4 corners, perform this examination sequence:.*?(?=🆕 QUANTITATIVE CORNER ASSESSMENT|────────────────────────────────────────\nC\. EDGES)'

    replacement1 = """🔍 **v4.2 MANDATORY CORNER INSPECTION PROTOCOL**

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

    content = re.sub(pattern1, replacement1, content, flags=re.DOTALL)

    # Stage 2: Condense edge inspection protocol
    print("[Stage 2] Condensing edge inspection protocol...")
    pattern2 = r'🔍 \*\*v4\.2 MANDATORY EDGE INSPECTION PROTOCOL\*\*\n\nFor EACH of the 4 edges.*?(?=🆕 QUANTITATIVE EDGE ASSESSMENT|────────────────────────────────────────\nD\. SURFACE)'

    replacement2 = """🔍 **v4.2 MANDATORY EDGE INSPECTION PROTOCOL**

**SCAN METHODOLOGY:** Examine all 4 edges at max zoom for white flecks/fiber, chipping, roughness.

**Scoring:**
- **Perfect (10.0)**: Zero white, clean factory cut, smooth edge
- **Excellent (9.5)**: Minor white fleck(s), otherwise clean
- **Very Good (9.0)**: Light whitening, multiple small fiber areas
- **Good (8.0-8.5)**: Moderate whitening, continuous exposure
- **Fair (<8.0)**: Heavy whitening, chipping, rough/damaged

**Deductions:** White flecks (−0.3 each) | Edge whitening (−0.7 per edge) | Chipping (−1.5 to −2.0)

**Context:** Dark borders show white clearly | Light borders need careful examination | Modern cards (2000+) should have clean cuts

"""

    content = re.sub(pattern2, replacement2, content, flags=re.DOTALL)

    # Stage 3: Condense surface inspection protocol (PRESERVE FOIL GUIDANCE)
    print("[Stage 3] Condensing surface inspection protocol (preserving foil guidance)...")
    pattern3 = r'🔍 \*\*v4\.2 MANDATORY SURFACE INSPECTION PROTOCOL\*\*\n\nFor front and back surfaces, perform this examination:.*?(?=🆕 QUANTITATIVE SURFACE ASSESSMENT|⚠️ \*\*CRITICAL CREASE DETECTION)'

    replacement3 = """🔍 **v4.2 MANDATORY SURFACE INSPECTION PROTOCOL**

**SCAN METHODOLOGY:** Examine entire card surface systematically for defects.

**Defect Types:**
- **Scratches:** Hairline (<0.2mm) vs Visible (≥0.2mm)
- **Print defects:** Dots, lines, misalignment, registration issues
- **Stains:** Foreign substance, discoloration
- **Indentations:** Depressions without creases
- **Holographic/Foil issues:** 🚨 CRITICAL FOR MTG - Foil scratches, pattern disruption, curling, peeling edges (foils very common in MTG)

**Scoring:**
- **Perfect (10.0)**: Zero defects
- **Excellent (9.5)**: 1-2 hairline scratches
- **Very Good (9.0)**: 1 visible scratch OR 3+ hairlines
- **Good (8.0-8.5)**: Multiple scratches or print defects

**Deductions:** Hairline (−0.5) | Visible scratch (−1.0 to −1.5) | Print defect (−0.5 to −1.0) | Stain (−1.0 to −2.0) | Indentation (−1.5 to −3.0) | Foil damage (−1.0 to −2.5 depending on severity)

**MTG FOIL INSPECTION:** Check foil layer integrity, look for peeling at edges, assess curling (common with older foils), check for pattern disruption.

"""

    content = re.sub(pattern3, replacement3, content, flags=re.DOTALL)

    # Stage 4: Condense "Avoid False Precision" section
    print("[Stage 4] Condensing instruction warnings...")
    pattern4 = r'🚨 \*\*v4\.2 CRITICAL: AVOID FALSE PRECISION & GENERIC COPY-PASTE\*\*\n\n\*\*UNACCEPTABLE REPETITIVE PATTERNS:\*\*.*?(?=\n────────────────────────────────────────\nA\. CENTERING|🆕 ENHANCED CENTERING)'

    replacement4 = """🚨 **v4.2 CRITICAL: AVOID FALSE PRECISION & GENERIC COPY-PASTE**

**REQUIREMENTS:**
• Observe actual card colors/features (never assume)
• Create unique descriptions for each area (no copy-paste)
• Reference specific observable features
• Vary sentence structure
• Explain methodology

────────────────────────────────────────
A. CENTERING"""

    content = re.sub(pattern4, replacement4, content, flags=re.DOTALL)

    # Stage 5: Condense centering methodology decision tree
    print("[Stage 5] Condensing centering methodology...")
    pattern5 = r'🆕 ENHANCED CENTERING MEASUREMENT METHODOLOGY\n\n\*\*DECISION TREE:\*\*\n1\. Does card have printed border.*?(?=\n🆕 CENTERING VALIDATION CHECKS:)'

    replacement5 = """🆕 ENHANCED CENTERING MEASUREMENT METHODOLOGY

**METHODOLOGY:**
1. **Border present?** → Border Measurement (measure left vs right, top vs bottom)
2. **No border, design anchors?** → Design Anchor Method (use logos/text as reference)
3. **Full-bleed asymmetric?** → Asymmetric Compensation (focus on composition shift)

"""

    content = re.sub(pattern5, replacement5, content, flags=re.DOTALL)

    # Stage 6: Condense foreign language examples
    print("[Stage 6] Condensing foreign language examples...")
    pattern6 = r'\*\*HOW TO HANDLE FOREIGN LANGUAGE CARDS:\*\*\n\nFor cards in other languages.*?Examples:.*?(?=\n\*\*3\. SUBSET|subset_name)'

    replacement6 = """**HOW TO HANDLE FOREIGN LANGUAGE CARDS:**

For non-English cards (Japanese, German, French, Spanish, Italian, Portuguese, Russian, Korean, Chinese):
1. Extract both English and native language versions
2. Use bilingual format: `"name": "English Name / 日本語名"`
3. If English unknown, use: `"name": "Unknown English / Native Language"`

**Examples:** Japanese: `"Lightning Bolt / ライトニング・ボルト"` | German: `"Black Lotus / Schwarzer Lotus"`

"""

    content = re.sub(pattern6, replacement6, content, flags=re.DOTALL)

    # Stage 7: Condense subset detection examples
    print("[Stage 7] Condensing subset detection examples...")
    pattern7 = r'\*\*REAL-WORLD MTG EXAMPLES:\*\*\n\nExample 1:.*?Example 5:.*?\(Additional examples omitted for brevity\)'

    replacement7 = """**MTG SUBSET EXAMPLES:**
- **Foil:** Check foil layer on card surface, may say "Foil" in set info
- **Borderless:** Artwork extends to card edges, no traditional border
- **Showcase:** Alternative art treatment, often with unique frame
- **Extended Art:** Art extends beyond normal frame, typically on rares

(Additional examples omitted for brevity)"""

    content = re.sub(pattern7, replacement7, content, flags=re.DOTALL)

    # Stage 8: Final cleanup
    print("[Stage 8] Final cleanup...")
    content = final_cleanup(content)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)

    final_size = len(content)
    final_lines = len(content.split('\n'))

    lines_saved = original_lines - final_lines
    bytes_saved = original_size - final_size
    percent_reduction = (bytes_saved / original_size) * 100

    print(f"\n{'='*60}")
    print(f"MTG OPTIMIZATION COMPLETE")
    print(f"{'='*60}")
    print(f"Before: {original_lines:,} lines, {original_size:,} bytes")
    print(f"After:  {final_lines:,} lines, {final_size:,} bytes")
    print(f"Saved:  {lines_saved:,} lines, {bytes_saved:,} bytes ({percent_reduction:.1f}%)")
    print(f"{'='*60}")

def final_cleanup(content):
    """Cleanup excessive spacing and dividers"""

    # Normalize dividers
    content = re.sub(r'═{50,}', '═'*43, content)
    content = re.sub(r'─{50,}', '─'*43, content)

    # Remove excessive blank lines
    content = re.sub(r'\n{5,}', '\n\n\n', content)

    # Remove trailing spaces
    lines = [line.rstrip() for line in content.split('\n')]
    content = '\n'.join(lines)

    return content

if __name__ == "__main__":
    # Create backup first
    backup_file = Path("prompts/mtg_conversational_grading_v4_2_BACKUP_BEFORE_OPTIMIZATION_2025-11-18.txt")
    target_file = Path("prompts/mtg_conversational_grading_v4_2.txt")

    print("="*60)
    print("MTG PROMPT TARGETED OPTIMIZATION")
    print("="*60)

    if not backup_file.exists():
        print("\nCreating backup...")
        shutil.copy(target_file, backup_file)
        print(f"Backup saved: {backup_file.name}")
    else:
        print(f"\nBackup already exists: {backup_file.name}")
        print("Restoring from backup before optimization...")
        shutil.copy(backup_file, target_file)

    print()
    optimize_mtg_targeted(target_file, target_file)
    print("\nOptimization complete!")
    print(f"Backup available at: {backup_file}")
