-- 010: Campos dashboard + tabela profiles + políticas storage

-- Campos novos em properties
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS tem_fotos        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tem_comparaveis  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verificado       boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_properties_tem_fotos       ON properties (tem_fotos);
CREATE INDEX IF NOT EXISTS idx_properties_tem_comparaveis ON properties (tem_comparaveis);
CREATE INDEX IF NOT EXISTS idx_properties_verificado      ON properties (verificado);

-- Tabela profiles (ligada ao Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name  text,
  role  text NOT NULL DEFAULT 'perito'
);

-- Trigger para novos utilizadores
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'perito')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Políticas Storage (fotos) — sem IF NOT EXISTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'photos_insert' AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY photos_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''photos'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'photos_select' AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY photos_select ON storage.objects FOR SELECT USING (bucket_id = ''photos'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'photos_delete' AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY photos_delete ON storage.objects FOR DELETE USING (bucket_id = ''photos'')';
  END IF;
END $$;
