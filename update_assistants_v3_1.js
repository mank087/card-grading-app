/**
 * Update OpenAI Assistants to v3.1 Instructions
 * Run: node update_assistants_v3_1.js
 */

const fs = require('fs');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Assistant IDs
const STAGE1_ASSISTANT_ID = 'asst_OPvbB4t6JqE93d8KcvgAYUR5';
const STAGE2_ASSISTANT_ID = 'asst_y40OPW6EmLEYupot4ltRwZMT';

async function updateAssistants() {
  try {
    console.log('🚀 Updating OpenAI Assistants to v3.1...\n');

    // Read v3.1 instruction files
    const stage1Instructions = fs.readFileSync('ai_prompts/stage1_instructions_v3_1.txt', 'utf8');
    const stage2Instructions = fs.readFileSync('ai_prompts/stage2_instructions_v3_1.txt', 'utf8');

    // Update Stage 1 Assistant
    console.log('📝 Updating Stage 1 Assistant (Observation)...');
    const stage1Updated = await openai.beta.assistants.update(STAGE1_ASSISTANT_ID, {
      instructions: stage1Instructions,
      name: 'DCM Stage 1 - Observation v3.1',
      description: 'Visual observation and verification with positive observations tracking. Supports borderless cards and design-anchor centering.',
      model: 'gpt-4o',
      temperature: 0.3
    });
    console.log(`✅ Stage 1 updated: ${stage1Updated.id}`);
    console.log(`   Version: ${stage1Updated.name}`);
    console.log(`   Model: ${stage1Updated.model}\n`);

    // Update Stage 2 Assistant
    console.log('📝 Updating Stage 2 Assistant (Scoring)...');
    const stage2Updated = await openai.beta.assistants.update(STAGE2_ASSISTANT_ID, {
      instructions: stage2Instructions,
      name: 'DCM Stage 2 - Scoring v3.1',
      description: 'Deterministic scoring with design-anchor centering support and image quality uncertainty mapping.',
      model: 'gpt-4o',
      temperature: 0.0
    });
    console.log(`✅ Stage 2 updated: ${stage2Updated.id}`);
    console.log(`   Version: ${stage2Updated.name}`);
    console.log(`   Model: ${stage2Updated.model}\n`);

    console.log('🎉 All assistants updated successfully!');
    console.log('\n📋 Summary:');
    console.log(`   Stage 1: ${STAGE1_ASSISTANT_ID}`);
    console.log(`   Stage 2: ${STAGE2_ASSISTANT_ID}`);
    console.log('\n🧪 Next step: Test with a card upload to verify v3.1 behavior');

  } catch (error) {
    console.error('❌ Error updating assistants:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

updateAssistants();
