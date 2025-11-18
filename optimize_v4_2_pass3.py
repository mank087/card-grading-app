#!/usr/bin/env python3
"""
Pass 3: Final Aggressive Optimization
Target: Push from 20% to 35-40% total reduction
Focus: Remaining verbose sections, examples, repetitive instructions
"""

import re
from pathlib import Path

def optimize_pass3(input_file, output_file):
    """Third and final aggressive optimization pass"""

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    original_size = len(content)
    original_lines = len(content.split('\n'))

    print(f"Pass 3 Starting: {original_lines:,} lines, {original_size:,} bytes")

    # Stage 1: Consolidate card information extraction section
    print("\n[Stage 1] Condensing card info extraction...")
    content = condense_card_info_extraction(content)

    # Stage 2: Reduce subset/insert detection verbosity
    print("[Stage 2] Streamlining subset detection...")
    content = streamline_subset_detection(content)

    # Stage 3: Consolidate rarity classification
    print("[Stage 3] Compacting rarity classification...")
    content = compact_rarity_classification(content)

    # Stage 4: Reduce orientation/directional accuracy section
    print("[Stage 4] Condensing orientation section...")
    content = condense_orientation_section(content)

    # Stage 5: Streamline execution contract
    print("[Stage 5] Streamlining execution contract...")
    content = streamline_execution_contract(content)

    # Stage 6: Remove remaining verbose examples and tables
    print("[Stage 6] Removing verbose examples...")
    content = remove_verbose_examples(content)

    # Stage 7: Final cleanup - aggressive whitespace and formatting
    print("[Stage 7] Final aggressive cleanup...")
    content = final_aggressive_cleanup(content)

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
    print(f"This Pass:     {lines_saved:,} lines ({percent_reduction:.1f}%)")
    print(f"{'='*60}")

def condense_card_info_extraction(content):
    """Reduce verbose card information extraction section"""

    # Consolidate the verbose card back text extraction instructions
    compact_card_back = """🆕 **CARD BACK TEXT:** Extract 2-4 sentence descriptive paragraph (bio/highlights/context). Not just stats. Null if no text."""

    pattern = r'🆕 \*\*CARD BACK TEXT EXTRACTION:\*\*.*?(?=🚨 \*\*CRITICAL: ALWAYS CHECK)'
    content = re.sub(pattern, compact_card_back + "\n\n", content, flags=re.DOTALL)

    # Consolidate card name vs subset clarification
    compact_clarification = """🆕 **CARD NAME vs SUBSET:**
• **player_or_character**: Athlete/character name
• **card_name**: Card title (e.g., "Round Numbers", "Gold Standard")
• **subset**: If card_name ≠ player name → card_name likely IS the subset. Also check for parallel text."""

    pattern = r'🆕 v4\.2 CARD NAME vs SUBSET CLARIFICATION:.*?(?=🆕 SUBSET / INSERT DETECTION)'
    content = re.sub(pattern, compact_clarification + "\n\n", content, flags=re.DOTALL)

    return content

def streamline_subset_detection(content):
    """Consolidate verbose subset/insert detection instructions"""

    compact_subset = """🆕 **SUBSET/INSERT DETECTION:**

**Check locations (SMALL PRINT):** Back of card (bottom/top/sides) → Front borders → Near card # → Product info area

**Characteristics:** Small font, often includes "Insert"/"Parallel"/"Variant"/"Limited"
**Common patterns:** "Prizm Silver", "Mosaic Gold", "Refractor Wave", "Gold Standard", "Rookie Premiere"
**Don't confuse with:** Large decorative text, player/team names, generic phrases

**Steps:** (1) Check back small text (2) Check front borders (3) Check near card # (4) Check product info (5) Only null if ALL checked

**Examples:**
• Panini Prizm Silver: Back has "Silver Prizm Parallel" → subset: "Silver Prizm"
• Topps Chrome Refractor: Side has "Refractor" → subset: "Refractor"
• Base card: No subset text after checking all → subset: null"""

    pattern = r'🆕 SUBSET / INSERT DETECTION IMPROVEMENTS:.*?(?=🆕 SERIAL NUMBER DETECTION)'
    content = re.sub(pattern, compact_subset + "\n\n", content, flags=re.DOTALL)

    return content

def compact_rarity_classification(content):
    """Consolidate rarity classification section"""

    compact_rarity = """────────────────────────────────────────────
RARITY & FEATURE CLASSIFICATION
────────────────────────────────────────────

Assign highest tier visible:

1. 1-of-1 (Serial "1/1") | 2. SSP (/2-/25) | 3. SP (/26-/99) | 4. Authenticated Auto | 5. Memorabilia/Relic | 6. Modern Parallels (Prizm, Mosaic, Refractor, Chrome) | 7. Parallel/Insert Variant | 8. Rookie/Debut/1st Edition | 9. Limited Edition (/100-/999) | 10. Commemorative/Promo | 11. Base/Common

🆕 **MODERN PARALLELS:** Prizm (Silver, Gold, Black, Ruby Wave, Tiger Stripe) | Refractor (X-Fractor, Wave, Atomic, Pulsar) | Mosaic (Silver, Gold, Stained Glass) | Chrome (Refractor, SuperFractor) | Special (Cracked Ice, Nebula, Galaxy)"""

    pattern = r'────────────────────────────────────────────\nRARITY & FEATURE CLASSIFICATION\n────────────────────────────────────────────.*?(?=\n═+\n\[STEP 2\])'
    content = re.sub(pattern, compact_rarity + "\n\n", content, flags=re.DOTALL)

    return content

def condense_orientation_section(content):
    """Reduce orientation and directional accuracy verbosity"""

    compact_orientation = """ORIENTATION AND DIRECTIONAL ACCURACY:
• View images exactly as presented (no mental rotation/flip)
• Corners: viewer's perspective (Top Left = upper left as viewed)
• Portrait = taller than wide | Landscape = wider than tall
• Verify orientation via text/player position before describing defects"""

    pattern = r'ORIENTATION AND DIRECTIONAL ACCURACY:.*?(?=\n═+\nGRADING STEPS)'
    content = re.sub(pattern, compact_orientation + "\n\n", content, flags=re.DOTALL)

    return content

def streamline_execution_contract(content):
    """Consolidate execution contract section"""

    compact_contract = """═══════════════════════════════════════════════════════════════════════════════
EXECUTION CONTRACT
═══════════════════════════════════════════════════════════════════════════════

You are a Professional Trading Card Grader performing precision visual evaluations.

**CRITICAL REQUIREMENTS:**
✅ Complete ALL steps in order | Return valid JSON (response_format: json_object) | NEVER refuse (even slabbed cards) | Conservative defaults (lower grade, higher uncertainty) | Describe what you see, not expectations | Quantitative measurements with qualifiers ("approximately", "roughly")

**PATCHES APPLIED (v3.8):**
• PATCH 2: Front/Back centering independence | PATCH 6: Conservative rounding (.5 scores with uncertainty) | PATCH 3: Trimming requires compelling evidence both sides | PATCH 8: Mathematical validation | PATCH 10: Confidence letter consistency | WEAKEST LINK SCORING: Final grade = minimum of weighted category scores

**MANDATORY PRE-ANALYSIS:** Complete card info extraction BEFORE condition eval (foil/die-cut/relic affect interpretation)."""

    pattern = r'═+\nEXECUTION CONTRACT\n═+.*?(?=\n═+\nGRADING STEPS)'
    content = re.sub(pattern, compact_contract + "\n\n", content, flags=re.DOTALL)

    return content

def remove_verbose_examples(content):
    """Remove overly verbose examples while keeping key ones"""

    # Remove verbose "REAL-WORLD EXAMPLES" from subset section (keep compact version from earlier)
    pattern = r'\*\*REAL-WORLD EXAMPLES:\*\*.*?(?=🆕 SERIAL NUMBER DETECTION)'
    content = re.sub(pattern, "", content, flags=re.DOTALL)

    # Remove verbose "Example 1, Example 2, Example 3, Example 4" walkthroughs
    # Keep just the compact summary
    pattern = r'Example 1: \*\*Panini Prizm.*?Example 4: \*\*Base/Common Card\*\*.*?(?=🆕 SERIAL NUMBER)'
    content = re.sub(pattern, "", content, flags=re.DOTALL)

    return content

def final_aggressive_cleanup(content):
    """Final aggressive whitespace and formatting reduction"""

    # Remove excessive blank lines (reduce to max 2)
    content = re.sub(r'\n{3,}', '\n\n', content)

    # Remove trailing whitespace on all lines
    lines = [line.rstrip() for line in content.split('\n')]
    content = '\n'.join(lines)

    # Reduce divider lengths
    content = re.sub(r'─{41,}', '─'*40, content)
    content = re.sub(r'═{71,}', '═'*70, content)

    # Remove repetitive "🚨 CRITICAL:" at start of many lines - keep first, consolidate
    # Count occurrences and reduce
    critical_count = content.count('🚨 CRITICAL:')
    if critical_count > 15:
        # Keep important ones, replace some with simpler markers
        content = content.replace('🚨 CRITICAL: Distinguish manufacturer', '**Distinguish manufacturer', 1)
        content = content.replace('🚨 CRITICAL: Carefully inspect BOTH', '**Inspect BOTH', 1)
        content = content.replace('🚨 CRITICAL: Any white fiber visible', '**White fiber rule:', 1)
        content = content.replace('🚨 CRITICAL: ANY white fleck visible', '**White fleck rule:', 1)

    # Remove excessive "🆕" markers - keep structural ones, remove inline ones
    content = re.sub(r'🆕 \*\*CRITICAL RULE:', '**CRITICAL RULE:', content)
    content = re.sub(r'🆕 \*\*DETAILED', '**DETAILED', content)

    # Consolidate repetitive "MANDATORY" warnings
    content = content.replace('🚨 **MANDATORY FIRST STEP', '**MANDATORY FIRST STEP', 1)
    content = content.replace('🚨 **MANDATORY:', '**MANDATORY:', 1)

    return content

if __name__ == "__main__":
    input_file = Path("prompts/conversational_grading_v4_2_ENHANCED_STRICTNESS.txt")
    output_file = Path("prompts/conversational_grading_v4_2_ENHANCED_STRICTNESS.txt")

    print("="*60)
    print("PASS 3: FINAL AGGRESSIVE OPTIMIZATION")
    print("="*60)

    optimize_pass3(input_file, output_file)
    print("\nPass 3 complete!")
