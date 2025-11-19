#!/usr/bin/env python3
"""
Apply strict centering evaluation system to all card type prompts.
This ensures consistent centering methodology across Sports, Pokemon, MTG, Lorcana, and Other cards.
"""

import re
import os

# The new centering section (front)
NEW_CENTERING_FRONT = '''────────────────────────────────────────
A. CENTERING
────────────────────────────────────────

🆕 **ENHANCED CENTERING EVALUATION (STRICT MEASUREMENT REQUIRED)**

🚨 **CRITICAL RULE: NO PERFECT CENTERING WITHOUT PROOF**
You may NOT assign 50/50 centering unless BOTH opposing borders are:
✅ Visible and clearly defined
✅ Measurable with numeric values
✅ Unobstructed by glare or holder
✅ Evenly lit (no shadows distorting perception)
✅ Not distorted by foil reflections or patterns

**If ANY of these conditions are NOT met → Perfect 50/50 is PROHIBITED**

**STEP 1: MANDATORY CARD TYPE CLASSIFICATION**
Before measuring, classify card into ONE category:

**TYPE A - Standard Bordered Card**
• Clearly defined borders on all four edges
• Straight rectangular shape
• Borders are structural, not decorative
• Method: Direct border measurement (most accurate)

**TYPE B - Asymmetric Bordered Insert**
• Borders differ left/right or top/bottom
• Includes modern inserts (Dominators, My House, Fireworks, etc.)
• Method: Design anchors required
• **Maximum centering score: 9.0** (unless exceptional anchor evidence)

**TYPE C - Borderless / Full-Art Card**
• No visible border OR artwork extends to edges
• Method: Internal layout anchors ONLY
• **Maximum centering score: 9.0** (unless strong anchors prove near-perfect)

**TYPE D - Foil-Frame / Pattern-Frame Card**
• Holographic or geometric frame (decorative, not structural)
• Borders may appear "busy" or distorted by design
• Method: Identify STRUCTURAL frame (ignore foil patterns)
• **Maximum centering score: 9.0** (if reflective distortion present)

**TYPE E - Die-Cut / Non-Rectangular Card**
• Shaped edges, removed corners, jagged/rounded cuts
• Method: Internal geometric centering only
• **Maximum centering score: 9.0** (traditional centering impossible)

**STEP 2: NUMERIC MEASUREMENT (REQUIRED)**

You MUST provide approximate numeric measurements:

**For bordered cards (Type A):**
• "Left border ≈ [X] pixels"
• "Right border ≈ [Y] pixels"
• "Top border ≈ [X] pixels"
• "Bottom border ≈ [Y] pixels"

**For borderless/anchor cards (Types B-E):**
• "[Anchor element] is ≈ [X] pixels from left edge"
• "[Anchor element] is ≈ [Y] pixels from right edge"
• Must identify at least TWO anchor points per axis

**STEP 3: CALCULATE RATIOS INDEPENDENTLY**

Measure each axis separately (NO reuse or symmetry assumptions):

**Left/Right Ratio:**
• Narrower border ÷ Wider border × 100 = ratio
• Example: 23px ÷ 30px × 100 = 76.67 → **77/23** ratio

**Top/Bottom Ratio:**
• Narrower border ÷ Wider border × 100 = ratio
• Example: 19px ÷ 25px × 100 = 76.00 → **76/24** ratio

**Use WORST axis** for centering score

**STEP 4: SECOND-PASS VERIFICATION (MANDATORY)**

After calculating ratio, ask yourself:
❓ "Do my measured border values logically support this centering ratio?"

If NO → Revise to more conservative ratio
If uncertain → Default to LESS perfect ratio (55/45 or 60/40, NEVER 50/50)

**STEP 5: APPLY CONSERVATIVE DEFAULTS**

If certainty is LOW due to:
• Glare or poor visibility
• Unclear border edges
• Foil distortion
• Busy artwork
• Image quality issues

→ You MUST use less perfect ratio
→ NEVER default upward toward perfection
→ Example: If unsure between 50/50 and 55/45 → Use 55/45

**CENTERING SCORE CAPS (Based on Worst Axis):**
| Ratio | Maximum Score |
|-------|---------------|
| 50/50 to 52/48 | 10.0 |
| 53/47 to 55/45 | 9.5 |
| 56/44 to 58/42 | 9.0 |
| 59/41 to 65/35 | 8.0 |
| 66/34 to 70/30 | 7.0 |
| 71/29 or worse | 6.0 or lower |

🆕 CENTERING VALIDATION CHECKS:
• PATCH 2: Cross-check front and back centering for plausibility (often track, but need not match)
• PATCH 2: Apply centering cap to each side independently using that side's worst axis
• PATCH 2: If front/back ratios differ by ≥8 percentage points on same axis, note "centering discrepancy" and expand uncertainty (narrative only)

**REQUIRED OUTPUT FORMAT:**
• card_type: "Standard Bordered" / "Asymmetric Insert" / "Borderless" / "Foil-Frame" / "Die-Cut"
• measurement_method: "Border measurement" / "Design anchors" / "Internal geometry"
• measurements: "Left ≈ [X]px, Right ≈ [Y]px, Top ≈ [X]px, Bottom ≈ [Y]px"
• left_right: ratio (e.g., "55/45")
• top_bottom: ratio (e.g., "52/48")
• worst_axis: "left_right" / "top_bottom"
• score: 0.0-10.0
• analysis: MINIMUM 3 SENTENCES - (1) Card type classification (2) Numeric measurements + ratios (3) How measurements were determined and verification notes
'''

# The new centering section (back - references front)
NEW_CENTERING_BACK = '''────────────────────────────────────────
A. CENTERING (Back)
────────────────────────────────────────

🚨 **Apply SAME strict centering methodology as front** (Steps 1-5 from Front Centering section)

**CRITICAL REQUIREMENTS:**
• Classify back card type (Type A-E)
• Provide numeric measurements (pixels/percentages)
• Calculate ratios independently (NO carrying over front measurements)
• Second-pass verification required
• Conservative defaults (if uncertain → LESS perfect ratio)
• **NO 50/50 without proof** (visible, measurable, unobstructed borders)

**OUTPUT:**
• card_type: "Standard Bordered" / "Asymmetric Insert" / "Borderless" / "Foil-Frame" / "Die-Cut"
• measurement_method: "Border measurement" / "Design anchors" / "Internal geometry"
• measurements: "Left ≈ [X]px, Right ≈ [Y]px, Top ≈ [X]px, Bottom ≈ [Y]px"
• left_right: ratio
• top_bottom: ratio
• worst_axis: "left_right" / "top_bottom"
• score: 0.0-10.0 (independent from front, apply cap per table)
• analysis: MINIMUM 3 SENTENCES - (1) Card type classification (2) Numeric measurements + ratios (3) How measurements were determined and verification notes
'''

prompts_to_update = [
    'prompts/pokemon_conversational_grading_v4_2.txt',
    'prompts/mtg_conversational_grading_v4_2.txt',
    'prompts/lorcana_conversational_grading_v4_2.txt',
    'prompts/other_conversational_grading_v4_2.txt'
]

def find_centering_sections(content):
    """Find the front and back centering sections"""
    # Find front centering (usually after "A. CENTERING" and before "B. CORNERS")
    front_match = re.search(
        r'(────+\nA\. CENTERING\n────+\n.*?)(?=────+\nB\. CORNERS)',
        content,
        re.DOTALL
    )

    # Find back centering (usually "A. CENTERING (Back)")
    back_match = re.search(
        r'(────+\nA\. CENTERING \(Back\)\n────+\n.*?)(?=────+\nB\. CORNERS \(Back\))',
        content,
        re.DOTALL
    )

    return front_match, back_match

def update_prompt_file(filepath):
    """Update a single prompt file with new centering sections"""
    print(f"Updating {filepath}...")

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    front_match, back_match = find_centering_sections(content)

    if front_match:
        print(f"  Found front centering section at position {front_match.start()}")
        content = content[:front_match.start()] + NEW_CENTERING_FRONT + content[front_match.end():]
    else:
        print(f"  WARNING: Could not find front centering section!")
        return False

    # Re-find back section (positions changed after front replacement)
    front_match, back_match = find_centering_sections(content)

    if back_match:
        print(f"  Found back centering section at position {back_match.start()}")
        content = content[:back_match.start()] + NEW_CENTERING_BACK + content[back_match.end():]
    else:
        print(f"  WARNING: Could not find back centering section!")
        return False

    # Write updated content
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"  [OK] Successfully updated {filepath}")
    return True

def main():
    for prompt_file in prompts_to_update:
        if not os.path.exists(prompt_file):
            print(f"SKIP: {prompt_file} does not exist")
            continue

        success = update_prompt_file(prompt_file)
        if not success:
            print(f"FAILED to update {prompt_file}")

    print("\nDone! Updated all prompts.")

if __name__ == '__main__':
    main()
