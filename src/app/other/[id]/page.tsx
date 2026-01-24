import { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabaseServer';
import OtherCardDetails from './CardDetailClient';

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
  return true;
}

// Helper: Generate meta keywords for Other cards
function generateMetaKeywords(card: any): string {
  const keywords: string[] = [];

  const playerOrCharacter = stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || '';
  const cardName = stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || '';
  const primarySubject = playerOrCharacter || cardName;
  const manufacturer = stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer || '';
  const setName = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || '';
  const cardDate = stripMarkdown(card.conversational_card_info?.card_date) || card.card_date || '';
  const category = stripMarkdown(card.conversational_card_info?.category) || card.category || '';
  const grade = card.conversational_decimal_grade;

  // Core keywords - subject/character variations
  if (primarySubject) {
    keywords.push(primarySubject.toLowerCase());
    keywords.push(`${primarySubject} card`.toLowerCase());
    if (manufacturer) keywords.push(`${manufacturer} ${primarySubject}`.toLowerCase());
  }

  // Manufacturer and set
  if (manufacturer) {
    keywords.push(manufacturer.toLowerCase());
    keywords.push(`${manufacturer} cards`.toLowerCase());
  }
  if (setName) {
    keywords.push(setName.toLowerCase());
  }
  if (cardDate && manufacturer) keywords.push(`${cardDate} ${manufacturer}`.toLowerCase());

  // Category-specific
  if (category) {
    keywords.push(category.toLowerCase());
    keywords.push(`${category.toLowerCase()} cards`);
  }
  keywords.push('collectible cards', 'trading cards', 'non-sport cards');

  // Grading keywords
  keywords.push('graded card', 'dcm grading', 'professional grading', 'card authentication');

  // PSA/BGS equivalent
  if (grade !== null && grade !== undefined) {
    const psaGrade = Math.floor(grade);
    keywords.push(`psa ${psaGrade}`, `bgs ${grade}`);
    if (grade >= 9) keywords.push('gem mint');
    if (grade >= 8) keywords.push('near mint');
  }

  // Special features
  if (card.conversational_card_info?.autographed || card.autograph_type) {
    keywords.push('autograph', 'auto', 'signed card');
  }
  if (card.conversational_card_info?.serial_number || card.serial_numbering) {
    keywords.push('serial numbered', 'limited edition');
  }

  // Remove duplicates and return
  return [...new Set(keywords)].join(', ');
}

// Helper: Build dynamic title for Other cards
// Format matches Sports cards: Primary Subject Year Manufacturer Set - DCM Grade X
// For Other cards, player_or_character is the PRIMARY identifier (person, character, or subject)
function buildTitle(card: any): string {
  // Use conversational AI data first, then database fields
  // PRIORITY: player_or_character is the primary subject for Other cards (e.g., "Gisele Bundchen")
  const playerOrCharacter = stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || '';
  const cardName = stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || '';
  // Use player_or_character first, fall back to card_name if not available
  const primarySubject = playerOrCharacter || cardName;
  const manufacturer = stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer || '';
  const setName = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || '';
  const cardDate = stripMarkdown(card.conversational_card_info?.card_date) || card.card_date || '';
  const grade = card.conversational_decimal_grade;

  const titleParts: string[] = [];

  // Primary subject (player/character) - most important for Other cards
  if (isValidValue(primarySubject)) {
    titleParts.push(primarySubject);
  }

  // Date/Year (matches Sports pattern - year comes after name)
  if (isValidValue(cardDate)) {
    titleParts.push(cardDate);
  }

  // Manufacturer
  if (isValidValue(manufacturer)) {
    titleParts.push(manufacturer);
  }

  // Set name
  if (isValidValue(setName)) {
    titleParts.push(setName);
  }

  // Build title with space separator (matches Sports)
  let title = titleParts.filter(p => p && p.trim()).join(' ');

  // If title is empty, use fallback
  if (!title || title.trim() === '') {
    title = 'Other Collectible Card';
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

// Helper: Build description for Other cards
// For Other cards, player_or_character is the PRIMARY identifier
function buildDescription(card: any): string {
  // PRIORITY: player_or_character is the primary subject for Other cards
  const playerOrCharacter = stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || '';
  const cardName = stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || '';
  const primarySubject = playerOrCharacter || cardName;
  const manufacturer = stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer || '';
  const cardDate = stripMarkdown(card.conversational_card_info?.card_date) || card.card_date || '';
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

  const cardParts = [primarySubject, manufacturer, cardDate].filter(p => isValidValue(p));
  const cardId = cardParts.join(' ');

  if (grade !== null && grade !== undefined) {
    desc = `${cardId} graded DCM ${grade}/10.`;
    if (gradeDesc) desc += ` ${gradeDesc} condition.`;
    desc += ' Professional collectible card grading with AI analysis.';
  } else {
    desc = `${cardId} - Professional card authentication and grading by DCM.`;
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
      title: 'Other Card Not Found | DCM Grading',
      description: 'Professional collectible card grading and authentication by DCM',
      keywords: 'card grading, collectible cards, professional grading, DCM, authentication',
      openGraph: {
        title: 'Other Card Not Found | DCM Grading',
        description: 'Professional collectible card grading and authentication by DCM',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Other Card Not Found | DCM Grading',
        description: 'Professional collectible card grading and authentication by DCM',
      },
    };
  }

  // Build enhanced SEO components
  const title = buildTitle(card);
  const description = buildDescription(card);
  const keywords = generateMetaKeywords(card);
  const isPrivate = card.visibility === 'private';

  console.log('[METADATA] Other card title:', title);
  console.log('[METADATA] Other card description:', description);

  const imageUrl = card.front_url;
  const cardUrl = `https://dcmgrading.com/other/${id}`;
  const primarySubject = stripMarkdown(card.conversational_card_info?.player_or_character) ||
                         stripMarkdown(card.conversational_card_info?.card_name) ||
                         card.featured || card.card_name || 'Collectible Card';

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
          alt: `${primarySubject} - DCM Graded Card`,
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

export default function OtherCardDetailPage() {
  return <OtherCardDetails />;
}
