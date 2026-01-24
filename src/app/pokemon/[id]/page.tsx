import { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabaseServer';
import { PokemonCardDetails } from './CardDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Helper: Strip markdown formatting
function stripMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  // Remove **bold** formatting
  return text.replace(/\*\*/g, '').trim();
}

// Helper: Generate meta keywords for Pokemon cards
function generateMetaKeywords(card: any): string {
  const keywords: string[] = [];

  // 🎯 v3.3: Prioritize database columns (verified from OCR override/internal DB) over JSONB
  const pokemonName = getFirstValidValue(
    card.pokemon_featured,
    card.featured,
    card.conversational_card_info?.player_or_character
  );
  const setName = getFirstValidValue(card.card_set, card.conversational_card_info?.set_name);
  // Extract year from release_date if it's a full date string
  const releaseYear = card.release_date ? card.release_date.slice(0, 4) : null;
  const year = getFirstValidValue(releaseYear, card.conversational_card_info?.year);
  const manufacturer = getFirstValidValue(
    card.manufacturer_name,
    card.conversational_card_info?.manufacturer
  ) || 'The Pokemon Company';
  const rarity = getFirstValidValue(card.rarity_tier, card.conversational_card_info?.rarity_tier);
  const cardNumber = getFirstValidValue(
    card.card_number,
    card.conversational_card_info?.card_number_raw,
    card.conversational_card_info?.card_number
  );
  const pokemonType = getFirstValidValue(card.pokemon_type, card.conversational_card_info?.pokemon_type);
  const hp = getFirstValidValue(card.hp, card.conversational_card_info?.hp);
  const grade = card.conversational_decimal_grade;

  // Core keywords - Pokemon name variations
  if (pokemonName) {
    keywords.push(pokemonName.toLowerCase());
    keywords.push(`${pokemonName} pokemon card`.toLowerCase());
    if (year) keywords.push(`${year} ${pokemonName}`.toLowerCase());
    if (setName) keywords.push(`${setName} ${pokemonName}`.toLowerCase());
  }

  // Set and manufacturer
  if (setName) {
    keywords.push(setName.toLowerCase());
    keywords.push(`${setName} pokemon`.toLowerCase());
  }
  if (manufacturer) keywords.push(manufacturer.toLowerCase());
  if (year && setName) keywords.push(`${year} ${setName}`.toLowerCase());

  // Pokemon-specific
  keywords.push('pokemon cards', 'pokemon tcg', 'trading card game');
  if (pokemonType) {
    keywords.push(`${pokemonType.toLowerCase()} type pokemon`);
    keywords.push(`${pokemonType.toLowerCase()} pokemon`);
  }
  if (hp) keywords.push(`${hp}hp pokemon`);

  // Card number and rarity
  if (cardNumber) keywords.push(`card number ${cardNumber}`);
  if (rarity) {
    keywords.push(rarity.toLowerCase());
    if (rarity.toLowerCase().includes('holo')) keywords.push('holographic', 'holo');
    if (rarity.toLowerCase().includes('rare')) keywords.push('rare pokemon card');
  }

  // Grading keywords
  keywords.push('graded pokemon card', 'dcm grading', 'professional grading', 'pokemon card authentication');

  // PSA/BGS equivalent
  if (grade !== null && grade !== undefined) {
    const psaGrade = Math.floor(grade);
    keywords.push(`psa ${psaGrade}`, `bgs ${grade}`);
    if (grade >= 9) keywords.push('gem mint pokemon');
    if (grade >= 8) keywords.push('near mint pokemon');
  }

  // Special features
  if (card.conversational_card_info?.rookie_or_first || card.first_print_rookie) {
    keywords.push('first edition', '1st edition', 'first print');
  }

  if (card.conversational_card_info?.serial_number || card.serial_numbering) {
    keywords.push('serial numbered', 'limited edition pokemon');
  }

  // Remove duplicates and return
  return [...new Set(keywords)].join(', ');
}

// Helper: Check if value is valid (not empty, null, "Unknown", etc.)
function isValidValue(value: any): boolean {
  if (!value) return false;
  if (typeof value !== 'string') return false;
  const cleaned = value.trim().toLowerCase();
  if (cleaned === '') return false;
  if (cleaned === 'unknown') return false;
  if (cleaned === 'n/a') return false;
  if (cleaned === 'not visible') return false;
  if (cleaned === 'null') return false;
  if (cleaned.startsWith('unknown ')) return false;
  return true;
}

// Helper: Get first valid value from a list of candidates (validates before fallback)
function getFirstValidValue(...values: (string | null | undefined)[]): string {
  for (const value of values) {
    const stripped = stripMarkdown(value);
    if (isValidValue(stripped)) return stripped;
  }
  return '';
}

// Helper: Build enhanced title for Pokemon cards
// Format matches Sports cards: Name Year Set Subset Features - DCM Grade X
function buildTitle(card: any): string {
  // 🎯 v3.3: Prioritize database columns (verified from OCR override/internal DB) over JSONB
  const pokemonName = getFirstValidValue(
    card.pokemon_featured,  // Database column first
    card.featured,
    card.conversational_card_info?.player_or_character
  );
  // Extract year from release_date if it's a full date string (safely handle non-string values)
  const releaseYear = card.release_date && typeof card.release_date === 'string'
    ? card.release_date.slice(0, 4)
    : null;
  const year = getFirstValidValue(releaseYear, card.conversational_card_info?.year);
  const setName = getFirstValidValue(card.card_set, card.conversational_card_info?.set_name);
  const cardNumber = getFirstValidValue(
    card.card_number,
    card.conversational_card_info?.card_number_raw,
    card.conversational_card_info?.card_number
  );
  const rarity = getFirstValidValue(card.rarity_tier, card.conversational_card_info?.rarity_tier);
  const grade = card.conversational_decimal_grade;

  // Special features
  const isFirstEdition = card.first_print_rookie || card.conversational_card_info?.rookie_or_first;
  const serialNum = getFirstValidValue(card.serial_numbering, card.conversational_card_info?.serial_number);

  const titleParts: string[] = [];

  // Pokemon name - primary identifier
  if (isValidValue(pokemonName)) titleParts.push(pokemonName);

  // Year (matches Sports pattern)
  if (isValidValue(year)) titleParts.push(year);

  // Set name
  if (isValidValue(setName)) titleParts.push(setName);

  // Card number as subset equivalent
  if (isValidValue(cardNumber)) titleParts.push(`#${cardNumber}`);

  // Rarity (shortened)
  if (isValidValue(rarity)) {
    if (rarity.toLowerCase().includes('holo')) {
      titleParts.push('Holo');
    } else if (rarity.toLowerCase().includes('rare')) {
      titleParts.push('Rare');
    } else {
      titleParts.push(rarity);
    }
  }

  // Special features (matches Sports: RC, Auto, Serial)
  const features: string[] = [];
  if (isFirstEdition) features.push('1st Ed');
  if (isValidValue(serialNum)) features.push(serialNum);
  if (features.length > 0) titleParts.push(features.join(' '));

  // Build title with space separator (matches Sports)
  let title = titleParts.filter(p => p && p.trim()).join(' ');

  // If title is empty, try harder
  if (!title || title.trim() === '') {
    const cardName = stripMarkdown(card.conversational_card_info?.card_name) || card.card_name;
    title = isValidValue(cardName) ? cardName : 'Pokemon Card';
  }

  // Add grade with dash separator (matches Sports pattern)
  if (grade !== null && grade !== undefined && !isNaN(grade)) {
    title += ` - DCM Grade ${grade}`;
  } else {
    title += ' - DCM Grading';
  }

  // Ensure title isn't too long (60 characters recommended, 70 max)
  if (title.length > 70) {
    const truncated = title.substring(0, 67);
    const lastSpace = truncated.lastIndexOf(' ');
    title = truncated.substring(0, lastSpace) + '...';
  }

  return title;
}

// Helper: Build enhanced description for Pokemon cards
function buildDescription(card: any): string {
  // Use conversational AI data first, then database fields
  const pokemonName = stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || card.pokemon_featured || '';
  const setName = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || '';
  // Safely handle release_date which might not be a string
  const releaseYear = card.release_date && typeof card.release_date === 'string'
    ? card.release_date.slice(0, 4)
    : (typeof card.release_date === 'string' ? card.release_date : '');
  const year = stripMarkdown(card.conversational_card_info?.year) || releaseYear || '';
  const cardNumber = stripMarkdown(card.conversational_card_info?.card_number_raw) || stripMarkdown(card.conversational_card_info?.card_number) || card.card_number || '';
  const rarity = stripMarkdown(card.conversational_card_info?.rarity_tier) || card.rarity_tier || '';
  const pokemonType = card.conversational_card_info?.pokemon_type || card.pokemon_type || '';
  const hp = card.conversational_card_info?.hp || card.hp || '';
  const grade = card.conversational_decimal_grade;

  // Use condition_label if available, otherwise derive from grade
  const gradeDesc = card.conversational_condition_label?.replace(/\s*\([A-Z]+\)/, '') || (grade !== null && grade !== undefined ? (() => {
    if (grade >= 9.6) return 'Gem Mint';
    if (grade >= 9.0) return 'Mint';
    if (grade >= 8.0) return 'Near Mint';
    if (grade >= 6.0) return 'Excellent';
    if (grade >= 4.0) return 'Good';
    if (grade >= 2.0) return 'Fair';
    return 'Poor';
  })() : null);

  // Special features
  const features: string[] = [];

  const isFirstEdition = card.conversational_card_info?.rookie_or_first || card.first_print_rookie;
  if (isFirstEdition) features.push('1st Edition');

  const serialNum = stripMarkdown(card.conversational_card_info?.serial_number) || card.serial_numbering;
  if (serialNum && serialNum !== 'N/A') features.push(serialNum);

  // Condition highlights from sub-scores
  const highlights: string[] = [];
  const centering = card.conversational_sub_scores?.centering?.weighted;
  const corners = card.conversational_sub_scores?.corners?.weighted;
  const edges = card.conversational_sub_scores?.edges?.weighted;
  const surface = card.conversational_sub_scores?.surface?.weighted;

  if (centering >= 9.5) highlights.push('excellent centering');
  if (corners >= 9.5) highlights.push('sharp corners');
  if (edges >= 9.5) highlights.push('clean edges');
  if (surface >= 10) highlights.push('pristine surface');

  // Build description
  let desc = '';

  // Card identification
  const cardParts = [pokemonName, setName, year, cardNumber ? `#${cardNumber}` : null, rarity].filter(p => isValidValue(p));
  const cardId = cardParts.slice(0, 4).join(' ');

  if (grade !== null && grade !== undefined) {
    desc = `${cardId} graded DCM ${grade}/10.`;
    if (gradeDesc) desc += ` ${gradeDesc}`;
    if (highlights.length > 0) desc += ` with ${highlights.slice(0, 2).join(', ')}`;
    desc += '.';
  } else {
    desc = `${cardId} - Not Gradable.`;
  }

  // Add Pokemon-specific info
  if (pokemonType || hp) {
    const pokemonInfo: string[] = [];
    if (pokemonType) pokemonInfo.push(`${pokemonType} type`);
    if (hp) pokemonInfo.push(`${hp} HP`);
    if (pokemonInfo.length > 0) desc += ` ${pokemonInfo.join(', ')}.`;
  }

  // Add features
  if (features.length > 0) {
    desc += ` ${features.slice(0, 2).join(', ')}.`;
  }

  // Add call to action
  if (grade !== null && grade !== undefined) {
    desc += ' Professional Pokemon card grading with AI analysis.';
  } else {
    desc += ' Professional Pokemon card authentication.';
  }

  // Truncate to 160 characters if needed
  if (desc.length > 160) {
    desc = desc.substring(0, 157) + '...';
  }

  return desc;
}

// Server-side metadata generation for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = supabaseServer();

  // Fetch card data server-side
  const { data: card, error } = await supabase
    .from('cards')
    .select('*')
    .eq('id', id)
    .single();

  // Default metadata if card not found
  if (error || !card) {
    return {
      title: 'Pokemon Card Not Found - DCM Grading',
      description: 'Professional Pokemon card grading and authentication by DCM',
      keywords: 'pokemon card grading, pokemon tcg, professional grading, DCM, authentication',
      openGraph: {
        title: 'Pokemon Card Not Found - DCM Grading',
        description: 'Professional Pokemon card grading and authentication by DCM',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Pokemon Card Not Found - DCM Grading',
        description: 'Professional Pokemon card grading and authentication by DCM',
      },
    };
  }

  // Build enhanced SEO components
  const title = buildTitle(card);
  const description = buildDescription(card);
  const keywords = generateMetaKeywords(card);

  console.log('[METADATA] Pokemon card title:', title);
  console.log('[METADATA] Pokemon card description:', description);

  const imageUrl = card.front_url;
  const cardUrl = `https://dcmgrading.com/pokemon/${id}`;
  const isPrivate = card.visibility === 'private';

  const pokemonName = card.conversational_card_info?.player_or_character || card.featured || card.pokemon_featured || 'Pokemon Card';

  // Return enhanced metadata with full SEO optimization
  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: cardUrl,
    },
    openGraph: {
      title,
      description,
      images: imageUrl ? [
        {
          url: imageUrl,
          width: 800,
          height: 1120,
          alt: `${pokemonName} - DCM Graded Pokemon Card`,
        },
      ] : undefined,
      url: cardUrl,
      type: 'website',
      siteName: 'DCM Card Grading',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
      creator: '@DCMGrading',
    },
    // Privacy-aware robots: noindex/nofollow for private cards
    robots: isPrivate ? {
      index: false,
      follow: false,
    } : {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

// Server component that renders the client component
export default function Page() {
  return <PokemonCardDetails />;
}
