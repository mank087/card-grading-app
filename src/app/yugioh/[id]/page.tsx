import { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabaseServer';
import YugiohCardDetails from './CardDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Helper: Strip markdown formatting
function stripMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  if (typeof text !== 'string') return String(text); // Handle numbers/objects
  // Remove **bold** formatting
  return text.replace(/\*\*/g, '').trim();
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

// Helper: Generate meta keywords for Yu-Gi-Oh cards
function generateMetaKeywords(card: any): string {
  const keywords: string[] = [];

  // Priority: label_data (canonical display) > conversational AI > DB columns
  const cardName = getFirstValidValue(
    card.label_data?.primaryName,
    card.conversational_card_info?.card_name,
    card.card_name
  );
  const characterName = getFirstValidValue(
    card.conversational_card_info?.player_or_character,
    card.featured
  );
  const setName = getFirstValidValue(
    card.label_data?.setName,
    card.conversational_card_info?.set_name,
    card.card_set
  );
  const cardNumber = getFirstValidValue(
    card.label_data?.cardNumber,
    card.conversational_card_info?.card_number,
    card.card_number
  );
  const releaseYear = card.release_date ? card.release_date.slice(0, 4) : null;
  const year = getFirstValidValue(card.label_data?.year, card.conversational_card_info?.set_year, releaseYear);
  const rarity = getFirstValidValue(
    card.conversational_card_info?.rarity,
    card.rarity
  );
  const cardType = getFirstValidValue(
    card.conversational_card_info?.ygo_card_type,
    card.ygo_card_type
  );
  const attribute = getFirstValidValue(
    card.conversational_card_info?.attribute,
    card.ygo_attribute
  );
  const archetype = getFirstValidValue(
    card.ygo_archetype,
    card.conversational_card_info?.archetype
  );
  const grade = card.conversational_decimal_grade;

  // Core keywords - card name and character variations
  if (cardName) {
    keywords.push(cardName.toLowerCase());
    keywords.push(`${cardName} yu-gi-oh`.toLowerCase());
    if (setName) keywords.push(`${setName} ${cardName}`.toLowerCase());
  }
  if (characterName && characterName !== cardName) {
    keywords.push(characterName.toLowerCase());
    keywords.push(`${characterName} yu-gi-oh card`.toLowerCase());
  }

  // Set info
  if (setName) {
    keywords.push(setName.toLowerCase());
    keywords.push(`${setName} yu-gi-oh`.toLowerCase());
  }
  if (year && setName) keywords.push(`${year} ${setName}`.toLowerCase());

  // Yu-Gi-Oh TCG-specific
  keywords.push('yu-gi-oh tcg', 'ygo', 'yugioh', 'konami', 'yu-gi-oh cards');
  if (attribute) {
    keywords.push(`${attribute.toLowerCase()} yu-gi-oh card`);
    keywords.push(`${attribute.toLowerCase()} attribute`);
  }
  if (cardType) {
    keywords.push(`${cardType.toLowerCase()} yu-gi-oh`);
    keywords.push(`yu-gi-oh ${cardType.toLowerCase()}`);
  }

  // Card types
  keywords.push('monster card', 'spell card', 'trap card');

  // Attributes
  keywords.push('dark', 'light', 'fire', 'water', 'earth', 'wind', 'divine');

  // Archetype
  if (archetype) {
    keywords.push(archetype.toLowerCase());
    keywords.push(`${archetype.toLowerCase()} deck`);
    keywords.push(`${archetype.toLowerCase()} yu-gi-oh`);
  }

  // Card number and rarity
  if (cardNumber) keywords.push(`card number ${cardNumber}`);
  if (rarity) {
    keywords.push(rarity.toLowerCase());
    if (rarity.toLowerCase().includes('secret')) keywords.push('secret rare yu-gi-oh');
    if (rarity.toLowerCase().includes('ultra')) keywords.push('ultra rare yu-gi-oh');
    if (rarity.toLowerCase().includes('ghost')) keywords.push('ghost rare yu-gi-oh');
    if (rarity.toLowerCase().includes('starlight')) keywords.push('starlight rare yu-gi-oh');
  }

  // Grading keywords
  keywords.push('graded yu-gi-oh card', 'dcm grading', 'professional grading', 'yu-gi-oh card authentication');

  // PSA/BGS equivalent
  if (grade !== null && grade !== undefined) {
    const psaGrade = Math.floor(grade);
    keywords.push(`psa ${psaGrade}`, `bgs ${grade}`);
    if (grade >= 9) keywords.push('gem mint yu-gi-oh');
    if (grade >= 8) keywords.push('near mint yu-gi-oh');
  }

  // Remove duplicates and return
  return [...new Set(keywords)].join(', ');
}

// Helper: Build dynamic title for Yu-Gi-Oh cards
// Format matches other card types: Card Name Year Set #Number - DCM Grade X
function buildTitle(card: any): string {
  const cardName = getFirstValidValue(
    card.label_data?.primaryName,
    card.conversational_card_info?.card_name,
    card.card_name
  );
  const characterName = getFirstValidValue(
    card.conversational_card_info?.player_or_character,
    card.featured
  );
  const setName = getFirstValidValue(
    card.label_data?.setName,
    card.conversational_card_info?.set_name,
    card.card_set
  );
  const cardNumber = getFirstValidValue(
    card.label_data?.cardNumber,
    card.conversational_card_info?.card_number,
    card.card_number
  );
  const releaseYear = card.release_date ? card.release_date.slice(0, 4) : null;
  const year = getFirstValidValue(card.label_data?.year, card.conversational_card_info?.set_year, releaseYear);
  const grade = card.conversational_decimal_grade;

  const titleParts: string[] = [];

  // Card name or character name - most important
  if (isValidValue(cardName)) {
    titleParts.push(cardName);
  } else if (isValidValue(characterName)) {
    titleParts.push(characterName);
  }

  // Year (matches other card patterns)
  if (year && !isNaN(Number(year))) {
    titleParts.push(String(year));
  }

  // Set name
  if (isValidValue(setName)) {
    titleParts.push(setName);
  }

  // Card number
  if (isValidValue(cardNumber)) {
    titleParts.push(`#${cardNumber}`);
  }

  // Build title with space separator
  let title = titleParts.filter(p => p && p.trim()).join(' ');

  // If title is empty, use fallback
  if (!title || title.trim() === '') {
    title = 'Yu-Gi-Oh Card';
  }

  // Add grade with dash separator
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

// Helper: Build description for Yu-Gi-Oh cards
function buildDescription(card: any): string {
  const cardName = getFirstValidValue(
    card.label_data?.primaryName,
    card.conversational_card_info?.card_name,
    card.card_name
  );
  const setName = getFirstValidValue(
    card.label_data?.setName,
    card.conversational_card_info?.set_name,
    card.card_set
  );
  const releaseYear = card.release_date ? card.release_date.slice(0, 4) : null;
  const year = getFirstValidValue(card.label_data?.year, card.conversational_card_info?.set_year, releaseYear);
  const attribute = getFirstValidValue(
    card.conversational_card_info?.attribute,
    card.ygo_attribute
  );
  const grade = card.conversational_decimal_grade;

  const gradeDesc = card.conversational_condition_label?.replace(/\s*\([A-Z]+\)/, '') || (grade !== null && grade !== undefined ? (() => {
    if (grade >= 9.6) return 'Gem Mint';
    if (grade >= 9.0) return 'Mint';
    if (grade >= 8.0) return 'Near Mint';
    if (grade >= 6.0) return 'Excellent';
    if (grade >= 4.0) return 'Good';
    if (grade >= 2.0) return 'Fair';
    return 'Poor';
  })() : null);

  let desc = '';

  const cardParts = [cardName, setName, year ? String(year) : null].filter(p => isValidValue(p));
  const cardId = cardParts.join(' ');

  if (grade !== null && grade !== undefined) {
    desc = `${cardId} graded DCM ${grade}/10.`;
    if (gradeDesc) desc += ` ${gradeDesc} condition.`;

    // Add Yu-Gi-Oh-specific details
    const details: string[] = [];
    if (isValidValue(attribute)) details.push(`${attribute} attribute`);
    if (details.length > 0) desc += ` ${details.join(', ')}.`;

    desc += ' Professional Yu-Gi-Oh TCG card grading with AI analysis.';
  } else {
    desc = `${cardId} - Professional Yu-Gi-Oh TCG card authentication and grading by DCM.`;
  }

  // Truncate to 160 characters if needed
  if (desc.length > 160) {
    desc = desc.substring(0, 157) + '...';
  }

  return desc;
}

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
      title: 'Yu-Gi-Oh Card Not Found | DCM Grading',
      description: 'Professional Yu-Gi-Oh TCG card grading and authentication by DCM',
      keywords: 'yu-gi-oh card grading, yu-gi-oh tcg, ygo, konami, professional grading, DCM, authentication',
      openGraph: {
        title: 'Yu-Gi-Oh Card Not Found | DCM Grading',
        description: 'Professional Yu-Gi-Oh TCG card grading and authentication by DCM',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Yu-Gi-Oh Card Not Found | DCM Grading',
        description: 'Professional Yu-Gi-Oh TCG card grading and authentication by DCM',
      },
    };
  }

  // Build enhanced SEO components
  const title = buildTitle(card);
  const description = buildDescription(card);
  const keywords = generateMetaKeywords(card);
  const isPrivate = card.visibility === 'private';

  console.log('[METADATA] Yu-Gi-Oh card title:', title);
  console.log('[METADATA] Yu-Gi-Oh card description:', description);

  const imageUrl = card.front_url;
  const cardUrl = `https://dcmgrading.com/yugioh/${id}`;
  const cardName = getFirstValidValue(
    card.card_name,
    card.conversational_card_info?.card_name
  ) || 'Yu-Gi-Oh Card';

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
          alt: `${cardName} - DCM Graded Yu-Gi-Oh Card`,
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

export default function YugiohCardDetailPage() {
  return <YugiohCardDetails />;
}
