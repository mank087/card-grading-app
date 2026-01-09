// Card Show Types for Dynamic Landing Pages

export interface CardShow {
  id: string;
  slug: string;

  // Basic Info
  name: string;
  short_name?: string;

  // Location
  city: string;
  state?: string;
  country: string;
  venue_name?: string;
  venue_address?: string;

  // Dates
  start_date: string;  // ISO date string
  end_date: string;    // ISO date string

  // Show Details
  show_type: string;
  scope: string;
  estimated_tables?: number;
  estimated_attendance?: string;
  website_url?: string;

  // Content
  description?: string;
  highlights?: string[];

  // Images
  hero_image_url?: string;
  logo_url?: string;
  thumbnail_url?: string;

  // Marketing
  headline?: string;
  subheadline?: string;
  special_offer?: string;
  offer_code?: string;
  offer_discount_percent?: number;

  // SEO
  meta_title?: string;
  meta_description?: string;
  keywords?: string[];

  // Status
  is_active: boolean;
  is_featured: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export type ShowStatus = 'active' | 'upcoming' | 'past';

export interface CardShowWithStatus extends CardShow {
  status: ShowStatus;
  days_until?: number;
  days_remaining?: number;
}

/**
 * Get the status of a card show based on current date
 */
export function getShowStatus(show: CardShow): ShowStatus {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const start = new Date(show.start_date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(show.end_date);
  end.setHours(23, 59, 59, 999);

  if (now >= start && now <= end) return 'active';
  if (now < start) return 'upcoming';
  return 'past';
}

/**
 * Calculate days until show starts
 */
export function getDaysUntil(show: CardShow): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(show.start_date);
  start.setHours(0, 0, 0, 0);

  const diffTime = start.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days remaining in active show
 */
export function getDaysRemaining(show: CardShow): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(show.end_date);
  end.setHours(23, 59, 59, 999);

  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get current or next upcoming show
 */
export function getCurrentOrNextShow(shows: CardShow[]): CardShow | null {
  const now = new Date();

  // First check for active shows
  const activeShow = shows.find(show => getShowStatus(show) === 'active');
  if (activeShow) return activeShow;

  // Get upcoming shows sorted by start date
  const upcomingShows = shows
    .filter(show => getShowStatus(show) === 'upcoming')
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  return upcomingShows[0] || null;
}

/**
 * Format date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = start.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}–${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

/**
 * Generate default meta title for a show
 */
export function generateMetaTitle(show: CardShow): string {
  return show.meta_title || `${show.name} | Grade Cards Instantly | DCM Grading`;
}

/**
 * Generate default meta description for a show
 */
export function generateMetaDescription(show: CardShow): string {
  if (show.meta_description) return show.meta_description;

  const dateRange = formatDateRange(show.start_date, show.end_date);
  return `Attending ${show.name} ${dateRange}? Grade your cards instantly with DCM. Pre-screen before buying, verify seller claims, know what's worth submitting to PSA.`;
}
