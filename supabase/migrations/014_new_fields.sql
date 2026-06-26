ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS categorizacao        text,
  ADD COLUMN IF NOT EXISTS tipo_reparacao       text,
  ADD COLUMN IF NOT EXISTS observacoes_areas    text,
  ADD COLUMN IF NOT EXISTS metodo_comp_descricao  text,
  ADD COLUMN IF NOT EXISTS metodo_comp_area       numeric,
  ADD COLUMN IF NOT EXISTS metodo_comp_valor_m2   numeric,
  ADD COLUMN IF NOT EXISTS metodo_comp_valor_total numeric,
  ADD COLUMN IF NOT EXISTS renda_mensal           numeric,
  ADD COLUMN IF NOT EXISTS renda_anual            numeric,
  ADD COLUMN IF NOT EXISTS taxa_capitalizacao     numeric;
