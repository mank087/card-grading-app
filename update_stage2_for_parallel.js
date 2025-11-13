const OpenAI = require('openai');
const fs = require('fs');

// Read API key from .env.local manually
const envFile = fs.readFileSync('.env.local', 'utf8');
const apiKeyMatch = envFile.match(/OPENAI_API_KEY=(.+)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : '';

if (!apiKey) {
  console.error('❌ Error: OPENAI_API_KEY not found in .env.local');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: apiKey,
});

async function updateStage2Assistant() {
  try {
    // Read both instruction files
    const addendum = fs.readFileSync('stage2_parallel_processing_addendum.txt', 'utf8');
    const originalInstructions = fs.readFileSync('stage2_scoring_instructions_v2.2_REVISED.txt', 'utf8');

    // Combine them (addendum first, then original instructions)
    const combinedInstructions = addendum + '\n\n' + originalInstructions;

    console.log('📝 Combined instructions length:', combinedInstructions.length, 'characters');
    console.log('\n🔄 Updating Stage 2 Assistant to support parallel processing...');

    // Get existing Stage 2 assistant ID from .env.local
    const stage2Match = envFile.match(/OPENAI_STAGE2_SCORING_ASSISTANT_ID=(.+)/);
    const stage2AssistantId = stage2Match ? stage2Match[1].trim() : '';

    if (!stage2AssistantId) {
      console.error('❌ Error: OPENAI_STAGE2_SCORING_ASSISTANT_ID not found in .env.local');
      process.exit(1);
    }

    console.log('🎯 Updating Assistant ID:', stage2AssistantId);

    // Update the assistant
    const assistant = await openai.beta.assistants.update(stage2AssistantId, {
      instructions: combinedInstructions,
      name: "DCM Sports Card Grading - Stage 2 SCORING (v2.3 Parallel - Fast)",
      model: "gpt-4o-mini",  // Fast model for deterministic scoring (5-10x faster than gpt-4o)
      temperature: 0.0  // Deterministic scoring
    });

    console.log('\n✅ Stage 2 Assistant Updated Successfully!');
    console.log('Assistant ID:', assistant.id);
    console.log('\nUpdated Details:');
    console.log('- Name:', assistant.name);
    console.log('- Model:', assistant.model);
    console.log('- Temperature:', assistant.temperature || 0.0);
    console.log('- Instructions Length:', combinedInstructions.length, 'characters');
    console.log('\n🎉 Stage 2 can now handle both legacy AND parallel processing formats!');

  } catch (error) {
    console.error('❌ Error updating Stage 2 assistant:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

updateStage2Assistant();
