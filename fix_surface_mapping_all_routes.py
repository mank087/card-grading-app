#!/usr/bin/env python3
"""
Fix surface mapping in all API routes to use .condition (v5) instead of .analysis
and prioritize .summary over .front_summary/.back_summary
"""

import re

OLD_FRONT_SURFACE = r'''([ ]*// Front surface\n[ ]*front_surface: \{\n[ ]*defects: parsedJSONData\.surface\?\.front\?\.defects \|\| \[\],\n[ ]*)analysis: parsedJSONData\.surface\?\.front\?\.analysis \|\| 'No analysis available',(\n[ ]*sub_score: parsedJSONData\.raw_sub_scores\?\.surface_front \|\| 0,\n[ ]*)summary: parsedJSONData\.surface\?\.front_summary \|\| parsedJSONData\.surface\?\.front\?\.summary \|\| 'Surface analysis not available'(\n[ ]*\},)'''

NEW_FRONT_SURFACE = r'''\1analysis: parsedJSONData.surface?.front?.condition || parsedJSONData.surface?.front?.analysis || 'No analysis available',\2summary: parsedJSONData.surface?.front?.summary || parsedJSONData.surface?.front_summary || 'Surface analysis not available'\3'''

OLD_BACK_SURFACE = r'''([ ]*// Back surface\n[ ]*back_surface: \{\n[ ]*defects: parsedJSONData\.surface\?\.back\?\.defects \|\| \[\],\n[ ]*)analysis: parsedJSONData\.surface\?\.back\?\.analysis \|\| 'No analysis available',(\n[ ]*sub_score: parsedJSONData\.raw_sub_scores\?\.surface_back \|\| 0,\n[ ]*)summary: parsedJSONData\.surface\?\.back_summary \|\| parsedJSONData\.surface\?\.back\?\.summary \|\| 'Surface analysis not available'(\n[ ]*\})'''

NEW_BACK_SURFACE = r'''\1analysis: parsedJSONData.surface?.back?.condition || parsedJSONData.surface?.back?.analysis || 'No analysis available',\2summary: parsedJSONData.surface?.back?.summary || parsedJSONData.surface?.back_summary || 'Surface analysis not available'\3'''

def update_file(filepath, card_type):
    """Update surface mapping in API route"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        updated = False

        # Fix front surface
        pattern_front = re.compile(OLD_FRONT_SURFACE, re.MULTILINE)
        if pattern_front.search(content):
            content = pattern_front.sub(NEW_FRONT_SURFACE, content)
            updated = True

        # Fix back surface
        pattern_back = re.compile(OLD_BACK_SURFACE, re.MULTILINE)
        if pattern_back.search(content):
            content = pattern_back.sub(NEW_BACK_SURFACE, content)
            updated = True

        if updated:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)

        return updated
    except Exception as e:
        print(f"Error processing {card_type}: {e}")
        return None

def main():
    files = [
        ('pokemon', r'C:\Users\benja\card-grading-app\src\app\api\pokemon\[id]\route.ts'),
        ('mtg', r'C:\Users\benja\card-grading-app\src\app\api\mtg\[id]\route.ts'),
        ('lorcana', r'C:\Users\benja\card-grading-app\src\app\api\lorcana\[id]\route.ts'),
        ('other', r'C:\Users\benja\card-grading-app\src\app\api\other\[id]\route.ts'),
    ]

    print("=" * 70)
    print("FIXING SURFACE MAPPING IN ALL API ROUTES")
    print("=" * 70)
    print()

    updated = []
    skipped = []
    errors = []

    for card_type, filepath in files:
        print(f"Processing {card_type}...", end=" ")
        result = update_file(filepath, card_type)

        if result is True:
            print("[OK] Updated")
            updated.append(card_type)
        elif result is False:
            print("[SKIP] Already updated or pattern not found")
            skipped.append(card_type)
        else:
            print("[ERROR]")
            errors.append(card_type)

    print()
    print("=" * 70)
    print(f"Updated: {len(updated)} files")
    print(f"Skipped: {len(skipped)} files")
    print(f"Errors: {len(errors)} files")
    print("=" * 70)
    print()
    print("NOTE: Sports card was already updated manually")
    print()
    print("CHANGES MADE:")
    print("1. surface?.front?.condition prioritized over surface?.front?.analysis")
    print("2. surface?.front?.summary prioritized over surface?.front_summary")
    print("3. Same for back surface")

if __name__ == "__main__":
    main()
