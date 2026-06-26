-- 006: Estados do portfólio
ALTER TABLE portfolios
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','delivered','awaiting_payment','closed'));
