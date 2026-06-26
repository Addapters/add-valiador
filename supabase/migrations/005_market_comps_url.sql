-- 005: Campo url em market_comps
ALTER TABLE market_comps
  ADD COLUMN IF NOT EXISTS url text;
