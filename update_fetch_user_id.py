#!/usr/bin/env python3
"""
Update all card detail client files to pass user_id parameter when fetching card data.
"""

import re

# File paths
files_to_update = [
    'src/app/pokemon/[id]/CardDetailClient.tsx',
    'src/app/mtg/[id]/CardDetailClient.tsx',
    'src/app/lorcana/[id]/CardDetailClient.tsx'
]

# Mappings for each card type
card_types = {
    'src/app/pokemon/[id]/CardDetailClient.tsx': {
        'api_name': 'pokemon',
        'function_name': 'fetchPokemonCardDetails'
    },
    'src/app/mtg/[id]/CardDetailClient.tsx': {
        'api_name': 'mtg',
        'function_name': 'fetchMTGCardDetails'
    },
    'src/app/lorcana/[id]/CardDetailClient.tsx': {
        'api_name': 'lorcana',
        'function_name': 'fetchLorcanaCardDetails'
    }
}

for file_path in files_to_update:
    print(f"\n{'='*60}")
    print(f"Processing: {file_path}")
    print('='*60)

    card_type = card_types[file_path]
    api_name = card_type['api_name']

    # Read the file
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern 1: Update the initial fetch call to add user session and parameter
    pattern1_old = f'''  const {card_type['function_name']} = useCallback(async () => {{
    if (!cardId) return;

    try {{
      setLoading(true);
      setError(null);
      setIsProcessing(false);

      console.log(`Fetching {api_name} card details for: ${{cardId}}`);
      const res = await fetch(`/api/{api_name}/${{cardId}}?t=${{Date.now()}}`); // Cache-busting
      console.log(`{api_name.capitalize()} API response status: ${{res.status}}`);'''

    pattern1_new = f'''  const {card_type['function_name']} = useCallback(async () => {{
    if (!cardId) return;

    try {{
      setLoading(true);
      setError(null);
      setIsProcessing(false);

      // Get user session to pass user_id for private card access
      const session = getStoredSession();
      const userParam = session?.user?.id ? `&user_id=${{session.user.id}}` : '';

      console.log(`Fetching {api_name} card details for: ${{cardId}}`);
      const res = await fetch(`/api/{api_name}/${{cardId}}?t=${{Date.now()}}${{userParam}}`); // Cache-busting
      console.log(`{api_name.capitalize()} API response status: ${{res.status}}`);'''

    # Pattern 2: Update retry fetch call
    pattern2_old = f'''              console.log(`Retry ${{attempt}}: Calling /api/{api_name}/${{cardId}}`);
              const retryRes = await fetch(`/api/{api_name}/${{cardId}}?t=${{Date.now()}}`); // Cache-busting'''

    pattern2_new = f'''              console.log(`Retry ${{attempt}}: Calling /api/{api_name}/${{cardId}}`);
              const retryRes = await fetch(`/api/{api_name}/${{cardId}}?t=${{Date.now()}}${{userParam}}`); // Cache-busting'''

    # Apply replacements
    content_updated = content

    # First pattern - use regex for more flexibility
    pattern1_regex = rf'''(const {card_type['function_name']} = useCallback\(async \(\) => {{\s+if \(!cardId\) return;\s+try {{\s+setLoading\(true\);\s+setError\(null\);\s+setIsProcessing\(false\);\s+console\.log\(`Fetching {api_name} card details for: \${{cardId}}`\);\s+const res = await fetch\(`/api/{api_name}/\${{cardId}}\?t=\${{Date\.now\(\)}}`\);)'''

    replacement1 = rf'''const {card_type['function_name']} = useCallback(async () => {{
    if (!cardId) return;

    try {{
      setLoading(true);
      setError(null);
      setIsProcessing(false);

      // Get user session to pass user_id for private card access
      const session = getStoredSession();
      const userParam = session?.user?.id ? `&user_id=${{session.user.id}}` : '';

      console.log(`Fetching {api_name} card details for: ${{cardId}}`);
      const res = await fetch(`/api/{api_name}/${{cardId}}?t=${{Date.now()}}${{userParam}}`);'''

    if pattern2_old in content_updated:
        content_updated = content_updated.replace(pattern2_old, pattern2_new)
        print(f"✓ Updated retry fetch call")
    else:
        print(f"⚠ Could not find retry fetch pattern")

    # Write back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content_updated)

    print(f"✓ Completed: {file_path}")

print(f"\n{'='*60}")
print("All files processed!")
print('='*60)
