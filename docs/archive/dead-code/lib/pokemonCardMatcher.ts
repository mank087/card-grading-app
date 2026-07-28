// src/lib/pokemonCardMatcher.ts
// Fuzzy matching to find best card match from API results
// Enhanced with confidence flags system for better match visibility

import { PokemonCard } from './pokemonTcgApi';

/**
 * Confidence flags tracking which features matched
 */
export interface MatchConfidenceFlags {
  nameMatched: boolean;
  nameScore: number;
  setMatched: boolean;
  setScore: number;
  numberMatched: boolean;
  numberScore: number;
  denominatorMatched: boolean;
  rarityMatched: boolean;
  rarityScore: number;
  overallConfidence: 'high' | 'medium' | 'low';
  matchedFeatures: number;
  totalFeatures: number;
  warnings: string[];
}

/**
 * Extended match result with confidence flags
 */
export interface MatchResult {
  card: PokemonCard | null;
  score: number;
  confidence: MatchConfidenceFlags;
}

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
 * Extract denominator from card number string
 */
function extractDenominator(cardNumber: string): number | null {
  const match = cardNumber.match(/\/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Find best matching card from API results with confidence flags
 */
export function findBestMatchWithConfidence(
  apiResults: PokemonCard[],
  aiIdentification: {
    name?: string;
    set?: string;
    cardNumber?: string;
    rarity?: string;
    setTotal?: string; // Denominator from AI extraction
  }
): MatchResult {
  const emptyConfidence: MatchConfidenceFlags = {
    nameMatched: false,
    nameScore: 0,
    setMatched: false,
    setScore: 0,
    numberMatched: false,
    numberScore: 0,
    denominatorMatched: false,
    rarityMatched: false,
    rarityScore: 0,
    overallConfidence: 'low',
    matchedFeatures: 0,
    totalFeatures: 0,
    warnings: []
  };

  if (apiResults.length === 0) {
    return { card: null, score: 0, confidence: { ...emptyConfidence, warnings: ['No API results to match against'] } };
  }

  // Extract AI denominator for validation
  const aiDenominator = aiIdentification.setTotal
    ? parseInt(aiIdentification.setTotal.replace(/[^0-9]/g, ''))
    : aiIdentification.cardNumber
      ? extractDenominator(aiIdentification.cardNumber)
      : null;

  // Score each result with detailed tracking
  const scored = apiResults.map(card => {
    let score = 0;
    let factors = 0;
    const confidence: MatchConfidenceFlags = { ...emptyConfidence, warnings: [] };

    // Name match (most important) - weight 3
    if (aiIdentification.name) {
      const nameScore = calculateSimilarity(card.name, aiIdentification.name);
      score += nameScore * 3;
      factors += 3;
      confidence.nameScore = nameScore;
      confidence.nameMatched = nameScore >= 0.8;
      if (nameScore < 0.5) {
        confidence.warnings.push(`Name mismatch: "${aiIdentification.name}" vs "${card.name}"`);
      }
    }

    // Set match (very important) - weight 2
    if (aiIdentification.set) {
      const setScore = calculateSimilarity(card.set.name, aiIdentification.set);
      score += setScore * 2;
      factors += 2;
      confidence.setScore = setScore;
      confidence.setMatched = setScore >= 0.7;
      if (setScore < 0.5) {
        confidence.warnings.push(`Set mismatch: "${aiIdentification.set}" vs "${card.set.name}"`);
      }
    }

    // Card number match (important) - weight 2
    if (aiIdentification.cardNumber) {
      const apiNumber = `${card.number}/${card.set.printedTotal}`;
      const numberScore = calculateSimilarity(apiNumber, aiIdentification.cardNumber);
      score += numberScore * 2;
      factors += 2;
      confidence.numberScore = numberScore;
      confidence.numberMatched = numberScore >= 0.8;

      // Check denominator specifically (CRITICAL)
      if (aiDenominator && card.set.printedTotal) {
        confidence.denominatorMatched = aiDenominator === card.set.printedTotal;
        if (!confidence.denominatorMatched) {
          confidence.warnings.push(`Denominator mismatch: AI extracted /${aiDenominator}, card is from set with ${card.set.printedTotal} cards`);
          // Penalize denominator mismatch heavily
          score -= 1.5;
        }
      }
    }

    // Rarity match (less important) - weight 1
    if (aiIdentification.rarity && card.rarity) {
      const rarityScore = calculateSimilarity(card.rarity, aiIdentification.rarity);
      score += rarityScore;
      factors += 1;
      confidence.rarityScore = rarityScore;
      confidence.rarityMatched = rarityScore >= 0.7;
    }

    // Calculate matched features count
    let matchedFeatures = 0;
    let totalFeatures = 0;
    if (aiIdentification.name) { totalFeatures++; if (confidence.nameMatched) matchedFeatures++; }
    if (aiIdentification.set) { totalFeatures++; if (confidence.setMatched) matchedFeatures++; }
    if (aiIdentification.cardNumber) { totalFeatures++; if (confidence.numberMatched) matchedFeatures++; }
    if (aiDenominator) { totalFeatures++; if (confidence.denominatorMatched) matchedFeatures++; }
    if (aiIdentification.rarity) { totalFeatures++; if (confidence.rarityMatched) matchedFeatures++; }

    confidence.matchedFeatures = matchedFeatures;
    confidence.totalFeatures = totalFeatures;

    // Determine overall confidence
    const matchRatio = totalFeatures > 0 ? matchedFeatures / totalFeatures : 0;
    if (matchRatio >= 0.8 && confidence.denominatorMatched !== false) {
      confidence.overallConfidence = 'high';
    } else if (matchRatio >= 0.5 && confidence.denominatorMatched !== false) {
      confidence.overallConfidence = 'medium';
    } else {
      confidence.overallConfidence = 'low';
    }

    // Force low confidence if denominator mismatched
    if (confidence.denominatorMatched === false) {
      confidence.overallConfidence = 'low';
    }

    return {
      card,
      score: factors > 0 ? score / factors : 0,
      confidence
    };
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  console.log('[Pokemon Matcher] Top 3 matches with confidence:');
  scored.slice(0, 3).forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.card.name} (${result.card.set.name}) - Score: ${result.score.toFixed(2)}, Confidence: ${result.confidence.overallConfidence}`);
    if (result.confidence.warnings.length > 0) {
      result.confidence.warnings.forEach(w => console.log(`     ⚠️ ${w}`));
    }
  });

  // Return best match if score is good enough
  // Use higher threshold (0.7) if there are denominator concerns
  const threshold = aiDenominator ? 0.7 : 0.6;
  if (scored[0].score >= threshold) {
    return scored[0];
  }

  // Return the best match anyway but with low confidence
  if (scored[0].score >= 0.4) {
    scored[0].confidence.overallConfidence = 'low';
    scored[0].confidence.warnings.push(`Match score (${scored[0].score.toFixed(2)}) below confidence threshold (${threshold})`);
    return scored[0];
  }

  return { card: null, score: 0, confidence: { ...emptyConfidence, warnings: ['No match met minimum score threshold'] } };
}

/**
 * Find best matching card from API results (legacy function for backwards compatibility)
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
  const result = findBestMatchWithConfidence(apiResults, aiIdentification);

  // Only return card if confidence is not low, or if score is very high
  if (result.card && (result.confidence.overallConfidence !== 'low' || result.score >= 0.8)) {
    return result.card;
  }

  // For low confidence matches, still return if score is acceptable
  if (result.card && result.score >= 0.6) {
    return result.card;
  }

  return null;
}
