-- 008: Campos ABANCA extra em properties
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS nuc_risco        text,
  ADD COLUMN IF NOT EXISTS data_pedido      date,
  ADD COLUMN IF NOT EXISTS tipo_reavaliacao text,
  ADD COLUMN IF NOT EXISTS tipo_via         text,
  ADD COLUMN IF NOT EXISTS escada           text,
  ADD COLUMN IF NOT EXISTS ampliacao        text,
  ADD COLUMN IF NOT EXISTS lugar            text;
