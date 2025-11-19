#!/usr/bin/env python3
"""
Pass 3: Final Deep Optimization
Target: Push from 20% to 35-40% total reduction
Focus: Verbose inspection protocols, component scoring tables
"""

import re
from pathlib import Path

def optimize_pass3(input_file, output_file):
    """Final aggressive optimization pass"""

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    original_size = len(content)
    original_lines = len(content.split('\n'))

    print(f"Pass 3 Starting: {original_lines} lines, {original_size:,} bytes")

    # Stage 1: Drastically condense 8-corner inspection
    print("\n[Stage 1] Condensing 8-corner inspection protocol...")
    content = condense_corner_inspection(content)

    # Stage 2: Reduce edge inspection from 20 segments to summary
    print("[Stage 2] Streamlining edge inspection...")
    content = streamline_edge_inspection(content)

    # Stage 3: Condense surface inspection from 18 zones
    print("[Stage 3] Reducing surface inspection zones...")
    content = reduce_surface_inspection(content)

    # Stage 4: Simplify component scoring tables
    print("[Stage 4] Compacting component scoring tables...")
    content = compact_scoring_tables(content)

    # Stage 5: Remove repetitive examples in final grading section
    print("[Stage 5] Removing duplicate examples...")
    content = remove_duplicate_examples(content)

    # Stage 6: Condense final grade calculation section
    print("[Stage 6] Streamlining grade calculation...")
    content = streamline_grade_calculation(content)

    # Stage 7: Final cleanup pass
    print("[Stage 7] Final formatting cleanup...")
    content = final_cleanup(content)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)

    final_size = len(content)
    final_lines = len(content.split('\n'))

    lines_saved = original_lines - final_lines
    bytes_saved = original_size - final_size
    percent_reduction = (bytes_saved / original_size) * 100

    print(f"\n{'='*60}")
    print(f"PASS 3 COMPLETE")
    print(f"{'='*60}")
    print(f"Before Pass 3: {original_lines:,} lines, {original_size:,} bytes")
    print(f"After Pass 3:  {final_lines:,} lines, {final_size:,} bytes")
    print(f"This Pass:     {lines_saved:,} lines, {bytes_saved:,} bytes ({percent_reduction:.1f}%)")
    print(f"{'='*60}")

def condense_corner_inspection(content):
    """Drastically reduce the 8-corner inspection protocol"""

    compact_corners = """
**A. SYSTEMATIC 8-CORNER INSPECTION PROTOCOL**

Inspect each corner for: whitening, rounding, crushing, fuzzy edges.

**8-CORNER INSPECTION:** TL → TR → BL → BR (front) → TL → TR → BL → BR (back)

For each corner:
1. Check 90° angle sharpness (microscopic rounding visible?)
2. Scan for whitening (exposed card stock, any size)
3. Look for crushing/compression (flattened area)
4. Examine fuzzy/frayed edges

**SCORING:** Count defects + severity:
- 0 defects all 8 corners = 10.0
- 1-2 microscopic = 9.5
- 2-3 minor = 9.0
- 1 moderate OR 3-4 minor = 8.5
- 2-3 moderate = 8.0
- Heavy defects = 7.0 or lower

(Apply Universal Severity Scale: Microscopic <0.1mm | Minor 0.1-0.3mm | Moderate 0.3-1mm | Heavy >1mm)
"""

    pattern = r'\*\*A\. SYSTEMATIC 8-CORNER INSPECTION PROTOCOL\*\*.*?(?=\n\*\*B\. SYSTEMATIC)'

    content = re.sub(pattern, compact_corners, content, flags=re.DOTALL)

    return content

def streamline_edge_inspection(content):
    """Reduce edge inspection from verbose 20-segment protocol"""

    compact_edges = """
**B. SYSTEMATIC EDGE INSPECTION PROTOCOL**

Inspect all 4 edges (Top, Right, Bottom, Left) on both sides.

**SCAN METHODOLOGY:** Divide each edge into 5 segments (20 total per side)
- Visual scan left-to-right, top-to-bottom
- Look for: white dots, chipping, roughness, uneven cuts

**DEFECT DETECTION:**
- White dots: Count individual dots, measure size
- Chipping: Material loss exposing lighter stock
- Roughness: Inconsistent edge texture, abrasion
- Factory cut issues: Uneven/jagged edge line

**SCORING:** Count defects across all edges:
- 0 defects all edges = 10.0
- 1-3 isolated dots = 9.5
- 4-6 dots OR minor roughness 1 edge = 9.0
- Moderate whitening 1 edge OR minor on 2+ edges = 8.5
- Moderate on 2+ edges = 8.0 or lower

(Use Universal Severity Scale for measurements)
"""

    pattern = r'\*\*B\. SYSTEMATIC 5-SEGMENT EDGE INSPECTION PROTOCOL\*\*.*?(?=\n⚠️ \*\*MANDATORY SYSTEMATIC SURFACE)'

    content = re.sub(pattern, compact_edges, content, flags=re.DOTALL)

    return content

def reduce_surface_inspection(content):
    """Condense 18-zone surface inspection"""

    compact_surface = """
**C. SYSTEMATIC SURFACE INSPECTION PROTOCOL**

Inspect entire card surface (front & back) for defects.

**INSPECTION ZONES:** Divide card into grid (corners, edges, center)
- Scan systematically, zone by zone
- Look for: scratches, print defects, stains, indentations

**DEFECT TYPES:**
- Scratches: Hairline (<0.2mm) vs Visible (≥0.2mm)
- Print defects: Dots, lines, misalignment, registration issues
- Stains/discoloration: Foreign substance, color variation
- Indentations: Depressions without creases

**SCORING:**
- 0 defects = 10.0
- 1-2 hairline scratches = 9.5
- 1 visible scratch OR 3+ hairlines = 9.0
- Multiple scratches OR print defects = 8.5 or lower

(Apply (Apply CREASE DETECTION MASTER PROTOCOL) for any suspect lines)
"""

    pattern = r'⚠️ \*\*MANDATORY SYSTEMATIC SURFACE INSPECTION - 18 ZONES TOTAL:\*\*.*?(?=\n===========================================\nIV-B\.)'

    content = re.sub(pattern, compact_surface, content, flags=re.DOTALL)

    return content

def compact_scoring_tables(content):
    """Simplify the component scoring tables (corners, edges, surface, centering)"""

    # These tables are already somewhat optimized from pass 1, but can be more compact
    # Convert remaining verbose scoring descriptions to concise format

    # Corners scoring
    content = re.sub(
        r'\*\*Corners Component Score:\*\*.*?(?=\n\*\*Edges Component Score:)',
        '**Corners Score:** 0 defects=10 | 1-2 micro=9.5 | 2-3 minor=9 | 1 mod OR 3-4 minor=8.5 | See scale for lower\n\n',
        content,
        flags=re.DOTALL
    )

    # Edges scoring
    content = re.sub(
        r'\*\*Edges Component Score:\*\*.*?(?=\n\*\*Surface Component Score:)',
        '**Edges Score:** 0 defects=10 | 1-3 dots=9.5 | 4-6 dots=9 | Moderate 1 edge=8.5 | See scale for lower\n\n',
        content,
        flags=re.DOTALL
    )

    # Surface scoring
    content = re.sub(
        r'\*\*Surface Component Score:\*\*.*?(?=\n\*\*Centering Component Score:)',
        '**Surface Score:** 0 defects=10 | 1-2 hairlines=9.5 | 1 visible=9 | Multiple=8.5 or lower\n\n',
        content,
        flags=re.DOTALL
    )

    # Centering scoring
    content = re.sub(
        r'\*\*Centering Component Score:\*\*.*?(?=\n===========================================\nIV-C\.)',
        '**Centering Score:** 50-55/45=10 | 56-60/40=9.5-9 | 61-70/30=9-8.5 | 71-75/25=8-7 | >75/25=6 or lower\n\n',
        content,
        flags=re.DOTALL
    )

    return content

def remove_duplicate_examples(content):
    """Remove repetitive grading examples"""

    # Remove verbose "Example 1" and "Example 2" calculation walk-throughs if duplicated
    # Keep only one comprehensive example

    examples = list(re.finditer(r'Example \d+:.*?(?=\n(?:Example \d+:|===========================================))', content, re.DOTALL))

    if len(examples) > 3:
        # Keep first 3 examples, remove others
        for example in examples[3:]:
            content = content[:example.start()] + "(Additional examples omitted for brevity)\n" + content[example.end():]

    return content

def streamline_grade_calculation(content):
    """Condense the final grade calculation section"""

    # Remove repetitive "how to calculate" instructions
    pattern = r'FINAL GRADE CALCULATION FORMULA.*?(?=\n\*\*CRITICAL RULES)'

    replacement = """**FINAL GRADE CALCULATION:** Take LOWEST score from (corners, edges, surface, centering). Apply grade caps if structural damage detected.

"""

    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

    return content

def final_cleanup(content):
    """Final pass to remove any remaining redundancy"""

    # Remove excessive section dividers (keep structure but reduce)
    content = re.sub(r'={50,}', '='*43, content)
    content = re.sub(r'-{50,}', '-'*43, content)

    # Remove multiple blank lines
    content = re.sub(r'\n{5,}', '\n\n\n', content)

    # Remove trailing spaces at end of lines
    lines = [line.rstrip() for line in content.split('\n')]
    content = '\n'.join(lines)

    # Remove redundant "See X protocol" if mentioned multiple times in paragraph
    paragraphs = content.split('\n\n')
    cleaned_paragraphs = []

    for para in paragraphs:
        # If "See PROTOCOL" appears more than once, keep only first
        if para.count('(See') > 1 and 'PROTOCOL' in para:
            lines = para.split('\n')
            seen_protocol = False
            kept_lines = []
            for line in lines:
                if '(See' in line and 'PROTOCOL' in line:
                    if not seen_protocol:
                        kept_lines.append(line)
                        seen_protocol = True
                else:
                    kept_lines.append(line)
            para = '\n'.join(kept_lines)

        cleaned_paragraphs.append(para)

    content = '\n\n'.join(cleaned_paragraphs)

    return content

if __name__ == "__main__":
    input_file = Path("prompts/card_grader_v1.txt")
    output_file = Path("prompts/card_grader_v1.txt")

    print("="*60)
    print("PASS 3: FINAL DEEP OPTIMIZATION")
    print("="*60)

    optimize_pass3(input_file, output_file)
    print("\nPass 3 complete! Check results.")
