#!/usr/bin/env python3
"""
Pass 2: More Aggressive Prompt Optimization
Target: Additional 20-25% reduction (total 35-40%)
"""

import re
from pathlib import Path

def optimize_pass2(input_file, output_file):
    """Second pass optimization"""

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    original_size = len(content)
    original_lines = len(content.split('\n'))

    print(f"Pass 2 Starting: {original_lines} lines, {original_size:,} bytes")

    # Stage 1: Remove duplicate master section references
    print("\n[Stage 1] Cleaning duplicate references...")
    content = clean_duplicate_references(content)

    # Stage 2: Aggressively consolidate background handling
    print("[Stage 2] Consolidating background handling...")
    content = consolidate_background_section(content)

    # Stage 3: Consolidate defect definitions more aggressively
    print("[Stage 3] Merging defect definitions...")
    content = merge_defect_definitions(content)

    # Stage 4: Reduce slab detection verbosity
    print("[Stage 4] Condensing slab detection...")
    content = condense_slab_detection(content)

    # Stage 5: Consolidate rarity classification
    print("[Stage 5] Streamlining rarity module...")
    content = streamline_rarity_module(content)

    # Stage 6: Condense card orientation section
    print("[Stage 6] Reducing orientation section...")
    content = reduce_orientation_section(content)

    # Stage 7: Merge all validation checkboxes
    print("[Stage 7] Unifying validation checkboxes...")
    content = unify_checkboxes(content)

    # Stage 8: Remove excessive dividers and whitespace
    print("[Stage 8] Cleaning formatting...")
    content = clean_formatting(content)

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
    print(f"This Pass:     {lines_saved:,} lines, {bytes_saved:,} bytes ({percent_reduction:.1f}%)")
    print(f"{'='*60}")

def clean_duplicate_references(content):
    """Remove consecutive duplicate references"""

    # Remove duplicate reference lines
    lines = content.split('\n')
    cleaned_lines = []
    prev_line = ""

    for line in lines:
        # Skip if this line is a duplicate reference
        if line.strip() == prev_line.strip() and "See" in line and "PROTOCOL" in line:
            continue
        cleaned_lines.append(line)
        prev_line = line

    return '\n'.join(cleaned_lines)

def consolidate_background_section(content):
    """Dramatically reduce the background handling section"""

    compact_background = """
===========================================
BACKGROUND AND ENVIRONMENTAL HANDLING
===========================================

**CRITICAL: Grade ONLY the card itself (or card + holder if encased)**

IGNORE COMPLETELY:
- Table surfaces, backgrounds, fingers holding card
- Background objects, shadows cast BY card
- Lighting equipment, photography setup

FOCUS ON:
- Card edges (or holder edges if encased)
- Card surface defects (not case scratches)
- Defects visible THROUGH holder

IF UNCLEAR: Increase grade_uncertainty +0.5, document limitation

VALIDATION: □ Identified subject boundary □ Ignored background elements
===========================================
"""

    # Replace verbose section (lines 92-229 approximately)
    pattern = r'===========================================\s*BACKGROUND AND ENVIRONMENTAL HANDLING\s*===========================================.*?(?=\n===========================================\nII\.)'

    content = re.sub(pattern, compact_background, content, flags=re.DOTALL)

    return content

def merge_defect_definitions(content):
    """Consolidate all defect type definitions into one compact section"""

    compact_defects = """
**DEFECT TAXONOMY (Use Universal Severity Scale: Microscopic <0.1mm | Minor 0.1-0.3mm | Moderate 0.3-1mm | Heavy >1mm)**

- **Whitening**: Visible white/exposed stock at corner/edge. Severity by length.
- **Chipping**: Edge material loss exposing lighter base. Severity by size.
- **Abrasion**: Dull patch, loss of gloss. Severity: Microscopic <2mm, Minor 2-5mm, Moderate 5-10mm, Heavy >10mm.
- **Crease**: Fold line through card. Light (4.5 cap) | Moderate (3.0 cap) | Heavy (2.0 cap).
- **Print Dot**: Contrasting pixel ≥0.1mm not in design.
- **Scratch**: Hairline <0.2mm wide/<5mm long. Visible ≥0.2mm wide or ≥5mm long.
- **Rounding**: Corner curve radius. Minor 0.2-0.5mm | Moderate 0.5-1mm | Heavy >1mm.
- **Centering**: (Narrower ÷ Wider) × 100. Example: 45/55.
"""

    # Replace verbose defect definitions section
    pattern = r'DEFECT-SPECIFIC DEFINITIONS\s*----------------------------.*?(?=\n---\n)'

    content = re.sub(pattern, compact_defects, content, flags=re.DOTALL)

    return content

def condense_slab_detection(content):
    """Reduce slab detection section by 50%"""

    compact_slab = """
**PROFESSIONAL GRADING SLAB DETECTION**

IF CARD IN SLAB: Extract label info (company, grade, cert#) + STILL perform full AI grading.

Companies: PSA (red label) | BGS (black) | CGC (blue/orange) | SGC (black) | TAG | HGA | CSG

Extract if visible: Grade, cert#, player name, subgrades (BGS/CGC)

Compare: If AI grade differs ±1.0 from professional → note in comments (slab may obstruct view)

Output schema: slab_detected (true/false), company, grade, cert_number, subgrades, notes
"""

    pattern = r'PROFESSIONAL GRADING SLAB DETECTION\s*------------------------------------.*?(?=\n===========================================\nIII\.)'

    content = re.sub(pattern, compact_slab, content, flags=re.DOTALL)

    return content

def streamline_rarity_module(content):
    """Reduce rarity classification by consolidating examples"""

    # Remove verbose tier examples, keep just the scoring table
    pattern = r'Example 1 - Event-Specific Topps NOW:.*?Example 5.*?(?=\nCARD ORIENTATION)'

    content = re.sub(pattern, '(Rarity examples available in documentation)\n\n', content, flags=re.DOTALL)

    return content

def reduce_orientation_section(content):
    """Condense card orientation section"""

    compact_orientation = """
**CARD ORIENTATION DETECTION**

Measure aspect ratio: Width ÷ Height
- Portrait (H>W, ratio >1.1): L/R centering primary
- Landscape (W>H, ratio >1.1): T/B centering primary
- Square (0.9-1.1): Treat as portrait

Both axes measured; worst ratio determines grade cap.
"""

    pattern = r'CARD ORIENTATION DETECTION\s*--------------------------.*?(?=\nPROFESSIONAL GRADING SLAB)'

    content = re.sub(pattern, compact_orientation, content, flags=re.DOTALL)

    return content

def unify_checkboxes(content):
    """Merge multiple validation checkbox sections"""

    # Find all checkbox sections
    checkbox_sections = list(re.finditer(r'VALIDATION CHECKPOINT.*?(?=\n[A-Z=])', content, re.DOTALL))

    if len(checkbox_sections) > 1:
        # Keep only the most comprehensive one, remove others
        for section in checkbox_sections[1:]:
            content = content[:section.start()] + "(See master validation checklist above)\n" + content[section.end():]

    return content

def clean_formatting(content):
    """Remove excessive dividers and whitespace"""

    # Replace multiple dividers with single
    content = re.sub(r'(=+\n){3,}', '='*43 + '\n', content)
    content = re.sub(r'(-+\n){3,}', '-'*43 + '\n', content)

    # Remove excessive blank lines (more than 2 consecutive)
    content = re.sub(r'\n{4,}', '\n\n\n', content)

    # Remove trailing whitespace
    lines = [line.rstrip() for line in content.split('\n')]
    content = '\n'.join(lines)

    return content

if __name__ == "__main__":
    input_file = Path("prompts/card_grader_v1.txt")
    output_file = Path("prompts/card_grader_v1.txt")

    print("="*60)
    print("PASS 2: AGGRESSIVE OPTIMIZATION")
    print("="*60)

    optimize_pass2(input_file, output_file)
    print("\nPass 2 complete!")
