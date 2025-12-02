#!/usr/bin/env python3
"""
Add case_detection to dvgGrading object construction in all CardDetailClient files.
This ensures dvgGrading.case_detection is available as a fallback.
"""

import re

def update_file(filepath, card_type):
    """Add case_detection to dvgGrading object"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Pattern to find the recommended_grade section in dvgGrading
        old_pattern = r'''([ ]*// 🆕 Include recommended_grade if we have conversational grade \(matches Pokemon pattern\)\n[ ]*\.\.\.\(card\.conversational_decimal_grade \? \{\n[ ]*recommended_grade: \{\n[ ]*recommended_decimal_grade: card\.conversational_decimal_grade,\n[ ]*recommended_whole_grade: card\.conversational_whole_grade,\n[ ]*grade_uncertainty: card\.conversational_grade_uncertainty\n[ ]*\}\n[ ]*\} : \{\}\))(\n[ ]*\};)'''

        new_text = r'''\1,
    // 🆕 Include case_detection from conversational data (v5.0)
    ...(card.conversational_case_detection ? {
      case_detection: card.conversational_case_detection
    } : {})\2'''

        pattern = re.compile(old_pattern, re.MULTILINE)
        if pattern.search(content):
            new_content = pattern.sub(new_text, content)

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)

            return True
        else:
            return False
    except Exception as e:
        print(f"Error processing {card_type}: {e}")
        return None

def main():
    files = [
        ('pokemon', r'C:\Users\benja\card-grading-app\src\app\pokemon\[id]\CardDetailClient.tsx'),
        ('mtg', r'C:\Users\benja\card-grading-app\src\app\mtg\[id]\CardDetailClient.tsx'),
        ('lorcana', r'C:\Users\benja\card-grading-app\src\app\lorcana\[id]\CardDetailClient.tsx'),
        ('other', r'C:\Users\benja\card-grading-app\src\app\other\[id]\CardDetailClient.tsx'),
    ]

    print("=" * 70)
    print("ADDING CASE_DETECTION TO DVGGRADING OBJECT")
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
            print("[SKIP] Pattern not found (may already be updated)")
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

if __name__ == "__main__":
    main()
