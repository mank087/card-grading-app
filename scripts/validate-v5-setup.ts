/**
 * v5.0 Setup Validation Script
 * Run this to verify v5.0 architecture is ready to use
 */

import { validatePromptFiles, loadGradingPrompt, getTokenEstimates, type CardType } from '../src/lib/promptLoader_v5';

console.log('═══════════════════════════════════════════════════════════');
console.log('v5.0 ARCHITECTURE SETUP VALIDATION');
console.log('═══════════════════════════════════════════════════════════\n');

// Check environment variable
const v5Enabled = process.env.USE_V5_ARCHITECTURE === 'true';
console.log(`✓ Environment Variable Check:`);
console.log(`  USE_V5_ARCHITECTURE = ${process.env.USE_V5_ARCHITECTURE || 'not set'}`);
console.log(`  Status: ${v5Enabled ? '✅ ENABLED' : '❌ DISABLED'}\n`);

// Validate all prompt files exist
console.log('✓ Prompt Files Validation:');
const fileValidation = validatePromptFiles();

if (fileValidation.valid) {
  console.log('  ✅ All required files found:');
  fileValidation.found.forEach(file => console.log(`     - ${file}`));
} else {
  console.log('  ❌ Missing files:');
  fileValidation.missing.forEach(file => console.log(`     - ${file}`));
  console.log('\n⚠️  SETUP INCOMPLETE - Missing prompt files!');
  process.exit(1);
}

console.log();

// Test prompt loading for each card type
console.log('✓ Prompt Loading Test:');
const cardTypes: CardType[] = ['sports', 'pokemon', 'mtg', 'lorcana', 'other'];
let allLoaded = true;

for (const cardType of cardTypes) {
  const result = loadGradingPrompt(cardType);
  const status = result.success ? '✅' : '❌';
  const tokens = result.metadata.estimated_tokens || 0;

  console.log(`  ${status} ${cardType.padEnd(10)} - ${result.success ? `${tokens.toLocaleString()} tokens` : result.error}`);

  if (!result.success) {
    allLoaded = false;
  }
}

console.log();

if (!allLoaded) {
  console.log('⚠️  SETUP INCOMPLETE - Some prompts failed to load!');
  process.exit(1);
}

// Show token estimates
console.log('✓ Token Estimates by Card Type:');
const estimates = getTokenEstimates();
const cardTypeLabels: Record<CardType, string> = {
  sports: 'Sports Cards',
  pokemon: 'Pokemon TCG',
  mtg: 'Magic: The Gathering',
  lorcana: 'Disney Lorcana',
  other: 'Other/Generic TCG'
};

for (const [cardType, tokens] of Object.entries(estimates)) {
  const label = cardTypeLabels[cardType as CardType];
  console.log(`  ${label.padEnd(25)} ~${tokens.toLocaleString()} tokens`);
}

console.log();

// Calculate savings vs v4.2
console.log('✓ Cost Savings Estimate:');
const v4Baseline: Record<CardType, number> = {
  sports: 14000,
  pokemon: 9500,
  mtg: 9750,
  lorcana: 7250,
  other: 6500
};

let totalSavings = 0;
for (const [cardType, v5Tokens] of Object.entries(estimates)) {
  const v4Tokens = v4Baseline[cardType as CardType];
  const savings = v4Tokens - v5Tokens;
  const savingsPercent = ((savings / v4Tokens) * 100).toFixed(1);
  totalSavings += parseFloat(savingsPercent);

  console.log(`  ${cardType.padEnd(10)} ${v4Tokens.toLocaleString()} → ${v5Tokens.toLocaleString()} tokens (${savingsPercent}% reduction)`);
}

const avgSavings = (totalSavings / cardTypes.length).toFixed(1);
console.log(`  Average savings: ${avgSavings}%`);

console.log();

// Final status
console.log('═══════════════════════════════════════════════════════════');
if (v5Enabled && allLoaded) {
  console.log('✅ v5.0 ARCHITECTURE READY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log();
  console.log('Next steps:');
  console.log('1. Restart your dev server to pick up new env var');
  console.log('2. Test grading a sample card');
  console.log('3. Monitor validation warnings in console');
  console.log();
  process.exit(0);
} else if (!v5Enabled) {
  console.log('⚠️  v5.0 DISABLED IN ENVIRONMENT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log();
  console.log('To enable v5.0, set in .env.local:');
  console.log('USE_V5_ARCHITECTURE=true');
  console.log();
  process.exit(0);
} else {
  console.log('❌ SETUP INCOMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log();
  console.log('Please fix errors above before proceeding.');
  console.log();
  process.exit(1);
}
