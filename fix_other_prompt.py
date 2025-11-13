#!/usr/bin/env python3
"""Fix the Other card prompt by copying Sports prompt and modifying Step 1"""

# Read the sports prompt
with open('prompts/conversational_grading_v4_2_ENHANCED_STRICTNESS.txt', 'r', encoding='utf-8') as f:
    sports_prompt = f.read()

# Replace header
sports_prompt = sports_prompt.replace(
    'SYSTEM / INSTRUCTION PROMPT – JSON Card Grader v4.2 ENHANCED STRICTNESS',
    'SYSTEM / INSTRUCTION PROMPT – JSON Card Grader v4.2 ENHANCED STRICTNESS – OTHER CARDS EDITION'
)

sports_prompt = sports_prompt.replace(
    '🎯 FIXES: Prevents false 10.0 scores for cards with visible defects (white dots, fiber exposure, surface scratches)',
    '🎯 FIXES: Prevents false 10.0 scores for cards with visible defects (white dots, fiber exposure, surface scratches)\n⚡ OTHER CARDS CATEGORY: Simplified field extraction for miscellaneous collectible cards (non-sports, non-TCG)'
)

sports_prompt = sports_prompt.replace(
    'Complete card information extraction BEFORE condition evaluation to ensure correct feature recognition (foil finish, die-cut edges, relic windows affect interpretation).',
    'Complete card information extraction BEFORE condition evaluation to ensure correct feature recognition (special finishes, die-cut edges, memorabilia patches affect interpretation).'
)

# Find Step 1 start and end
step1_start = sports_prompt.find('[STEP 1] CARD INFORMATION EXTRACTION')
step2_start = sports_prompt.find('[STEP 2] IMAGE QUALITY & CONFIDENCE ASSESSMENT')

if step1_start == -1 or step2_start == -1:
    print("ERROR: Could not find step boundaries")
    exit(1)

# Create new Step 1 for Other cards
new_step1 = '''[STEP 1] CARD INFORMATION EXTRACTION
═══════════════════════════════════════════════════════════════════════════════

🎯 PURPOSE: Extract basic card identification information for miscellaneous collectible cards.

⚡ OTHER CARDS PHILOSOPHY:
• Simplified data extraction (no game-specific fields)
• Flexible text capture (front and back text)
• Universal approach for diverse card types

────────────────────────────────────────────
REQUIRED FIELDS TO EXTRACT
────────────────────────────────────────────

**1. CARD NAME** (string, required)
Primary title/name visible on the card.
• Check front of card for main title
• If no clear name, use most prominent text
• Example: "Hound Doug", "Star Wars - Luke Skywalker", "Mickey Mouse"

**2. SET NAME** (string)
Series or collection name if applicable.
• Look for set designation on front or back
• Check copyright area for series information
• Example: "Garbage Pail Kids", "Star Wars Series 1", "Disney Classics"
• Use "Unknown" if no set name is visible

**3. MANUFACTURER** (string or null)
Card publisher/manufacturer if visible.
• Check for company name/logo on card
• Common locations: front logo, back copyright text
• Example: "Topps", "Panini", "Upper Deck", "Fleer"
• Use null if not visible

**4. CARD DATE** (string or null)
Year or date visible on card if applicable.
• Check copyright text on back
• Check front for year designation
• Can be year (e.g., "2020") or full date (e.g., "2020-05-15")
• Use null if not visible

**5. CARD NUMBER** (string or null)
Number within set if applicable.
• Usually on front or back of card
• May include letters (e.g., "82a", "C-3", "12/100")
• Use null if no numbering visible

**6. SPECIAL FEATURES** (string or null)
Notable features or variations.
• Check for: Autograph, Memorabilia/Relic, Serial Numbered, Holographic, Embossed, Die-Cut
• List all that apply, comma-separated
• Example: "Autographed, Serial Numbered /100"
• Example: "Holographic Foil"
• Use null if no special features

**7. FRONT TEXT** (string, required)
Extract ALL visible text from the front of the card.
• Include: names, titles, descriptions, stats, quotes, copyright info
• Maintain original formatting where possible
• Be thorough - capture everything readable
• If no text visible, state: "No visible text"

**8. BACK TEXT** (string, required)
Extract ALL visible text from the back of the card.
• Include: descriptions, bios, stats, legal text, copyright
• Maintain original formatting where possible
• Be thorough - capture everything readable
• If no text visible, state: "No visible text"

────────────────────────────────────────────
EXTRACTION GUIDELINES
────────────────────────────────────────────

**Text Extraction Best Practices:**
• Read text carefully - don't rush
• Include punctuation and formatting
• Note if text is partially obscured
• Capture both English and non-English text
• Include numbers, codes, and copyright info

**Common Card Types in "Other" Category:**
• Trading cards (non-sports, non-TCG)
• Entertainment cards (movies, TV shows, music)
• Art cards and limited editions
• Promotional and advertising cards
• Historical and educational cards
• Collectible stickers and inserts

**What NOT to Extract:**
• Don't invent information not visible
• Don't guess at obscured text
• Don't translate foreign language text
• Don't correct spelling errors in original text

**If Information is Missing:**
• Use null for optional fields (manufacturer, date, number, special_features)
• Use "Unknown" only for set_name
• Never use null for card_name, front_text, or back_text

'''

# Replace Step 1 in the prompt
new_prompt = (
    sports_prompt[:step1_start] +
    new_step1 +
    sports_prompt[step2_start:]
)

# Write the new Other prompt
with open('prompts/other_conversational_grading_v4_2.txt', 'w', encoding='utf-8') as f:
    f.write(new_prompt)

print("[OK] Other card prompt created successfully")
print(f"   Original sports prompt: {len(sports_prompt)} characters")
print(f"   New other prompt: {len(new_prompt)} characters")
print(f"   Changed Step 1 only - all grading methodology identical to sports")
