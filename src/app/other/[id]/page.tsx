import { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabaseServer';
import OtherCardDetails from './CardDetailClient';

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
  return true;
}

// Helper: Build dynamic title for Other cards
// Format: Primary Subject | Manufacturer | Set | Year | DCM Grade X
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

  // Manufacturer
  if (isValidValue(manufacturer)) {
    titleParts.push(manufacturer);
  }

  // Set name
  if (isValidValue(setName)) {
    titleParts.push(setName);
  }

  // Date/Year
  if (isValidValue(cardDate)) {
    titleParts.push(cardDate);
  }

  // Build title
  let title = titleParts.filter(p => p && p.trim()).join(' | ');

  // If title is empty, use fallback
  if (!title || title.trim() === '') {
    title = 'Other Collectible Card';
  }

  // Add grade
  if (grade !== null && grade !== undefined && !isNaN(grade)) {
    title += ` | DCM Grade ${grade}`;
  } else {
    title += ' | DCM Grading';
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
    };
  }

  // Build dynamic title and description
  const title = buildTitle(card);
  const description = buildDescription(card);

  console.log('[METADATA] Other card title:', title);
  console.log('[METADATA] Other card description:', description);

  return {
    title,
    description,
  };
}

export default function OtherCardDetailPage() {
  return <OtherCardDetails />;
}
