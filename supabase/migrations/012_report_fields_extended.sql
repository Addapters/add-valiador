-- 012: Campos adicionais para as 18 secções do relatório

ALTER TABLE properties
  -- Sec 1: Identificação
  ADD COLUMN IF NOT EXISTS data_validade_relatorio  date,
  ADD COLUMN IF NOT EXISTS banco                    text,
  ADD COLUMN IF NOT EXISTS tipo_relatorio           text,
  ADD COLUMN IF NOT EXISTS subtipo_relatorio        text,
  ADD COLUMN IF NOT EXISTS perito_nif               text,
  ADD COLUMN IF NOT EXISTS perito_cmvm              text,
  ADD COLUMN IF NOT EXISTS nr_apolice               text,
  ADD COLUMN IF NOT EXISTS data_validade_seguro     date,
  ADD COLUMN IF NOT EXISTS seguradora               text,
  ADD COLUMN IF NOT EXISTS requerente_nome          text,
  ADD COLUMN IF NOT EXISTS requerente_nif           text,
  ADD COLUMN IF NOT EXISTS mandatario_nome          text,
  ADD COLUMN IF NOT EXISTS mandatario_nif           text,
  -- Sec 3: Descrição
  ADD COLUMN IF NOT EXISTS imovel_singular          text,
  ADD COLUMN IF NOT EXISTS ref_cadastral            text,
  -- Sec 4: Localização
  ADD COLUMN IF NOT EXISTS zona_envolvente          text,
  -- Sec 5: Construção
  ADD COLUMN IF NOT EXISTS data_licenca_construcao  date,
  ADD COLUMN IF NOT EXISTS data_conclusao_obras     date,
  ADD COLUMN IF NOT EXISTS data_ultima_remod        date,
  ADD COLUMN IF NOT EXISTS interesse_cultural       text,
  ADD COLUMN IF NOT EXISTS potencial_alteracao_uso  text,
  ADD COLUMN IF NOT EXISTS qualificacao_solo        text,
  ADD COLUMN IF NOT EXISTS classificacao_solo       text,
  ADD COLUMN IF NOT EXISTS condicao_lote            text,
  -- Sec 6: Áreas
  ADD COLUMN IF NOT EXISTS area_caderneta           numeric,
  ADD COLUMN IF NOT EXISTS tipo_superficie          text,
  ADD COLUMN IF NOT EXISTS tipo_parcela             text,
  -- Sec 7: Métodos
  ADD COLUMN IF NOT EXISTS metodo_avaliacao         text,
  ADD COLUMN IF NOT EXISTS metodo_avaliacao_2       text,
  ADD COLUMN IF NOT EXISTS justificacao_metodo      text,
  ADD COLUMN IF NOT EXISTS valor_comparativo        numeric,
  ADD COLUMN IF NOT EXISTS ajuste_comparativo       numeric,
  ADD COLUMN IF NOT EXISTS valor_comparativo_bruto  numeric,
  ADD COLUMN IF NOT EXISTS valor_rendas             numeric,
  ADD COLUMN IF NOT EXISTS valor_residual_din       numeric,
  ADD COLUMN IF NOT EXISTS valor_patrimonial        numeric,
  ADD COLUMN IF NOT EXISTS valor_subs_bruto         numeric,
  ADD COLUMN IF NOT EXISTS valor_subs_liquido       numeric,
  ADD COLUMN IF NOT EXISTS valor_maximo_legal       numeric,
  ADD COLUMN IF NOT EXISTS valor_renda_otima        numeric,
  -- Sec 8: Documentos
  ADD COLUMN IF NOT EXISTS doc_caderneta            text,
  ADD COLUMN IF NOT EXISTS doc_certidao             text,
  ADD COLUMN IF NOT EXISTS doc_licenca_util         text,
  ADD COLUMN IF NOT EXISTS doc_licenca_constr       text,
  ADD COLUMN IF NOT EXISTS doc_cert_energetico      text,
  ADD COLUMN IF NOT EXISTS doc_planta               text,
  ADD COLUMN IF NOT EXISTS tipo_doc_enviar          text,
  ADD COLUMN IF NOT EXISTS tipo_doc_descarregar     text,
  -- Sec 9: Condicionalismos
  ADD COLUMN IF NOT EXISTS data_levantamento_cond   date,
  ADD COLUMN IF NOT EXISTS cond_sanavel             text,
  -- Sec 10: Advertências
  ADD COLUMN IF NOT EXISTS advertencias             text,
  ADD COLUMN IF NOT EXISTS pressupostos             text,
  -- Sec 11: Conclusão HEC
  ADD COLUMN IF NOT EXISTS valor_hec                numeric,
  ADD COLUMN IF NOT EXISTS valor_vvr_hec            numeric,
  ADD COLUMN IF NOT EXISTS valor_emp_hec            numeric,
  -- Sec 13: Certificação
  ADD COLUMN IF NOT EXISTS data_certificacao        date,
  ADD COLUMN IF NOT EXISTS data_caducidade          date,
  ADD COLUMN IF NOT EXISTS data_contrato            date,
  -- Sec 14: Faturação
  ADD COLUMN IF NOT EXISTS fatura_recetor_nome      text,
  ADD COLUMN IF NOT EXISTS fatura_recetor_nif       text,
  ADD COLUMN IF NOT EXISTS fatura_emissor_nome      text,
  ADD COLUMN IF NOT EXISTS fatura_emissor_nif       text,
  ADD COLUMN IF NOT EXISTS fatura_base              numeric,
  ADD COLUMN IF NOT EXISTS fatura_iva               numeric,
  ADD COLUMN IF NOT EXISTS fatura_total             numeric;
