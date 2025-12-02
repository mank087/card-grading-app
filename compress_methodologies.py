"""
Compress Grading Methodology sections (Sections 8, 9, 10)
Target: Reduce verbose scoring tables and examples while preserving formulas
"""

# Read the file
with open('prompts/master_grading_rubric_v5.txt', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace verbose methodology sections
# Strategy: Keep core formulas, remove verbose examples and repetitive explanations

# The methodologies are already fairly concise in their formulas
# Main bloat is in examples and verbose step-by-step instructions
# Let's just measure current state for now

lines = content.split('\n')
print(f"Total lines: {len(lines)}")
print(f"Total chars: {len(content)}")
print(f"Estimated tokens: ~{len(content) // 4}")

# Find methodology sections
import re
sections = []
for i, line in enumerate(lines):
    if 'SECTION' in line and 'GRADING METHODOLOGY' in line:
        sections.append((i+1, line.strip()))

print("\nGrading Methodology Sections found:")
for line_num, title in sections:
    print(f"  Line {line_num}: {title}")

# For now, let's just report - we've already made good progress
# Further optimization would require careful review to not lose functionality
print("\nOptimization Progress:")
print("  Section 12 removed: ~185 lines (~4,600 tokens)")
print("  Section 3 simplified: ~57 lines (~1,400 tokens)")
print("  Section 7 compressed: ~233 lines (~5,800 tokens)")
print("  Total saved: ~475 lines (~11,800 tokens)")
print("\nRemaining opportunity:")
print("  Need ~8,000 more tokens reduction")
print("  = ~32,000 more characters")
print("  = ~800 more lines at 40 chars/line average")
