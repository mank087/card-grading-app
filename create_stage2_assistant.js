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

async function createStage2ScoringAssistant() {
  try {
    // Read the Stage 2 scoring instructions file
    const instructions = fs.readFileSync('stage2_scoring_instructions_v2.txt', 'utf8');

    console.log('\n=== CREATING STAGE 2 SCORING ASSISTANT ===');
    console.log(`Instructions file: stage2_scoring_instructions_v2.txt`);
    console.log(`Instructions length: ${instructions.length} characters`);

    // Create new assistant
    const assistant = await openai.beta.assistants.create({
      instructions: instructions,
      name: "DCM Sports Card Grading - Stage 2: Scoring v2.2",
      model: "gpt-4o",
      temperature: 0.0  // Zero temperature for deterministic scoring
    });

    console.log('\n✅ STAGE 2 ASSISTANT CREATED SUCCESSFULLY!');
    console.log(`\nAssistant ID: ${assistant.id}`);
    console.log(`Name: ${assistant.name}`);
    console.log(`Model: ${assistant.model}`);
    console.log(`Temperature: 0.0 (deterministic)`);
    console.log(`Instructions length: ${assistant.instructions?.length || 0} characters`);

    // Verify key features
    console.log('\n=== VERIFICATION ===');
    console.log(`✅ Has "scoring" keyword: ${assistant.instructions?.includes('scoring')}`);
    console.log(`✅ Has "deterministic": ${assistant.instructions?.includes('deterministic')}`);
    console.log(`✅ Has "weighted composite": ${assistant.instructions?.includes('weighted composite')}`);
    console.log(`✅ Has "deduction table": ${assistant.instructions?.includes('deduction table')}`);
    console.log(`✅ Has alteration check: ${assistant.instructions?.includes('alteration')}`);
    console.log(`✅ Has roller lines clarification: ${assistant.instructions?.includes('Roller/foil lines are ONLY scored in Surface')}`);

    console.log('\n=== INSTRUCTIONS PREVIEW ===');
    console.log(assistant.instructions?.substring(0, 300) + '...\n');

    console.log(`\n⚠️  IMPORTANT: Add this to your .env.local file:`);
    console.log(`OPENAI_STAGE2_SCORING_ASSISTANT_ID=${assistant.id}`);

  } catch (error) {
    console.error('❌ Error creating Stage 2 assistant:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

createStage2ScoringAssistant();
