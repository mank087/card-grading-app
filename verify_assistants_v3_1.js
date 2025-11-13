/**
 * Verify OpenAI Assistants Configuration
 * Run: node verify_assistants_v3_1.js
 */

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Assistant IDs
const STAGE1_ASSISTANT_ID = 'asst_OPvbB4t6JqE93d8KcvgAYUR5';
const STAGE2_ASSISTANT_ID = 'asst_y40OPW6EmLEYupot4ltRwZMT';

async function verifyAssistants() {
  try {
    console.log('🔍 Verifying OpenAI Assistants Configuration...\n');

    // Check Stage 1
    console.log('📋 Stage 1 Assistant (Observation):');
    const stage1 = await openai.beta.assistants.retrieve(STAGE1_ASSISTANT_ID);
    console.log(`   ID: ${stage1.id}`);
    console.log(`   Name: ${stage1.name}`);
    console.log(`   Model: ${stage1.model}`);
    console.log(`   Temperature: ${stage1.temperature}`);
    console.log(`   Instructions length: ${stage1.instructions?.length || 0} chars`);

    // Check for v3.1 markers in instructions
    const stage1HasV31 = stage1.instructions?.includes('v3.1') || stage1.instructions?.includes('version": "3.1');
    const stage1HasPositiveObs = stage1.instructions?.includes('positive_observations');
    const stage1HasEdgeMode = stage1.instructions?.includes('edge_detection_mode');

    console.log(`   ✅ v3.1 markers: ${stage1HasV31 ? '✓' : '✗'}`);
    console.log(`   ✅ Positive observations: ${stage1HasPositiveObs ? '✓' : '✗'}`);
    console.log(`   ✅ Edge detection mode: ${stage1HasEdgeMode ? '✓' : '✗'}`);

    // Check Stage 2
    console.log('\n📋 Stage 2 Assistant (Scoring):');
    const stage2 = await openai.beta.assistants.retrieve(STAGE2_ASSISTANT_ID);
    console.log(`   ID: ${stage2.id}`);
    console.log(`   Name: ${stage2.name}`);
    console.log(`   Model: ${stage2.model}`);
    console.log(`   Temperature: ${stage2.temperature}`);
    console.log(`   Instructions length: ${stage2.instructions?.length || 0} chars`);

    // Check for v3.1 markers in instructions
    const stage2HasV31 = stage2.instructions?.includes('v3.1') || stage2.instructions?.includes('version": "3.1');
    const stage2HasDesignAnchor = stage2.instructions?.includes('design-anchor');
    const stage2HasUncertainty = stage2.instructions?.includes('grade_uncertainty');
    const stage2HasAnalysisSummary = stage2.instructions?.includes('analysis_summary');

    console.log(`   ✅ v3.1 markers: ${stage2HasV31 ? '✓' : '✗'}`);
    console.log(`   ✅ Design-anchor support: ${stage2HasDesignAnchor ? '✓' : '✗'}`);
    console.log(`   ✅ Grade uncertainty: ${stage2HasUncertainty ? '✓' : '✗'}`);
    console.log(`   ✅ Analysis summary: ${stage2HasAnalysisSummary ? '✓' : '✗'}`);

    // Overall status
    const allV31Markers = stage1HasV31 && stage2HasV31;
    const allFeatures = stage1HasPositiveObs && stage1HasEdgeMode &&
                       stage2HasDesignAnchor && stage2HasUncertainty && stage2HasAnalysisSummary;

    console.log('\n' + '='.repeat(60));
    if (allV31Markers && allFeatures) {
      console.log('🎉 All assistants are configured for v3.1!');
    } else if (allV31Markers) {
      console.log('⚠️  Assistants have v3.1 markers but may be missing some features');
    } else {
      console.log('❌ Assistants appear to be on older version');
      console.log('💡 Run: node update_assistants_v3_1.js');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error verifying assistants:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

verifyAssistants();
