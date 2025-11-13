// src/lib/pokemonCardMatcher.ts
// Fuzzy matching to find best card match from API results

import { PokemonCard } from './pokemonTcgApi';

/**
 * Calculate similarity score between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // Contains match
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Levenshtein distance (simplified)
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Find best matching card from API results
 */
export function findBestMatch(
  apiResults: PokemonCard[],
  aiIdentification: {
    name?: string;
    set?: string;
    cardNumber?: string;
    rarity?: string;
  }
): PokemonCard | null {
  if (apiResults.length === 0) return null;
  if (apiResults.length === 1) return apiResults[0];

  // Score each result
  const scored = apiResults.map(card => {
    let score = 0;
    let factors = 0;

    // Name match (most important)
    if (aiIdentification.name) {
      score += calculateSimilarity(card.name, aiIdentification.name) * 3;
      factors += 3;
    }

    // Set match (very important)
    if (aiIdentification.set) {
      score += calculateSimilarity(card.set.name, aiIdentification.set) * 2;
      factors += 2;
    }

    // Card number match (important)
    if (aiIdentification.cardNumber) {
      const apiNumber = `${card.number}/${card.set.printedTotal}`;
      score += calculateSimilarity(apiNumber, aiIdentification.cardNumber) * 2;
      factors += 2;
    }

    // Rarity match (less important)
    if (aiIdentification.rarity) {
      score += calculateSimilarity(card.rarity, aiIdentification.rarity);
      factors += 1;
    }

    return {
      card,
      score: factors > 0 ? score / factors : 0
    };
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  console.log('[Pokemon Matcher] Top 3 matches:');
  scored.slice(0, 3).forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.card.name} (${result.card.set.name}) - Score: ${result.score.toFixed(2)}`);
  });

  // Return best match if score is good enough
  if (scored[0].score >= 0.6) {
    return scored[0].card;
  }

  return null;
}
