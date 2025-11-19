#!/usr/bin/env python3
"""
Other Prompt Targeted Optimization
Aggressive condensation of verbose inspection protocols and anti-repetition warnings
Highest optimization potential: 20-22% reduction (minimal unique content to preserve)
"""

import re
from pathlib import Path
import shutil

def optimize_other_targeted(input_file, output_file):
    """Apply targeted optimization to verbose sections"""

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    original_size = len(content)
    original_lines = len(content.split('\n'))

    print(f"Starting: {original_lines:,} lines, {original_size:,} bytes")

    # Stage 1: Condense corner inspection protocol (including anti-repetition warnings)
    print("\n[Stage 1] Condensing corner inspection protocol...")
    pattern1 = r'🔍 \*\*v4\.2 MANDATORY CORNER INSPECTION PROTOCOL\*\*.*?(?=────────────────────────────────────────\nC\. EDGES)'

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

**REQUIREMENTS:** For each corner, observe actual colors/features (never assume), create unique descriptions, vary sentence structure, reference specific observable features.

**OUTPUT:** For each corner: document defects with size estimates (mm), type, context, and how card characteristics affected assessment.

"""

    content = re.sub(pattern1, replacement1, content, flags=re.DOTALL)

    # Stage 2: Condense edge inspection protocol (including anti-repetition warnings)
    print("[Stage 2] Condensing edge inspection protocol...")
    pattern2 = r'🔍 \*\*v4\.2 MANDATORY EDGE INSPECTION PROTOCOL\*\*.*?(?=────────────────────────────────────────\nD\. SURFACE)'

    replacement2 = """🔍 **v4.2 MANDATORY EDGE INSPECTION PROTOCOL**

**SCAN METHODOLOGY:** Examine all 4 edges at max zoom for white flecks/fiber, chipping, roughness.

**Scoring:**
- **Perfect (10.0)**: Zero white, clean factory cut, smooth edge
- **Excellent (9.5)**: Minor white fleck(s), otherwise clean
- **Very Good (9.0)**: Light whitening, multiple small fiber areas
- **Good (8.0-8.5)**: Moderate whitening, continuous exposure
- **Fair (<8.0)**: Heavy whitening, chipping, rough/damaged

**Deductions:** White flecks (−0.3 each) | Edge whitening (−0.7 per edge) | Chipping (−1.5 to −2.0)

**Context:** Dark borders show white clearly | Light borders need careful examination | Modern cards (2000+) should have clean cuts | Vintage may have rougher factory cuts

**REQUIREMENTS:** For each edge, describe actual colors at edge (never generic "dark border"), reference edge-specific features, use unique descriptions, vary sentence structure.

**OUTPUT:** For each edge: describe visible defects with location/measurements, specify which edges affected, how card finish/color affects visibility.

"""

    content = re.sub(pattern2, replacement2, content, flags=re.DOTALL)

    # Stage 3: Condense surface inspection protocol
    print("[Stage 3] Condensing surface inspection protocol...")
    pattern3 = r'🔍 \*\*v4\.2 MANDATORY SURFACE DEFECT DETECTION PROTOCOL\*\*.*?(?=⚠️ \*\*CRITICAL CREASE DETECTION|\[STEP 4\])'

    replacement3 = """🔍 **v4.2 MANDATORY SURFACE DEFECT DETECTION PROTOCOL**

**SCAN METHODOLOGY:** Examine entire card surface systematically for defects.

**Defect Types:**
- **Scratches:** Hairline (<0.2mm) vs Visible (≥0.2mm)
- **Print defects:** Dots, lines, misalignment, registration issues
- **Stains:** Foreign substance, discoloration
- **Indentations:** Depressions without creases
- **Holographic issues:** Foil scratches, pattern disruption

**Scoring:**
- **Perfect (10.0)**: Zero defects
- **Excellent (9.5)**: 1-2 hairline scratches
- **Very Good (9.0)**: 1 visible scratch OR 3+ hairlines
- **Good (8.0-8.5)**: Multiple scratches or print defects

**Deductions:** Hairline (−0.5) | Visible scratch (−1.0 to −1.5) | Print defect (−0.5 to −1.0) | Stain (−1.0 to −2.0) | Indentation (−1.5 to −3.0)

**Finish-Specific:** Refractor/Prizm/Chrome (check pattern disruption) | Matte (glossy spots from wear) | Glossy (dull spots/scuffing)

**OUTPUT:** List all defects with type, location, size/severity, and how they interact with card features (finish, artwork, etc.).

"""

    content = re.sub(pattern3, replacement3, content, flags=re.DOTALL)

    # Stage 4: Final cleanup
    print("[Stage 4] Final cleanup...")
    content = final_cleanup(content)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)

    final_size = len(content)
    final_lines = len(content.split('\n'))

    lines_saved = original_lines - final_lines
    bytes_saved = original_size - final_size
    percent_reduction = (bytes_saved / original_size) * 100

    print(f"\n{'='*60}")
    print(f"OTHER OPTIMIZATION COMPLETE")
    print(f"{'='*60}")
    print(f"Before: {original_lines:,} lines, {original_size:,} bytes")
    print(f"After:  {final_lines:,} lines, {final_size:,} bytes")
    print(f"Saved:  {lines_saved:,} lines, {bytes_saved:,} bytes ({percent_reduction:.1f}%)")
    print(f"{'='*60}")

def final_cleanup(content):
    """Cleanup excessive spacing and dividers"""

    # Normalize dividers
    content = re.sub(r'═{50,}', '═'*79, content)
    content = re.sub(r'─{50,}', '─'*44, content)

    # Remove excessive blank lines
    content = re.sub(r'\n{5,}', '\n\n\n', content)

    # Remove trailing spaces
    lines = [line.rstrip() for line in content.split('\n')]
    content = '\n'.join(lines)

    return content

if __name__ == "__main__":
    # Create backup first
    backup_file = Path("prompts/other_conversational_grading_v4_2_BACKUP_BEFORE_OPTIMIZATION_2025-11-18.txt")
    target_file = Path("prompts/other_conversational_grading_v4_2.txt")

    print("="*60)
    print("OTHER PROMPT TARGETED OPTIMIZATION")
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
    optimize_other_targeted(target_file, target_file)
    print("\nOptimization complete!")
    print(f"Backup available at: {backup_file}")
