-- Seed Card Shows Data for 2026
-- Run this after creating the card_shows table

INSERT INTO card_shows (slug, name, short_name, city, state, venue_name, venue_address, start_date, end_date, show_type, scope, estimated_tables, estimated_attendance, description, highlights) VALUES

-- January 2026
('dallas-card-show-winter-2026', 'Dallas Card Show (Winter)', 'Dallas Card Show', 'Allen', 'TX', 'Marriott Dallas Allen Hotel & Convention Center', '777 Watters Creek Blvd, Allen, TX', '2026-01-15', '2026-01-18', 'Sports & TCG', 'Regional', 700, 'Thousands', 'One of the largest recurring card shows in the United States, featuring sports cards and TCG vendors.', ARRAY['700+ vendor tables', 'Sports & TCG cards', '4-day event', 'Major Texas show']),

('white-plains-winter-extravaganza-2026', 'White Plains Winter Extravaganza', 'Winter Extravaganza', 'White Plains', 'NY', 'Westchester County Center', '198 Central Ave, White Plains, NY', '2026-01-16', '2026-01-18', 'Sports', 'Regional', 500, '5,000+', 'Lucky''s Promotions presents a massive 3-day sports card show across two floors of the Westchester County Center.', ARRAY['500+ tables', 'Two-floor venue', '3-day event', 'Northeast premiere show']),

('culture-collision-atlanta-2026', 'Culture Collision Trade Show', 'Culture Collision', 'Atlanta', 'GA', 'Georgia International Convention Center', '2000 Convention Center Concourse, College Park, GA', '2026-01-23', '2026-01-25', 'Sports & Collectibles', 'Regional', 600, '10,000+', 'Large multi-category collectibles show featuring sports cards, sneakers, and pop culture items.', ARRAY['600+ tables', 'Multi-category collectibles', 'High-energy atmosphere', 'Atlanta metro area']),

('tristar-houston-2026', 'TriStar Houston Collectors Show', 'TriStar Houston', 'Houston', 'TX', 'NRG Arena', '1 NRG Pkwy, Houston, TX', '2026-01-30', '2026-02-01', 'Sports', 'Regional', 500, '10,000+', '40th annual TriStar Houston show featuring 500+ exhibitor tables and major autograph guests.', ARRAY['40th annual event', '500+ exhibitor tables', 'Major autograph lineup', 'Nationwide vendors']),

-- February 2026
('collect-a-con-atlanta-2026', 'Collect-A-Con Atlanta', 'Collect-A-Con ATL', 'Atlanta', 'GA', 'Georgia World Congress Center (Hall A1)', '285 Andrew Young Intl Blvd NW, Atlanta, GA', '2026-02-07', '2026-02-08', 'Mixed (TCG & Pop Culture)', 'National', 900, '15,000+', 'Major trading card and pop culture convention featuring Pokemon, MTG, sports cards, and anime collectibles.', ARRAY['900 vendor tables', 'Pokemon & MTG', 'Sports cards', 'Anime collectibles', 'National tour stop']),

('west-coast-card-show-2026', 'West Coast Card Show', 'West Coast Show', 'Ontario', 'CA', 'Ontario Convention Center', '2000 E Convention Center Way, Ontario, CA', '2026-02-12', '2026-02-15', 'Sports', 'Regional', 1200, '40,000+', 'The largest West Coast sports card show with over 1,200 vendors expected.', ARRAY['1,200+ vendors', '40,000+ attendees', '4-day event', 'Largest West Coast show']),

('collect-a-con-miami-2026', 'Collect-A-Con Miami/Ft. Lauderdale', 'Collect-A-Con Miami', 'Fort Lauderdale', 'FL', 'Broward County Convention Center', '1950 Eisenhower Blvd, Fort Lauderdale, FL', '2026-02-21', '2026-02-22', 'Mixed (TCG & Pop Culture)', 'National', 900, '12,000+', 'South Florida''s premier trading card and pop culture expo featuring anime and TCG vendors.', ARRAY['900 tables', 'TCG & anime focus', 'South Florida premiere', 'National tour']),

('las-vegas-card-show-2026', 'Las Vegas Card Show', 'Vegas Card Show', 'Las Vegas', 'NV', 'Ahern Luxury Hotel', '300 W Sahara Ave, Las Vegas, NV', '2026-02-27', '2026-03-01', 'Sports & TCG', 'Regional', 200, '1,500+', 'Growing 3-day regional show in Las Vegas with trade nights and special events.', ARRAY['200+ vendor tables', 'Trade nights', '3-day event', 'Vegas location']),

('pokemon-regional-seattle-2026', 'Pokemon Regional Championship - Seattle', 'Pokemon Seattle', 'Seattle', 'WA', 'Seattle Convention Center', 'Seattle, WA', '2026-02-28', '2026-03-01', 'Pokemon TCG', 'National', NULL, '5,000+', 'Major Pokemon TCG tournament and expo with 2,000+ competitors and family spectators.', ARRAY['2,000+ competitors', 'Official Pokemon event', 'Tournament & expo', 'Pacific Northwest']),

-- March 2026
('philly-show-spring-2026', 'Philadelphia Sports Collectors Show', 'Philly Show', 'Oaks', 'PA', 'Greater Philadelphia Expo Center (Halls A, B & E)', '100 Station Ave, Oaks, PA', '2026-03-06', '2026-03-08', 'Sports', 'Regional', 400, '8,000+', 'Long-running 3-day sports card show serving the Philadelphia metro area.', ARRAY['14,000+ sq ft', 'Hundreds of dealers', '3-day event', 'East Coast tradition']),

('dallas-card-show-spring-2026', 'Dallas Card Show (Spring)', 'Dallas Card Show', 'Allen', 'TX', 'Marriott Dallas Allen Hotel & Convention Center', '777 Watters Creek Blvd, Allen, TX', '2026-03-12', '2026-03-15', 'Sports & TCG', 'Regional', 700, 'Thousands', 'Spring edition of the popular Dallas Card Show with 700+ vendor tables.', ARRAY['700+ vendor tables', 'Sports & TCG cards', '4-day event', 'Spring edition']),

('collect-a-con-houston-2026', 'Collect-A-Con Houston', 'Collect-A-Con Houston', 'Houston', 'TX', 'George R. Brown Convention Center (Hall B)', '1001 Avenida De Las Americas, Houston, TX', '2026-03-14', '2026-03-15', 'Mixed (TCG & Pop Culture)', 'National', 900, '15,000+', 'Houston''s largest trading card and pop culture convention.', ARRAY['900 tables', 'Anime & gaming', 'Sports cards', 'Texas flagship']),

('pokemon-regional-houston-2026', 'Pokemon Regional Championship - Houston', 'Pokemon Houston', 'Houston', 'TX', 'George R. Brown Convention Center', 'Houston, TX', '2026-03-20', '2026-03-22', 'Pokemon TCG', 'National', NULL, '5,000+', 'Major Pokemon TCG tournament event in Houston.', ARRAY['2,000+ players', 'Official Pokemon event', 'Tournament', 'Texas region']),

-- April 2026
('pokemon-regional-orlando-2026', 'Pokemon Regional Championship - Orlando', 'Pokemon Orlando', 'Orlando', 'FL', 'Orange County Convention Center', 'Orlando, FL', '2026-04-03', '2026-04-05', 'Pokemon TCG', 'National', NULL, '5,000+', 'Pokemon TCG regional competition in Orlando.', ARRAY['Major TCG event', 'Official tournament', 'Florida region', 'Family friendly']),

('collect-a-con-dallas-2026', 'Collect-A-Con Dallas-Fort Worth', 'Collect-A-Con DFW', 'Fort Worth', 'TX', 'Fort Worth Convention Center (Hall A-D)', '1201 Houston St, Fort Worth, TX', '2026-04-04', '2026-04-05', 'Mixed (TCG & Pop Culture)', 'National', 900, '18,000+', 'Texas'' largest TCG and pop culture convention.', ARRAY['900 tables', 'Largest Texas TCG show', 'Pop culture', 'DFW metro']),

('csa-chantilly-spring-2026', 'CSA Chantilly Show (Spring)', 'Chantilly Show', 'Chantilly', 'VA', 'Dulles Expo Center', '4320 Chantilly Shopping Center, Chantilly, VA', '2026-04-10', '2026-04-12', 'Sports', 'Regional', 650, '10,000+', 'Big East Coast sports card show with 130,000 sq ft of show floor.', ARRAY['130,000 sq ft', '650+ tables', 'East Coast premiere', 'Guest signers']),

('boston-show-2026', 'Lucky''s The Boston Show', 'Boston Show', 'Wilmington', 'MA', 'Shriners Auditorium', '99 Fordham Rd, Wilmington, MA', '2026-04-17', '2026-04-19', 'Sports', 'Regional', 400, '5,000+', 'New England''s premier multi-day sports card show.', ARRAY['Hundreds of tables', 'New England premiere', '3-day event', 'Strong attendance']),

('long-island-expo-spring-2026', 'Lucky''s Long Island Expo', 'Long Island Expo', 'Hempstead', 'NY', 'Hofstra University', '1000 Fulton Ave, Hempstead, NY', '2026-04-24', '2026-04-26', 'Sports', 'Regional', 400, '6,000+', 'Tri-state area sports card show with expanded 3-day format.', ARRAY['Tri-state area', 'Expanded format', '3 days', 'Robust dealer presence']),

('next-up-pittsburgh-2026', 'Next Up Pittsburgh Card Show', 'Pittsburgh Show', 'Pittsburgh', 'PA', 'David L. Lawrence Convention Center', '1000 Fort Duquesne Blvd, Pittsburgh, PA', '2026-04-24', '2026-04-25', 'Sports & TCG', 'Regional', 500, '8,000+', 'Major card show during NFL Draft weekend with 500+ tables.', ARRAY['500+ tables', 'NFL Draft weekend', 'Sports & TCG', 'Steel City event']),

('collect-a-con-chicago-spring-2026', 'Collect-A-Con Chicago', 'Collect-A-Con Chicago', 'Rosemont', 'IL', 'Donald E. Stephens Convention Center', '5555 N. River Rd, Rosemont, IL', '2026-04-25', '2026-04-26', 'Mixed (TCG & Pop Culture)', 'National', 900, '20,000+', 'Midwest flagship TCG and anime convention at the same venue as NSCC.', ARRAY['900 tables', 'Midwest flagship', 'TCG & anime', 'Major venue']),

-- May 2026
('magiccon-las-vegas-2026', 'MagicCon Las Vegas', 'MagicCon Vegas', 'Las Vegas', 'NV', 'Las Vegas Convention Center', '3150 Paradise Rd, Las Vegas, NV', '2026-05-01', '2026-05-03', 'Magic: The Gathering', 'National', NULL, '10,000+', 'Official Magic: The Gathering convention and fan experience.', ARRAY['Official MTG event', 'Tournaments', 'Exclusive reveals', 'Vegas location']),

('dallas-card-show-summer-2026', 'Dallas Card Show (Early Summer)', 'Dallas Card Show', 'Allen', 'TX', 'Marriott Dallas Allen Hotel & Convention Center', '777 Watters Creek Blvd, Allen, TX', '2026-05-14', '2026-05-17', 'Sports & TCG', 'Regional', 700, 'Thousands', 'Mid-year edition of Dallas Card Show with 700+ tables.', ARRAY['700+ tables', 'Mid-year edition', 'Sports & TCG', '4-day event']),

('pokemon-regional-los-angeles-2026', 'Pokemon Regional Championship - Los Angeles', 'Pokemon LA', 'Los Angeles', 'CA', 'Los Angeles Convention Center', 'Los Angeles, CA', '2026-05-08', '2026-05-10', 'Pokemon TCG', 'National', NULL, '6,000+', 'Major West Coast Pokemon tournament event.', ARRAY['West Coast major', '2,000+ participants', 'Large spectator turnout', 'LA Convention Center']),

('collect-a-con-cleveland-2026', 'Collect-A-Con Cleveland', 'Collect-A-Con Cleveland', 'Cleveland', 'OH', 'Huntington Convention Center', 'Cleveland, OH', '2026-05-16', '2026-05-17', 'Mixed (TCG & Pop Culture)', 'National', 900, '12,000+', 'First-ever Cleveland stop for Collect-A-Con tour.', ARRAY['900 tables', 'First Cleveland show', 'TCG & pop culture', 'Ohio debut']),

('collect-a-con-phoenix-2026', 'Collect-A-Con Phoenix', 'Collect-A-Con Phoenix', 'Phoenix', 'AZ', 'Phoenix Convention Center', 'Phoenix, AZ', '2026-05-23', '2026-05-24', 'Mixed (TCG & Pop Culture)', 'National', 900, '12,000+', 'Southwest regional stop on the Collect-A-Con tour.', ARRAY['900 tables', 'Southwest region', 'TCG & pop culture', 'Arizona show']),

('pokemon-regional-indianapolis-2026', 'Pokemon Regional Championship - Indianapolis', 'Pokemon Indy', 'Indianapolis', 'IN', 'Indiana Convention Center', 'Indianapolis, IN', '2026-05-29', '2026-05-31', 'Pokemon TCG', 'National', NULL, '5,000+', 'Concludes the 2025-26 Pokemon Regional circuit.', ARRAY['Season finale', 'High competitor turnout', 'Midwest major', 'Championship series']),

-- June 2026
('midwest-monster-summer-2026', 'Midwest Monster Card Show (Summer)', 'Midwest Monster', 'Fishers', 'IN', 'Best Choice Fieldhouse', '11825 Technology Dr, Fishers, IN', '2026-06-05', '2026-06-06', 'Sports', 'Regional', 500, '5,000+', '500+ table show serving Midwest collectors.', ARRAY['500+ tables', 'Midwest focused', 'Strong regional attendance', 'Indianapolis area']),

('collect-a-con-kansas-city-2026', 'Collect-A-Con Kansas City', 'Collect-A-Con KC', 'Kansas City', 'MO', 'Kansas City Convention Center', 'Kansas City, MO', '2026-06-13', '2026-06-14', 'Mixed (TCG & Pop Culture)', 'National', 900, '12,000+', 'Midwest Collect-A-Con stop with broad trading card audience.', ARRAY['900 tables', 'Midwest stop', 'TCG & pop culture', 'Kansas City']),

('csa-chantilly-summer-2026', 'CSA Chantilly Show (Summer)', 'Chantilly Show', 'Chantilly', 'VA', 'Dulles Expo Center', '4320 Chantilly Shopping Center, Chantilly, VA', '2026-06-26', '2026-06-28', 'Sports', 'Regional', 650, '10,000+', 'Summer edition of CSA''s flagship Chantilly show.', ARRAY['130,000 sq ft', '650+ tables', 'Summer edition', 'Hundreds of dealers']),

('collect-a-con-las-vegas-2026', 'Collect-A-Con Las Vegas', 'Collect-A-Con Vegas', 'Las Vegas', 'NV', 'Las Vegas Convention Center', 'Las Vegas, NV', '2026-06-27', '2026-06-28', 'Mixed (TCG & Pop Culture)', 'National', 900, '15,000+', 'West Coast summer stop for Collect-A-Con.', ARRAY['900 tables', 'Vegas location', 'Summer show', 'West Coast']),

-- July 2026
('collect-a-con-new-jersey-summer-2026', 'Collect-A-Con New Jersey', 'Collect-A-Con NJ', 'Edison', 'NJ', 'New Jersey Convention & Expo Center', 'Edison, NJ', '2026-07-11', '2026-07-12', 'Mixed (TCG & Pop Culture)', 'National', 900, '15,000+', 'Northeast Collect-A-Con stop with high TCG fan turnout.', ARRAY['900 tables', 'Northeast stop', 'High Pokemon/TCG turnout', 'NY metro area']),

('collect-a-con-minneapolis-2026', 'Collect-A-Con Minneapolis', 'Collect-A-Con Minneapolis', 'Minneapolis', 'MN', 'Minneapolis Convention Center', 'Minneapolis, MN', '2026-07-25', '2026-07-26', 'Mixed (TCG & Pop Culture)', 'National', 900, '12,000+', 'Upper Midwest pop culture and card convention.', ARRAY['900 tables', 'Upper Midwest', 'Pop culture & TCG', 'Minnesota show']),

('nscc-national-2026', 'National Sports Collectors Convention (NSCC)', 'The National', 'Rosemont', 'IL', 'Donald E. Stephens Convention Center', '5555 N. River Rd, Rosemont, IL', '2026-07-29', '2026-08-02', 'Sports', 'National', 2000, '100,000+', 'THE largest sports card show in the United States. 5 days, 600,000+ sq ft, record-breaking attendance.', ARRAY['100,000+ attendees', '600,000+ sq ft', '5-day event', 'The biggest show', 'Must-attend event']),

-- August 2026
('collect-a-con-los-angeles-2026', 'Collect-A-Con Los Angeles', 'Collect-A-Con LA', 'Los Angeles', 'CA', 'Los Angeles Convention Center', 'Los Angeles, CA', '2026-08-08', '2026-08-09', 'Mixed (TCG & Pop Culture)', 'National', 900, '18,000+', 'Major West Coast pop culture and TCG convention.', ARRAY['900 tables', 'West Coast flagship', 'LA Convention Center', 'Pop culture & TCG']),

('east-coast-national-2026', 'Lucky''s East Coast National', 'East Coast National', 'White Plains', 'NY', 'Westchester County Center', 'White Plains, NY', '2026-08-14', '2026-08-16', 'Sports', 'Regional', 500, '12,000+', 'Premier Northeast card show branded as the East Coast National.', ARRAY['500+ tables', 'Two floors', 'East Coast premiere', 'Northeast flagship']),

('collect-a-con-san-antonio-2026', 'Collect-A-Con San Antonio', 'Collect-A-Con SA', 'San Antonio', 'TX', 'Freeman Coliseum Expo Hall', 'San Antonio, TX', '2026-08-22', '2026-08-23', 'Mixed (TCG & Pop Culture)', 'National', 900, '12,000+', 'Texas Collect-A-Con stop with large regional turnout.', ARRAY['900 tables', 'Texas stop', 'Large regional turnout', 'San Antonio']),

('collect-a-con-charlotte-2026', 'Collect-A-Con Charlotte', 'Collect-A-Con Charlotte', 'Charlotte', 'NC', 'Charlotte Convention Center', 'Charlotte, NC', '2026-08-29', '2026-08-30', 'Mixed (TCG & Pop Culture)', 'National', 900, '12,000+', 'Southeast pop culture and card expo.', ARRAY['900 tables', 'Southeast region', 'Pop culture & TCG', 'North Carolina']),

('collect-a-con-richmond-2026', 'Collect-A-Con Richmond', 'Collect-A-Con Richmond', 'Richmond', 'VA', 'Greater Richmond Convention Center', 'Richmond, VA', '2026-08-29', '2026-08-30', 'Mixed (TCG & Pop Culture)', 'National', 900, '10,000+', 'Mid-Atlantic Collect-A-Con show.', ARRAY['900 tables', 'Mid-Atlantic', 'Virginia show', 'TCG & pop culture']),

-- September 2026
('collect-a-con-san-francisco-2026', 'Collect-A-Con San Francisco', 'Collect-A-Con SF', 'San Francisco', 'CA', 'Moscone Center', 'San Francisco, CA', '2026-09-12', '2026-09-13', 'Mixed (TCG & Pop Culture)', 'National', 900, '15,000+', 'West Coast fall Collect-A-Con stop at Moscone Center.', ARRAY['900 tables', 'Moscone Center', 'Bay Area', 'Fall West Coast']),

('pokemon-regional-pittsburgh-2026', 'Pokemon Regional Championship - Pittsburgh', 'Pokemon Pittsburgh', 'Pittsburgh', 'PA', 'David L. Lawrence Convention Center', '1000 Fort Duquesne Blvd, Pittsburgh, PA', '2026-09-19', '2026-09-21', 'Pokemon TCG', 'National', NULL, '5,000+', 'Part of 2026 Pokemon Championship Series.', ARRAY['Championship series', 'Huge Pokemon event', 'Tournament', 'Pittsburgh']),

('collect-a-con-atlanta-fall-2026', 'Collect-A-Con Atlanta (Fall)', 'Collect-A-Con ATL', 'Atlanta', 'GA', 'Georgia World Congress Center', 'Atlanta, GA', '2026-09-26', '2026-09-27', 'Mixed (TCG & Pop Culture)', 'National', 900, '15,000+', 'Second 2026 Atlanta date due to high demand.', ARRAY['900 tables', 'Second Atlanta date', 'High demand', 'Fall edition']),

-- October 2026
('midwest-monster-fall-2026', 'Midwest Monster Card Show (Fall)', 'Midwest Monster', 'Fishers', 'IN', 'Best Choice Fieldhouse', '11825 Technology Dr, Fishers, IN', '2026-10-02', '2026-10-03', 'Sports', 'Regional', 500, '5,000+', 'Fall edition of 500-table Midwest Monster show.', ARRAY['500+ tables', 'Fall edition', 'Midwest regional', 'Strong attendance']),

('pokemon-regional-milwaukee-2026', 'Pokemon Regional Championship - Milwaukee', 'Pokemon Milwaukee', 'Milwaukee', 'WI', 'Wisconsin Center (Baird Center)', 'Milwaukee, WI', '2026-10-10', '2026-10-12', 'Pokemon TCG', 'National', NULL, '5,000+', 'Large Midwest Pokemon TCG event.', ARRAY['Midwest major', 'Thousands of participants', 'Tournament', 'Wisconsin']),

('collect-a-con-chicago-fall-2026', 'Collect-A-Con Chicago (Fall)', 'Collect-A-Con Chicago', 'Rosemont', 'IL', 'Donald E. Stephens Convention Center', '5555 N. River Rd, Rosemont, IL', '2026-10-10', '2026-10-11', 'Mixed (TCG & Pop Culture)', 'National', 900, '20,000+', 'Second Chicago date for Collect-A-Con in October.', ARRAY['900 tables', 'Chicago 2', 'Fall edition', 'Midwest flagship']),

('dallas-card-show-fall-2026', 'Dallas Card Show (Fall)', 'Dallas Card Show', 'Allen', 'TX', 'Marriott Dallas Allen Hotel & Convention Center', '777 Watters Creek Blvd, Allen, TX', '2026-10-10', '2026-10-13', 'Sports & TCG', 'Regional', 700, 'Thousands', 'Fall 4-day edition of Dallas Card Show.', ARRAY['700+ tables', 'Fall edition', '4-day event', 'Major regional']),

('csa-chantilly-fall-2026', 'CSA Chantilly Show (Fall)', 'Chantilly Show', 'Chantilly', 'VA', 'Dulles Expo Center', '4320 Chantilly Shopping Center, Chantilly, VA', '2026-10-16', '2026-10-18', 'Sports', 'Regional', 650, '10,000+', 'Fall edition of Chantilly show with guest signers.', ARRAY['130,000 sq ft', '650+ tables', 'Fall edition', 'Guest signers']),

('hofstra-fall-classic-2026', 'Lucky''s Hofstra Fall Classic', 'Fall Classic', 'Hempstead', 'NY', 'Hofstra University', 'Hempstead, NY', '2026-10-23', '2026-10-25', 'Sports', 'Regional', 400, '6,000+', 'Long Island fall show with expanded 3-day format for 2026.', ARRAY['Expanded format', '3-day event', 'Long Island', 'Fall classic']),

-- November 2026
('collect-a-con-houston-fall-2026', 'Collect-A-Con Houston (Fall)', 'Collect-A-Con Houston', 'Houston', 'TX', 'NRG Center', 'Houston, TX', '2026-11-07', '2026-11-08', 'Mixed (TCG & Pop Culture)', 'National', 900, '15,000+', 'Second 2026 Houston date for holiday season kickoff.', ARRAY['900 tables', 'Second Houston date', 'Holiday kickoff', 'Texas show']),

('magiccon-atlanta-2026', 'MagicCon Atlanta', 'MagicCon Atlanta', 'Atlanta', 'GA', 'Georgia World Congress Center (Building C)', '285 Andrew Young Intl Blvd NW, Atlanta, GA', '2026-11-13', '2026-11-15', 'Magic: The Gathering', 'National', NULL, '15,000+', 'MTG convention and World Championship event.', ARRAY['MTG World Championship', 'Official event', 'Huge Magic gathering', 'Atlanta']),

('collect-a-con-new-jersey-fall-2026', 'Collect-A-Con New Jersey (Fall)', 'Collect-A-Con NJ', 'Edison', 'NJ', 'New Jersey Convention & Expo Center', 'Edison, NJ', '2026-11-21', '2026-11-22', 'Mixed (TCG & Pop Culture)', 'National', 900, '15,000+', 'Second NJ date for late fall with large Northeast turnout.', ARRAY['900 tables', 'Second NJ date', 'Late fall', 'Northeast TCG']),

('philly-thanksgiving-show-2026', 'Philly Show (Thanksgiving)', 'Thanksgiving Show', 'Hempstead', 'NY', 'Hofstra University', 'Hempstead, NY', '2026-11-28', '2026-11-29', 'Sports', 'Regional', 300, '4,000+', 'Two-day post-Thanksgiving show.', ARRAY['Post-Thanksgiving', 'Year-end event', 'Regional show', 'Holiday weekend']),

-- December 2026
('collect-a-con-los-angeles-winter-2026', 'Collect-A-Con Los Angeles (Winter)', 'Collect-A-Con LA', 'Los Angeles', 'CA', 'Los Angeles Convention Center', 'Los Angeles, CA', '2026-12-05', '2026-12-06', 'Mixed (TCG & Pop Culture)', 'National', 900, '18,000+', 'Second LA date wrapping up the Collect-A-Con tour for 2026.', ARRAY['900 tables', 'Tour finale', 'West Coast', 'Year-end show']);

-- Update all shows with default marketing content
UPDATE card_shows SET
  headline = 'Attending ' || name || '?',
  subheadline = 'Grade your cards instantly with DCM. Pre-screen before buying, verify seller claims.',
  special_offer = 'Use code CARDSHOW for 10% off your first credit purchase',
  offer_code = 'CARDSHOW',
  offer_discount_percent = 10
WHERE headline IS NULL;

-- Set The National as featured
UPDATE card_shows SET is_featured = true WHERE slug = 'nscc-national-2026';
