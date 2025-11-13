// Create a fresh OpenAI Assistant with enhanced corner instructions
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

async function createNewAssistant() {
  try {
    // Read the current sports instructions
    const instructions = fs.readFileSync('sports_assistant_instructions.txt', 'utf8');

    console.log('=== CREATING NEW ASSISTANT ===');
    console.log('Instructions length:', instructions.length);

    // Create new assistant with fresh instructions
    const newAssistant = await openai.beta.assistants.create({
      name: 'DCM Sports Card Grading Assistant v2',
      description: 'Fresh assistant with enhanced corner rounding detection',
      model: 'gpt-4o',
      instructions: instructions,
      temperature: 0.2
    });

    console.log('✅ NEW ASSISTANT CREATED!');
    console.log('New Assistant ID:', newAssistant.id);
    console.log('Name:', newAssistant.name);
    console.log('Instructions length:', newAssistant.instructions?.length || 0);

    // Verify enhanced definitions
    const hasCornerDefinition = newAssistant.instructions?.includes('DCM Standard');
    const hasFactoryTolerance = newAssistant.instructions?.includes('Factory Tolerance');

    console.log('Contains DCM Standard:', hasCornerDefinition);
    console.log('Contains Factory Tolerance:', hasFactoryTolerance);

    console.log('\n🎯 TO USE THIS ASSISTANT:');
    console.log('Update your .env.local file:');
    console.log(`OPENAI_ASSISTANT_ID=${newAssistant.id}`);

    if (hasCornerDefinition && hasFactoryTolerance) {
      console.log('\n🎉 SUCCESS: Enhanced corner definitions are in the new assistant!');
    } else {
      console.log('\n⚠️ WARNING: Enhanced definitions may not have been applied properly');
    }

  } catch (error) {
    console.error('Error creating new assistant:', error.message);
  }
}

createNewAssistant();