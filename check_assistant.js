// Quick script to check OpenAI Assistant instructions
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

async function checkAssistant() {
  try {
    const assistant = await openai.beta.assistants.retrieve('asst_gwX2wmsnNsMOqsZqcnypUmlg');

    console.log('=== ASSISTANT INFO ===');
    console.log('ID:', assistant.id);
    console.log('Name:', assistant.name);
    console.log('Model:', assistant.model);
    console.log('Created:', new Date(assistant.created_at * 1000));

    console.log('\n=== INSTRUCTIONS LENGTH ===');
    console.log('Instructions length:', assistant.instructions?.length || 0);

    console.log('\n=== CORNER ROUNDING CHECK ===');
    const instructions = assistant.instructions || '';

    // Check for corner-related content
    const cornerMatches = instructions.match(/corner.*rounding/gi) || [];
    console.log('Corner rounding mentions:', cornerMatches.length);

    if (cornerMatches.length > 0) {
      console.log('Found corner references:', cornerMatches);
    }

    // Check for DCM Standard
    const dcmStandard = instructions.includes('DCM Standard');
    console.log('Contains "DCM Standard":', dcmStandard);

    // Check for Factory Tolerance
    const factoryTolerance = instructions.includes('Factory Tolerance');
    console.log('Contains "Factory Tolerance":', factoryTolerance);

    // Check if instructions seem old or new
    const hasOldDefinition = instructions.includes('significantly rounded/curved with noticeable radius');
    const hasNewDefinition = instructions.includes('deviates substantially from the expected factory cut');

    console.log('\n=== DEFINITION VERSION ===');
    console.log('Has OLD definition:', hasOldDefinition);
    console.log('Has NEW definition:', hasNewDefinition);

    if (hasOldDefinition && !hasNewDefinition) {
      console.log('🚨 PROBLEM: Assistant has OLD corner rounding definition!');
    } else if (hasNewDefinition) {
      console.log('✅ Assistant has NEW corner rounding definition');
    } else {
      console.log('❓ Unknown corner definition status');
    }

    // Show first 500 chars of instructions to verify content
    console.log('\n=== INSTRUCTIONS PREVIEW ===');
    console.log(instructions.substring(0, 500) + '...');

  } catch (error) {
    console.error('Error checking assistant:', error.message);
  }
}

checkAssistant();