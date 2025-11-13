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

async function createStage1ObservationAssistant() {
  try {
    // Read the Stage 1 observation instructions file
    const instructions = fs.readFileSync('stage1_observation_instructions_v2.txt', 'utf8');

    console.log('\n=== CREATING STAGE 1 OBSERVATION ASSISTANT ===');
    console.log(`Instructions file: stage1_observation_instructions_v2.txt`);
    console.log(`Instructions length: ${instructions.length} characters`);

    // Create new assistant
    const assistant = await openai.beta.assistants.create({
      instructions: instructions,
      name: "DCM Sports Card Grading - Stage 1: Observation v2.0",
      model: "gpt-4o",
      temperature: 0.1
    });

    console.log('\n✅ STAGE 1 ASSISTANT CREATED SUCCESSFULLY!');
    console.log(`\nAssistant ID: ${assistant.id}`);
    console.log(`Name: ${assistant.name}`);
    console.log(`Model: ${assistant.model}`);
    console.log(`Temperature: 0.1`);
    console.log(`Instructions length: ${assistant.instructions?.length || 0} characters`);

    // Verify key features
    console.log('\n=== VERIFICATION ===');
    console.log(`✅ Has "observation" keyword: ${assistant.instructions?.includes('observation')}`);
    console.log(`✅ Has "DO NOT SCORE": ${assistant.instructions?.includes('DO NOT SCORE')}`);
    console.log(`✅ Has "autograph" detection: ${assistant.instructions?.includes('autograph')}`);
    console.log(`✅ Has "centering" measurement: ${assistant.instructions?.includes('centering')}`);
    console.log(`✅ Has forbidden phrases: ${assistant.instructions?.includes('FORBIDDEN')}`);

    console.log('\n=== INSTRUCTIONS PREVIEW ===');
    console.log(assistant.instructions?.substring(0, 300) + '...\n');

    console.log(`\n⚠️  IMPORTANT: Add this to your .env.local file:`);
    console.log(`OPENAI_STAGE1_OBSERVATION_ASSISTANT_ID=${assistant.id}`);

  } catch (error) {
    console.error('❌ Error creating Stage 1 assistant:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

createStage1ObservationAssistant();
