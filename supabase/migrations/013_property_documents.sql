-- 013: Tabela de documentos por imóvel (avaliações anteriores, etc.)

CREATE TABLE IF NOT EXISTS property_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid REFERENCES properties(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  name          text NOT NULL,
  size_bytes    integer,
  created_at    timestamptz DEFAULT now()
);

-- Políticas Storage para prev-reports
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='prev_reports_insert' AND tablename='objects') THEN
    EXECUTE 'CREATE POLICY prev_reports_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''prev-reports'')';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='prev_reports_select' AND tablename='objects') THEN
    EXECUTE 'CREATE POLICY prev_reports_select ON storage.objects FOR SELECT USING (bucket_id = ''prev-reports'')';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='prev_reports_delete' AND tablename='objects') THEN
    EXECUTE 'CREATE POLICY prev_reports_delete ON storage.objects FOR DELETE USING (bucket_id = ''prev-reports'')';
  END IF;
END $$;
