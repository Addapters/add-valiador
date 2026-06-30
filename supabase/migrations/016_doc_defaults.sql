-- Set default 'Não entregue' for all document status fields
ALTER TABLE properties
  ALTER COLUMN doc_caderneta            SET DEFAULT 'Não entregue',
  ALTER COLUMN doc_certidao             SET DEFAULT 'Não entregue',
  ALTER COLUMN doc_contrato_arrend      SET DEFAULT 'Não entregue',
  ALTER COLUMN doc_alvara               SET DEFAULT 'Não entregue',
  ALTER COLUMN doc_planta               SET DEFAULT 'Não entregue',
  ALTER COLUMN doc_licenca_constr       SET DEFAULT 'Não entregue',
  ALTER COLUMN doc_licenca_util         SET DEFAULT 'Não entregue',
  ALTER COLUMN doc_orcamento_obras      SET DEFAULT 'Não entregue',
  ALTER COLUMN doc_memoria_descritiva   SET DEFAULT 'Não entregue',
  ALTER COLUMN doc_ficha_tecnica        SET DEFAULT 'Não entregue',
  ALTER COLUMN doc_projeto_aprovado     SET DEFAULT 'Não entregue',
  ALTER COLUMN doc_projeto_nao_aprovado SET DEFAULT 'Não entregue',
  ALTER COLUMN doc_cert_energetico      SET DEFAULT 'Não entregue',
  ALTER COLUMN doc_outro                SET DEFAULT 'Não entregue';
