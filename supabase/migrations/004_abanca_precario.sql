-- 004: Tabela fee_schedules + precário ABANCA 2026

CREATE TABLE IF NOT EXISTS fee_schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  activity    text NOT NULL,
  area_min    numeric NOT NULL DEFAULT 0,
  area_max    numeric,
  area_unit   text NOT NULL DEFAULT 'ABC',
  price       numeric NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Precário ABANCA 2026 — Cliente Avaliação
-- Será associado ao cliente ABANCA após criação
-- Para associar: UPDATE fee_schedules SET client_id = '<id_cliente_abanca>' WHERE client_id IS NULL;

INSERT INTO fee_schedules (activity, area_min, area_max, area_unit, price) VALUES
  -- Sem área
  ('Moradia',       0, NULL, 'ABC', 125),
  ('Apartamento',   0, NULL, 'ABC', 120),
  ('Loja',          0, NULL, 'ABC', 110),
  ('Arrumos',       0, NULL, 'ABC', 100),
  ('Outros Anexos', 0, NULL, 'ABC', 100),
  ('Garagem',       0, NULL, 'ABC',  95),
  -- Armazém
  ('Armazém',    0,    500,  'ABC', 235),
  ('Armazém',    500,  2000, 'ABC', 380),
  ('Armazém',    2000, 10000,'ABC', 585),
  ('Armazém',    10000,NULL, 'ABC', 880),
  -- Moradias em banda
  ('Moradias em banda', 0,    500,  'ABC', 485),
  ('Moradias em banda', 500,  2000, 'ABC', 695),
  ('Moradias em banda', 2000, 10000,'ABC', 970),
  ('Moradias em banda', 10000,NULL, 'ABC', 1290),
  -- Moradias unifamiliares
  ('Moradias unifamiliares', 0,    500,  'ABC', 485),
  ('Moradias unifamiliares', 500,  2000, 'ABC', 695),
  ('Moradias unifamiliares', 2000, 10000,'ABC', 970),
  ('Moradias unifamiliares', 10000,NULL, 'ABC', 1290),
  -- Habitação
  ('Habitação', 0,    500,  'ABC', 485),
  ('Habitação', 500,  2000, 'ABC', 695),
  ('Habitação', 2000, 10000,'ABC', 970),
  ('Habitação', 10000,NULL, 'ABC', 1290),
  -- Comércio
  ('Comércio', 0,    500,  'ABC', 485),
  ('Comércio', 500,  2000, 'ABC', 695),
  ('Comércio', 2000, 10000,'ABC', 970),
  ('Comércio', 10000,NULL, 'ABC', 1290),
  -- Escritórios
  ('Escritórios', 0,    500,  'ABC', 485),
  ('Escritórios', 500,  2000, 'ABC', 695),
  ('Escritórios', 2000, 10000,'ABC', 970),
  ('Escritórios', 10000,NULL, 'ABC', 1290),
  -- Naves industriais
  ('Naves industriais', 0,    500,  'ABC', 485),
  ('Naves industriais', 500,  2000, 'ABC', 695),
  ('Naves industriais', 2000, 10000,'ABC', 970),
  ('Naves industriais', 10000,NULL, 'ABC', 1290),
  -- Terreno rústico (ATT)
  ('Terreno rústico', 0,      5000,  'ATT', 295),
  ('Terreno rústico', 5000,   50000, 'ATT', 520),
  ('Terreno rústico', 50000,  100000,'ATT', 770),
  ('Terreno rústico', 100000, NULL,  'ATT', 1165),
  -- Terreno urbano (ATT)
  ('Terreno urbano', 0,      5000,  'ATT', 570),
  ('Terreno urbano', 5000,   50000, 'ATT', 840),
  ('Terreno urbano', 50000,  100000,'ATT', 1170),
  ('Terreno urbano', 100000, NULL,  'ATT', 1555);
