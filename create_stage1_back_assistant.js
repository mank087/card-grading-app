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

async function createBackAssistant() {
  try {
    // Read the back-specific instructions
    const instructions = fs.readFileSync('stage1_back_observation_instructions_v2.3.txt', 'utf8');

    const assistant = await openai.beta.assistants.create({
      name: "DCM Sports Card Grading - Stage 1 BACK (v2.3)",
      instructions: instructions,
      model: "gpt-4o",
      tools: [],
      temperature: 0.3
    });

    console.log('✅ Stage 1 BACK Assistant Created Successfully!');
    console.log('Assistant ID:', assistant.id);
    console.log('\n📋 Add this to your .env.local file:');
    console.log(`OPENAI_STAGE1_BACK_ASSISTANT_ID=${assistant.id}`);
    console.log('\nAssistant Details:');
    console.log('- Name:', assistant.name);
    console.log('- Model:', assistant.model);
    console.log('- Temperature: 0.3');
    console.log('- Instructions Length:', instructions.length, 'characters');
  } catch (error) {
    console.error('❌ Error creating back assistant:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

createBackAssistant();
