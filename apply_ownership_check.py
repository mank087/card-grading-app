#!/usr/bin/env python3
"""
Add ownership check to hide visibility and re-grade buttons from non-owners
"""

import re

# Card types and their file paths
card_types = {
    'pokemon': {
        'file': 'src/app/pokemon/[id]/CardDetailClient.tsx',
        'badge': '🎴 Pokemon Card',
        'link': 'Pokemon Upload'
    },
    'mtg': {
        'file': 'src/app/mtg/[id]/CardDetailClient.tsx',
        'badge': '🧙 Magic Card',
        'link': 'MTG Upload'
    },
    'lorcana': {
        'file': 'src/app/lorcana/[id]/CardDetailClient.tsx',
        'badge': '🎭 Lorcana Card',
        'link': 'Lorcana Upload'
    }
}

for card_name, card_info in card_types.items():
    file_path = card_info['file']
    badge_text = card_info['badge']

    print(f"\n{'='*60}")
    print(f"Processing: {file_path}")
    print('='*60)

    # Read the file
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern to find and replace the button section
    # Looking for the structure with badge, visibility button, and re-grade button
    pattern = re.compile(
        r'(<div className="flex items-center space-x-4">\s+'
        r'<div className="inline-flex items-center px-3 py-1 bg-\w+-100 text-\w+-800 rounded-full text-sm font-medium">\s+'
        rf'{re.escape(badge_text)}\s+'
        r'</div>\s+'
        r'{/\* 🔒 Visibility Toggle Button \*/}\s+'
        r'<button\s+onClick=\{\(\) => \{.*?'
        r'</button>\s+'
        r'<button\s+onClick=\{regradeCard\}.*?'
        r'</button>\s+'
        r'</div>)',
        re.DOTALL
    )

    # Check if pattern exists
    if not pattern.search(content):
        print(f"❌ Could not find button section in {file_path}")
        continue

    # Create replacement with ownership check
    def create_replacement(match):
        # Extract the button section
        section = match.group(0)

        # Find the visibility button and re-grade button
        visibility_btn_pattern = r'({/\* 🔒 Visibility Toggle Button \*/}.*?</button>)'
        regrade_btn_pattern = r'(<button\s+onClick=\{regradeCard\}.*?</button>)'

        visibility_btn = re.search(visibility_btn_pattern, section, re.DOTALL)
        regrade_btn = re.search(regrade_btn_pattern, section, re.DOTALL)

        if not visibility_btn or not regrade_btn:
            return section

        # Build new section with ownership check
        new_section = f'''<div className="flex items-center space-x-4">
          <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {badge_text}
          </div>
          {{/* Only show visibility toggle and re-grade buttons to card owner */}}
          {{(() => {{
            const session = getStoredSession();
            const isOwner = session?.user?.id && card?.user_id && session.user.id === card.user_id;

            if (!isOwner) return null;

            return (
              <>
                {visibility_btn.group(1)}
                {regrade_btn.group(1)}
              </>
            );
          }})()}}
        </div>'''

        return new_section

    # Apply replacement
    content_updated = pattern.sub(create_replacement, content)

    # Write back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content_updated)

    print(f"✅ Updated {file_path}")

print(f"\n{'='*60}")
print("All files processed!")
print('='*60)
