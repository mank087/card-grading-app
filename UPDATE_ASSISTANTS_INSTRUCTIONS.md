# Update OpenAI Assistants to v3.1

## Option 1: Automatic Update (Recommended)

### Step 1: Set your OpenAI API Key
```bash
# Windows Command Prompt
set OPENAI_API_KEY=sk-your-key-here

# OR Windows PowerShell
$env:OPENAI_API_KEY="sk-your-key-here"
```

### Step 2: Run the update script
```bash
node update_assistants_v3_1.js
```

### Step 3: Verify the update
```bash
node verify_assistants_v3_1.js
```

**Expected Output:**
```
🎉 All assistants are configured for v3.1!
   Stage 1: asst_OPvbB4t6JqE93d8KcvgAYUR5
   Stage 2: asst_y40OPW6EmLEYupot4ltRwZMT
```

---

## Option 2: Manual Update (via OpenAI Dashboard)

If the script doesn't work, you can manually update via the OpenAI Assistants dashboard:

### Stage 1 Assistant (asst_OPvbB4t6JqE93d8KcvgAYUR5)

1. Go to: https://platform.openai.com/assistants/asst_OPvbB4t6JqE93d8KcvgAYUR5
2. Click **Edit**
3. **Name:** `DCM Stage 1 - Observation v3.1`
4. **Model:** `gpt-4o`
5. **Temperature:** `0.3`
6. **Instructions:** Copy entire contents of `ai_prompts/stage1_instructions_v3_1.txt`
7. Click **Save**

### Stage 2 Assistant (asst_y40OPW6EmLEYupot4ltRwZMT)

1. Go to: https://platform.openai.com/assistants/asst_y40OPW6EmLEYupot4ltRwZMT
2. Click **Edit**
3. **Name:** `DCM Stage 2 - Scoring v3.1`
4. **Model:** `gpt-4o`
5. **Temperature:** `0.0`
6. **Instructions:** Copy entire contents of `ai_prompts/stage2_instructions_v3_1.txt`
7. Click **Save**

---

## Key v3.1 Features in New Instructions

### Stage 1 Enhancements:
✅ **Validates Stage 0 centering** - Checks if OpenCV centering is plausible
✅ **Design-anchor support** - Handles borderless/full-art cards
✅ **Positive observations** - Records card strengths (sharp corners, smooth edges)
✅ **Image quality override** - Can disagree with Stage 0 if visual assessment differs
✅ **Edge detection mode tracking** - Records standard/color-channel/manual-fallback

### Stage 2 Enhancements:
✅ **Design-anchor centering** - Neutral score (9.0) if centering is N/A
✅ **Image quality uncertainty** - Grade D = ±1.0, Grade C = ±0.5, Grade A/B = ±0.0
✅ **Analysis summary** - Lists both positives AND negatives
✅ **Centering type tracking** - Records border-detected vs design-anchor for both sides

---

## Verification Checklist

After updating, verify by uploading a card and checking logs:

- [ ] Stage 1 response includes `"version": "3.1"`
- [ ] Stage 1 response includes `"positive_observations"` object
- [ ] Stage 1 response includes `"edge_detection_mode"`
- [ ] Stage 2 response includes `"centerings_used"` with `"front_type"` and `"back_type"`
- [ ] Stage 2 response includes `"analysis_summary"` with `"positives"` and `"negatives"`
- [ ] Stage 2 response includes `"grade_uncertainty"` field

---

## Rollback (If Needed)

If v3.1 causes issues, you can revert to v2.3:

1. Use your backup instructions files (if you saved them)
2. OR disable OpenCV v3.1: Set `USE_OPENCV_V3_1=false` in environment
3. Restart Flask service

---

## Support

If assistants don't update correctly:
1. Check OpenAI API key is valid
2. Check assistant IDs are correct:
   - Stage 1: `asst_OPvbB4t6JqE93d8KcvgAYUR5`
   - Stage 2: `asst_y40OPW6EmLEYupot4ltRwZMT`
3. Try manual update via dashboard (Option 2)
