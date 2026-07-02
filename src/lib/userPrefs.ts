// ── Column definitions ───────────────────────────────────────
// group: 'base' = white bg, 'abanca' = blue tint bg
export interface ColDef { label: string; group: 'base' | 'abanca' }

export interface PropertyFilters {
  search: string; visitFilter: string; billingFilter: string
  districtFilter: string[]; parishFilter: string[]; peritoFilter: string
}
export const DEFAULT_FILTERS: PropertyFilters = {
  search:'', visitFilter:'', billingFilter:'', districtFilter:[], parishFilter:[], peritoFilter:''
}

export const ALL_COLUMNS: Record<string, ColDef> = {
  // Base fields
  external_ref:           { label:'Ref. Externa',          group:'base' },
  id_bien:                { label:'ID do Bem',             group:'base' },
  id_registo_predial:     { label:'Reg. Predial',          group:'base' },
  id_registo_matricial:   { label:'Reg. Matricial',        group:'base' },
  fracao:                 { label:'Fracção',               group:'base' },
  street:                 { label:'Rua',                   group:'base' },
  number:                 { label:'Nº',                    group:'base' },
  block:                  { label:'Bloco',                 group:'base' },
  floor_letter:           { label:'Piso/Letra',            group:'base' },
  postal_code:            { label:'Cód. Postal',           group:'base' },
  parish:                 { label:'Freguesia',             group:'base' },
  municipality:           { label:'Concelho',              group:'base' },
  district:               { label:'Distrito',              group:'base' },
  property_type:          { label:'Tipo de Bem',           group:'base' },
  property_subtype:       { label:'Subtipo',               group:'base' },
  use_type:               { label:'Uso',                   group:'base' },
  use_subtype:            { label:'Subuso',                group:'base' },
  property_state:         { label:'Estado Bem',            group:'base' },
  typology:               { label:'Tipologia',             group:'base' },
  year_built:             { label:'Ano Const.',            group:'base' },
  area_m2:                { label:'m² (N)',                group:'base' },
  area_garage_m2:         { label:'m² Garagem',            group:'base' },
  area_annex_m2:          { label:'m² Anexo',              group:'base' },
  gross_area:             { label:'Área bruta',            group:'base' },
  useful_area:            { label:'Área útil',             group:'base' },
  land_area:              { label:'Terreno',               group:'base' },
  perito_avaliador:       { label:'Perito Avaliador',      group:'base' },
  visit_status:           { label:'Visita',               group:'base' },
  tem_fotos:              { label:'Fotos',                 group:'base' },
  tem_comparaveis:        { label:'Comparáveis',           group:'base' },
  verificado:             { label:'Verificado',            group:'base' },
  visit_date:             { label:'Data visita',           group:'base' },
  fee_amount:             { label:'Honorário',             group:'base' },
  honorarios_addapters:   { label:'Honorários Addapters',  group:'base' },
  po_number:              { label:'Nº PO',                 group:'base' },
  invoice_number:         { label:'Nº Fatura',             group:'base' },
  payment_date:           { label:'Dt. Pagamento',         group:'base' },
  geo:                    { label:'Geo',                   group:'base' },
  // ABANCA fields — highlighted in blue
  nuc_risco:              { label:'NUC Risco',             group:'abanca' },
  data_pedido:            { label:'Data Pedido',           group:'abanca' },
  tipo_reavaliacao:       { label:'Tipo Reavaliação',      group:'abanca' },
  tipo_via:               { label:'Tipo Via',              group:'abanca' },
  escada:                 { label:'Escada',                group:'abanca' },
  ampliacao:              { label:'Ampliação',             group:'abanca' },
  lugar:                  { label:'Lugar',                 group:'abanca' },
  prev_valuation_date:    { label:'Dt. Aval. Anterior',    group:'abanca' },
  prev_valuation_value:   { label:'Valor Aval. Anterior',  group:'abanca' },
  prev_valuation_method:  { label:'Método Aval.',          group:'abanca' },
  prev_valuation_expert:  { label:'Perito Anterior',       group:'abanca' },
  prev_valuation_entity:  { label:'Entidade Anterior',     group:'abanca' },
}

export const DEFAULT_VISIBLE = [
  'external_ref','id_bien','district','municipality','parish',
  'street','number','postal_code',
  'property_type','typology','area_m2',
  'perito_avaliador','visit_status','tem_fotos','tem_comparaveis','verificado',
  'fee_amount','honorarios_addapters',
  'nuc_risco','data_pedido',
]

export const DEFAULT_MINIMUM = [
  'external_ref','district','municipality','parish',
  'street','property_type','visit_status','verificado','fee_amount',
]

// No-op stubs kept for compatibility — não usam localStorage
export function getSavedFilters(): PropertyFilters  { return { ...DEFAULT_FILTERS } }
export function saveFilters(_f: PropertyFilters)    { /* sem persistência */ }
export function clearFilters()                      { /* sem persistência */ }
export function getSavedVisibleCols(): string[]     { return [...DEFAULT_VISIBLE] }
export function saveVisibleCols(_cols: string[])    { /* sem persistência */ }
export function getSavedPerito(): string            { return '' }
export function savePerito(_name: string)           { /* sem persistência */ }
