const OpenAI = require('openai');
const fs = require('fs');

// Load environment variables manually
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const openai = new OpenAI({
  apiKey: envVars.OPENAI_API_KEY,
});

// Stage 2 Evaluation Assistant ID
const STAGE2_ASSISTANT_ID = 'asst_XjzIEKt9P6Gj6aXRFe91jwV3';

async function updateStage2Assistant() {
  try {
    // Read the Stage 2 instructions file
    const instructions = fs.readFileSync('stage2_evaluation_instructions.txt', 'utf8');

    console.log('\n=== UPDATING STAGE 2 EVALUATION ASSISTANT ===');
    console.log(`Assistant ID: ${STAGE2_ASSISTANT_ID}`);
    console.log(`Instructions file: stage2_evaluation_instructions.txt`);
    console.log(`Instructions length: ${instructions.length} characters`);

    // Update the assistant
    const updatedAssistant = await openai.beta.assistants.update(
      STAGE2_ASSISTANT_ID,
      {
        instructions: instructions,
        name: "DCM Stage 2 - Evaluation & Scoring",
        model: "gpt-4o",
        temperature: 0.1
      }
    );

    console.log('\n✅ STAGE 2 ASSISTANT UPDATED SUCCESSFULLY!');
    console.log(`Name: ${updatedAssistant.name}`);
    console.log(`Model: ${updatedAssistant.model}`);
    console.log(`New instructions length: ${updatedAssistant.instructions?.length || 0} characters`);

    // Verify key features
    console.log('\n=== VERIFICATION ===');
    console.log(`✅ Has "weighted_composite_score": ${updatedAssistant.instructions?.includes('weighted_composite_score')}`);
    console.log(`✅ Has "category_scores": ${updatedAssistant.instructions?.includes('category_scores')}`);
    console.log(`✅ Has "Trust Stage 1": ${updatedAssistant.instructions?.includes('Trust Stage 1')}`);
    console.log(`✅ Has "Never recalculate": ${updatedAssistant.instructions?.includes('Never recalculate')}`);

    console.log('\n=== INSTRUCTIONS PREVIEW ===');
    console.log(updatedAssistant.instructions?.substring(0, 300) + '...\n');

  } catch (error) {
    console.error('❌ Error updating assistant:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

updateStage2Assistant();
