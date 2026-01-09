-- Add universal CARDSHOW promo code to all card shows
-- Run after seeding card_shows table

UPDATE card_shows
SET
  special_offer = '10% off your first credit purchase',
  offer_code = 'CARDSHOW',
  offer_discount_percent = 10
WHERE is_active = true;
