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

// Stage 1 Measurement Assistant ID
const STAGE1_ASSISTANT_ID = 'asst_EbYus9ZeLMrGHw9ICEfQ99vm';

async function updateStage1Assistant() {
  try {
    // Read the Stage 1 instructions file (now using the correct filename that backend loads)
    const instructions = fs.readFileSync('stage1_measurement_instructions.txt', 'utf8');

    console.log('\n=== UPDATING STAGE 1 MEASUREMENT ASSISTANT ===');
    console.log(`Assistant ID: ${STAGE1_ASSISTANT_ID}`);
    console.log(`Instructions file: stage1_measurement_instructions.txt`);
    console.log(`Instructions length: ${instructions.length} characters`);

    // Update the assistant
    const updatedAssistant = await openai.beta.assistants.update(
      STAGE1_ASSISTANT_ID,
      {
        instructions: instructions,
        name: "DCM Stage 1 - Measurement & Analysis",
        model: "gpt-4o",
        temperature: 0.1
      }
    );

    console.log('\n✅ STAGE 1 ASSISTANT UPDATED SUCCESSFULLY!');
    console.log(`Name: ${updatedAssistant.name}`);
    console.log(`Model: ${updatedAssistant.model}`);
    console.log(`New instructions length: ${updatedAssistant.instructions?.length || 0} characters`);

    // Verify key features
    console.log('\n=== VERIFICATION ===');
    console.log(`✅ Has "overall_score": ${updatedAssistant.instructions?.includes('overall_score')}`);
    console.log(`✅ Has "reference_points": ${updatedAssistant.instructions?.includes('reference_points')}`);
    console.log(`✅ Has "visual_observation": ${updatedAssistant.instructions?.includes('visual_observation')}`);
    console.log(`✅ Has "measurement_approach": ${updatedAssistant.instructions?.includes('measurement_approach')}`);
    console.log(`✅ Has "5-Category": ${updatedAssistant.instructions?.includes('5-Category')}`);
    console.log(`✅ Has "MANDATORY": ${updatedAssistant.instructions?.includes('MANDATORY')}`);

    console.log('\n=== INSTRUCTIONS PREVIEW ===');
    console.log(updatedAssistant.instructions?.substring(0, 300) + '...\n');

  } catch (error) {
    console.error('❌ Error updating assistant:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

updateStage1Assistant();
