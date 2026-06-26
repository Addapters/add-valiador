-- 002: lat/lon, campos avaliação anterior, slots fotos
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS latitude          numeric,
  ADD COLUMN IF NOT EXISTS longitude         numeric,
  ADD COLUMN IF NOT EXISTS prev_valuation_date    date,
  ADD COLUMN IF NOT EXISTS prev_valuation_value   numeric,
  ADD COLUMN IF NOT EXISTS prev_valuation_method  text,
  ADD COLUMN IF NOT EXISTS prev_valuation_expert  text,
  ADD COLUMN IF NOT EXISTS prev_valuation_entity  text,
  ADD COLUMN IF NOT EXISTS prev_valuation_conditions text;

CREATE TABLE IF NOT EXISTS property_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid REFERENCES properties(id) ON DELETE CASCADE,
  slot         integer,
  sort_order   integer DEFAULT 0,
  storage_path text NOT NULL,
  created_at   timestamptz DEFAULT now()
);
