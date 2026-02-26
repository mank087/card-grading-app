import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addShow() {
  const { data: show, error } = await supabase
    .from('card_shows')
    .insert({
      slug: 'fanatics-fest-nyc-2026',
      name: 'Fanatics Fest NYC 2026',
      short_name: 'Fanatics Fest',
      city: 'New York',
      state: 'NY',
      country: 'US',
      venue_name: 'Jacob K. Javits Convention Center',
      venue_address: '655 West 34th Street, New York, NY 10001',
      start_date: '2026-07-16',
      end_date: '2026-07-19',
      show_type: 'convention',
      scope: 'national',
      estimated_tables: 500,
      estimated_attendance: '125,000+',
      website_url: 'https://www.fanaticsfest.com/',
      description: 'Fanatics Fest NYC is one of the largest trading card and collectibles events in the country. Now in its third year and expanded to four days, the 2026 edition takes over the Javits Center with hundreds of hobby shop vendors, athlete autograph sessions, exclusive trading card products, and interactive brand activations from the NFL, NBA, MLB, NHL, UFC, WWE, and FIFA. The final day coincides with the 2026 FIFA World Cup Final at nearby MetLife Stadium. Over 500 athletes and celebrities are expected to appear, including Tom Brady, Aaron Judge, Kevin Durant, and Jay-Z.',
      highlights: [
        'Hundreds of trading card vendors and hobby shops',
        'Autograph sessions with 500+ athletes and celebrities',
        'Event-exclusive trading card products',
        'Fanatics Games $2M athletic competition',
        'FIFA World Cup Final tie-in on closing day',
        'Interactive activations from NFL, NBA, MLB, NHL, UFC, WWE',
        '25% more floor space than 2025'
      ],
      headline: 'Grade Cards Instantly at Fanatics Fest NYC',
      subheadline: 'Pre-screen before you buy. Know what\'s worth submitting to PSA — right from the show floor.',
      special_offer: 'Show special: 20% off your first credit pack',
      offer_code: 'FANFEST26',
      offer_discount_percent: 20,
      meta_title: 'Fanatics Fest NYC 2026 | Grade Cards Instantly at the Show | DCM Grading',
      meta_description: 'Attending Fanatics Fest NYC July 16-19, 2026 at the Javits Center? Grade trading cards instantly with DCM. Pre-screen before buying, verify condition, and get PSA estimates in 60 seconds.',
      keywords: [
        'fanatics fest',
        'fanatics fest nyc',
        'fanatics fest 2026',
        'card show new york',
        'trading card convention',
        'javits center card show',
        'sports card grading',
        'card grading at shows',
        'pre-screen cards',
        'dcm grading'
      ],
      is_active: true,
      is_featured: true,
    })
    .select('id, slug, name, start_date, end_date, is_active')
    .single();

  if (error) {
    console.error('Error adding show:', error);
    process.exit(1);
  }

  console.log('Card show added successfully!');
  console.log('  ID:', show.id);
  console.log('  Name:', show.name);
  console.log('  Slug:', show.slug);
  console.log('  Dates:', show.start_date, 'to', show.end_date);
  console.log('  Active:', show.is_active);
  console.log('  View at: /card-shows/' + show.slug);
}

addShow().catch(console.error);
