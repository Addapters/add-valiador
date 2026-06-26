-- 011: Recalcular honorários com o precário ABANCA correcto
-- Actualiza imóveis com fee_amount = 0 ou NULL

UPDATE properties SET fee_amount = CASE
  -- Sem área (linha única)
  WHEN upper(trim(property_type)) IN ('APARTAMENTO','PISO','ATICO','DUPLEX','ESTUDIO','VIVIENDA (PISO)','VIVIENDA','FRACAO','FRACAO AUTONOMA')
    THEN 120.00
  WHEN upper(trim(property_type)) IN ('MORADIA')
    THEN 125.00
  WHEN upper(trim(property_type)) IN ('LOJA','LOCAL COMERCIAL','LOCAL')
    THEN 110.00
  WHEN upper(trim(property_type)) IN ('ARRUMOS','TRASTERO')
    THEN 100.00
  WHEN upper(trim(property_type)) IN ('OUTROS ANEXOS')
    THEN 100.00
  WHEN upper(trim(property_type)) IN ('GARAGEM','GARAJE','PLAZA DE GARAJE')
    THEN 95.00
  -- Moradias unifamiliares
  WHEN upper(trim(property_type)) IN ('VIVIENDA UNIFAMILIAR','MORADIA UNIFAMILIAR','CHALET','CASA','MORADIA ISOLADA')
    THEN CASE
      WHEN COALESCE(area_m2, gross_area, 0) <= 500   THEN 485.00
      WHEN COALESCE(area_m2, gross_area, 0) <= 2000  THEN 695.00
      WHEN COALESCE(area_m2, gross_area, 0) <= 10000 THEN 970.00
      ELSE 1290.00
    END
  -- Moradias em banda
  WHEN upper(trim(property_type)) IN ('CHALET ADOSADO','CHALET PAREADO','CASA ADOSADA','MORADIA EM BANDA')
    THEN CASE
      WHEN COALESCE(area_m2, gross_area, 0) <= 500   THEN 485.00
      WHEN COALESCE(area_m2, gross_area, 0) <= 2000  THEN 695.00
      WHEN COALESCE(area_m2, gross_area, 0) <= 10000 THEN 970.00
      ELSE 1290.00
    END
  -- Armazém
  WHEN upper(trim(property_type)) IN ('ARMAZEM','ARMAZÉM')
    THEN CASE
      WHEN COALESCE(area_m2, gross_area, 0) <= 500   THEN 235.00
      WHEN COALESCE(area_m2, gross_area, 0) <= 2000  THEN 380.00
      WHEN COALESCE(area_m2, gross_area, 0) <= 10000 THEN 585.00
      ELSE 880.00
    END
  -- Comércio / Escritórios / Naves / Habitação / Edifício
  WHEN upper(trim(property_type)) IN ('LOCAL DE NEGOCIO','COMERCIO','COMÉRCIO','OFICINA','ESCRITORIO','ESCRITÓRIO','NAVE','NAVE INDUSTRIAL','HABITACAO','HABITAÇÃO','EDIFICIO','EDIFÍCIO')
    THEN CASE
      WHEN COALESCE(area_m2, gross_area, 0) <= 500   THEN 485.00
      WHEN COALESCE(area_m2, gross_area, 0) <= 2000  THEN 695.00
      WHEN COALESCE(area_m2, gross_area, 0) <= 10000 THEN 970.00
      ELSE 1290.00
    END
  -- Terreno rústico
  WHEN upper(trim(property_type)) IN ('TERRENO FINCA RUSTICA','TERRENO FINCA RÚSTICA','FINCA RUSTICA','FINCA RÚSTICA','TERRENO RUSTICO','TERRENO RÚSTICO')
    OR (upper(trim(property_type)) = 'TERRENO' AND upper(trim(COALESCE(property_subtype,''))) LIKE '%RUSTIC%')
    THEN CASE
      WHEN COALESCE(land_area, area_m2, 0) <= 5000    THEN 295.00
      WHEN COALESCE(land_area, area_m2, 0) <= 50000   THEN 520.00
      WHEN COALESCE(land_area, area_m2, 0) <= 100000  THEN 770.00
      ELSE 1165.00
    END
  -- Terreno urbano
  WHEN upper(trim(property_type)) IN ('SOLAR','TERRENO URBANO','TERRENO FINCA URBANA')
    OR upper(trim(property_type)) = 'TERRENO'
    THEN CASE
      WHEN COALESCE(land_area, area_m2, 0) <= 5000    THEN 570.00
      WHEN COALESCE(land_area, area_m2, 0) <= 50000   THEN 840.00
      WHEN COALESCE(land_area, area_m2, 0) <= 100000  THEN 1170.00
      ELSE 1555.00
    END
  ELSE fee_amount
END
WHERE fee_amount IS NULL OR fee_amount = 0;
