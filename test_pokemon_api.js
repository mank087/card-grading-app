// test_pokemon_api.js
// Simple test script to verify Pokemon TCG API integration

const POKEMON_API_BASE = 'https://api.pokemontcg.io/v2';
const POKEMON_API_KEY = 'a69e2947-6080-4a50-84ae-9f91e054f33e';

async function testSearchCards() {
  console.log('\n=== Testing Card Search ===\n');

  try {
    const query = 'name:"Charizard" set.name:"Base"';
    const url = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query)}`;

    console.log('Searching for: Charizard from Base Set');
    console.log(`URL: ${url}\n`);

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': POKEMON_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    const cards = json.data || [];

    console.log(`✅ Found ${cards.length} card(s)\n`);

    cards.forEach((card, index) => {
      console.log(`Card ${index + 1}:`);
      console.log(`  ID: ${card.id}`);
      console.log(`  Name: ${card.name}`);
      console.log(`  Set: ${card.set.name}`);
      console.log(`  Number: ${card.number}/${card.set.printedTotal}`);
      console.log(`  Rarity: ${card.rarity}`);
      console.log(`  HP: ${card.hp || 'N/A'}`);
      console.log(`  Types: ${card.types?.join(', ') || 'N/A'}`);
      console.log(`  Release Date: ${card.set.releaseDate}`);

      if (card.tcgplayer?.prices) {
        const prices = card.tcgplayer.prices;
        console.log('  Prices:');
        if (prices.holofoil) {
          console.log(`    Holofoil Market: $${prices.holofoil.market}`);
        }
        if (prices['1stEditionHolofoil']) {
          console.log(`    1st Edition Holofoil Market: $${prices['1stEditionHolofoil'].market}`);
        }
        if (prices.normal) {
          console.log(`    Normal Market: $${prices.normal.market}`);
        }
      }

      console.log('');
    });

    return true;
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    return false;
  }
}

async function testGetCardById() {
  console.log('\n=== Testing Get Card By ID ===\n');

  try {
    const cardId = 'base1-4'; // Charizard Base Set
    const url = `${POKEMON_API_BASE}/cards/${cardId}`;

    console.log(`Getting card: ${cardId}\n`);

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': POKEMON_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    const card = json.data;

    console.log('✅ Card found:\n');
    console.log(`  Name: ${card.name}`);
    console.log(`  Set: ${card.set.name}`);
    console.log(`  Rarity: ${card.rarity}`);
    console.log(`  HP: ${card.hp}`);
    console.log(`  Types: ${card.types?.join(', ')}`);
    console.log(`  Image: ${card.images.small}`);
    console.log('');

    return true;
  } catch (error) {
    console.error('❌ Get card by ID failed:', error.message);
    return false;
  }
}

async function testModernCards() {
  console.log('\n=== Testing Modern Card Search ===\n');

  try {
    const query = 'name:"Pikachu VMAX"';
    const url = `${POKEMON_API_BASE}/cards?q=${encodeURIComponent(query)}`;

    console.log('Searching for: Pikachu VMAX (modern card)\n');

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': POKEMON_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    const cards = json.data || [];

    console.log(`✅ Found ${cards.length} card(s)\n`);

    if (cards.length > 0) {
      const card = cards[0];
      console.log(`First result:`);
      console.log(`  Name: ${card.name}`);
      console.log(`  Set: ${card.set.name}`);
      console.log(`  Rarity: ${card.rarity}`);
      console.log(`  HP: ${card.hp}`);
      console.log('');
    }

    return true;
  } catch (error) {
    console.error('❌ Modern card search failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Pokemon TCG API Integration Test Suite  ║');
  console.log('╚════════════════════════════════════════════╝');

  const results = {
    search: await testSearchCards(),
    getById: await testGetCardById(),
    modern: await testModernCards()
  };

  console.log('\n=== Test Results Summary ===\n');
  console.log(`Card Search:           ${results.search ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Get Card By ID:        ${results.getById ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Modern Card Search:    ${results.modern ? '✅ PASSED' : '❌ FAILED'}`);

  const allPassed = Object.values(results).every(r => r);
  console.log(`\n${'='.repeat(50)}`);
  console.log(allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  console.log('='.repeat(50));
}

runAllTests();
