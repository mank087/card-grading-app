#!/usr/bin/env python3
"""
Lorcana Prompt Targeted Optimization
Lightweight optimization - Lorcana already uses condensed protocols
Main target: Perfect Grade Verification checklist
Preserves critical Lorcana-specific content (Enchanted, Inkwell, Stats)
"""

import re
from pathlib import Path
import shutil

def optimize_lorcana_targeted(input_file, output_file):
    """Apply targeted optimization to verbose sections"""

    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    original_size = len(content)
    original_lines = len(content.split('\n'))

    print(f"Starting: {original_lines:,} lines, {original_size:,} bytes")

    # Stage 1: Condense Perfect Grade Verification Protocol
    print("\n[Stage 1] Condensing Perfect Grade Verification Protocol...")
    pattern1 = r'\[STEP 10\.5\] PERFECT GRADE PRE-FLIGHT CHECKLIST.*?(?=═══════════════════════════════════════════════════════════════════════════════\n\[STEP 11\])'

    replacement1 = """[STEP 10.5] PERFECT GRADE PRE-FLIGHT CHECKLIST (v4.2 ENHANCEMENT)
═══════════════════════════════════════════════════════════════════════════════

🚨 **MANDATORY**: If preliminary grade = 10.0, complete this verification before finalizing.

**PERFECT GRADE REQUIREMENTS:**

Before assigning 10.0, ALL criteria must be met:

**Centering:** Front & back both scored 10.0 with visually equal borders
**Corners (8 total):** ALL corners with zero white fiber at max zoom, perfect factory points intact
**Edges (8 total):** ALL edges with zero white flecks/fiber, smooth factory cut quality
**Surface:** Both sides with zero scratches/dots/debris/defects, holographic pattern intact (if foil/enchanted)
**Image Quality:** Grade A (<10% glare, professional quality, all areas visible)

**CRITICAL RULES:**
• If ANY criterion not met → Maximum grade 9.5 or lower
• When uncertain → Choose 9.5, NOT 10.0
• Perfect 10.0 should be <1% of all cards graded

"""

    content = re.sub(pattern1, replacement1, content, flags=re.DOTALL)

    # Stage 2: Condense Lorcana examples section
    print("[Stage 2] Condensing Lorcana examples...")
    pattern2 = r'\*\*REAL-WORLD LORCANA EXAMPLES:\*\*\n\nExample 1: \*\*Enchanted Character\*\*.*?Example 4: \*\*Promo Card\*\*.*?(?=\n🆕 ENCHANTED & FOIL VARIANTS:)'

    replacement2 = """**LORCANA SUBSET EXAMPLES:**
- **Enchanted:** Borderless full-art with holographic finish across entire card
- **Foil:** Standard border/frame with holographic layer
- **Promo:** Set code "PRO" instead of standard sets

"""

    content = re.sub(pattern2, replacement2, content, flags=re.DOTALL)

    # Stage 3: Minor cleanup - remove excessive blank lines and long dividers
    print("[Stage 3] Final cleanup...")
    content = final_cleanup(content)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)

    final_size = len(content)
    final_lines = len(content.split('\n'))

    lines_saved = original_lines - final_lines
    bytes_saved = original_size - final_size
    percent_reduction = (bytes_saved / original_size) * 100

    print(f"\n{'='*60}")
    print(f"LORCANA OPTIMIZATION COMPLETE")
    print(f"{'='*60}")
    print(f"Before: {original_lines:,} lines, {original_size:,} bytes")
    print(f"After:  {final_lines:,} lines, {final_size:,} bytes")
    print(f"Saved:  {lines_saved:,} lines, {bytes_saved:,} bytes ({percent_reduction:.1f}%)")
    print(f"{'='*60}")

def final_cleanup(content):
    """Cleanup excessive spacing and dividers"""

    # Normalize dividers
    content = re.sub(r'═{70,}', '═'*79, content)
    content = re.sub(r'─{50,}', '─'*44, content)

    # Remove excessive blank lines
    content = re.sub(r'\n{5,}', '\n\n\n', content)

    # Remove trailing spaces
    lines = [line.rstrip() for line in content.split('\n')]
    content = '\n'.join(lines)

    return content

if __name__ == "__main__":
    # Create backup first
    backup_file = Path("prompts/lorcana_conversational_grading_v4_2_BACKUP_BEFORE_OPTIMIZATION_2025-11-18.txt")
    target_file = Path("prompts/lorcana_conversational_grading_v4_2.txt")

    print("="*60)
    print("LORCANA PROMPT TARGETED OPTIMIZATION")
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
    optimize_lorcana_targeted(target_file, target_file)
    print("\nOptimization complete!")
    print(f"Backup available at: {backup_file}")
