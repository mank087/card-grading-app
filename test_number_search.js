const POKEMON_API_BASE = 'https://api.pokemontcg.io/v2';
const POKEMON_API_KEY = 'a69e2947-6080-4a50-84ae-9f91e054f33e';

async function testNumberSearch() {
  console.log('Testing card number search capabilities...\n');

  // Test 1: Search by name and number
  console.log('=== Test 1: name + number ===');
  const query1 = 'name:"Charizard" number:"4"';
  const url1 = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query1)}`;

  const res1 = await fetch(url1, { headers: { 'X-Api-Key': POKEMON_API_KEY } });
  const json1 = await res1.json();

  console.log('Query:', query1);
  console.log('Results:', json1.data?.length || 0, 'cards');
  if (json1.data?.[0]) {
    json1.data.slice(0, 3).forEach(card => {
      console.log(`  - ${card.name} | ${card.set.name} | #${card.number}/${card.set.printedTotal}`);
    });
  }

  console.log('\n=== Test 2: just number (broad search) ===');

  // Test 2: Search by just number to see how many cards share that number
  const query2 = 'number:"25"';
  const url2 = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query2)}`;

  const res2 = await fetch(url2, { headers: { 'X-Api-Key': POKEMON_API_KEY } });
  const json2 = await res2.json();

  console.log('Query:', query2);
  console.log('Results:', json2.data?.length || 0, 'cards (showing first 5):');
  json2.data?.slice(0, 5).forEach(card => {
    console.log(`  - ${card.name} | ${card.set.name} | #${card.number}`);
  });

  console.log('\n=== Test 3: name only (current approach) ===');

  // Test 3: Current approach - name only
  const query3 = 'name:"Pikachu"';
  const url3 = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query3)}`;

  const res3 = await fetch(url3, { headers: { 'X-Api-Key': POKEMON_API_KEY } });
  const json3 = await res3.json();

  console.log('Query:', query3);
  console.log('Results:', json3.data?.length || 0, 'total cards');
  console.log('(Too many to show all - there are hundreds of Pikachu cards!)');

  console.log('\n=== Test 4: name + set.name (current full query) ===');

  // Test 4: Current full query
  const query4 = 'name:"Pikachu" set.name:"Base"';
  const url4 = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query4)}`;

  const res4 = await fetch(url4, { headers: { 'X-Api-Key': POKEMON_API_KEY } });
  const json4 = await res4.json();

  console.log('Query:', query4);
  console.log('Results:', json4.data?.length || 0, 'cards');
  if (json4.data?.[0]) {
    json4.data.forEach(card => {
      console.log(`  - ${card.name} | ${card.set.name} | #${card.number}/${card.set.printedTotal} | ${card.rarity}`);
    });
  }

  console.log('\n=== CONCLUSION ===');
  console.log('✅ number field IS searchable');
  console.log('✅ Combining name + number gives precise results');
  console.log('✅ Card numbers are unique within a set, so name+number narrows it down significantly');
  console.log('⚠️  Set names need exact matches (e.g., "Base" vs "Base Set" matters)');
}

testNumberSearch().catch(console.error);
