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

async function checkAssistants() {
  const stage1Id = 'asst_EbYus9ZeLMrGHw9ICEfQ99vm';
  const stage2Id = 'asst_XjzIEKt9P6Gj6aXRFe91jwV3';

  console.log('\n=== STAGE 1 MEASUREMENT ASSISTANT ===');
  const stage1 = await openai.beta.assistants.retrieve(stage1Id);
  console.log(`ID: ${stage1.id}`);
  console.log(`Name: ${stage1.name}`);
  console.log(`Instructions Length: ${stage1.instructions?.length || 0}`);
  console.log(`Has "overall_score": ${stage1.instructions?.includes('overall_score') || false}`);
  console.log(`Has "reference_points": ${stage1.instructions?.includes('reference_points') || false}`);
  console.log(`Has "5-Category": ${stage1.instructions?.includes('5-Category') || stage1.instructions?.includes('5 categories') || false}`);
  console.log(`Preview: ${stage1.instructions?.substring(0, 150)}...`);

  console.log('\n=== STAGE 2 EVALUATION ASSISTANT ===');
  const stage2 = await openai.beta.assistants.retrieve(stage2Id);
  console.log(`ID: ${stage2.id}`);
  console.log(`Name: ${stage2.name}`);
  console.log(`Instructions Length: ${stage2.instructions?.length || 0}`);
  console.log(`Has "confidence-weighted": ${stage2.instructions?.includes('confidence-weighted') || stage2.instructions?.includes('Confidence-Weighted') || false}`);
  console.log(`Preview: ${stage2.instructions?.substring(0, 150)}...`);
}

checkAssistants().catch(console.error);
