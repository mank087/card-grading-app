import { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabaseServer';
import LorcanaCardDetails from './CardDetailClient';

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

// Helper: Generate meta keywords for Lorcana cards
function generateMetaKeywords(card: any): string {
  const keywords: string[] = [];

  // 🎯 v3.3: Prioritize database columns (verified from internal database) over JSONB
  const cardName = getFirstValidValue(card.card_name, card.conversational_card_info?.card_name);
  const characterName = getFirstValidValue(card.featured, card.conversational_card_info?.player_or_character);
  const setName = getFirstValidValue(card.card_set, card.conversational_card_info?.set_name);
  const cardNumber = getFirstValidValue(card.card_number, card.conversational_card_info?.card_number);
  // Extract year from release_date if it's a full date string
  const releaseYear = card.release_date ? card.release_date.slice(0, 4) : null;
  const year = getFirstValidValue(releaseYear, card.conversational_card_info?.set_year, card.set_year);
  const rarity = getFirstValidValue(card.rarity, card.conversational_card_info?.rarity);
  const inkColor = getFirstValidValue(card.ink_color, card.conversational_card_info?.ink_color);
  const grade = card.conversational_decimal_grade;

  // Core keywords - card name and character variations
  if (cardName) {
    keywords.push(cardName.toLowerCase());
    keywords.push(`${cardName} lorcana`.toLowerCase());
    if (setName) keywords.push(`${setName} ${cardName}`.toLowerCase());
  }
  if (characterName && characterName !== cardName) {
    keywords.push(characterName.toLowerCase());
    keywords.push(`${characterName} lorcana`.toLowerCase());
  }

  // Set info
  if (setName) {
    keywords.push(setName.toLowerCase());
    keywords.push(`${setName} lorcana`.toLowerCase());
  }
  if (year && setName) keywords.push(`${year} ${setName}`.toLowerCase());

  // Lorcana-specific
  keywords.push('disney lorcana', 'lorcana', 'lorcana tcg', 'lorcana cards', 'disney trading cards');
  if (inkColor) {
    keywords.push(`${inkColor.toLowerCase()} ink`);
    keywords.push(`${inkColor.toLowerCase()} lorcana`);
  }

  // Card number and rarity
  if (cardNumber) keywords.push(`card number ${cardNumber}`);
  if (rarity) {
    keywords.push(rarity.toLowerCase());
    if (rarity.toLowerCase() === 'legendary') keywords.push('legendary lorcana');
    if (rarity.toLowerCase() === 'enchanted') keywords.push('enchanted lorcana', 'enchanted rare');
    if (rarity.toLowerCase() === 'super rare') keywords.push('super rare lorcana');
  }

  // Grading keywords
  keywords.push('graded lorcana card', 'dcm grading', 'professional grading', 'lorcana card authentication');

  // PSA/BGS equivalent
  if (grade !== null && grade !== undefined) {
    const psaGrade = Math.floor(grade);
    keywords.push(`psa ${psaGrade}`, `bgs ${grade}`);
    if (grade >= 9) keywords.push('gem mint lorcana');
    if (grade >= 8) keywords.push('near mint lorcana');
  }

  // Special features
  if (card.conversational_card_info?.foil || card.foil) {
    keywords.push('foil', 'foil lorcana card');
  }

  // Remove duplicates and return
  return [...new Set(keywords)].join(', ');
}

// Helper: Build dynamic title for Lorcana cards
// Format matches Sports cards: Card Name Year Set #Number - DCM Grade X
function buildTitle(card: any): string {
  // 🎯 v3.3: Prioritize database columns (verified from internal database) over JSONB
  const cardName = getFirstValidValue(card.card_name, card.conversational_card_info?.card_name);
  const setName = getFirstValidValue(card.card_set, card.conversational_card_info?.set_name);
  const cardNumber = getFirstValidValue(card.card_number, card.conversational_card_info?.card_number);
  // Extract year from release_date if it's a full date string
  const releaseYear = card.release_date ? card.release_date.slice(0, 4) : null;
  const year = getFirstValidValue(releaseYear, card.conversational_card_info?.set_year, card.set_year);
  const grade = card.conversational_decimal_grade;

  const titleParts: string[] = [];

  // Card name - most important
  if (isValidValue(cardName)) {
    titleParts.push(cardName);
  }

  // Year (matches Sports pattern)
  if (year && !isNaN(year)) {
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

  // Build title with space separator (matches Sports)
  let title = titleParts.filter(p => p && p.trim()).join(' ');

  // If title is empty, use fallback
  if (!title || title.trim() === '') {
    title = 'Lorcana Card';
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

// Helper: Build description for Lorcana cards
function buildDescription(card: any): string {
  // 🎯 v3.3: Prioritize database columns (verified from internal database) over JSONB
  const cardName = getFirstValidValue(card.card_name, card.conversational_card_info?.card_name);
  const setName = getFirstValidValue(card.card_set, card.conversational_card_info?.set_name);
  // Extract year from release_date if it's a full date string
  const releaseYear = card.release_date ? card.release_date.slice(0, 4) : null;
  const year = getFirstValidValue(releaseYear, card.conversational_card_info?.set_year, card.set_year);
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
    desc += ' Professional Disney Lorcana card grading with AI analysis.';
  } else {
    desc = `${cardId} - Professional Lorcana card authentication and grading by DCM.`;
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
      title: 'Lorcana Card Not Found | DCM Grading',
      description: 'Professional Disney Lorcana card grading and authentication by DCM',
      keywords: 'lorcana card grading, disney lorcana, professional grading, DCM, authentication',
      openGraph: {
        title: 'Lorcana Card Not Found | DCM Grading',
        description: 'Professional Disney Lorcana card grading and authentication by DCM',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Lorcana Card Not Found | DCM Grading',
        description: 'Professional Disney Lorcana card grading and authentication by DCM',
      },
    };
  }

  // Build enhanced SEO components
  const title = buildTitle(card);
  const description = buildDescription(card);
  const keywords = generateMetaKeywords(card);
  const isPrivate = card.visibility === 'private';

  console.log('[METADATA] Lorcana card title:', title);
  console.log('[METADATA] Lorcana card description:', description);

  const imageUrl = card.front_url;
  const cardUrl = `https://dcmgrading.com/lorcana/${id}`;
  const cardName = stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || 'Lorcana Card';

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
          alt: `${cardName} - DCM Graded Lorcana Card`,
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

export default function LorcanaCardDetailPage() {
  return <LorcanaCardDetails />;
}
