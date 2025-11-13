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

async function createOrUpdateSingleStageAssistant() {
  try {
    // Read the single-stage instructions file
    const instructions = fs.readFileSync('sports_grading_instructions_SINGLE_STAGE_V5.txt', 'utf8');

    console.log('\n=== CREATING/UPDATING SINGLE-STAGE SPORTS GRADING ASSISTANT ===');
    console.log(`Instructions file: sports_grading_instructions_SINGLE_STAGE_V5.txt`);
    console.log(`Instructions length: ${instructions.length} characters`);

    // Check if assistant ID exists in .env.local
    const existingAssistantId = envVars.OPENAI_SPORTS_GRADING_ASSISTANT_ID;

    let assistant;

    if (existingAssistantId && existingAssistantId !== 'asst_PLACEHOLDER') {
      console.log(`\nFound existing assistant ID: ${existingAssistantId}`);
      console.log('Updating existing assistant...');

      // Update existing assistant
      assistant = await openai.beta.assistants.update(
        existingAssistantId,
        {
          instructions: instructions,
          name: "DCM Sports Card Grading - Single Stage v5.0",
          model: "gpt-4o",
          temperature: 0.1
        }
      );

      console.log('\n✅ ASSISTANT UPDATED SUCCESSFULLY!');
    } else {
      console.log('\nNo existing assistant found, creating new assistant...');

      // Create new assistant
      assistant = await openai.beta.assistants.create({
        instructions: instructions,
        name: "DCM Sports Card Grading - Single Stage v5.0",
        model: "gpt-4o",
        temperature: 0.1
      });

      console.log('\n✅ NEW ASSISTANT CREATED SUCCESSFULLY!');
      console.log(`\n⚠️  IMPORTANT: Add this to your .env.local file:`);
      console.log(`OPENAI_SPORTS_GRADING_ASSISTANT_ID=${assistant.id}`);
    }

    console.log(`\nAssistant ID: ${assistant.id}`);
    console.log(`Name: ${assistant.name}`);
    console.log(`Model: ${assistant.model}`);
    console.log(`Temperature: 0.1`);
    console.log(`Instructions length: ${assistant.instructions?.length || 0} characters`);

    // Verify key features
    console.log('\n=== VERIFICATION ===');
    console.log(`✅ Has "image_quality": ${assistant.instructions?.includes('image_quality')}`);
    console.log(`✅ Has "final_grade_calculation": ${assistant.instructions?.includes('final_grade_calculation')}`);
    console.log(`✅ Has "category_scores": ${assistant.instructions?.includes('category_scores')}`);
    console.log(`✅ Has "unique defect descriptions": ${assistant.instructions?.includes('UNIQUE')}`);
    console.log(`✅ Has "weighted composite": ${assistant.instructions?.includes('weighted composite')}`);

    console.log('\n=== INSTRUCTIONS PREVIEW ===');
    console.log(assistant.instructions?.substring(0, 300) + '...\n');

  } catch (error) {
    console.error('❌ Error creating/updating assistant:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

createOrUpdateSingleStageAssistant();
