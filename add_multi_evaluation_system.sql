-- Create table to track multiple AI evaluations per card
CREATE TABLE IF NOT EXISTS card_evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  evaluation_number INTEGER NOT NULL,
  ai_grading JSONB,
  raw_decimal_grade DECIMAL(4,2),
  dcm_grade_whole INTEGER,
  ai_confidence_score VARCHAR(1),
  grade_numeric INTEGER,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(card_id, evaluation_number)
);

-- Add columns to cards table for consensus scoring
ALTER TABLE cards ADD COLUMN IF NOT EXISTS total_evaluations INTEGER DEFAULT 0;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS completed_evaluations INTEGER DEFAULT 0;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS consensus_raw_grade DECIMAL(4,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS consensus_whole_grade INTEGER;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS consensus_confidence VARCHAR(1);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS evaluation_status VARCHAR(20) DEFAULT 'pending'; -- pending, processing, completed
ALTER TABLE cards ADD COLUMN IF NOT EXISTS target_evaluations INTEGER DEFAULT 3; -- How many evaluations we want

-- Add comments
COMMENT ON TABLE card_evaluations IS 'Stores multiple AI evaluations for each card to calculate consensus scores';
COMMENT ON COLUMN cards.total_evaluations IS 'Total number of evaluation attempts made';
COMMENT ON COLUMN cards.completed_evaluations IS 'Number of successfully completed evaluations';
COMMENT ON COLUMN cards.consensus_raw_grade IS 'Average raw decimal grade from all evaluations';
COMMENT ON COLUMN cards.consensus_whole_grade IS 'Consensus whole grade based on averaged scores';
COMMENT ON COLUMN cards.consensus_confidence IS 'Consensus confidence level from all evaluations';
COMMENT ON COLUMN cards.evaluation_status IS 'Status: pending, processing, completed';
COMMENT ON COLUMN cards.target_evaluations IS 'Target number of evaluations to complete (default 3)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_card_evaluations_card_id ON card_evaluations(card_id);
CREATE INDEX IF NOT EXISTS idx_card_evaluations_status ON card_evaluations(card_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_cards_evaluation_status ON cards(evaluation_status);

-- Verify the new structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'card_evaluations'
ORDER BY ordinal_position;