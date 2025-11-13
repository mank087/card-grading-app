// Script to update OpenAI Assistant with fresh instructions
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

async function updateAssistant() {
  try {
    // Read the current sports instructions
    const instructions = fs.readFileSync('sports_assistant_instructions.txt', 'utf8');

    console.log('=== UPDATING ASSISTANT ===');
    console.log('Instructions length:', instructions.length);

    // Update the assistant
    const updatedAssistant = await openai.beta.assistants.update('asst_gwX2wmsnNsMOqsZqcnypUmlg', {
      instructions: instructions,
      name: 'DCM Sports Card Grading Assistant',
      description: 'Professional sports card grading with visual inspection checklist'
    });

    console.log('✅ Assistant updated successfully!');
    console.log('New instructions length:', updatedAssistant.instructions?.length || 0);

    // Verify the update
    const hasCornerDefinition = updatedAssistant.instructions?.includes('DCM Standard');
    const hasFactoryTolerance = updatedAssistant.instructions?.includes('Factory Tolerance');

    console.log('Contains DCM Standard:', hasCornerDefinition);
    console.log('Contains Factory Tolerance:', hasFactoryTolerance);

    if (hasCornerDefinition && hasFactoryTolerance) {
      console.log('🎯 SUCCESS: Enhanced corner definition is now in the assistant!');
    } else {
      console.log('⚠️ WARNING: Enhanced definitions may not have been applied properly');
    }

  } catch (error) {
    console.error('Error updating assistant:', error.message);
  }
}

updateAssistant();