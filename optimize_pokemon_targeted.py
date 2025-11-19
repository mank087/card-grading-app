#!/usr/bin/env python3
"""
Pokemon Prompt Targeted Optimization
Aggressive condensation of verbose inspection protocols
"""

import re
from pathlib import Path

def optimize_pokemon_targeted(input_file, output_file):
    """Apply targeted optimization to verbose sections"""

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    original_size = len(content)
    original_lines = len(content.split('\n'))

    print(f"Starting: {original_lines:,} lines, {original_size:,} bytes")

    # Stage 1: Condense edge inspection (5-step protocol)
    print("\n[Stage 1] Condensing edge inspection...")
    pattern = r'🔍 \*\*v4\.2 MANDATORY EDGE INSPECTION PROTOCOL\*\*\n\nFor EACH of the 4 edges, perform this examination sequence:.*?(?=🆕 QUANTITATIVE EDGE ASSESSMENT)'

    replacement = """🔍 **v4.2 MANDATORY EDGE INSPECTION PROTOCOL**

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

    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

    # Stage 2: Condense surface inspection
    print("[Stage 2] Condensing surface inspection...")
    pattern2 = r'🔍 \*\*v4\.2 MANDATORY SURFACE INSPECTION PROTOCOL\*\*\n\nFor front and back surfaces, perform this examination:.*?(?=🆕 QUANTITATIVE SURFACE ASSESSMENT)'

    replacement2 = """🔍 **v4.2 MANDATORY SURFACE INSPECTION PROTOCOL**

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

"""

    content = re.sub(pattern2, replacement2, content, flags=re.DOTALL)

    # Stage 3: Remove verbose "avoid false precision" section
    print("[Stage 3] Condensing instruction warnings...")
    pattern3 = r'\*\*UNACCEPTABLE REPETITIVE PATTERNS:\*\*\n❌ FORBIDDEN:.*?\*\*MANDATORY FOR ALL ANALYSIS:\*\*.*?(?=\n────────────────────────────────────────\nA\. CENTERING)'

    replacement3 = """**REQUIREMENTS:**
• Observe actual card colors/features (never assume)
• Create unique descriptions for each area (no copy-paste)
• Reference specific observable features
• Vary sentence structure
• Explain methodology

────────────────────────────────────────
A. CENTERING"""

    content = re.sub(pattern3, replacement3, content, flags=re.DOTALL)

    # Stage 4: Condense centering decision tree
    print("[Stage 4] Condensing centering methodology...")
    pattern4 = r'\*\*DECISION TREE:\*\*\n1\. Does card have printed border.*?\*\*METHOD 3: DESIGN ANCHOR WITH ASYMMETRIC COMPENSATION\*\* \(Action shots, artistic designs\).*?(?=\n🆕 CENTERING VALIDATION CHECKS:)'

    replacement4 = """**METHODOLOGY:**
1. **Border present?** → Border Measurement (measure left vs right, top vs bottom)
2. **No border, design anchors?** → Design Anchor Method (use logos/text as reference)
3. **Full-bleed asymmetric?** → Asymmetric Compensation (focus on composition shift)

"""

    content = re.sub(pattern4, replacement4, content, flags=re.DOTALL)

    # Stage 5: Condense examples
    print("[Stage 5] Condensing examples...")
    pattern5 = r'Example 1: \*\*Reverse Holo Common\*\*.*?Example 5: \*\*1st Edition Shadowless\*\*.*?\(Additional examples omitted for brevity\)'

    replacement5 = """**EXAMPLES:**
- Reverse Holo: Check back for "Reverse Holofoil" text
- Full Art: Artwork to edges, "Full Art" designation
- Rainbow Rare: Rainbow pattern, card# > set# (e.g., 234/198)

(Additional examples omitted for brevity)"""

    content = re.sub(pattern5, replacement5, content, flags=re.DOTALL)

    # Stage 6: Final cleanup
    print("[Stage 6] Final cleanup...")
    content = final_cleanup(content)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)

    final_size = len(content)
    final_lines = len(content.split('\n'))

    lines_saved = original_lines - final_lines
    bytes_saved = original_size - final_size
    percent_reduction = (bytes_saved / original_size) * 100

    print(f"\n{'='*60}")
    print(f"OPTIMIZATION COMPLETE")
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
    # Restore from backup first
    import shutil
    backup_file = Path("prompts/pokemon_conversational_grading_v4_2_BACKUP_BEFORE_OPTIMIZATION_2025-11-18.txt")
    target_file = Path("prompts/pokemon_conversational_grading_v4_2.txt")

    print("Restoring from backup...")
    shutil.copy(backup_file, target_file)

    print("="*60)
    print("POKEMON PROMPT TARGETED OPTIMIZATION")
    print("="*60)

    optimize_pokemon_targeted(target_file, target_file)
    print("\nOptimization complete!")
