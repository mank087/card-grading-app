import { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabaseServer';
import OnePieceCardDetails from './CardDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Helper: Strip markdown formatting
function stripMarkdown(text: string | null | undefined): string {
  if (!text) return '';
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

// Helper: Generate meta keywords for One Piece cards
function generateMetaKeywords(card: any): string {
  const keywords: string[] = [];

  // Get card info from database columns or conversational_card_info
  const cardName = getFirstValidValue(
    card.card_name,
    card.conversational_card_info?.card_name
  );
  const characterName = getFirstValidValue(
    card.featured,
    card.conversational_card_info?.player_or_character
  );
  const setName = getFirstValidValue(
    card.card_set,
    card.conversational_card_info?.set_name
  );
  const cardNumber = getFirstValidValue(
    card.card_number,
    card.conversational_card_info?.card_number
  );
  const releaseYear = card.release_date ? card.release_date.slice(0, 4) : null;
  const year = getFirstValidValue(releaseYear, card.conversational_card_info?.set_year);
  const rarity = getFirstValidValue(
    card.rarity,
    card.conversational_card_info?.rarity
  );
  const cardColor = getFirstValidValue(
    card.op_card_color,
    card.conversational_card_info?.card_color
  );
  const cardType = getFirstValidValue(
    card.op_card_type,
    card.conversational_card_info?.op_card_type
  );
  const variantType = getFirstValidValue(
    card.op_variant_type,
    card.conversational_card_info?.variant_type
  );
  const grade = card.conversational_decimal_grade;

  // Core keywords - card name and character variations
  if (cardName) {
    keywords.push(cardName.toLowerCase());
    keywords.push(`${cardName} one piece`.toLowerCase());
    if (setName) keywords.push(`${setName} ${cardName}`.toLowerCase());
  }
  if (characterName && characterName !== cardName) {
    keywords.push(characterName.toLowerCase());
    keywords.push(`${characterName} one piece card`.toLowerCase());
  }

  // Set info
  if (setName) {
    keywords.push(setName.toLowerCase());
    keywords.push(`${setName} one piece`.toLowerCase());
  }
  if (year && setName) keywords.push(`${year} ${setName}`.toLowerCase());

  // One Piece TCG-specific
  keywords.push('one piece tcg', 'one piece card game', 'one piece cards', 'optcg', 'bandai one piece');
  if (cardColor) {
    keywords.push(`${cardColor.toLowerCase()} one piece card`);
    keywords.push(`${cardColor.toLowerCase()} optcg`);
  }
  if (cardType) {
    keywords.push(`${cardType.toLowerCase()} one piece`);
    keywords.push(`one piece ${cardType.toLowerCase()}`);
  }

  // Card number and rarity
  if (cardNumber) keywords.push(`card number ${cardNumber}`);
  if (rarity) {
    keywords.push(rarity.toLowerCase());
    if (rarity.toLowerCase().includes('secret')) keywords.push('secret rare one piece');
    if (rarity.toLowerCase().includes('super')) keywords.push('super rare one piece');
    if (rarity.toLowerCase().includes('alternate')) keywords.push('alternate art one piece');
  }

  // Variant keywords
  if (variantType) {
    keywords.push(variantType.toLowerCase());
    if (variantType.toLowerCase().includes('parallel')) keywords.push('parallel art one piece', 'parallel optcg');
    if (variantType.toLowerCase().includes('manga')) keywords.push('manga art one piece');
  }

  // Grading keywords
  keywords.push('graded one piece card', 'dcm grading', 'professional grading', 'one piece card authentication');

  // PSA/BGS equivalent
  if (grade !== null && grade !== undefined) {
    const psaGrade = Math.floor(grade);
    keywords.push(`psa ${psaGrade}`, `bgs ${grade}`);
    if (grade >= 9) keywords.push('gem mint one piece');
    if (grade >= 8) keywords.push('near mint one piece');
  }

  // Remove duplicates and return
  return [...new Set(keywords)].join(', ');
}

// Helper: Build dynamic title for One Piece cards
// Format matches other card types: Card Name Year Set #Number - DCM Grade X
function buildTitle(card: any): string {
  const cardName = getFirstValidValue(
    card.card_name,
    card.conversational_card_info?.card_name
  );
  const characterName = getFirstValidValue(
    card.featured,
    card.conversational_card_info?.player_or_character
  );
  const setName = getFirstValidValue(
    card.card_set,
    card.conversational_card_info?.set_name
  );
  const cardNumber = getFirstValidValue(
    card.card_number,
    card.conversational_card_info?.card_number
  );
  const releaseYear = card.release_date ? card.release_date.slice(0, 4) : null;
  const year = getFirstValidValue(releaseYear, card.conversational_card_info?.set_year);
  const variantType = getFirstValidValue(
    card.op_variant_type,
    card.conversational_card_info?.variant_type
  );
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

  // Variant type (parallel, manga, etc.)
  if (isValidValue(variantType)) {
    const variantLabel = variantType.charAt(0).toUpperCase() + variantType.slice(1).replace(/_/g, ' ');
    titleParts.push(variantLabel);
  }

  // Build title with space separator
  let title = titleParts.filter(p => p && p.trim()).join(' ');

  // If title is empty, use fallback
  if (!title || title.trim() === '') {
    title = 'One Piece Card';
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

// Helper: Build description for One Piece cards
function buildDescription(card: any): string {
  const cardName = getFirstValidValue(
    card.card_name,
    card.conversational_card_info?.card_name
  );
  const setName = getFirstValidValue(
    card.card_set,
    card.conversational_card_info?.set_name
  );
  const releaseYear = card.release_date ? card.release_date.slice(0, 4) : null;
  const year = getFirstValidValue(releaseYear, card.conversational_card_info?.set_year);
  const cardColor = getFirstValidValue(
    card.op_card_color,
    card.conversational_card_info?.card_color
  );
  const variantType = getFirstValidValue(
    card.op_variant_type,
    card.conversational_card_info?.variant_type
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

    // Add One Piece-specific details
    const details: string[] = [];
    if (isValidValue(cardColor)) details.push(`${cardColor} color`);
    if (isValidValue(variantType)) details.push(`${variantType.replace(/_/g, ' ')} variant`);
    if (details.length > 0) desc += ` ${details.join(', ')}.`;

    desc += ' Professional One Piece TCG card grading with AI analysis.';
  } else {
    desc = `${cardId} - Professional One Piece TCG card authentication and grading by DCM.`;
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
      title: 'One Piece Card Not Found | DCM Grading',
      description: 'Professional One Piece TCG card grading and authentication by DCM',
      keywords: 'one piece card grading, one piece tcg, optcg, professional grading, DCM, authentication',
      openGraph: {
        title: 'One Piece Card Not Found | DCM Grading',
        description: 'Professional One Piece TCG card grading and authentication by DCM',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'One Piece Card Not Found | DCM Grading',
        description: 'Professional One Piece TCG card grading and authentication by DCM',
      },
    };
  }

  // Build enhanced SEO components
  const title = buildTitle(card);
  const description = buildDescription(card);
  const keywords = generateMetaKeywords(card);
  const isPrivate = card.visibility === 'private';

  console.log('[METADATA] One Piece card title:', title);
  console.log('[METADATA] One Piece card description:', description);

  const imageUrl = card.front_url;
  const cardUrl = `https://dcmgrading.com/onepiece/${id}`;
  const cardName = getFirstValidValue(
    card.card_name,
    card.conversational_card_info?.card_name
  ) || 'One Piece Card';

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
          alt: `${cardName} - DCM Graded One Piece Card`,
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

export default function OnePieceCardDetailPage() {
  return <OnePieceCardDetails />;
}
