"""
Script to apply centering analysis updates to all remaining card types.
This updates Sports (back section), Lorcana, MTG, and Other CardDetailClient files.
"""
import re

# Files to update
files = [
    r'C:\Users\benja\card-grading-app\src\app\sports\[id]\CardDetailClient.tsx',
    r'C:\Users\benja\card-grading-app\src\app\lorcana\[id]\CardDetailClient.tsx',
    r'C:\Users\benja\card-grading-app\src\app\mtg\[id]\CardDetailClient.tsx',
    r'C:\Users\benja\card-grading-app\src\app\other\[id]\CardDetailClient.tsx',
]

print("✅ Script ready. Please run manually for each file to continue updates.")
print("Due to file size, continuing updates through individual edits...")
