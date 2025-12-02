#!/usr/bin/env python3
"""
Update master rubric to limit subgrade summaries to 2-3 sentences max.
This prevents overly verbose descriptions while keeping overall summary detailed.
"""

def update_master_rubric():
    file_path = r"C:\Users\benja\card-grading-app\prompts\master_grading_rubric_v5.txt"

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Track changes
    changes = []

    # Update corner summaries (front and back)
    old1 = '"summary": "MINIMUM 2 SENTENCES: Overall front corners condition, how grade determined, reference specific observations from THIS card"'
    new1 = '"summary": "2-3 SENTENCES MAXIMUM: Overall front corners condition, how grade determined, reference specific observations from THIS card"'
    if old1 in content:
        content = content.replace(old1, new1)
        changes.append("[OK] Updated front corners summary")

    old2 = '"summary": "MINIMUM 2 SENTENCES: Independent back corners analysis"'
    new2 = '"summary": "2-3 SENTENCES MAXIMUM: Independent back corners analysis"'
    if old2 in content:
        content = content.replace(old2, new2)
        changes.append("[OK] Updated back corners summary")

    # Update edge summaries (front and back)
    old3 = '"summary": "MINIMUM 2 SENTENCES - (1) Synthesize overall edge condition, (2) Explain HOW you determined the grade"'
    new3 = '"summary": "2-3 SENTENCES MAXIMUM - (1) Synthesize overall edge condition, (2) Explain HOW you determined the grade"'
    if old3 in content:
        content = content.replace(old3, new3)
        changes.append("[OK] Updated front edges summary")

    old4 = '"summary": "MINIMUM 2 SENTENCES: Independent back edges analysis"'
    new4 = '"summary": "2-3 SENTENCES MAXIMUM: Independent back edges analysis"'
    if old4 in content:
        content = content.replace(old4, new4)
        changes.append("[OK] Updated back edges summary")

    # Update surface summaries (front and back)
    old5 = '"summary": "MINIMUM 2 SENTENCES - (1) Overall surface assessment, (2) How grade was determined"'
    new5 = '"summary": "2-3 SENTENCES MAXIMUM - (1) Overall surface assessment, (2) How grade was determined"'
    if old5 in content:
        content = content.replace(old5, new5)
        changes.append("[OK] Updated front surface summary")

    old6 = '"summary": "MINIMUM 2 SENTENCES: Independent back surface analysis"'
    new6 = '"summary": "2-3 SENTENCES MAXIMUM: Independent back surface analysis"'
    if old6 in content:
        content = content.replace(old6, new6)
        changes.append("[OK] Updated back surface summary")

    # Update individual corner condition descriptions
    old7 = '"condition": "MINIMUM 2 SENTENCES describing THIS specific corner with actual colors and nearby design elements"'
    new7 = '"condition": "2-3 SENTENCES MAXIMUM describing THIS specific corner with actual colors and nearby design elements"'
    if old7 in content:
        content = content.replace(old7, new7)
        changes.append("[OK] Updated corner condition descriptions")

    # Update individual edge condition descriptions
    old8 = '"condition": "MINIMUM 2 SENTENCES - (1) Describe what you observe on THIS SPECIFIC edge mentioning ACTUAL colors/design elements visible along it, (2) Explain how THIS edge\'s characteristics affect visibility and assessment"'
    new8 = '"condition": "2-3 SENTENCES MAXIMUM - (1) Describe what you observe on THIS SPECIFIC edge mentioning ACTUAL colors/design elements visible along it, (2) Explain how THIS edge\'s characteristics affect visibility and assessment"'
    if old8 in content:
        content = content.replace(old8, new8)
        changes.append("[OK] Updated edge condition descriptions")

    # Update individual surface condition descriptions
    old9 = '"condition": "MINIMUM 2 SENTENCES - (1) Describe THIS card\'s surface with actual finish characteristics and colors, (2) Note any defects observed or confirm pristine condition with specifics"'
    new9 = '"condition": "2-3 SENTENCES MAXIMUM - (1) Describe THIS card\'s surface with actual finish characteristics and colors, (2) Note any defects observed or confirm pristine condition with specifics"'
    if old9 in content:
        content = content.replace(old9, new9)
        changes.append("[OK] Updated surface condition descriptions")

    # Write updated content
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    # Report changes
    print("=" * 60)
    print("MASTER RUBRIC UPDATE - SUBGRADE SUMMARY LIMITS")
    print("=" * 60)
    for change in changes:
        print(change)
    print()
    print(f"Total changes: {len(changes)}")
    print("=" * 60)
    print()
    print("NOTE: Centering analysis kept at MINIMUM 3 SENTENCES (detailed measurements needed)")
    print("NOTE: Overall final summary has no length limit (detailed overview desired)")

if __name__ == "__main__":
    update_master_rubric()
