#!/usr/bin/env python3
"""
Fix visionGrader.ts to use ENHANCED_USER_MESSAGE properly
"""

import re

# Read the file
with open('src/lib/visionGrader.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the malformed userMessageText assignment
# Pattern: from "const userMessageText = ENHANCED_USER_MESSAGE" to the end of that giant string
pattern = r"const userMessageText = ENHANCED_USER_MESSAGE;.*?- Be APPROPRIATELY CRITICAL - look for defects, don't assume perfection';"

replacement = "const userMessageText = ENHANCED_USER_MESSAGE;"

# Perform the replacement
fixed_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Write back
with open('src/lib/visionGrader.ts', 'w', encoding='utf-8') as f:
    f.write(fixed_content)

print("DONE: Fixed visionGrader.ts")
print("DONE: userMessageText now properly uses ENHANCED_USER_MESSAGE constant")
