# Hardening Rules Moved to System Prompt - Change Log
**Date**: 2025-10-19
**Status**: ✅ IMPLEMENTED - Ready for Testing

---

## What Changed

### **Previous Implementation (Didn't Work):**
- Hardening rules were in separate file: `prompts/grading_hardening_rules.txt`
- Rules loaded in user message via `visionGrader.ts`
- AI **ignored** the hardening rules completely
- Result: No `perfect_gate_checks`, no `micro_findings_summary`, all defects marked "none"

### **New Implementation (Testing Now):**
- Hardening rules **appended to system prompt**: `prompts/card_grader_v1.txt`
- System prompt now 4,966 lines (was 4,819 lines)
- User message simplified - just references the hardening rules in system prompt
- `max_tokens` increased from 4000 → 6000 to allow detailed output

---

## Files Modified

### 1. `prompts/card_grader_v1.txt` ✅
**Change**: Appended hardening rules to end of file
**Lines added**: ~147 lines
**New total**: 4,966 lines (from 4,819)

**What was added:**
- Perfect-Grade Gate (5 required proofs for 10.0)
- Safety Defaults (binding rules when uncertain)
- Cross-Side Verification protocol
- Centering Measurement protocol
- Statistical priors (10.0 should be <1%)

**Location**: End of file (lines 4820-4966)

---

### 2. `src/lib/visionGrader.ts` ✅
**Changes:**

**a) Removed hardening rules file loading:**
```typescript
// REMOVED:
let hardeningRules = '';
try {
  const hardeningPath = path.join(process.cwd(), 'prompts', 'grading_hardening_rules.txt');
  hardeningRules = fs.readFileSync(hardeningPath, 'utf-8');
} catch (error) {
  console.warn('[DVG v2] Warning: Could not load hardening rules, proceeding without them');
}
```

**b) Simplified user message:**
```typescript
// NEW (Line 475-478):
const userMessageText = `Grade this card thoroughly using the provided grading scale.
Apply the HARDENING RULES from the system prompt strictly - they block grade 10.0 unless all proofs are met.
Be appropriately critical - look for defects, don't assume perfection.
Return results in the required JSON format.`;
```

**c) Increased max_tokens:**
```typescript
// Line 453:
max_tokens = 6000    // INCREASED from 4000 (allow full micro-sweep audits + hardening rules compliance)
```

---

### 3. `src/app/api/vision-grade/[id]/route.ts` ✅
**Change**: Increased max_tokens in API call

```typescript
// Line 257:
max_tokens: 6000 // INCREASED from 4000: Allow full micro-sweep audits + hardening rules in system prompt
```

---

## Why This Should Work Better

### **Problem with Previous Approach:**

1. **Token Budget Exhaustion**:
   - System prompt: 252K characters
   - Hardening rules in user message: ~8K characters
   - Total instructions: ~260K characters
   - AI likely hit token limit and truncated, ignoring hardening rules

2. **Priority/Attention**:
   - User message has lower priority than system message in LLM processing
   - AI may have focused on images over the text rules

3. **Max Tokens Too Low**:
   - 4000 tokens wasn't enough for detailed micro-sweep output
   - AI had to choose between following rules OR outputting detailed findings
   - Chose simpler path: ignore rules, output basic structure

### **Why New Approach Should Work:**

1. **Consolidated Instructions**:
   - Everything in one place (system prompt)
   - AI sees hardening rules as part of core instructions, not add-on
   - Higher priority/attention to system message content

2. **More Output Tokens**:
   - 6000 tokens (50% increase) allows detailed micro-sweep findings
   - Room for `perfect_gate_checks`, `micro_findings_summary`, detailed corner/edge/surface findings

3. **Simpler User Message**:
   - Just images + short reminder
   - Doesn't compete with system prompt for attention

---

## Expected Results After Testing

### **What We Should See:**

✅ **AI populates new JSON fields:**
```json
{
  "perfect_gate_checks": {
    "corners8_pass": false,  // Should be false if any defect found
    "edges4_pass": false,
    "centering_two_axis_pass": true,
    "cross_side_pass": true,
    "image_quality_sufficient": true
  },
  "micro_findings_summary": {
    "corner_whitening_mm_sum_front": 0.2,  // Should have measurements
    "edge_chips_total": 2,
    "hairline_count_front": 0,
    ...
  }
}
```

✅ **Defects actually recorded:**
```json
"defects": {
  "front": {
    "corners": {
      "bottom_left": {"severity": "microscopic", "description": "0.15mm whitening on tip"}
    }
  }
}
```

✅ **Validator caps based on REAL defects, not accidental bug**

### **What We're Testing For:**

1. Does AI populate `perfect_gate_checks`? (YES/NO)
2. Does AI populate `micro_findings_summary`? (YES/NO)
3. Does AI mark defects with severity other than "none"? (YES/NO)
4. Does final grade match ChatGPT's 9.0? (YES/NO)
5. Are defect descriptions specific with measurements? (YES/NO)

---

## Testing Instructions

### **1. Restart Dev Server**
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### **2. Upload and Grade Herbert Card**
- Use the SAME Justin Herbert card images
- Let grading complete
- Check grade and detailed observations

### **3. Check Server Console Logs**

Look for:
```
[DVG v1] Loaded grading prompt successfully (252293 characters) [DEV MODE - fresh load]
                                           ^^^^^^^ This should be HIGHER now (with hardening rules)
[DVG v2] Grade (before validation): ?
[GRADE CAP APPLIED] AI suggested ?, capped at ?
[DVG v2] Grade (after validation): ?
```

**Expected:**
- Prompt size should be **~260K+ characters** (was 252K)
- Grade before validation should be **9.0-9.5** (NOT 10)
- Grade cap may or may not apply (depends on AI's findings)

### **4. Check Card Detail Page**

**Expected to see:**
- Final grade: **9.0-9.5** (matching ChatGPT)
- Professional Assessment: Should mention SPECIFIC defects with measurements
- Defects list: Should show actual defects found (NOT all "NONE")

### **5. Check Database JSON**

Query Supabase for `dvg_grading` field:
```sql
SELECT dvg_grading
FROM cards
WHERE id = '[new card id]';
```

**Check for:**
- ✅ `perfect_gate_checks` field exists?
- ✅ `micro_findings_summary` field exists?
- ✅ Defects have severity != "none"?
- ✅ `grade_cap_applied` and `grade_cap_reasons` populated?

---

## Success Criteria

### **Test PASSES if:**

1. ✅ Herbert card grades **9.0 to 9.5** (matching ChatGPT's 9.0)
2. ✅ AI populates `perfect_gate_checks` field
3. ✅ AI populates `micro_findings_summary` field
4. ✅ AI records specific defects (not all "none")
5. ✅ Professional assessment mentions actual defects found
6. ✅ Console shows increased prompt size (~260K+ characters)

### **Test FAILS if:**

1. ❌ Herbert card still grades 10.0
2. ❌ No `perfect_gate_checks` field in JSON
3. ❌ All defects still marked "none"
4. ❌ Professional assessment still says "pristine gem mint, zero defects"
5. ❌ Prompt size unchanged (still ~252K)

---

## If Test Fails

### **Option A: Further increase max_tokens**
- Try 8000 tokens (double original 4000)
- Gives AI even more room for detailed output

### **Option B: Simplify hardening rules further**
- Condense ~8K character rules to ~2K core requirements
- Focus only on: "ANY defect → cap at 9.5", "Statistical prior: 10.0 <1%"

### **Option C: Two-pass grading approach**
- First pass: Grade normally
- If grade = 10.0 → Second pass: "Re-examine for micro-defects or confirm absolute perfection"
- Forces AI to justify 10.0 grades

### **Option D: Accept the "accidental cap"**
- Current validator works (caps 10→9 due to structural bug)
- Document as intentional, call it done
- Not ideal but functional

---

## Rollback Plan

If this breaks grading completely:

### **Quick Rollback:**

1. **Restore original system prompt:**
```bash
cp prompts/card_grader_v1.txt.backup_before_hardening_2025-10-19 prompts/card_grader_v1.txt
```

2. **Revert visionGrader.ts changes** (git checkout or manual edit)

3. **Revert route.ts max_tokens** back to 4000

4. **Restart server**

---

## Next Steps After Testing

### **If Test Passes:**
1. Test 5-10 more diverse cards
2. Monitor grade distribution (10.0 should be <1%)
3. Compare to ChatGPT analysis on same cards
4. Document successful configuration
5. Proceed with Pokemon card expansion

### **If Test Fails:**
1. Review console logs for clues
2. Check if prompt size increased (proves hardening rules loaded)
3. Check if `max_tokens` is being hit (truncated output)
4. Try one of the fallback options (A/B/C/D above)
5. Report findings and decide next approach

---

## Summary of Current State

**What's Working:**
- ✅ Temperature: 0.2 (correct for strict grading)
- ✅ top_p: 0.2 (deterministic sampling)
- ✅ max_tokens: 6000 (increased from 4000)
- ✅ Validator: Catches optimistic grades and applies caps
- ✅ Hardening rules: Appended to system prompt (should be higher priority)

**What We're Testing:**
- ❓ Does AI follow hardening rules in system prompt?
- ❓ Does AI populate new JSON fields?
- ❓ Does AI find actual defects?

**Expected Outcome:**
- Herbert card grades 9.0-9.5 with specific defect findings
- JSON contains `perfect_gate_checks` and `micro_findings_summary`
- Professional assessment describes actual defects found

---

**Status**: ✅ READY TO TEST
**Test Card**: Justin Herbert 2022 Panini Prestige Heroes (same card as before)
**Expected Grade**: 9.0-9.5 (matching ChatGPT analysis)
**Last Updated**: 2025-10-19

---

## Files Created/Modified Summary

**Created:**
- `HARDENING_RULES_MOVED_TO_SYSTEM_PROMPT.md` (this file)

**Modified:**
- `prompts/card_grader_v1.txt` (appended hardening rules, +147 lines)
- `src/lib/visionGrader.ts` (removed hardening file load, simplified user message, increased max_tokens)
- `src/app/api/vision-grade/[id]/route.ts` (increased max_tokens to 6000)

**Backup Created:**
- `prompts/card_grader_v1.txt.backup_before_hardening_2025-10-19` (automatic, created earlier)

**No Changes:**
- `prompts/grading_hardening_rules.txt` (still exists, but no longer loaded)
- `src/lib/gradeValidator.ts` (validator still active, unchanged)
- Frontend files (unchanged)
