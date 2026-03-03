/**
 * Enhanced User Message for LLM Card Grading
 * Focus: Improved edge and surface defect detection with alteration-level urgency
 */

export const ENHANCED_USER_MESSAGE = `⚠️ CRITICAL DEFECT INSPECTION - DO NOT SKIP ANY STEP ⚠️

🔴 PRIORITY 0A: PROTECTIVE CASE/SLEEVE DETECTION
**CRITICAL - CHECK THIS FIRST:**
- Look for ANY protective covering: penny sleeve, top loader, semi-rigid holder, slab
- Penny sleeves appear as CLEAR PLASTIC with visible edges/seams around the card
- Top loaders are rigid plastic cases with open top
- Semi-rigids are stiff plastic holders
- Slabs are professionally sealed hard cases (PSA, BGS, CGC, etc.)
- If card is in ANY case/sleeve → Set case_detection.case_type to the appropriate value
- Document case presence in image_quality.notes: "Card in [case type] - may affect defect visibility"
- Penny sleeves especially can obscure fine defects and create glare

🔴 PRIORITY 0B: IMAGE QUALITY - CORNER VISIBILITY CHECK
BEFORE GRADING: Verify ALL 8 corners (4 front + 4 back) are FULLY VISIBLE in frame.
- Corner is "CUT OFF" if tip extends beyond frame or touches image border
- If ANY corner cut off → Image Quality grade "C" (±0.5) - document which corners in notes
- If 2+ corners cut off → Image Quality grade "D" (±1.0)
- NEVER assign grade "A" or "B" if ANY corner is cut off

🔴 PRIORITY 1: UNVERIFIED AUTOGRAPH CHECK (GRADE: N/A - ALTERATION)
**CRITICAL - CHECK THIS FIRST BEFORE GRADING:**
- Look for ANY handwritten signature, autograph, or ink writing on front or back
- If you see an AUTOGRAPH (handwritten signature with player name/initials):
  → Check for manufacturer authentication: hologram, foil stamp, "Certified Autograph" text, serial number
  → If NO authentication markers visible → ❌ AUTOMATIC GRADE 1.0 (Altered - unverified autograph)
  → If authentication IS visible → Card is gradable normally
- ❌ NEVER grade an unverified autograph higher than 1.0
- Common unverified autographs: Signatures obtained in-person, through-the-mail, or added post-production without manufacturer certification

🔴 PRIORITY 2: CREASES & STRUCTURAL DAMAGE (GRADE CAP: 4.0 OR LOWER)
- Scan ENTIRE card surface (front and back) for ANY visible lines, folds, or indentations
- Look for BENT CORNERS (corners that don't lie flat, appear raised or deformed)
- Check for SURFACE CREASES (any line visible from reflected light, especially mid-card)
- Examine card at ANGLES to catch light reflection that reveals creases
- ❌ If you find ANY crease or bent corner → AUTOMATIC MAX GRADE 4.0
- Common locations: Mid-card horizontal creases, corner bends, diagonal folds

🔴 PRIORITY 3: HANDWRITTEN MARKINGS (NON-AUTOGRAPH)
- Check BOTH sides (especially back) for ANY pen, pencil, or marker writing
- Numbers, letters, symbols, prices (e.g., "100", "$5", initials)
- ❌ Any handwritten marking → AUTOMATIC GRADE 1.0

🔴 PRIORITY 4: EDGE DEFECTS - SYSTEMATIC SCAN (ALL 4 EDGES)
**⚠️ YOU MUST EXAMINE EVERY EDGE - DO NOT ASSUME PERFECTION ⚠️**

**INSPECTION GUIDANCE:**
- Bottom edges are the most common location for edge defects
- Top edges are the second most common location
- Left/right edges are less frequently affected
- If you find zero edge defects, verify you completed a thorough segment-by-segment scan

**🔍 WHAT EDGE DEFECTS LOOK LIKE - VISUAL IDENTIFICATION GUIDE:**

**Type 1: Micro White Dots** (MOST commonly missed - 50-60% of all edge defects)
- Appearance: Tiny bright pinpoint spots (0.05-0.15mm diameter, 1-3 pixels at high resolution)
- Location: ON the edge line (not on surface, but at the physical edge where border meets cut)
- Visibility by border color:
  * BLACK/DARK NAVY borders → Appear as BRIGHT WHITE dots (EASIEST to see - like tiny stars)
  * DARK BLUE borders → Appear as light blue or white micro-spots
  * DARK RED/BURGUNDY borders → Appear as pink or light spots
  * YELLOW/GOLD borders → Appear as very light yellow or white spots
  * WHITE borders → HARDEST - look for slightly brighter areas or texture changes
- Pattern: Usually appear as isolated single dots OR clusters of 2-4 micro-dots
- Visual cue: Create "sparkle" effect - micro-dots catch light like tiny pinpoints
- **Any micro white dot is a handling defect — document and deduct accordingly**

**Type 2: Continuous Whitening** (Linear white bands)
- Appearance: Linear light bands or lines running along edge (like thin white stripe)
- Detection: Compare edge color to border color 1-2mm inward - is edge lighter?
- Width: 0.1-0.5mm wide band
- Length: Can range from 2mm to entire edge length
- Most visible on dark-colored borders (black, navy, dark blue, dark red)
- ⚠️ **NOT whitening:** If an ENTIRE edge appears uniformly lighter while the opposite edge appears darker → this is UNEVEN LIGHTING, not whitening. Real whitening is localized (specific segments/spots with fiber texture), not a uniform brightness shift across a full edge. Check that the border color COATING is actually MISSING (exposing white cardstock) rather than simply appearing brighter due to illumination.

**Type 3: Edge Chipping** (Missing material)
- Appearance: Irregular edge profile, "notches" or "dents" in edge line
- Detection: Edge line is NOT smooth/straight - has jagged sections
- Result: Exposes lighter card stock underneath colored border
- Size: 0.1-1mm+ indentations into edge

**Type 4: Edge Roughness** (Uneven texture)
- Appearance: Uneven or jagged edge line (not smooth)
- Detection: Zoom in and trace edge line - does it wobble or have micro-variations?
- Cause: Factory cutting variance OR handling wear

**🔬 MANDATORY SYSTEMATIC EDGE SCAN - FOLLOW THIS EXACT PROCEDURE:**

**STEP 1: BOTTOM EDGE** 🔴 HIGHEST PRIORITY 🔴
⏱️ TIME REQUIRED: 55 seconds minimum

1. **Mental Setup:** ZOOM IN on bottom edge, prepare for segment-by-segment scan
2. **Divide edge into 5 EQUAL segments** (left to right):

   **Segment B1 (Bottom-Left, near corner):**
   - Scan for 8 seconds
   - Check for: white dots, whitening, chipping, roughness

   **Segment B2 (Left-Center):** ⚠️ HIGH DEFECT ZONE
   - Scan for 12 seconds
   - This segment has defects on 40-50% of cards
   - Look specifically for micro white dots against border color

   **Segment B3 (Center):** ⚠️ HIGHEST DEFECT ZONE
   - Scan for 15 seconds
   - This segment has defects on 50-60% of cards
   - The MOST COMMON location for edge damage
   - If you find ZERO defects here, re-scan immediately

   **Segment B4 (Right-Center):** ⚠️ HIGH DEFECT ZONE
   - Scan for 12 seconds
   - Similar probability to B2

   **Segment B5 (Bottom-Right, near corner):**
   - Scan for 8 seconds
   - Check for: white dots, whitening, chipping, roughness

3. **FOR EACH SEGMENT, ACTIVELY LOOK FOR:**
   ✓ Micro white dots (tiny bright spots 0.05-0.15mm)
   ✓ Continuous whitening (light bands along edge)
   ✓ Edge chipping (missing material, irregular profile)
   ✓ Roughness (jagged or uneven edge line)
   ✓ Color deviation (lighter areas vs. expected border color)

4. **MANDATORY VALIDATION CHECK:**
   - Question: "Did I find ANY defects on bottom edge?"
   - If YES → Document all findings, proceed to STEP 2
   - If NO → Verify you completed a thorough scan of segments B2, B3, B4
     * Re-scan those segments for 10 seconds each
     * Look specifically for micro white dots on dark borders

**STEP 2: TOP EDGE** 🟡 SECOND PRIORITY
⏱️ TIME REQUIRED: 40 seconds minimum

1. ZOOM IN on top edge
2. SCAN LEFT TO RIGHT, dividing into 5 segments (T1, T2, T3, T4, T5)
3. Spend 8-12 seconds per segment
4. Check for SAME defect types as bottom edge:
   ✓ Micro white dots
   ✓ Continuous whitening
   ✓ Edge chipping
   ✓ Roughness
5. **NOTE:** Top edges are often damaged but frequently missed - be thorough

**STEP 3: LEFT EDGE** 🟢 MODERATE PRIORITY
⏱️ TIME REQUIRED: 25-40 seconds

1. ZOOM IN on left edge
2. SCAN TOP TO BOTTOM, dividing into 5 segments (L1, L2, L3, L4, L5)
3. Spend 5-8 seconds per segment
4. Check for SAME defect types

**STEP 4: RIGHT EDGE** 🟢 MODERATE PRIORITY
⏱️ TIME REQUIRED: 25-40 seconds

1. ZOOM IN on right edge
2. SCAN TOP TO BOTTOM, dividing into 5 segments (R1, R2, R3, R4, R5)
3. Spend 5-8 seconds per segment
4. Check for SAME defect types

**STEP 5: ALL 8 CORNERS** (Front: TL, TR, BL, BR; Back: TL, TR, BL, BR)
⏱️ TIME REQUIRED: 80-110 seconds (10-15 sec per corner)

For EACH of the 8 corners, perform this inspection:

1. **ZOOM IN to corner tip** (the exact apex where two edges meet at 90° angle)

2. **CHECK FOR THESE SPECIFIC DEFECTS:**
   ✓ **Micro whitening (<0.1mm):** Tiny white dot at tip - appears as pinpoint bright spot
   ✓ **Minor whitening (0.1-0.3mm):** Small visible white area at tip
   ✓ **Moderate whitening (0.3-1mm):** Obvious white stock exposure
   ✓ **Heavy whitening (>1mm):** Extensive white exposure or rounding
   ✓ **Rounding:** Corner no longer sharp 90° angle, appears blunted/curved
   ✓ **Bent corner:** Corner raised/lifted, doesn't lie flat ← **AUTOMATIC 4.0 CAP**

3. **TIME ALLOCATION PER CORNER:**
   - **BOTTOM CORNERS (BL, BR):** 10-15 seconds EACH
     * Highest damage probability (60-70% have defects)
     * Most common: micro whitening at tip
   - **TOP CORNERS (TL, TR):** 8-12 seconds EACH
     * Moderate damage probability (40-50% have defects)

4. **DETECTION TIP FOR MICRO CORNER WHITENING:**
   - Focus on the EXACT tip where edges meet
   - Compare tip color to edge color 1mm away - is tip lighter?
   - On dark borders: Micro whitening appears as bright white dot
   - Look for "sparkle" effect at corner tip
   - ⚠️ **LIGHTING CHECK:** Before flagging, verify the bright spot shows FIBER TEXTURE (rough, fuzzy, sharp boundary). If the corner is simply brighter due to lighting angle (smooth brightness, no texture, border color still visible), it is NOT whitening — it is glare/lighting artifact. Compare ALL 4 corners: if corners on one side are all brighter while the opposite side is darker, that's uneven lighting.

**❌ COMMON MISTAKES TO AVOID:**

1. ❌ "Edges look good" without systematic segment-by-segment scan
2. ❌ Glancing at edges instead of methodical 5-segment inspection per edge
3. ❌ Missing micro white dots because they seem "too small to matter"
   - They DO matter: Document all defects with measurements for accurate grading
4. ❌ Confusing glare/reflection/uneven lighting with actual whitening
   - CRITICAL: Uneven lighting makes one side of the card appear brighter — this is NOT whitening
   - Glare from camera flash creates smooth bright spots at corners/edges — this is NOT fiber exposure
   - Solution: Check for FIBER TEXTURE (real whitening is fuzzy/rough with sharp edges where coating is missing)
   - Solution: Compare to opposite edge — if one side is uniformly brighter and the other uniformly darker, it's lighting
   - Solution: Check if border COLOR is still present but brighter (lighting) vs. completely MISSING/white (real whitening)
   - If bright area is a smooth gradient with no fiber texture → DO NOT flag as whitening
5. ❌ Only checking corners and ignoring edge segments between corners
6. ❌ Scanning too quickly when card "looks perfect"
   - When card looks mint, you unconsciously scan FASTER and MISS micro-defects
   - Counter-measure: Force yourself to scan SLOWER on perfect-looking cards

**✅ PROPER DEFECT DOCUMENTATION EXAMPLES:**

GOOD - Specific and Measurable:
✅ "Bottom edge segment B3 (center): 4 micro white dots visible (0.1mm each) against black border - appear as bright pinpoint spots creating sparkle effect"
✅ "Top edge segment T2: Continuous whitening band 8mm length, 0.2mm width - light blue exposure along dark blue border edge"
✅ "Bottom-left corner: Moderate whitening 0.5mm at corner tip - white card stock visible against navy border"
✅ "Right edge segment R4: Edge chipping 0.3mm creating irregular notched profile - missing border material exposing lighter stock"
✅ "Bottom-right corner: Micro whitening <0.1mm at apex - tiny white dot visible where edges meet, appears as pinpoint bright spot on black border"

BAD - Vague and Unmeasurable:
❌ "Edge looks worn"
❌ "Some whitening visible"
❌ "Possible edge defect"
❌ "Minor corner wear"

**⚠️ CRITICAL VALIDATION - BEFORE PROCEEDING TO PRIORITY 5:**

Ask yourself these questions:
1. Did I scan ALL 4 edges in 5-segment pattern? (20 segments front, 20 segments back = 40 total)
2. Did I examine ALL 8 corners for micro whitening?
3. Did I spend adequate time? (Minimum 150-200 seconds for complete edge+corner inspection)

If you answer NO to any question → RE-EXAMINE before proceeding

🔴 PRIORITY 5: SURFACE DEFECTS - SCAN FRONT AND BACK COMPLETELY
**⚠️ SCAN ENTIRE SURFACE - DO NOT JUST GLANCE ⚠️**

**INSPECTION GUIDANCE:**
- Surface white dots and print defects are common — inspect solid color areas carefully
- Scratches may only be visible at certain angles — check for light reflections
- Print defects (dots, lines, hickeys) occur during manufacturing

**🔍 WHAT SURFACE DEFECTS LOOK LIKE - VISUAL IDENTIFICATION GUIDE:**

**Type 1: Surface White Dots/Spots** (MOST commonly missed - 40-50% of surface defects)
- Appearance: Small white or light-colored dots/spots on card FACE (NOT on edges)
- Size: 0.1-1mm diameter (print dots are usually 0.1-0.3mm)
- Location: Can appear ANYWHERE on surface, most common in bottom third
- Visibility: Most visible on darker backgrounds, solid colors, or uniform areas
- Visual cue: Appear as isolated light spots against background
- Detection tip: Easier to see on solid color zones than busy graphics
- **Surface white dots are handling defects — document and deduct accordingly**

**Type 2: Print Dots** (Factory manufacturing defects)
- Appearance: Tiny white dots in printed areas (0.1-0.3mm diameter)
- Cause: Missing ink from printing process, dust on printing plate
- Pattern: Usually isolated single dots, occasionally clusters
- Location: Most common on solid color backgrounds
- **MANUFACTURING VARIANCE:** Single tiny print dot <0.3mm in non-critical area (border/background) is acceptable for 10.0 — this is a manufacturing defect, not handling wear
- **NO 10.0 if:** Dot >0.3mm OR on critical area (player face, main subject) OR multiple dots

**Type 3: Scratches**
- **Hairline scratches:** <0.2mm wide, <5mm long
  * Barely visible, only seen when light reflects at certain angles
  * Catch light and create thin reflective line
  * Maximum grade impact: 9.5
- **Visible scratches:** ≥0.2mm wide OR ≥5mm long
  * Clearly visible, disrupt surface
  * Catch light easily, create obvious linear marks
  * Maximum grade impact: 9.0 to 8.5 depending on severity

**Type 4: Print Defects**
- **Print lines:** Roller marks, ink streaks, drag lines (horizontal or vertical)
- **Hickeys:** Circular printing defects, donut/ring shapes (0.5-2mm diameter)
- **Registration errors:** Color layer misalignment, ghost images, rainbow halos
- **Missing ink:** Areas where ink didn't adhere properly
- ⚠️ **NOT print defects:** Lines that are part of a card's holographic/parallel DESIGN PATTERN (e.g., Topps Chrome Geometric lines, Mosaic tiles, Prizm waves, Cracked Ice fractures, X-Fractor crosses). If a line REPEATS in a uniform pattern across the card or shifts with viewing angle as part of the holographic effect → it is the card's INTENDED DESIGN, not a defect. Only flag lines that are ISOLATED anomalies independent of the card's pattern.

**Type 5: Stains & Discoloration**
- Wax stains (from wax pack storage)
- Water damage/moisture marks
- Yellowing (aging, UV exposure)
- Ink marks or foreign substances
- Adhesive residue

**Type 6: Surface Damage** (STRUCTURAL - automatic grade caps)
- **Dents/Indentations:** Depressed areas in card surface → Grade cap ≤4.0
- **Creases:** Fold lines that break surface continuity → Grade cap ≤4.0
- **Abrasion patches:** Loss of glossy finish, dull/matte patches

**🔬 MANDATORY SYSTEMATIC SURFACE SCAN - FOLLOW THIS EXACT PROCEDURE:**

**SURFACE GRID SYSTEM:**
Mentally divide EACH card side (front and back) into 9 zones (3x3 grid):

+----------+----------+----------+
| Zone 1   | Zone 2   | Zone 3   |  <- Top Row
+----------+----------+----------+
| Zone 4   | Zone 5   | Zone 6   |  <- Middle Row (Zone 5 = Center)
+----------+----------+----------+
| Zone 7   | Zone 8   | Zone 9   |  <- Bottom Row
+----------+----------+----------+
  Left       Center     Right

**TOTAL ZONES TO INSPECT:** 18 (9 front + 9 back)

**STEP 1: FRONT SURFACE - 9-ZONE SCAN**
⏱️ TIME REQUIRED: 90-140 seconds

For EACH zone, perform systematic inspection:

**Zone 5 (Center)** 🔴 HIGHEST PRIORITY
- Time: 15-20 seconds
- Contains main subject (player face on sports cards, character on TCG)
- Scratches here dramatically impact card appeal
- Check for: white dots, scratches, print defects, stains
- **ANY visible defect in Zone 5 = significant grade impact**

**Zones 2, 4, 6, 8 (Cardinal zones surrounding center)** 🟡 HIGH PRIORITY
- Time: 8-12 seconds EACH (32-48 seconds total)
- Check for: white dots, scratches, print defects, stains
- Solid color backgrounds → Add 5 seconds (defects MOST visible)

**Zones 1, 3, 7, 9 (Corner zones)** 🟢 MODERATE PRIORITY
- Time: 5-8 seconds EACH (20-32 seconds total)
- Check for: white dots, scratches, print defects, stains
- Pay special attention if solid color background

**FOR EACH ZONE, ACTIVELY LOOK FOR:**
✓ **Surface white dots:** Isolated light spots 0.1-1mm (NOT on edge, on surface)
✓ **Print dots:** Tiny white dots in printed areas 0.1-0.3mm
✓ **Scratches:** Hairline (<0.2mm) or visible (≥0.2mm) linear marks
✓ **Print defects:** Lines, hickeys (donuts), registration errors
✓ **Stains:** Discoloration, yellowing, wax marks, water damage
✓ **Surface damage:** Dents, indentations (CRITICAL - 4.0 cap)
✓ **Abrasion:** Dull patches, loss of gloss

**STEP 2: BACK SURFACE - 9-ZONE SCAN**
⏱️ TIME REQUIRED: 90-140 seconds

Repeat the EXACT SAME 9-zone inspection procedure for the back:
- Zone 5 (Center): 15-20 seconds
- Zones 2, 4, 6, 8: 8-12 seconds each
- Zones 1, 3, 7, 9: 5-8 seconds each

**DETECTION TIPS FOR SURFACE DEFECTS:**

1. **Best visibility for white dots/print dots:**
   - Solid color backgrounds (easiest to see defects)
   - Dark backgrounds (white dots appear as bright spots)
   - Uniform areas (defects stand out against consistency)

2. **Best visibility for scratches:**
   - Observe at different angles (scratches catch light)
   - Glossy surfaces (scratches break reflectivity)
   - Light-colored areas (scratches create shadow lines)

3. **Most common locations for surface white dots:**
   - Bottom third of card (40-50% of surface defects)
   - Solid color background areas
   - Border zones (especially white borders)

4. **Protective case artifacts - DO NOT count against card:**
   - Case scratches appear on OUTER layer (not card itself)
   - Scratch spans both card AND holder edge = case artifact
   - Multiple parallel scratches from case handling = case defects
   - Document: "Card grade based on visible card only, case shows scratches"

**✅ PROPER DEFECT DOCUMENTATION EXAMPLES:**

GOOD - Specific and Measurable:
✅ "Front Zone 5 (center): Surface white dot 0.2mm diameter on dark blue background - appears as isolated bright spot"
✅ "Front Zone 8 (bottom center): 3 print dots clustered together, each 0.1mm, on solid red background"
✅ "Back Zone 4: Hairline scratch 4mm length, <0.1mm width - catches light at angle, runs vertically through text area"
✅ "Front Zone 2: Print hickey (donut shape) 1.2mm diameter on yellow background - visible ring pattern"
✅ "Back Zone 7: Small wax stain 2mm diameter in bottom-left border area - slight yellowing visible"

BAD - Vague and Unmeasurable:
❌ "Some surface wear"
❌ "Card looks clean"
❌ "Possible print defect"
❌ "Minor surface issues"

**❌ COMMON MISTAKES TO AVOID:**

1. ❌ "Surface looks clean" without zone-by-zone inspection
2. ❌ Only examining the center/player face and ignoring background/border zones
3. ❌ Missing print dots because they're "just manufacturing variance"
   - They DO matter for grading accuracy
4. ❌ Counting case scratches against the card grade
   - Only grade the CARD, not the protective case
5. ❌ Scanning too quickly when surface appears glossy/clean
   - Glossy surfaces can still have microscopic defects
6. ❌ Missing white dots on solid color backgrounds
   - These are the EASIEST defects to see - scan carefully

**⚠️ CRITICAL VALIDATION - BEFORE FINALIZING GRADE:**

Ask yourself these questions:
1. Did I scan ALL 18 zones (9 front + 9 back)?
2. Did I spend adequate time on Zone 5 center areas? (15-20 seconds each)
3. Did I check solid color backgrounds extra carefully? (defects most visible)
4. Did I find ANY surface defects? (50-60% probability for white dots/print defects)
5. Did I spend adequate time? (Minimum 180-280 seconds for complete surface inspection)

If you answer NO to any question → RE-EXAMINE before finalizing grade

**⚠️ SURFACE VALIDATION:**
- If reporting zero surface defects on a card with large solid color areas, double-check those areas — defects are easiest to spot on solid backgrounds

**GRADE 10.0 — GEM MINT (Virtually Perfect):**

Grade 10.0 is achievable for genuinely exceptional cards. Requirements:

**GRADE 10.0 REQUIREMENTS - ALL must be true:**
✓ No handling defects on corners (no whitening, no wear)
✓ No handling defects on edges (no whitening, no chipping)
✓ No handling defects on surface (no scratches, no scuffs)
✓ A single minor manufacturing print dot (<0.3mm in non-critical area) is acceptable
✓ Centering 55/45 or better on all axes
✓ Zero structural damage

**IF ASSIGNING 10.0 TO ANY CATEGORY:**
1. Verify thorough inspection was completed for that category
2. Confirm no handling defects were found
3. Document what you examined and your findings

⚠️ CRITICAL REMINDERS:
- If you detect an UNVERIFIED AUTOGRAPH → Grade 1.0 (Altered)
- If you detect a CREASE or BENT CORNER → Maximum grade 4.0
- If you detect HANDWRITTEN MARKING → Grade 1.0 (Altered)
- If you detect ANY handling defect on edges/corners → Card is NOT a 10.0
- If you detect ANY scratch or scuff on surface → Card is NOT a 10.0
- Be thorough — inspect carefully, but grade based on what you actually observe

**FINAL VALIDATION CHECKLIST:**

Before submitting your grade, verify you completed ALL these steps:
✅ Checked for protective case/sleeve (Priority 0A)
✅ Verified all 8 corners visible in frame (Priority 0B)
✅ Checked for unverified autograph (Priority 1)
✅ Scanned for creases & structural damage (Priority 2)
✅ Checked for handwritten markings (Priority 3)
✅ Systematically scanned all 4 edges in 5-segment pattern (Priority 4)
✅ Examined all 8 corners for whitening (Priority 4)
✅ Scanned front surface in 9-zone grid (Priority 5)
✅ Scanned back surface in 9-zone grid (Priority 5)
✅ Documented ALL defects found with specific measurements
✅ Applied grade 10.0 reality check if any category scored 10.0

Total minimum inspection time: ~400-600 seconds (7-10 minutes) for thorough grading`;
