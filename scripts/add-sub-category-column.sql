ALTER TABLE cards ADD COLUMN sub_category VARCHAR(50) DEFAULT NULL;
CREATE INDEX idx_cards_sub_category ON cards(sub_category);
-- Migrate Star Wars cards
UPDATE cards SET category = 'Other', sub_category = 'Star Wars' WHERE category = 'Star Wars';
