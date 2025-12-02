#!/usr/bin/env python3
"""
Fix case detection display in all CardDetailClient files.
- Show case_detection even when case_type is "none"
- Display all fields (case_type, case_visibility, impact_level, adjusted_uncertainty, notes)
- Use conditional styling based on whether a case is detected
"""

import re

OLD_CODE = r'''                      {/\* Protective Case Detection - Integrated into Confidence \*/}
                      {\(\(\) => \{
                        const caseDetection = card\.conversational_case_detection \|\| dvgGrading\.case_detection;
                        return caseDetection && caseDetection\.case_type && caseDetection\.case_type !== 'none' && \(
                        <div className="mt-4 bg-blue-50 border-2 border-blue-300 rounded-lg p-4 shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-blue-800 mb-2">
                                Protective Case Detected: \{caseDetection\.case_type\.replace\(/_/g, ' '\)\.toUpperCase\(\)\}
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                <div className="bg-white rounded p-3 border border-blue-200">
                                  <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Visibility</p>
                                  <p className="font-semibold text-blue-700 capitalize">\{caseDetection\.visibility\}</p>
                                </div>
                                <div className="bg-white rounded p-3 border border-blue-200">
                                  <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Impact Level</p>
                                  <p className="font-semibold text-blue-700 capitalize">\{caseDetection\.impact_level\}</p>
                                </div>
                                \{caseDetection\.adjusted_uncertainty && \(
                                  <div className="bg-white rounded p-3 border border-blue-200">
                                    <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Adjusted Uncertainty</p>
                                    <p className="font-semibold text-blue-700">\{caseDetection\.adjusted_uncertainty\}</p>
                                  </div>
                                \)\}
                              </div>
                              \{caseDetection\.notes && \(
                                <p className="text-xs text-blue-700 mt-3 italic">
                                  \{caseDetection\.notes\}
                                </p>
                              \)\}
                              <p className="text-xs text-blue-700 mt-2 italic">
                                Note: Protective cases may limit visibility of minor defects and can increase grade uncertainty\.
                              </p>
                            </div>
                          </div>
                        </div>
                        \);
                      }\)\(\)\}'''

NEW_CODE = '''                      {/* Protective Case Detection - Integrated into Confidence */}
                      {(() => {
                        const caseDetection = card.conversational_case_detection || dvgGrading.case_detection;
                        if (!caseDetection) return null;

                        const caseType = caseDetection.case_type || 'none';
                        const caseVisible = caseType !== 'none';
                        const bgColor = caseVisible ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-300';
                        const titleColor = caseVisible ? 'text-blue-800' : 'text-gray-700';
                        const accentColor = caseVisible ? 'text-blue-700 border-blue-200' : 'text-gray-600 border-gray-200';

                        return (
                        <div className={`mt-4 ${bgColor} border-2 rounded-lg p-4 shadow-sm`}>
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <h3 className={`text-lg font-bold ${titleColor} mb-2`}>
                                {caseVisible
                                  ? `Protective Case Detected: ${caseType.replace(/_/g, ' ').toUpperCase()}`
                                  : 'Protective Case Detection'}
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                <div className="bg-white rounded p-3 border border-gray-200">
                                  <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Case Type</p>
                                  <p className={`font-semibold ${accentColor} capitalize`}>
                                    {caseType === 'none' ? 'No Case' : caseType.replace(/_/g, ' ')}
                                  </p>
                                </div>
                                {caseDetection.case_visibility && (
                                  <div className="bg-white rounded p-3 border border-gray-200">
                                    <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Visibility</p>
                                    <p className={`font-semibold ${accentColor} capitalize`}>{caseDetection.case_visibility}</p>
                                  </div>
                                )}
                                {caseDetection.impact_level && (
                                  <div className="bg-white rounded p-3 border border-gray-200">
                                    <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Impact Level</p>
                                    <p className={`font-semibold ${accentColor} capitalize`}>{caseDetection.impact_level}</p>
                                  </div>
                                )}
                                {caseDetection.adjusted_uncertainty && (
                                  <div className="bg-white rounded p-3 border border-gray-200">
                                    <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Uncertainty Adjustment</p>
                                    <p className={`font-semibold ${accentColor}`}>{caseDetection.adjusted_uncertainty}</p>
                                  </div>
                                )}
                              </div>
                              {caseDetection.notes && (
                                <p className={`text-xs ${accentColor} mt-3 italic`}>
                                  {caseDetection.notes}
                                </p>
                              )}
                              {caseVisible && (
                                <p className="text-xs text-blue-700 mt-2 italic">
                                  Note: Protective cases may limit visibility of minor defects and can increase grade uncertainty.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        );
                      })()}'''

def update_file(filepath, card_type):
    """Update a single CardDetailClient file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find and replace the old code
        pattern = re.compile(OLD_CODE, re.MULTILINE)
        if pattern.search(content):
            new_content = pattern.sub(NEW_CODE, content)

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
    print("FIXING CASE DETECTION DISPLAY")
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
            print("[SKIP] Pattern not found")
            skipped.append(card_type)
        else:
            print("[ERROR]")
            errors.append(card_type)

    print()
    print("=" * 70)
    print(f"Updated: {len(updated)} files")
    print(f"Skipped: {len(skipped)} files (may already be updated)")
    print(f"Errors: {len(errors)} files")
    print("=" * 70)
    print()
    print("NOTE: Sports card was already updated manually")

if __name__ == "__main__":
    main()
