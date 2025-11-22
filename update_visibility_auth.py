import re

files = [
    r"C:\Users\benja\card-grading-app\src\app\pokemon\[id]\CardDetailClient.tsx",
    r"C:\Users\benja\card-grading-app\src\app\mtg\[id]\CardDetailClient.tsx",
    r"C:\Users\benja\card-grading-app\src\app\lorcana\[id]\CardDetailClient.tsx"
]

old_pattern = r'''  // 🔒 Toggle card visibility
  const toggleVisibility = async \(\) => \{
    try \{
      if \(!card\) return;

      const newVisibility = visibility === 'public' \? 'private' : 'public';

      setIsTogglingVisibility\(true\);

      const response = await fetch\(`/api/cards/\$\{card\.id\}/visibility`, \{
        method: 'PATCH',
        headers: \{
          'Content-Type': 'application/json',
        \},
        body: JSON\.stringify\(\{ visibility: newVisibility \}\),
      \}\);'''

new_text = '''  // 🔒 Toggle card visibility
  const toggleVisibility = async () => {
    try {
      if (!card) return;

      const newVisibility = visibility === 'public' ? 'private' : 'public';

      setIsTogglingVisibility(true);

      // Get user session for authentication
      const session = getStoredSession();
      if (!session || !session.user) {
        throw new Error('You must be logged in to change visibility');
      }

      const response = await fetch(`/api/cards/${card.id}/visibility?user_id=${session.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ visibility: newVisibility }),
      });'''

for file_path in files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace the pattern
        updated_content = re.sub(old_pattern, new_text, content)
        
        if updated_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            print(f"✅ Updated: {file_path}")
        else:
            print(f"⚠️  No match found in: {file_path}")
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")

print("\n✅ All files processed!")
