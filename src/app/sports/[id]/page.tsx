import { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabaseServer';
import { SportsCardDetails } from './CardDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Helper: Strip markdown formatting
function stripMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  // Remove **bold** formatting
  return text.replace(/\*\*/g, '').trim();
}

// Helper: Generate meta keywords
function generateMetaKeywords(card: any, dvgGrading: any): string {
  const keywords: string[] = [];

  // 🎯 v3.2: Extract card data - Use conversational_card_info first, then database fields, then DVG
  // Supabase returns JSONB as objects - access directly like CardDetailClient does
  const playerName = stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || dvgGrading?.card_info?.player_or_character || '';
  const year = stripMarkdown(card.conversational_card_info?.year) || card.release_date || dvgGrading?.card_info?.year || '';
  const manufacturer = stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer_name || dvgGrading?.card_info?.manufacturer || '';
  const setName = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || dvgGrading?.card_info?.set_name || '';
  const subset = stripMarkdown(card.conversational_card_info?.subset) || card.subset || dvgGrading?.card_info?.subset || '';
  const sport = stripMarkdown(card.conversational_card_info?.sport_or_category) || card.sport || dvgGrading?.card_info?.sport_or_category || card.category || 'sports';
  const position = dvgGrading?.card_info?.position || '';
  const team = dvgGrading?.card_info?.team_association || '';
  const grade = card.conversational_decimal_grade ?? dvgGrading?.recommended_grade?.recommended_decimal_grade;

  // Core keywords - player variations
  if (playerName) {
    keywords.push(playerName.toLowerCase());
    if (year) keywords.push(`${year} ${playerName}`.toLowerCase());
    if (manufacturer) keywords.push(`${manufacturer} ${playerName}`.toLowerCase());
    if (setName) keywords.push(`${setName} ${playerName}`.toLowerCase());
  }

  // Set and manufacturer
  if (manufacturer) keywords.push(manufacturer.toLowerCase());
  if (setName) keywords.push(setName.toLowerCase());
  if (subset) keywords.push(subset.toLowerCase());
  if (year && manufacturer) keywords.push(`${year} ${manufacturer}`.toLowerCase());

  // Sport-specific
  keywords.push(`${sport} cards`.toLowerCase());
  if (position) keywords.push(position.toLowerCase());
  if (team) keywords.push(team.toLowerCase());

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
  if (card.conversational_card_info?.rookie_or_first ||
      card.rookie_card ||
      dvgGrading?.rarity_features?.rookie_or_first === 'true' ||
      dvgGrading?.rarity_features?.feature_tags?.includes('rookie_card')) {
    keywords.push('rookie card', 'rc', 'rookie', 'first year card');
  }

  if (card.conversational_card_info?.autographed ||
      (card.autograph_type && card.autograph_type !== 'none') ||
      dvgGrading?.rarity_features?.autograph?.present) {
    keywords.push('autograph', 'auto', 'signed card', 'autographed');
    const autoType = dvgGrading?.rarity_features?.autograph?.type || card.autograph_type;
    if (autoType && autoType !== 'none') {
      keywords.push(autoType.toLowerCase());
      if (autoType === 'on-card') keywords.push('hard signed');
    }
  }

  const serialNum = stripMarkdown(card.conversational_card_info?.serial_number) || card.serial_numbering || dvgGrading?.rarity_features?.serial_number;
  if (serialNum && serialNum !== 'N/A') {
    keywords.push('serial numbered', 'limited edition', 'numbered card');
    keywords.push(serialNum.toLowerCase());
  }

  if (card.conversational_card_info?.memorabilia ||
      (card.memorabilia_type && card.memorabilia_type !== 'none') ||
      dvgGrading?.rarity_features?.memorabilia?.present) {
    keywords.push('memorabilia', 'game used', 'patch card', 'jersey card');
  }

  // Slab detection
  if (card.slab_detected && card.slab_company) {
    keywords.push(`${card.slab_company.toLowerCase()} graded`);
    if (card.slab_grade) {
      keywords.push(`${card.slab_company.toLowerCase()} ${card.slab_grade}`);
    }
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
  if (cleaned === 'unknown player') return false;
  if (cleaned === 'unknown set') return false;
  return true;
}

// Helper: Build enhanced title
function buildTitle(card: any, dvgGrading: any): string {
  // 🎯 v3.2: Use conversational AI data first, then database fields, then DVG fallback
  // Supabase returns JSONB as objects - access directly like CardDetailClient does
  const playerName = stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || dvgGrading?.card_info?.player_or_character || '';
  const year = stripMarkdown(card.conversational_card_info?.year) || card.release_date || dvgGrading?.card_info?.year || '';
  const manufacturer = stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer_name || dvgGrading?.card_info?.manufacturer || '';
  const setName = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || dvgGrading?.card_info?.set_name || '';
  const subset = stripMarkdown(card.conversational_card_info?.subset) || card.subset || dvgGrading?.card_info?.subset || '';
  const grade = card.conversational_decimal_grade ?? dvgGrading?.recommended_grade?.recommended_decimal_grade ?? card.dvg_decimal_grade;
  const cardName = stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || dvgGrading?.card_info?.card_name || '';

  // Special features - v3.2 conversational AI first
  const isRookie = card.conversational_card_info?.rookie_or_first ||
                   card.rookie_card ||
                   dvgGrading?.rarity_features?.rookie_or_first === 'true' ||
                   dvgGrading?.rarity_features?.feature_tags?.includes('rookie_card');
  const hasAuto = card.conversational_card_info?.autographed ||
                  (card.autograph_type && card.autograph_type !== 'none') ||
                  dvgGrading?.rarity_features?.autograph?.present;
  const serialNum = stripMarkdown(card.conversational_card_info?.serial_number) || card.serial_numbering || dvgGrading?.rarity_features?.serial_number;

  const titleParts: string[] = [];

  // Player name - only add if valid
  if (isValidValue(playerName)) titleParts.push(playerName);

  // Year - only add if valid
  if (isValidValue(year)) titleParts.push(year);

  // Manufacturer - only add if valid
  if (isValidValue(manufacturer)) titleParts.push(manufacturer);

  // Set name - only add if valid
  if (isValidValue(setName)) titleParts.push(setName);

  // Subset/parallel - only add if valid
  if (isValidValue(subset)) titleParts.push(subset);

  // Special features
  const features: string[] = [];
  if (isRookie) features.push('RC');
  if (hasAuto) features.push('Auto');
  if (isValidValue(serialNum)) features.push(serialNum);
  if (features.length > 0) titleParts.push(features.join(' '));

  // Build title
  let title = titleParts.filter(p => p && p.trim()).join(' ');

  // If title is empty, try harder to find something useful
  if (!title || title.trim() === '') {
    if (isValidValue(cardName)) {
      title = cardName;
    } else if (dvgGrading?.card_info) {
      // Last resort: build from DVG card_info directly, validating each part
      const parts = [
        dvgGrading.card_info.player_or_character,
        dvgGrading.card_info.year,
        dvgGrading.card_info.manufacturer,
        dvgGrading.card_info.set_name
      ].filter(p => isValidValue(p));
      title = parts.length > 0 ? parts.join(' ') : 'Sports Card';
    } else {
      title = 'Sports Card';
    }
  }

  // Add grade
  if (grade !== null && grade !== undefined && !isNaN(grade)) {
    title += ` - DCM Grade ${grade}`;
  } else {
    title += ' - DCM Grading';
  }

  // Ensure title isn't too long (60 characters recommended, 70 max)
  if (title.length > 70) {
    // Truncate intelligently at last space before 67 chars
    const truncated = title.substring(0, 67);
    const lastSpace = truncated.lastIndexOf(' ');
    title = truncated.substring(0, lastSpace) + '...';
  }

  return title;
}

// Helper: Build enhanced description
function buildDescription(card: any, dvgGrading: any): string {
  // 🎯 v3.2: Use conversational AI data first, then database fields, then DVG fallback
  // Supabase returns JSONB as objects - access directly like CardDetailClient does
  const playerName = stripMarkdown(card.conversational_card_info?.player_or_character) || card.featured || dvgGrading?.card_info?.player_or_character || '';
  const year = stripMarkdown(card.conversational_card_info?.year) || card.release_date || dvgGrading?.card_info?.year || '';
  const manufacturer = stripMarkdown(card.conversational_card_info?.manufacturer) || card.manufacturer_name || dvgGrading?.card_info?.manufacturer || '';
  const setName = stripMarkdown(card.conversational_card_info?.set_name) || card.card_set || dvgGrading?.card_info?.set_name || '';
  const subset = stripMarkdown(card.conversational_card_info?.subset) || card.subset || dvgGrading?.card_info?.subset || '';
  const grade = card.conversational_decimal_grade ?? dvgGrading?.recommended_grade?.recommended_decimal_grade;
  const cardName = stripMarkdown(card.conversational_card_info?.card_name) || card.card_name || dvgGrading?.card_info?.card_name || '';

  // 🎯 v3.2: Use condition_label if available, otherwise derive from grade
  const gradeDesc = card.conversational_condition_label?.replace(/\s*\([A-Z]+\)/, '') || (grade !== null && grade !== undefined ? (() => {
    if (grade >= 9.6) return 'Gem Mint';
    if (grade >= 9.0) return 'Mint';
    if (grade >= 8.0) return 'Near Mint';
    if (grade >= 6.0) return 'Excellent';
    if (grade >= 4.0) return 'Good';
    if (grade >= 2.0) return 'Fair';
    return 'Poor';
  })() : null);

  // Special features - v3.2 conversational AI first
  const features: string[] = [];

  const isRookie = card.conversational_card_info?.rookie_or_first ||
                   card.rookie_card ||
                   dvgGrading?.rarity_features?.rookie_or_first === 'true' ||
                   dvgGrading?.rarity_features?.feature_tags?.includes('rookie_card');
  if (isRookie) features.push('Rookie');

  const hasAuto = card.conversational_card_info?.autographed ||
                  (card.autograph_type && card.autograph_type !== 'none') ||
                  dvgGrading?.rarity_features?.autograph?.present;
  if (hasAuto) {
    const autoType = dvgGrading?.rarity_features?.autograph?.type || card.autograph_type || 'auto';
    features.push(autoType === 'on-card' ? 'on-card auto' : autoType);
  }

  const serialNum = stripMarkdown(card.conversational_card_info?.serial_number) || card.serial_numbering || dvgGrading?.rarity_features?.serial_number;
  if (serialNum && serialNum !== 'N/A') {
    features.push(serialNum);
  }

  const hasPatch = card.conversational_card_info?.memorabilia ||
                   (card.memorabilia_type && card.memorabilia_type !== 'none') ||
                   dvgGrading?.rarity_features?.memorabilia?.present;
  if (hasPatch) {
    features.push('game-used patch');
  }

  // Condition highlights - v3.2 conversational AI sub-scores first
  const highlights: string[] = [];
  const centering = card.conversational_sub_scores?.centering?.weighted || dvgGrading?.sub_scores?.centering?.weighted_score;
  const corners = card.conversational_sub_scores?.corners?.weighted || dvgGrading?.sub_scores?.corners?.weighted_score;
  const edges = card.conversational_sub_scores?.edges?.weighted || dvgGrading?.sub_scores?.edges?.weighted_score;
  const surface = card.conversational_sub_scores?.surface?.weighted || dvgGrading?.sub_scores?.surface?.weighted_score;

  if (centering >= 9.5) highlights.push('excellent centering');
  if (corners >= 9.5) highlights.push('sharp corners');
  if (edges >= 9.5) highlights.push('clean edges');
  if (surface >= 10) highlights.push('pristine surface');

  // Build description
  let desc = '';

  // Card identification (keep it concise)
  const cardParts = [year, manufacturer, setName, playerName || cardName, subset].filter(p => p);
  const cardId = cardParts.slice(0, 4).join(' '); // Limit to first 4 parts

  if (grade !== null && grade !== undefined) {
    desc = `${cardId} graded DCM ${grade}/10.`;
    if (gradeDesc) desc += ` ${gradeDesc}`;
    if (highlights.length > 0) desc += ` with ${highlights.slice(0, 2).join(', ')}`;
    desc += '.';
  } else {
    // N/A grade
    desc = `${cardId} - Not Gradable`;
    if (dvgGrading?.grading_status) {
      if (dvgGrading.grading_status.includes('autograph')) {
        desc += ' (unverified autograph).';
      } else if (dvgGrading.grading_status.includes('marking')) {
        desc += ' (handwritten marking).';
      } else {
        desc += ' (alteration detected).';
      }
    } else {
      desc += '.';
    }
  }

  // Add features (limit to 2)
  if (features.length > 0) {
    desc += ` ${features.slice(0, 2).join(', ')}.`;
  }

  // Add slab info if detected
  if (card.slab_detected && card.slab_company && card.slab_grade) {
    desc += ` ${card.slab_company} ${card.slab_grade} verified.`;
  }

  // Add call to action
  if (grade !== null && grade !== undefined) {
    desc += ' Professional grading with AI analysis.';
  } else {
    desc += ' Professional authentication service.';
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
      title: 'Card Not Found - DCM Grading',
      description: 'Professional sports card grading and authentication by DCM',
      keywords: 'card grading, sports cards, professional grading, DCM, authentication',
      openGraph: {
        title: 'Card Not Found - DCM Grading',
        description: 'Professional sports card grading and authentication by DCM',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Card Not Found - DCM Grading',
        description: 'Professional sports card grading and authentication by DCM',
      },
    };
  }

  // Extract card data from DVG grading
  // Supabase returns JSONB as objects, not strings - no parsing needed
  const dvgGrading = card.dvg_grading || card.vision_grade_v1 || {};

  // 🔍 DEBUG: Log data structure to diagnose "UNKNOWN" issue
  console.log('=== METADATA DEBUG START ===');
  console.log('card.conversational_card_info:', card.conversational_card_info);
  console.log('card.featured:', card.featured);
  console.log('card.card_name:', card.card_name);
  console.log('card.manufacturer_name:', card.manufacturer_name);
  console.log('card.card_set:', card.card_set);
  console.log('card.release_date:', card.release_date);
  console.log('card.conversational_decimal_grade:', card.conversational_decimal_grade);
  console.log('dvgGrading?.card_info:', dvgGrading?.card_info);
  console.log('=== METADATA DEBUG END ===');

  // Build enhanced SEO components
  const title = buildTitle(card, dvgGrading);
  const description = buildDescription(card, dvgGrading);
  const keywords = generateMetaKeywords(card, dvgGrading);

  console.log('[METADATA] Generated title:', title);
  console.log('[METADATA] Generated description:', description);

  const imageUrl = card.front_url;
  const cardUrl = `https://dcmgrading.com/sports/${id}`;
  const isPrivate = card.visibility === 'private';

  // 🎯 Use database fields first (populated by conversational AI)
  const playerName = card.featured || dvgGrading?.card_info?.player_or_character || 'Card';

  // Return enhanced metadata with full SEO optimization
  return {
    title,
    description,
    keywords, // Auto-generated meta keywords
    alternates: {
      canonical: cardUrl, // Canonical URL for SEO
    },
    openGraph: {
      title,
      description,
      images: imageUrl ? [
        {
          url: imageUrl,
          width: 800,
          height: 1200,
          alt: `${playerName} - DCM Graded Card`,
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
  return <SportsCardDetails />;
}
