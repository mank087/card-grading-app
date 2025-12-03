import { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabaseServer';
import MTGCardDetails from './CardDetailClient';

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

// Helper: Build dynamic title for MTG cards
// Format matches Sports cards: Card Name Year Set #Number - DCM Grade X
function buildTitle(card: any): string {
  // Use conversational AI data first, then database fields
  const cardName = stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || '';
  const setName = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || '';
  const expansionCode = stripMarkdown(card.conversational_card_info?.expansion_code) || card.expansion_code || '';
  const year = card.conversational_card_info?.set_year || card.set_year || '';
  const collectorNumber = stripMarkdown(card.conversational_card_info?.collector_number) || card.card_number || '';
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

  // Set name (or expansion code if no set name)
  if (isValidValue(setName)) {
    titleParts.push(setName);
  } else if (isValidValue(expansionCode)) {
    titleParts.push(expansionCode);
  }

  // Card number
  if (isValidValue(collectorNumber)) {
    titleParts.push(`#${collectorNumber}`);
  }

  // Build title with space separator (matches Sports)
  let title = titleParts.filter(p => p && p.trim()).join(' ');

  // If title is empty, use fallback
  if (!title || title.trim() === '') {
    title = 'MTG Card';
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

// Helper: Build description for MTG cards
function buildDescription(card: any): string {
  const cardName = stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || '';
  const setName = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || '';
  const year = card.conversational_card_info?.set_year || card.set_year || '';
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
    desc += ' Professional Magic: The Gathering card grading with AI analysis.';
  } else {
    desc = `${cardId} - Professional MTG card authentication and grading by DCM.`;
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
      title: 'MTG Card Not Found | DCM Grading',
      description: 'Professional Magic: The Gathering card grading and authentication by DCM',
    };
  }

  // Build dynamic title and description
  const title = buildTitle(card);
  const description = buildDescription(card);

  console.log('[METADATA] MTG card title:', title);
  console.log('[METADATA] MTG card description:', description);

  return {
    title,
    description,
  };
}

export default function MTGCardDetailPage() {
  return <MTGCardDetails />;
}
