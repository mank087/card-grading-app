#!/usr/bin/env python3
"""
Add processing time to markdown format DCM Optic reports.
The JSON format already has it, but markdown format was missing it.
"""

import re

def update_card_detail_client(file_path, card_type):
    """Update a CardDetailClient file to add processing time to markdown meta section"""

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern to find the markdown meta section
    old_pattern = re.compile(
        r'([ ]*{/\* Meta Information \*/}\n'
        r'[ ]*{meta && \(\n'
        r'[ ]*<div className="mt-8 pt-8 border-t-2 border-gray-300 bg-gray-50 -mx-8 -mb-8 px-8 py-6">\n'
        r'[ ]*<h4 className="text-lg font-bold text-gray-900 mb-3">Evaluation Details</h4>\n'
        r'[ ]*<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">\n'
        r'[ ]*<div>\n'
        r'[ ]*<span className="font-semibold text-gray-700">Prompt Version:</span>\{\' \'\}\n'
        r'[ ]*<span className="text-gray-600">\{meta\.promptVersion\}</span>\n'
        r'[ ]*</div>\n'
        r'[ ]*<div>\n'
        r'[ ]*<span className="font-semibold text-gray-700">Evaluation Date:</span>\{\' \'\}\n'
        r'[ ]*<span className="text-gray-600">\{meta\.evaluationDate\}</span>\n'
        r'[ ]*</div>\n'
        r'[ ]*</div>\n'
        r'[ ]*</div>\n'
        r'[ ]*\)\})',
        re.MULTILINE
    )

    new_text = '''                            {/* Meta Information */}
                            {meta && (
                              <div className="mt-8 pt-8 border-t-2 border-gray-300 bg-gray-50 -mx-8 -mb-8 px-8 py-6">
                                <h4 className="text-lg font-bold text-gray-900 mb-3">Evaluation Details</h4>
                                <div className="space-y-3 text-sm">
                                  {/* Prompt Version - Full Width */}
                                  <div>
                                    <span className="font-semibold text-gray-700">Prompt Version:</span>{' '}
                                    <span className="text-gray-600">{meta.promptVersion}</span>
                                  </div>
                                  {/* Evaluation Date and Processing Time - Side by Side */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <span className="font-semibold text-gray-700">Evaluation Date:</span>{' '}
                                      <span className="text-gray-600">{meta.evaluationDate}</span>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-gray-700">Processing Time:</span>{' '}
                                      <span className="text-gray-600">
                                        {card.processing_time ? `${(card.processing_time / 1000).toFixed(1)}s` : 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}'''

    # Check if pattern found
    match = old_pattern.search(content)
    if match:
        content = old_pattern.sub(new_text, content)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return True
    else:
        return False

def main():
    card_types = [
        ('pokemon', r'C:\Users\benja\card-grading-app\src\app\pokemon\[id]\CardDetailClient.tsx'),
        ('mtg', r'C:\Users\benja\card-grading-app\src\app\mtg\[id]\CardDetailClient.tsx'),
        ('lorcana', r'C:\Users\benja\card-grading-app\src\app\lorcana\[id]\CardDetailClient.tsx'),
        ('other', r'C:\Users\benja\card-grading-app\src\app\other\[id]\CardDetailClient.tsx'),
    ]

    print("=" * 70)
    print("ADDING PROCESSING TIME TO MARKDOWN DCM OPTIC REPORTS")
    print("=" * 70)
    print()

    updated = []
    skipped = []

    for card_type, file_path in card_types:
        print(f"Processing {card_type}...", end=" ")
        try:
            if update_card_detail_client(file_path, card_type):
                print("[OK] Updated")
                updated.append(card_type)
            else:
                print("[SKIP] Pattern not found or already updated")
                skipped.append(card_type)
        except Exception as e:
            print(f"[ERROR] {e}")
            skipped.append(card_type)

    print()
    print("=" * 70)
    print(f"Updated: {len(updated)} files")
    print(f"Skipped: {len(skipped)} files")
    print("=" * 70)
    print()
    print("NOTE: Sports card type was already updated manually")

if __name__ == "__main__":
    main()
