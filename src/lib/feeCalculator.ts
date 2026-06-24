// Precário ABANCA 2026 — completo
// Fonte: Anexo II ao Contrato, pág. 23-32

export interface FeeRule {
  activity: string
  area_min: number
  area_max: number | null
  area_unit: 'ABC' | 'ATT' // ABC = área bruta construída, ATT = área total terreno
  price: number
}

// ── Tabela Cliente Avaliação ───────────────────────────────────────────────
const AVALIACAO: FeeRule[] = [
  // Sem dependência de área
  { activity: 'Moradia',         area_min: 0, area_max: null, area_unit: 'ABC', price: 125 },
  { activity: 'Apartamento',     area_min: 0, area_max: null, area_unit: 'ABC', price: 120 },
  { activity: 'Loja',            area_min: 0, area_max: null, area_unit: 'ABC', price: 110 },
  { activity: 'Arrumos',         area_min: 0, area_max: null, area_unit: 'ABC', price: 100 },
  { activity: 'Outros Anexos',   area_min: 0, area_max: null, area_unit: 'ABC', price: 100 },
  { activity: 'Garagem',         area_min: 0, area_max: null, area_unit: 'ABC', price:  95 },
  // Armazém
  { activity: 'Armazém',         area_min:     0, area_max:   500, area_unit: 'ABC', price:  235 },
  { activity: 'Armazém',         area_min:   500, area_max:  2000, area_unit: 'ABC', price:  380 },
  { activity: 'Armazém',         area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  585 },
  { activity: 'Armazém',         area_min: 10000, area_max:  null, area_unit: 'ABC', price:  880 },
  // Moradias em banda
  { activity: 'Moradias em banda',         area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Moradias em banda',         area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Moradias em banda',         area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Moradias em banda',         area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Moradias unifamiliares
  { activity: 'Moradias unifamiliares',    area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Moradias unifamiliares',    area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Moradias unifamiliares',    area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Moradias unifamiliares',    area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Habitação
  { activity: 'Habitação',                 area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Habitação',                 area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Habitação',                 area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Habitação',                 area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Comércio
  { activity: 'Comércio',                  area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Comércio',                  area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Comércio',                  area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Comércio',                  area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Escritórios
  { activity: 'Escritórios',               area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Escritórios',               area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Escritórios',               area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Escritórios',               area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Naves industriais
  { activity: 'Naves industriais',          area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Naves industriais',          area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Naves industriais',          area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Naves industriais',          area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Parqueamento
  { activity: 'Parqueamento',               area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Parqueamento',               area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Parqueamento',               area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Parqueamento',               area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Postos de abastecimento
  { activity: 'Postos de abastecimento',    area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Postos de abastecimento',    area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Postos de abastecimento',    area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Postos de abastecimento',    area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Residência Geriátrica
  { activity: 'Residência Geriátrica',      area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Residência Geriátrica',      area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Residência Geriátrica',      area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Residência Geriátrica',      area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Residência de Estudantes
  { activity: 'Residência de Estudantes',   area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Residência de Estudantes',   area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Residência de Estudantes',   area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Residência de Estudantes',   area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Instalações desportivas e recreativas
  { activity: 'Instalações desportivas',    area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Instalações desportivas',    area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Instalações desportivas',    area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Instalações desportivas',    area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Centros de ensino e instalações culturais
  { activity: 'Centros de ensino',          area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Centros de ensino',          area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Centros de ensino',          area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Centros de ensino',          area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Centros Logísticos
  { activity: 'Centros Logísticos',         area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Centros Logísticos',         area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Centros Logísticos',         area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Centros Logísticos',         area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Centros comerciais
  { activity: 'Centros comerciais',         area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Centros comerciais',         area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Centros comerciais',         area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Centros comerciais',         area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Hotéis
  { activity: 'Hotéis',                     area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Hotéis',                     area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Hotéis',                     area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Hotéis',                     area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Hospitais
  { activity: 'Hospitais',                  area_min:     0, area_max:   500, area_unit: 'ABC', price:  485 },
  { activity: 'Hospitais',                  area_min:   500, area_max:  2000, area_unit: 'ABC', price:  695 },
  { activity: 'Hospitais',                  area_min:  2000, area_max: 10000, area_unit: 'ABC', price:  970 },
  { activity: 'Hospitais',                  area_min: 10000, area_max:  null, area_unit: 'ABC', price: 1290 },
  // Terreno rústico (ATT)
  { activity: 'Terreno rústico',            area_min:     0, area_max:  5000, area_unit: 'ATT', price:  295 },
  { activity: 'Terreno rústico',            area_min:  5000, area_max: 50000, area_unit: 'ATT', price:  520 },
  { activity: 'Terreno rústico',            area_min: 50000, area_max:100000, area_unit: 'ATT', price:  770 },
  { activity: 'Terreno rústico',            area_min:100000, area_max:  null, area_unit: 'ATT', price: 1165 },
  // Terreno Urbano (ATT)
  { activity: 'Terreno urbano',             area_min:     0, area_max:  5000, area_unit: 'ATT', price:  570 },
  { activity: 'Terreno urbano',             area_min:  5000, area_max: 50000, area_unit: 'ATT', price:  840 },
  { activity: 'Terreno urbano',             area_min: 50000, area_max:100000, area_unit: 'ATT', price: 1170 },
  { activity: 'Terreno urbano',             area_min:100000, area_max:  null, area_unit: 'ATT', price: 1555 },
  // Outros sem área
  { activity: 'Cancelamento',              area_min: 0, area_max: null, area_unit: 'ABC', price:  50 },
]

// ── Tabela Portabilidade — todos 65€ ──────────────────────────────────────
const PORTABILIDADE: FeeRule[] = [
  'Moradia','Apartamento','Loja','Arrumos','Outros Anexos','Garagem',
  'Armazém','Edifícios','Terreno rústico','Terreno urbano',
  'Concessões administrativas','Direitos de superfície','Fundos de comércio',
  'Navios','Aeronaves'
].map(a => ({ activity: a, area_min: 0, area_max: null, area_unit: 'ABC' as const, price: 65 }))

// ── Mapeamento TIPO_BIEN ABANCA → actividade do precário ──────────────────
function norm(s: string) {
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
}

const BIEN_MAP: Record<string, string> = {
  // Apartamentos / Habitação vertical
  'vivienda (piso)':         'Apartamento',
  'vivienda':                'Apartamento',
  'piso':                    'Apartamento',
  'atico':                   'Apartamento',
  'duplex':                  'Apartamento',
  'estudio':                 'Apartamento',
  'apartamento':             'Apartamento',
  'fracao':                  'Apartamento',
  'fracao autonoma':         'Apartamento',
  // Moradia simples (sem escalão área — linha única)
  'moradia':                 'Moradia',
  // Moradias unifamiliares (com escalões)
  'vivienda unifamiliar':    'Moradias unifamiliares',
  'chalet':                  'Moradias unifamiliares',
  'casa':                    'Moradias unifamiliares',
  'moradia unifamiliar':     'Moradias unifamiliares',
  'moradia isolada':         'Moradias unifamiliares',
  // Moradias em banda
  'chalet adosado':          'Moradias em banda',
  'chalet pareado':          'Moradias em banda',
  'casa adosada':            'Moradias em banda',
  'moradia em banda':        'Moradias em banda',
  // Garagem / Arrumos
  'garaje':                  'Garagem',
  'garagem':                 'Garagem',
  'plaza de garaje':         'Garagem',
  'trastero':                'Arrumos',
  'arrumos':                 'Arrumos',
  'arrecadacao':             'Arrumos',
  'outros anexos':           'Outros Anexos',
  // Comércio
  'local comercial':         'Loja',
  'local':                   'Loja',
  'loja':                    'Loja',
  'local de negocio':        'Comércio',
  'comercio':                'Comércio',
  // Escritórios
  'oficina':                 'Escritórios',
  'escritorio':              'Escritórios',
  // Industrial
  'nave':                    'Naves industriais',
  'nave industrial':         'Naves industriais',
  'armazem':                 'Armazém',
  // Terrenos
  'terreno finca rustica':   'Terreno rústico',
  'finca rustica':           'Terreno rústico',
  'terreno rustico':         'Terreno rústico',
  'terreno finca urbana':    'Terreno urbano',
  'terreno urbano':          'Terreno urbano',
  'solar':                   'Terreno urbano',
  'terreno':                 'Terreno urbano', // default terreno → urbano
  // Edifício
  'edificio':                'Habitação',
  // Habitação genérica
  'habitacao':               'Habitação',
}

function mapActivity(propertyType: string, propertySubtype?: string | null): string {
  const k = norm(propertyType)
  if (BIEN_MAP[k]) return BIEN_MAP[k]
  // Terreno com subtipo rústico
  if (k === 'terreno' && propertySubtype) {
    const ks = norm(propertySubtype)
    if (ks.includes('rustic') || ks.includes('rustic')) return 'Terreno rústico'
  }
  return propertyType // fallback
}

function findRule(rules: FeeRule[], activity: string, area: number): number | null {
  const matching = rules.filter(r => norm(r.activity) === norm(activity))
  if (!matching.length) return null
  if (matching.length === 1) return matching[0].price
  const rule = matching.find(r => area >= r.area_min && (r.area_max === null || area < r.area_max))
  return rule?.price ?? matching[matching.length - 1].price
}

/**
 * Calcula honorário com base no precário ABANCA.
 *
 * @param propertyType  — valor do campo property_type (TIPO_BIEN do ABANCA)
 * @param propertySubtype — valor do campo property_subtype (opcional)
 * @param area          — área em m² (ABC para construção, ATT para terrenos)
 * @param tipoServico   — 'Avaliação' | 'Vistoria' | 'Portabilidade' | 'Reavaliação'
 *                        Se omitido, usa 'Avaliação'
 * @param dbRules       — regras da tabela fee_schedules (se existirem, têm prioridade)
 */
export function calculateFee(
  propertyType: string | null,
  area: number | null,
  dbRules: FeeRule[],
  propertySubtype?: string | null,
  tipoServico?: string | null
): number | null {
  if (!propertyType) return null

  // Se existem regras na BD, usa-as primeiro
  if (dbRules.length > 0) {
    const activity = mapActivity(propertyType, propertySubtype)
    const a = area || 0
    const matching = dbRules.filter(r => norm(r.activity) === norm(activity))
    if (matching.length) {
      if (matching.length === 1) return matching[0].price
      const rule = matching.find(r => a >= r.area_min && (r.area_max === null || a < r.area_max))
      return rule?.price ?? matching[matching.length - 1].price
    }
  }

  // Fallback: usa a tabela hardcoded do precário
  const activity = mapActivity(propertyType, propertySubtype)
  const a = area || 0
  const servico = (tipoServico || 'Avaliação').toLowerCase()

  if (servico.includes('portabilidade')) {
    return findRule(PORTABILIDADE, activity, a)
  }

  // Avaliação, Vistoria e Reavaliação usam a mesma tabela base para o cálculo de importação
  // (Vistoria e Reavaliação têm preços diferentes mas a lógica de escalões é igual)
  return findRule(AVALIACAO, activity, a)
}

// Alias para compatibilidade com chamadas antigas sem tipoServico
export function calculateFeeWithFallback(
  propertyType: string | null,
  area: number | null,
  rules: FeeRule[]
): number | null {
  return calculateFee(propertyType, area, rules)
}
