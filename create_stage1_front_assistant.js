const OpenAI = require('openai');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function createFrontAssistant() {
  try {
    // Read the front-specific instructions
    const instructions = fs.readFileSync('stage1_front_observation_instructions_v2.3.txt', 'utf8');

    const assistant = await openai.beta.assistants.create({
      name: "DCM Sports Card Grading - Stage 1 FRONT (v2.3)",
      instructions: instructions,
      model: "gpt-4o",
      tools: [],
      temperature: 0.3
    });

    console.log('✅ Stage 1 FRONT Assistant Created Successfully!');
    console.log('Assistant ID:', assistant.id);
    console.log('\n📋 Add this to your .env.local file:');
    console.log(`OPENAI_STAGE1_FRONT_ASSISTANT_ID=${assistant.id}`);
    console.log('\nAssistant Details:');
    console.log('- Name:', assistant.name);
    console.log('- Model:', assistant.model);
    console.log('- Temperature: 0.3');
    console.log('- Instructions Length:', instructions.length, 'characters');
  } catch (error) {
    console.error('❌ Error creating front assistant:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

createFrontAssistant();
