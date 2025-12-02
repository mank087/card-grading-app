# v5.0 Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Verify Installation

```bash
# Check all prompt files exist
ls prompts/master_grading_rubric_v5.txt
ls prompts/sports_delta_v5.txt
ls prompts/pokemon_delta_v5.txt
ls prompts/mtg_delta_v5.txt
ls prompts/lorcana_delta_v5.txt
ls prompts/other_delta_v5.txt
```

### 2. Test Prompt Loading

```typescript
import { validatePromptFiles, loadGradingPrompt } from '@/lib/promptLoader_v5';

// Verify all files exist
const validation = validatePromptFiles();
console.log(validation);
// Expected: { valid: true, missing: [], found: [...] }

// Test loading for one card type
const result = loadGradingPrompt('sports');
console.log(`Success: ${result.success}`);
console.log(`Tokens: ${result.metadata.estimated_tokens}`);
```

**Expected Output:**
```
[Prompt Loader v5] ✅ All required prompt files found
Success: true
Tokens: ~22500
```

### 3. Grade Your First Card with v5.0

```typescript
import { gradeCardV5 } from '@/lib/visionGrader_v5';

const result = await gradeCardV5({
  frontImageUrl: 'https://...front.jpg',
  backImageUrl: 'https://...back.jpg',
  cardType: 'sports',
  useV5Architecture: true,  // Force v5.0
  fallbackToV4: true,        // Safe fallback if it fails
  strictValidation: true     // Enforce evidence rules
});

if (result.success) {
  console.log(`✅ Graded successfully with ${result.version}`);
  console.log(`Grade: ${result.data?.final_grade.decimal_grade}`);
  console.log(`Warnings: ${result.validation?.evidence_based_warnings.length || 0}`);
} else {
  console.error(`❌ Grading failed: ${result.error}`);
}
```

### 4. Run A/B Test

```typescript
import { gradeCardABTest } from '@/lib/visionGrader_v5';

const abTest = await gradeCardABTest({
  frontImageUrl: 'https://...front.jpg',
  backImageUrl: 'https://...back.jpg',
  cardType: 'sports'
});

console.log('Comparison:', {
  both_succeeded: abTest.comparison.both_succeeded,
  v5_faster: abTest.comparison.v5_faster,
  token_savings: `${abTest.comparison.v5_token_savings_percent?.toFixed(1)}%`,
  grades_match: abTest.comparison.grades_match,
  grade_diff: abTest.comparison.grade_diff
});
```

**Expected Output:**
```
Comparison: {
  both_succeeded: true,
  v5_faster: true,
  token_savings: '42.3%',
  grades_match: true,
  grade_diff: 0.05
}
```

---

## 📋 Environment Variables

Add to `.env`:

```bash
# Enable v5.0 architecture globally
USE_V5_ARCHITECTURE=true

# Or disable to use v4.2
USE_V5_ARCHITECTURE=false
```

---

## 🔧 Common Use Cases

### Use Case 1: Drop-in Replacement (Safest)

```typescript
// Before (v4.2)
import { gradeCardConversational } from '@/lib/visionGrader';
const result = await gradeCardConversational(frontUrl, backUrl, 'sports');

// After (v5.0 with fallback)
import { gradeCardV5 } from '@/lib/visionGrader_v5';
const result = await gradeCardV5({
  frontImageUrl: frontUrl,
  backImageUrl: backUrl,
  cardType: 'sports',
  // useV5Architecture defaults to env var, fallback enabled by default
});
```

### Use Case 2: Force v5.0 Only

```typescript
const result = await gradeCardV5({
  frontImageUrl: frontUrl,
  backImageUrl: backUrl,
  cardType: 'pokemon',
  useV5Architecture: true,
  fallbackToV4: false  // Fail if v5.0 doesn't work
});
```

### Use Case 3: Smart Auto-Selection

```typescript
import { gradeCardSmart } from '@/lib/visionGrader_v5';

// Automatically uses best architecture based on environment
const result = await gradeCardSmart({
  frontImageUrl: frontUrl,
  backImageUrl: backUrl,
  cardType: 'mtg'
});
```

### Use Case 4: Gradual Rollout

```typescript
// 25% of traffic gets v5.0
const useV5 = Math.random() < 0.25;

const result = await gradeCardV5({
  frontImageUrl: frontUrl,
  backImageUrl: backUrl,
  cardType: 'lorcana',
  useV5Architecture: useV5,
  fallbackToV4: true
});

// Log which version was used
await logMetric('grading_version', result.version);
```

---

## 🐛 Debugging

### Check Validation Warnings

```typescript
const result = await gradeCardV5(options);

if (result.validation?.evidence_based_warnings.length > 0) {
  console.warn('⚠️ Evidence-based warnings:');
  result.validation.evidence_based_warnings.forEach(w => {
    console.warn(`  - ${w}`);
  });
}
```

**Common Warnings:**
- `Grade is 10.0 but X defects found` → Score/defect mismatch
- `Grade is 9.5 but zero defects found` → Missing justification
- `Detected identical corner descriptions` → Template language used

### Enable Verbose Logging

```typescript
// In your route or function
console.log('[DEBUG] Grading options:', options);
const result = await gradeCardV5(options);
console.log('[DEBUG] Result:', {
  success: result.success,
  version: result.version,
  validation: result.validation
});
```

### Check Fallback Status

```typescript
const result = await gradeCardV5({
  ...options,
  useV5Architecture: true,
  fallbackToV4: true
});

if (result.version === 'v4.2') {
  console.warn('⚠️ Fell back to v4.2');
  // Investigate why v5.0 failed
  // Check prompt files, API errors, etc.
}
```

---

## 📊 Monitoring Checklist

Track these metrics during rollout:

```typescript
const metrics = {
  // Core metrics
  version: result.version,                              // 'v5.0' or 'v4.2'
  success: result.success,                              // true/false
  fallback_used: result.version === 'v4.2',             // true/false

  // Performance metrics
  processing_time_ms: result.metadata.processing_time_ms,
  token_estimate: result.metadata.prompt_tokens_estimated,

  // Quality metrics
  validation_warnings: result.validation?.evidence_based_warnings.length || 0,
  schema_valid: result.validation?.schema_valid ?? true,

  // Grade data
  final_grade: result.data?.final_grade.decimal_grade ?? result.legacyData?.grade?.decimal_grade,
  uncertainty: result.data?.final_grade.grade_range ?? result.legacyData?.grade?.uncertainty
};

await logGradingMetrics(metrics);
```

---

## ✅ Success Checklist

Before deploying to production:

- [ ] All prompt files exist and load successfully
- [ ] Schema validation passes for sample cards
- [ ] A/B test shows >95% grade agreement (within ±0.5)
- [ ] Token savings observed (35-45%)
- [ ] Validation warnings are reasonable (<5% of tests)
- [ ] Fallback to v4.2 works correctly
- [ ] No performance degradation (processing time similar)

---

## 🆘 Troubleshooting

### "Master rubric not found"

```bash
# Check file exists
ls prompts/master_grading_rubric_v5.txt

# Verify current working directory
pwd

# If in wrong location, adjust path in promptLoader_v5.ts
```

### "Schema validation failed"

```typescript
// Disable strict validation temporarily to see raw response
const result = await gradeCardV5({
  ...options,
  strictValidation: false  // Allows invalid responses through
});

console.log('Raw data:', result.data);
// Identify which field is failing validation
```

### "Both v5.0 and v4.2 failed"

```typescript
// Check OpenAI API connectivity
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
try {
  await openai.models.list();
  console.log('✅ OpenAI API accessible');
} catch (error) {
  console.error('❌ OpenAI API error:', error);
}
```

---

## 📖 Full Documentation

For complete details, see:
- **Migration Guide:** `V5_MIGRATION_GUIDE.md`
- **Development Summary:** `DEVELOPMENT_SUMMARY_2025-11-22.md`
- **Master Rubric:** `prompts/master_grading_rubric_v5.txt`

---

## 🎯 Quick Decision Matrix

**When to use v5.0:**
- ✅ New feature development
- ✅ Cost optimization priority
- ✅ Evidence-based grading required
- ✅ After successful A/B testing

**When to use v4.2:**
- ✅ Existing production traffic (initially)
- ✅ Proven stability required
- ✅ During testing/validation phase
- ✅ As fallback during v5.0 rollout

**When to use A/B testing:**
- ✅ Validating v5.0 before production
- ✅ Measuring token savings
- ✅ Identifying grade differences
- ✅ Testing prompt changes

---

**Ready to start?** Run the verification steps above and you'll be grading with v5.0 in minutes! 🚀
