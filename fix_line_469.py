#!/usr/bin/env python3
"""
Fix line 469 in visionGrader.ts - replace the malformed giant line with simple assignment
"""

# Read the file
with open('src/lib/visionGrader.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 469 is index 468 (0-based)
# Check if it's the problematic line
if lines[468].startswith('    const userMessageText = ENHANCED_USER_MESSAGE'):
    # Replace with the simple, correct version
    lines[468] = '    const userMessageText = ENHANCED_USER_MESSAGE;\n'
    print("SUCCESS: Fixed line 469")
else:
    print("WARNING: Line 469 doesn't match expected pattern")
    print("Line 469 starts with:", lines[468][:100])

# Write back
with open('src/lib/visionGrader.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("File written successfully")
