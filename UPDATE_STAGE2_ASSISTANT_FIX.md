# Update Stage 2 Assistant - Autograph Bug Fix

## Issue
Stage 2 assistant is incorrectly marking cards as "altered" when there is NO autograph, just because authentication markers say "NO".

## Fix
Update your Stage 2 assistant (`asst_y40OPW6EmLEYupot4ltRwZMT`) with the corrected instructions.

## Steps

1. **Go to OpenAI Platform:**
   - https://platform.openai.com/assistants
   - Find assistant ID: `asst_y40OPW6EmLEYupot4ltRwZMT`

2. **Replace Instructions:**
   - Copy the ENTIRE contents of: `ai_prompts/stage2_instructions_v3_1.txt`
   - Paste into the "Instructions" field
   - **Save** the assistant

## What Changed

Added a critical AUTOGRAPH / ALTERATION CHECK section:

```
🚨 FOLLOW THIS EXACT LOGIC:

1. Check Stage 1 autograph.has_handwriting field FIRST:
   - If has_handwriting === false → Card is NOT altered, proceed with normal grading
   - If has_handwriting === true → Check authentication markers

2. Only if has_handwriting === true, check authentication markers:
   - If authentication_markers_found contains ANY markers that do NOT say "NO" → Autograph is certified
   - If all markers say "NO" or array is empty → Uncertified autograph, grade = NA

3. Set card_is_altered flag:
   - card_is_altered = true ONLY if has_handwriting === true AND no valid authentication markers
   - Otherwise card_is_altered = false

⚠️ NEVER set card_is_altered = true if has_handwriting = false
```

## Verification

After updating, re-grade the card. You should see:
- Correct numeric grade (not NA)
- No false "uncertified autograph" warnings

## Note

The backend now has validation to catch this error even if the assistant makes a mistake, but it's best to fix the assistant instructions too.
