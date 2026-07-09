import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

function v(val: any, def: any = '') { return val !== null && val !== undefined ? val : def }

function fmtDate(val: any): string {
  if (!val) return ''
  try {
    const s = String(val).slice(0, 10)
    const [y, m, d] = s.split('-')
    if (!y || !m || !d) return String(val)
    return `${d}/${m}/${y}`
  } catch { return String(val) }
}

function fmtArea(val: any): string {
  if (val === null || val === undefined || val === '') return ''
  const f = parseFloat(String(val))
  if (isNaN(f)) return ''
  return f === Math.floor(f) ? String(Math.floor(f)) : f.toFixed(2).replace('.', ',')
}

// Converte valor de área para número, lidando com formatos PT ("142,6") e EN ("142.6")
// — nunca interpreta ponto como separador de milhares a menos que haja também vírgula decimal
function parseArea(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  if (!isNaN(n) && typeof val !== 'string') return n // já é número JS
  const s = String(val).trim().replace(/[€$£\s]/g, '')
  let normalized: string
  if (s.includes(',') && s.includes('.')) {
    // Formato europeu completo: 1.402,50 → remove ponto milhar, substitui vírgula por ponto
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    // Vírgula como decimal: 142,6 → 142.6
    normalized = s.replace(',', '.')
  } else {
    // Ponto como decimal (JSON): 142.6 → mantém
    normalized = s
  }
  const result = parseFloat(normalized)
  return isNaN(result) ? null : result
}

async function fetchBuf(url: string): Promise<ArrayBuffer | null> {
  try {
    const sep = url.includes('?') ? '&' : '?'
    const r = await fetch(`${url}${sep}v=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return null
    return r.arrayBuffer()
  } catch { return null }
}

// Primeira letra de cada palavra maiúscula (para moradas e nomes)
function titleCase(val: any): string {
  if (!val) return ''
  const s = String(val).trim()
  if (!s) return ''
  const exceptions = new Set(['de','da','do','das','dos','e','a','o','as','os','em','na','no','nas','nos','ao','à','um','uma'])
  return s.split(' ').map((word, i) => {
    if (!word) return word
    const lower = word.toLowerCase()
    if (i > 0 && exceptions.has(lower)) return lower
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }).join(' ')
}

// Traduz termos em espanhol para português europeu
function traduzTipo(val: any): string {
  if (!val) return ''
  const map: Record<string, string> = {
    'DESCONOCIDO':                 'Desconhecido',
    'NO DISPONIBLE':               'Não disponível',
    'NO APLICA':                   'Não aplicável',
    'SIN DATOS':                   'Sem dados',
    'NO ESPECIFICADO':             'Não especificado',
    'OTRO':                        'Outro',
    'OTROS':                       'Outros',
    'NINGUNO':                     'Nenhum',
    'NINGUNA':                     'Nenhuma',
    'SI':                          'Sim',
    'SÍ':                          'Sim',
    // Tipos de imóvel
    'VIVIENDA UNIFAMILIAR':        'Moradia unifamiliar',
    'VIVIENDA (PISO)':             'Apartamento',
    'VIVIENDA':                    'Habitação',
    'PISO':                        'Apartamento',
    'CASA':                        'Moradia',
    'GARAJE':                      'Garagem',
    'PLAZA DE GARAJE':             'Garagem',
    'TRASTERO':                    'Arrumos',
    'LOCAL':                       'Loja',
    'LOCAL COMERCIAL':             'Loja comercial',
    'LOCAL DE NEGOCIO':            'Loja comercial',
    'OFICINA':                     'Escritório',
    'NAVE':                        'Nave industrial',
    'NAVE INDUSTRIAL':             'Nave industrial',
    'TERRENO':                     'Terreno',
    'URBANIZABLE NO DELIMITADO':   'Urbanizável não delimitado',
    'URBANIZABLE DELIMITADO':      'Urbanizável delimitado',
    'TERRENO FINCA RUSTICA':       'Terreno rústico',
    'TERRENO FINCA RÚSTICA':       'Terreno rústico',
    'TERRENO FINCA URBANA':        'Terreno urbano',
    'SOLAR':                       'Terreno urbano',
    'FINCA RUSTICA':               'Propriedade rústica',
    'FINCA RÚSTICA':               'Propriedade rústica',
    'EDIFICIO':                    'Edifício',
    'EDIFICIO COMPLETO':           'Edifício completo',
    'CHALET':                      'Moradia',
    'CHALET ADOSADO':              'Moradia em banda',
    'CHALET PAREADO':              'Moradia geminada',
    'CHALET INDIVIDUAL':           'Moradia isolada',
    'DUPLEX':                      'Duplex',
    'ATICO':                       'Cobertura',
    'ÁTICO':                       'Cobertura',
    'ESTUDIO':                     'Estúdio',
    'APARTAMENTO':                 'Apartamento',
    'BAJO':                        'Rés-do-chão',
    'BAJO COMERCIAL':              'Rés-do-chão comercial',
    // Finalidades
    'ADJUDICADO CON VISITA INTERIOR':    'Adjudicado com visita interior',
    'ADJUDICADOS CON VISTORIA INTERIOR': 'Adjudicado com visita interior',
    'ADJUDICADO SIN VISITA INTERIOR':    'Adjudicado sem visita interior',
    'ADJUDICADOS SIN VISITA INTERIOR':   'Adjudicado sem visita interior',
    'ADJUDICADOS SEM VISTORIA INTERIOR': 'Adjudicado sem visita interior',
    // Estados de construção
    'NUEVA CONSTRUCCION':          'Construção nova',
    'NUEVA CONSTRUCCIÓN':          'Construção nova',
    'SEGUNDA MANO':                'Usado',
    'EN PROYECTO':                 'Em projecto',
    'EN PROYETO':                  'Em projecto',
    'EN CONSTRUCCION':             'Em construção',
    'EN CONSTRUCCIÓN':             'Em construção',
    'EN REHABILITACION':           'Em reabilitação',
    'EN REHABILITACIÓN':           'Em reabilitação',
    'REHABILITADO':                'Reabilitado',
    'TERMINADO':                   'Terminado',
    'HIPOTESIS TERMINADO':         'Hipótese terminado',
    'HIPÓTESIS TERMINADO':         'Hipótese terminado',
    // Conservação
    'MUY BUENO':                   'Muito bom',
    'BUENO':                       'Bom',
    'NORMAL':                      'Normal',
    'DEFICIENTE':                  'Deficiente',
    'MUY DEFICIENTE':              'Muito deficiente',
    'RUINOSO':                     'Ruinoso',
    // Ocupação
    'OCUPADO':                     'Ocupado',
    'OCUPADO POR EL PROPIETARIO':  'Ocupado pelo proprietário',
    'LIBRE':                       'Livre',
    'ARRENDADO':                   'Arrendado',
    'OCUPADO POR TERCEROS':        'Ocupado por terceiros',
    'VACIO':                       'Vazio',
    'VACÍO':                       'Vazio',
    'ALQUILADO':                   'Arrendado',
    // Uso
    'RESIDENCIAL':                 'Residencial',
    'COMERCIAL':                   'Comercial',
    'INDUSTRIAL':                  'Industrial',
    'SERVICIOS':                   'Serviços',
    'MIXTO':                       'Misto',
    'RUSTICO':                     'Rústico',
    'RÚSTICO':                     'Rústico',
    // Mercado
    'POSITIVA':                    'Positiva',
    'MUY POSITIVA':                'Muito positiva',
    'NEGATIVA':                    'Negativa',
    'MUY NEGATIVA':                'Muito negativa',
    'ESTABLE':                     'Estável',
    'EN ALZA':                     'Em alta',
    'EN BAJA':                     'Em baixa',
    'ALTA':                        'Alta',
    'MEDIA':                       'Média',
    'BAJA':                        'Baixa',
    'MUY ALTA':                    'Muito alta',
    'MUY BAJA':                    'Muito baixa',
    'TENDENCIALMENTE POSITIVA':    'Tendencialmente positiva',
    'TENDENCIALMENTE NEGATIVA':    'Tendencialmente negativa',
    // Tipo via
    'CALLE':                       'Rua',
    'AVENIDA':                     'Avenida',
    'PLAZA':                       'Praça',
    'PASEO':                       'Passeio',
    'CARRETERA':                   'Estrada',
    'CAMINO':                      'Caminho',
    'TRAVESIA':                    'Travessa',
    'TRAVESÍA':                    'Travessa',
    // Destino
    '1ª RESIDENCIA':               '1ª residência',
    '1ª RESIDÊNCIA':               '1ª residência',
    '2ª RESIDENCIA':               '2ª residência',
    '2ª RESIDÊNCIA':               '2ª residência',
    'ARRENDAMIENTO':               'Arrendamento',
    // Tipo prédio
    'PREDIO URBANO':               'Prédio urbano',
    'PRÉDIO URBANO':               'Prédio urbano',
    'PREDIO RUSTICO':              'Prédio rústico',
    'PRÉDIO RÚSTICO':              'Prédio rústico',
    'PREDIO MIXTO':                'Prédio misto',
    // Serviço
    'TASACION':                    'Avaliação',
    'TASACIÓN':                    'Avaliação',
    'RETASACION':                  'Reavaliação',
    'RETASACIÓN':                  'Reavaliação',
    'VISTORIA':                    'Vistoria',
    'PORTABILIDAD':                'Portabilidade',
  }
  const upper = String(val).toUpperCase().trim()
  const translated = map[upper]
  // Se traduzido, devolve a tradução; se não, aplica titleCase ao valor original
  return translated || titleCase(val)
}

// Traduz e aplica titleCase
function tr(val: any): string {
  if (!val) return ''
  return traduzTipo(val)
}

export async function generateAbancaReport(
  property: any,
  photos: { url: string; slot?: number }[],
  comps: any[],
  templateUrl: string,
  mapImageBlob?: Blob | null,
  siblings: any[] = []   // outros imóveis com a mesma external_ref
): Promise<void> {
  const tmplBuf = await fetchBuf(templateUrl)
  if (!tmplBuf) throw new Error('Não foi possível carregar o modelo. Verifique a variável VITE_REPORT_TEMPLATE_URL.')

  const wb = new ExcelJS.Workbook()

  // Pré-processa para remover TODAS as fórmulas (incluindo shared) que o ExcelJS não suporta bem
  // Não precisamos de fórmulas calculadas no resultado final, apenas valores estáticos
  async function cleanSharedFormulas(buf: ArrayBuffer): Promise<ArrayBuffer> {
    // Expande fórmulas partilhadas (shared formulas) em fórmulas individuais.
    // O ExcelJS não suporta slaves sem master visível → expandimos antes de carregar.
    //
    // BUG ANTERIOR: split por </c> agrupava múltiplas células num chunk e o regex
    // encontrava r="D118" (célula vazia adjacente) em vez de r="AD118" (célula correcta).
    // Resultado: dc=-26 → coluna Y tornava-se A (Y-26=1=A).
    //
    // FIX: usar regex que captura col+row directamente do mesmo elemento <c> que contém
    // a fórmula slave, sem split.

    const colToNum = (col: string): number =>
      [...col].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)
    const numToCol = (n: number): string => {
      let col = ''
      while (n > 0) { const r = (n - 1) % 26; col = String.fromCharCode(65 + r) + col; n = Math.floor((n - 1) / 26) }
      return col
    }
    const adjustFormula = (formula: string, dc: number, dr: number): string =>
      formula.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g, (_, ac, col, ar, row) =>
        ac + (ac ? col : numToCol(Math.max(1, colToNum(col) + dc))) +
        ar + (ar ? row   : String(Math.max(1, parseInt(row) + dr))))

    try {
      const JSZip = (await import('jszip')).default
      const zip   = await JSZip.loadAsync(buf)
      const sheetFiles = Object.keys(zip.files).filter(f => /xl\/worksheets\/sheet\d+\.xml/.test(f))

      for (const sf of sheetFiles) {
        let xml: string = await zip.files[sf].async('string')

        // Passo 1 — Recolher masters: <c r="COL+ROW" ...><f t="shared" si="N" ref="...">formula</f>
        const masters = new Map<string, { col: string; row: number; formula: string }>()
        for (const m of xml.matchAll(/<c\s+r="([A-Z]+)(\d+)"[^>]*><f\b([^>]*)>([^<]+)<\/f>/g)) {
          const fAttrs = m[3]
          if (!fAttrs.includes('t="shared"')) continue
          const siM = fAttrs.match(/\bsi="(\d+)"/)
          if (!siM) continue
          if (!masters.has(siM[1])) {
            masters.set(siM[1], { col: m[1], row: parseInt(m[2]), formula: m[4] })
          }
        }

        // Passo 2 — Expandir slaves: <c r="COL+ROW" ATTRS>(qualquer conteúdo, incluindo <v>)<f t="shared" si="N"/>
        // BUG anterior: [^<]* falhava quando <v>0</v> aparecia ANTES de <f/> na mesma célula.
        // Fix: ((?:(?!<\/c>)[\s\S])*?) — token temperado que permite qualquer conteúdo
        //      mas NUNCA atravessa </c>, garantindo que col+row pertencem à célula correcta.
        xml = xml.replace(
          /<c\s+r="([A-Z]+)(\d+)"([^>]*)>((?:(?!<\/c>)[\s\S])*?)<f\b([^>]*)\/>/g,
          (full, col, row, cAttrs, inner, fAttrs) => {
            if (!fAttrs.includes('t="shared"')) return full   // não é shared slave
            const siM = fAttrs.match(/\bsi="(\d+)"/)
            if (!siM) return `<c r="${col}${row}"${cAttrs}>${inner}`
            const master = masters.get(siM[1])
            if (!master) return `<c r="${col}${row}"${cAttrs}>${inner}`
            const dc = colToNum(col) - colToNum(master.col)
            const dr = parseInt(row) - master.row
            return `<c r="${col}${row}"${cAttrs}>${inner}<f>${adjustFormula(master.formula, dc, dr)}</f>`
          }
        )

        // Passo 3 — Converter masters shared em fórmulas regulares (remover t/si/ref)
        xml = xml.replace(/<f\b([^>]*)>/g, (m, attrs) => {
          if (!attrs.includes('t="shared"')) return m
          const cleaned = attrs
            .replace(/\s*t="shared"\s*/g, ' ')
            .replace(/\s*si="\d+"\s*/g, ' ')
            .replace(/\s*ref="[^"]*"\s*/g, ' ')
            .replace(/\s+/g, ' ').trim()
          return `<f${cleaned ? ' ' + cleaned : ''}>`
        })

        // Passo 4 — Remover valores de erro em cache (#DIV/0!, #REF!, etc.)
        xml = xml.replace(/<v>#(DIV\/0!|REF!|N\/A|NAME\?|NULL!|NUM!|VALUE!)<\/v>/g, '')
        xml = xml.replace(/\st="e"/g, '')

        zip.file(sf, xml)
      }
      return await zip.generateAsync({ type: 'arraybuffer' })
    } catch (e) {
      console.warn('cleanSharedFormulas failed, using original buffer:', e)
      return buf
    }
  }

  const cleanBuf = await cleanSharedFormulas(tmplBuf as ArrayBuffer)
  await wb.xlsx.load(cleanBuf)

  const ws = wb.getWorksheet('RELATÓRIO - PT')
  if (!ws) throw new Error('Folha "RELATÓRIO - PT" não encontrada no modelo.')

  // Detecta se é template multi (4+ bens) ou terreno (capacidade construtiva) pela URL
  const isMulti   = templateUrl.includes('multiplos') || templateUrl.includes('multi')
  const isTerreno = templateUrl.toLowerCase().includes('terreno')

  // Todos os imóveis a preencher (terreno é sempre 1 bem, sem irmãos)
  const maxProps = isMulti ? 18 : 3
  const allProps = [property, ...siblings].slice(0, maxProps)

  const p = property

  function set(ref: string, val: any) {
    if (val === null || val === undefined || val === '') return
    ws.getCell(ref).value = val
  }
  function setFormula(ref: string, formula: string) {
    ws.getCell(ref).value = { formula, result: 0 }
  }

  // Linhas base para template standard (offset +1 por imóvel, max 3)
  const STANDARD_BASE_ROWS = [
    19, 25, 31,
    38, 44, 45, 50, 56, 62,
    86, 92, 98,
    105, 116,
    152, 157,
    172, 177, 183, 189,
    212, 224,
    265, 285, 291,
  ]

  // Linhas base para template multi — actualizadas
  const MULTI_BASE_ROWS = [
    19, 42, 65, 89, 112, 135, 158, 181, 204,
    239, 262, 285, 309,
    359, 390, 412,
    444, 466, 489, 512,
    552, 581,
    639, 663,
    693, 716,
  ]

  function fillBlock(idx: number, prop: any) {
    const off = idx
    const id = v(prop.id_bien)
    const baseRows = isMulti ? MULTI_BASE_ROWS : STANDARD_BASE_ROWS

    for (const baseRow of baseRows) {
      set(`B${baseRow + off}`, id)
    }

    // Standard: morada=19, cod-postal=25, coord=31
    // Multi: morada=19, cod-postal=42, coord=65 (índices 0,1,2 das MULTI_BASE_ROWS)
    const moradaRow    = isMulti ? MULTI_BASE_ROWS[0]  : 19
    const codPostalRow = isMulti ? MULTI_BASE_ROWS[1]  : 25
    const coordRow     = isMulti ? MULTI_BASE_ROWS[2]  : 31

    // Campos de morada
    set(`D${moradaRow + off}`,  tr(v(prop.tipo_via)))
    set(`I${moradaRow + off}`,  v(prop.street, v(prop.address)))
    set(`AE${moradaRow + off}`, v(prop.number))
    set(`AG${moradaRow + off}`, v(prop.floor_letter))
    set(`AI${moradaRow + off}`, v(prop.fracao))
    set(`X${moradaRow + off}`,  v(prop.block))
    set(`Z${moradaRow + off}`,  v(prop.escada))
    set(`AB${moradaRow + off}`, v(prop.portal))

    // Código postal / localização
    set(`D${codPostalRow + off}`,  v(prop.postal_code))
    set(`I${codPostalRow + off}`,  titleCase(v(prop.district)))
    set(`P${codPostalRow + off}`,  titleCase(v(prop.municipality)))
    set(`W${codPostalRow + off}`,  titleCase(v(prop.parish)))

    // Coordenadas
    if (prop.longitude) set(`D${coordRow + off}`, prop.longitude)
    if (prop.latitude)  set(`G${coordRow + off}`, prop.latitude)

    // Campos de descrição por bem (apenas no multi, usando índices 3-8 das MULTI_BASE_ROWS)
    if (isMulti && MULTI_BASE_ROWS.length > 8) {
      const descRow = MULTI_BASE_ROWS[3] // Tipo/Subtipo/Uso — B89
      set(`D${descRow + off}`,   tr(v(prop.property_type)))
      set(`K${descRow + off}`,   tr(v(prop.property_subtype)))
      set(`U${descRow + off}`,   tr(v(prop.use_type)))
      set(`AD${descRow + off}`,  tr(v(prop.use_subtype)))

      const estadoRow = MULTI_BASE_ROWS[4] // Estado construção — B112
      set(`D${estadoRow + off}`,  tr(v(prop.estado_construcao, v(prop.property_state))))
      set(`O${estadoRow + off}`,  tr(v(prop.destino)))
      set(`V${estadoRow + off}`,  tr(v(prop.estado_conservacao)))
      set(`AC${estadoRow + off}`, tr(v(prop.estado_ocupacao)))

      const compRow = MULTI_BASE_ROWS[5] // Composição — B135
      set(`D${compRow + off}`,   tr(v(prop.composicao_imovel, v(prop.typology))))

      const regRow = MULTI_BASE_ROWS[6]  // Registo predial — B158
      set(`D${regRow + off}`,    v(prop.id_registo_predial))

      const matricRow = MULTI_BASE_ROWS[7] // Artigo matricial — B181
      set(`D${matricRow + off}`, v(prop.id_registo_matricial))
      set(`G${matricRow + off}`, v(prop.fracao))

      const tipPredRow = MULTI_BASE_ROWS[8] // Tipo prédio — B204
      set(`D${tipPredRow + off}`, tr(v(prop.tipo_predio)))
    }
  }

  // Preenchimento do template TERRENO (capacidade construtiva) — sempre 1 bem por relatório.
  // Layout próprio: colunas de morada diferentes (Lt/Piso/Porta/Bloco/Portal/Escada) e secções
  // extra de Conservatória/Caderneta Predial. Linhas confirmadas directamente no ficheiro
  // Template_Terreno.xlsx (Jun/2026) — voltar a confirmar se o template for substituído.
  function fillTerreno(prop: any) {
    const id = v(prop.id_bien)
    // Linhas onde a coluna B precisa do Id (substituem as fórmulas "=+B19" removidas na limpeza)
    const idRows = [19, 25, 31, 38, 44, 50, 56, 62, 68, 86, 92, 98, 105, 116, 122, 131, 137, 144, 158, 163, 170, 178, 183, 189, 195, 218, 235, 276, 283, 296, 302]
    for (const r of idRows) set(`B${r}`, id)

    // 2. MORADA
    set('D19',  tr(v(prop.tipo_via)))
    set('I19',  v(prop.street, v(prop.address)))
    set('X19',  v(prop.number))           // Lt
    set('Z19',  v(prop.floor_letter))     // Piso
    set('AB19', v(prop.fracao))           // Porta
    set('AD19', v(prop.block))            // Bloco
    set('AF19', v(prop.portal))           // Portal
    set('AH19', v(prop.escada))           // Escada
    set('D25',  v(prop.postal_code))
    set('I25',  titleCase(v(prop.district)))
    set('P25',  titleCase(v(prop.municipality)))
    set('W25',  titleCase(v(prop.parish)))
    if (prop.longitude) set('D31', prop.longitude)
    if (prop.latitude)  set('G31', prop.latitude)

    // 3. DESCRIÇÃO DO IMÓVEL
    set('D38',  tr(v(prop.property_type)))
    set('K38',  tr(v(prop.property_subtype)))
    set('U38',  tr(v(prop.use_type)))
    set('AD38', tr(v(prop.use_subtype)))
    set('D44',  tr(v(prop.estado_construcao, v(prop.property_state))))
    set('O44',  tr(v(prop.destino)))
    set('V44',  tr(v(prop.estado_conservacao)))
    set('AC44', tr(v(prop.estado_ocupacao)))
    set('D50',  tr(v(prop.composicao_imovel, v(prop.typology))))
    // Conservatória de Registo Predial
    set('D56',  v(prop.nr_conservatoria))
    set('F56',  v(prop.nome_conservatoria))
    set('N56',  v(prop.id_registo_predial))
    set('S56',  titleCase(v(prop.parish)))
    set('AB56', v(prop.nome_proprietario))
    // Caderneta Predial das Finanças
    set('D62',  v(prop.id_registo_matricial))
    set('G62',  v(prop.fracao))
    set('I62',  v(prop.tipo_caderneta))
    set('L62',  v(prop.seccao_caderneta))
    set('N62',  v(prop.ano_matriz))
    set('Q62',  v(prop.valor_patrimonial))
    set('V62',  v(prop.cod_freg))
    set('Y62',  v(prop.freguesia_financas))
    set('D68',  tr(v(prop.tipo_predio)))

    // 4. ENQUADRAMENTO NO MERCADO LOCAL (caixa de texto livre é B75:AI76 — âncora B75, não J75)
    set('B75', tr(v(prop.caract_mercado)))
    set('J78', tr(v(prop.tipo_expectativa_mercado)))
    set('J79', tr(v(prop.ocupacao_laboral)))
    set('J80', v(prop.populacao_concelho))
    set('J81', tr(v(prop.evolucao_mercado)))

    // 5. CARACTERÍSTICAS DA CONSTRUÇÃO
    if (prop.nr_quartos)         set('D86', Number(prop.nr_quartos))
    if (prop.nr_inst_sanitarias) set('G86', Number(prop.nr_inst_sanitarias))
    set('J86',  v(prop.nr_pisos, 1))
    set('L86',  tr(v(prop.qualidade_construcao, 'Média')))
    set('P86',  tr(v(prop.orientacao_solar, 'Não influi no valor')))
    set('U86',  tr(v(prop.categorizacao)))
    set('AD86', tr(v(prop.tipo_reparacao)))
    set('D92',  v(prop.nr_certificado_energ))
    set('J92',  v(prop.classe_energetica))
    set('N92',  fmtDate(prop.data_emissao_cert))
    set('R92',  fmtDate(prop.data_validade_cert))
    set('V92',  v(prop.nome_pq))
    set('AF92', v(prop.nr_pq))
    set('D98',  v(prop.nr_licenca_utilizacao))
    set('I98',  fmtDate(prop.data_licenca_construcao))
    set('M98',  v(prop.year_built))
    set('Q98',  fmtDate(prop.data_conclusao_obras))
    set('W98',  tr(v(prop.obra_parada)))

    // 6. ÁREAS
    const areaVal = prop.area_considerada || prop.area_m2 || prop.gross_area
    set('D105', fmtArea(areaVal))
    set('L105', fmtArea(prop.land_area))
    set('Q105', fmtArea(prop.gross_area))
    set('T105', fmtArea(prop.area_annex_m2))

    // 7. MÉTODO COMPARATIVO DE MERCADO
    // T116 (Área Privativa) replica sempre a ABP da tab Áreas — não há campo de área próprio
    // Y116 = IV-IA!P38 (média homogeneizada da folha IV-IA) — escrito mais abaixo depois de calcular
    // AD116 (Valor total) = ROUND(€/m² × Área, -2), calculado depois de Y116 estar definido
    // Por agora escreve Y116 a partir do campo manual se disponível — será sobrescrito pelo IV-IA avg
    set('D116', v(prop.metodo_comp_descricao))
    const area116 = parseFloat(prop.gross_area)
    if (area116 > 0) set('T116', area116)
    const valorM2_116 = parseFloat(prop.metodo_comp_valor_m2)
    if (valorM2_116 > 0) {
      set('Y116', valorM2_116)                                          // Y116:AC116 (provisório)
      if (area116 > 0) set('AD116', Math.round(valorM2_116 * area116 / 100) * 100) // AD116:AI116
    }

    // Valor de Renda Efetiva
    set('D137', v(prop.renda_ef_descricao))
    set('P137', fmtArea(prop.renda_ef_area))
    if (prop.renda_ef_valor_m2) set('T137', Number(prop.renda_ef_valor_m2))
    if (prop.renda_ef_mensal)   set('X137', Number(prop.renda_ef_mensal))
    if (prop.renda_ef_taxa)     set('AB137', Number(prop.renda_ef_taxa))
    if (prop.renda_ef_total)    set('AE137', Number(prop.renda_ef_total))

    // Valor de Renda Potencial
    set('D144', v(prop.renda_pot_descricao))
    set('P144', fmtArea(prop.renda_pot_area))
    if (prop.renda_pot_valor_m2) set('T144', Number(prop.renda_pot_valor_m2))
    if (prop.renda_pot_mensal)   set('X144', Number(prop.renda_pot_mensal))
    if (prop.renda_pot_taxa)     set('AB144', Number(prop.renda_pot_taxa))
    if (prop.renda_pot_total)    set('AE144', Number(prop.renda_pot_total))
    set('B149', v(prop.justificacao_metodo))

    // NOTA: secções de Custo Terminado/Hipótese Terminado/DCF/Residual (linhas ~157-240)
    // dependem fortemente de fórmulas internas do template que são removidas por
    // cleanSharedFormulas(); ficam por preencher nesta primeira versão — confirmar com
    // o utilizador antes de mapear, para não escrever valores incorrectos.

    // 16. CONCLUSÃO DA AVALIAÇÃO
    if (prop.valor_mercado)            set('D276', Number(prop.valor_mercado))
    if (prop.valor_venda_rapida)       set('J276', Number(prop.valor_venda_rapida))
    if (prop.valor_seguro)             set('R276', Number(prop.valor_seguro))
    if (prop.pct_obra)                 set('Y276', Number(prop.pct_obra))
    if (prop.valor_mercado_atual)      set('D283', Number(prop.valor_mercado_atual))
    if (prop.valor_venda_rapida_atual) set('J283', Number(prop.valor_venda_rapida_atual))
    if (prop.valor_seguro_atual)       set('R283', Number(prop.valor_seguro_atual))
    if (prop.pct_obra_atual)           set('Y283', Number(prop.pct_obra_atual))

    // 17. MÉTODOS DE AVALIAÇÃO — justificação
    set('M296', v(prop.justificacao_metodo))

    // 18. CERTIFICAÇÃO E ASSINATURA
    set('K315',  fmtDate(prop.data_pedido_relatorio || prop.data_pedido))
    set('O315',  fmtDate(prop.data_visita || prop.visit_date))
    set('V315',  fmtDate(prop.data_conclusao || prop.data_relatorio))
    set('AC315', fmtDate(prop.prev_valuation_date))

    // Empresa de avaliação
    set('F317', v(prop.empresa_nome))
    set('F318', v(prop.empresa_nif))
    set('F319', v(prop.empresa_cmvm))
    set('F320', v(prop.empresa_apolice))
    set('F321', fmtDate(prop.empresa_data_validade))
    set('F322', v(prop.empresa_seguradora))

    // Perito Avaliador Certificado
    set('R317', v(prop.pac_nome))
    set('R319', v(prop.pac_cmvm))
    set('R320', v(prop.pac_apolice))
    set('R321', fmtDate(prop.pac_data_validade))
    set('R322', v(prop.pac_seguradora))

    // Perito Avaliador
    set('AC317', v(prop.perito_avaliador))
    set('AC319', v(prop.perito_cmvm))
    set('AC320', v(prop.nr_apolice))
    set('AC321', fmtDate(prop.data_validade_seguro))
    set('AC318', 'Arq.')

    // DOCUMENTOS (L235-L241 = esquerda, AC235-AC241 = direita)
    set('L235', v((prop as any).doc_caderneta_predial,           'Não entregue'))
    set('L236', v((prop as any).doc_certid_o_da_crp,             'Não entregue'))
    set('L237', v((prop as any).doc_contrato_de_arrendamento,    'Não entregue'))
    set('L238', v((prop as any).doc_alvar__de_loteamento,        'Não entregue'))
    set('L239', v((prop as any).doc_planta_de_loteamento,        'Não entregue'))
    set('L240', v((prop as any).doc_licen_a_de_constru__o_obras, 'Não entregue'))
    set('L241', v((prop as any).doc_licen_a_de_utiliza__o,       'Não entregue'))
    set('AC235', v((prop as any).doc_or_amento_de_obras,         'Não entregue'))
    set('AC236', v((prop as any).doc_mem_ria_descritiva,         'Não entregue'))
    set('AC237', v((prop as any).doc_ficha_t_cnica_habita__o,    'Não entregue'))
    set('AC238', v((prop as any).doc_projeto_aprovado,           'Não entregue'))
    set('AC239', v((prop as any).doc_projeto_n_o_aprovado,       'Não entregue'))
    set('AC240', v((prop as any).doc_certificado_energ_tico,     'Não entregue'))
    set('AC241', v((prop as any).doc_outro,                      'Não entregue'))

    set('AC322', v(prop.seguradora))
  }

  // ─── VALORES DERIVADOS DE FÓRMULAS (confirmados nos 4 relatórios fechados reais) ─────────
  //
  // HELPER: adiciona N meses a uma data ISO (substitui EDATE do Excel)
  function addMonths(isoDate: string, months: number): Date {
    const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
    return new Date(y, m - 1 + months, d)
  }
  // HELPER: calcula o coeficiente VVR — ROUND(((1-c)*(1-d))/(1+i)^t, 4)
  function calcVVR(t: number, i: number, d: number, c: number): number {
    return Math.round(((1 - c) * (1 - d)) / Math.pow(1 + i, t) * 10000) / 10000
  }

  // 1. CABEÇALHO
  // O3=IF(F8,"",F8), V3=+F10, F9=EDATE(F8,6) são fórmulas preservadas no template — NÃO escrever.
  // F8=+V304/V746/V315 também é fórmula — em vez de escrever F8 directamente, escrevemos
  // na célula de data de conclusão que alimenta F8 (na secção de certificação mais abaixo).
  // 1. IDENTIFICAÇÃO — células de input (não são fórmulas)
  const reportRef = v(p.nr_relatorio, v(p.external_ref, v(p.ref, '')))
  set('F10', reportRef)  // Relatório N.º — alimenta V3=+F10 (fórmula preservada)
  set('X9',  v(p.tipo_servico, 'Avaliação'))
  set('X10', v(p.finalidade, 'Adjudicado sem visita interior'))
  if (!isTerreno) set('D101', v(p.banco))

  // Id e IdRel — removido mapeamento automático (não preencher estas células)

  if (isTerreno) {
    // Terreno: sempre 1 bem, layout próprio (ver fillTerreno)
    fillTerreno(p)
  } else {
    // Preenche blocos por imóvel (1, 2 ou 3 no standard; 1-18 no multi)
    allProps.forEach((prop, idx) => fillBlock(idx, prop))
  }

  // 3. DESCRIÇÃO DO IMÓVEL — apenas no template standard (no multi colidem com linhas dos bens;
  // no terreno já é preenchido dentro de fillTerreno)
  if (!isMulti && !isTerreno) {
    set('D38',  tr(v(p.property_type)))
    set('K38',  tr(v(p.property_subtype)))
    set('U38',  tr(v(p.use_type)))
    set('AD38', tr(v(p.use_subtype)))
    set('D44',  tr(v(p.estado_construcao, v(p.property_state))))
    set('O44',  tr(v(p.destino)))
    set('V44',  tr(v(p.estado_conservacao)))
    set('AC44', tr(v(p.estado_ocupacao)))
    set('D50',  tr(v(p.composicao_imovel, v(p.typology))))
    set('D56',  v(p.id_registo_predial))
    set('D62',  v(p.id_registo_matricial))
    set('G62',  v(p.fracao))
    set('D68',  tr(v(p.tipo_predio)))

    // 4. ENQUADRAMENTO NO MERCADO LOCAL
    set('J75', tr(v(p.caract_mercado)))
    set('J78', tr(v(p.tipo_expectativa_mercado)))
    set('J79', tr(v(p.ocupacao_laboral)))
    set('J80', v(p.populacao_concelho))
    set('J81', tr(v(p.evolucao_mercado)))

    // 5. CARACTERÍSTICAS DA CONSTRUÇÃO
    if (p.nr_quartos)         set('D86', Number(p.nr_quartos))
    if (p.nr_inst_sanitarias) set('G86', Number(p.nr_inst_sanitarias))
    set('J86', v(p.nr_pisos, 1))
    set('L86', tr(v(p.qualidade_construcao, 'Média')))
    set('P86', tr(v(p.orientacao_solar, 'Não influi no valor')))
    set('D92', v(p.nr_certificado_energ))
    set('J92', v(p.classe_energetica))
    set('N92', fmtDate(p.data_emissao_cert))
    set('R92', fmtDate(p.data_validade_cert))
    set('M98', v(p.year_built))
    set('D98', v(p.ano_licenca_utilizacao))

    // 6. ÁREAS — por cada imóvel (offset idx)
    // Standard: headers na linha 104, dados em 105+idx (confirmar no template VRF24jun26)
    // Multi: headers na linha 308, dados em 309+idx
    // Coluna D = Área Considerada, L = Terreno, Q = ABP, T = ABD
    const areasBaseRow = isMulti ? 309 : 105
    allProps.forEach((prop: any, idx: number) => {
      const areaVal = prop.area_considerada || prop.gross_area || prop.area_m2
      const aC = parseArea(areaVal);       if (aC !== null) set(`D${areasBaseRow + idx}`, aC)
      const aL = parseArea(prop.land_area); if (aL !== null) set(`L${areasBaseRow + idx}`, aL)
      const aQ = parseArea(prop.gross_area); if (aQ !== null) set(`Q${areasBaseRow + idx}`, aQ)
      const aT = parseArea(prop.area_annex_m2); if (aT !== null) set(`T${areasBaseRow + idx}`, aT)
    })
  }

  // COMPARÁVEIS — apenas na tab IV-IV (não na folha principal)
  const selectedComps = comps
    .filter((c: any) => c.selected)
    .sort((a: any, b: any) => {
      const epmA = a.price && a.area_m2 ? parseFloat(a.price)/parseFloat(a.area_m2) : 0
      const epmB = b.price && b.area_m2 ? parseFloat(b.price)/parseFloat(b.area_m2) : 0
      return epmA - epmB
    })
  const compsToUse = selectedComps.length > 0 ? selectedComps : comps

  // TAB IV-IV — 5 comparáveis seleccionados + homogeneização + análise estatística + Chauvenet
  const IV_COLS  = ['H', 'L', 'P', 'T', 'X']   // colunas de cada amostra (label/valor)
  const IV_PCT_COLS = ['J', 'N', 'R', 'V', 'Z'] // colunas da % calculada por amostra (ao lado de cada IV_COLS)

  // Percentagens confirmadas a partir da tabela de referência do próprio template
  // (folha IV-IV, $AE$45:$AH$51 e $AE$54:$AH$59 — confirmado igual em 4 relatórios fechados reais)
  const HOMOG_PCT_GENERIC: Record<string, number> = {
    'MUITO INFERIOR': 0.15, 'INFERIOR': 0.10, 'LIGEIRAMENTE INFERIOR': 0.05,
    'SEMELHANTE': 0, 'LIGEIRAMENTE SUPERIOR': -0.05, 'SUPERIOR': -0.10, 'MUITO SUPERIOR': -0.15,
  }
  const HOMOG_PCT_TX: Record<string, number> = {
    'ESPECULATIVO': -0.20, 'FÁCILMENTE NEGOCIÁVEL': -0.15, 'LIGEIRAMENTE NEGOCIÁVEL': -0.10,
    'ALINHADO COM MERCADO': -0.05, 'SEM MARGEM NEGOCIAÇÃO': 0,
  }
  // Valores críticos do Critério de Chauvenet por N — o template só tem 5 e 6 (linhas AE61:AH62),
  // os restantes são a tabela estatística padrão de Chauvenet (usada quando há menos de 5 comparáveis)
  const CHAUVENET_CRITICAL: Record<number, number> = {
    2: 1.15, 3: 1.38, 4: 1.54, 5: 1.65, 6: 1.73, 7: 1.80, 8: 1.86,
  }
  function pctGeneric(label: any): number | undefined {
    return HOMOG_PCT_GENERIC[String(label ?? 'Semelhante').toUpperCase().trim()]
  }
  function pctTxDesconto(label: any): number | undefined {
    return HOMOG_PCT_TX[String(label ?? 'Alinhado com Mercado').toUpperCase().trim()]
  }
  // Ajuste de área — mesma fórmula do template (linha 25 do IV-IV), substituída por valor estático
  // já que as fórmulas são removidas do ficheiro final (ver cleanSharedFormulas)
  function areaAdjustment(subjectAreaM2: any, compAreaM2: any): number | null {
    const sa = parseFloat(subjectAreaM2), ca = parseFloat(compAreaM2)
    if (!sa || !ca || isNaN(sa) || isNaN(ca)) return null
    const diffRatio = (sa - ca) / sa
    const exp = diffRatio < 0.3 ? 1 / 25 : 1 / 50
    return Math.pow(ca / sa, exp) - 1
  }
  function median(values: number[]): number {
    const s = [...values].sort((a, b) => a - b)
    const mid = Math.floor(s.length / 2)
    return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2
  }
  function stdevP(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
    return Math.sqrt(variance)
  }

  // Variáveis de homogeneização em scope exterior para serem usadas pela IV-IA e pelo main sheet
  let homogIndices: { col: string; pctCol: string; value: number }[] = []

  const wsIV = wb.getWorksheet('IV - IV')
  if (wsIV) {
    function setIV(ref: string, val: any) {
      if (val === null || val === undefined || val === '') return
      wsIV.getCell(ref).value = val
    }

    // E13 — Área Privativa/Locável do imóvel em avaliação (ABP), usada como base da homogeneização de área
    const subjectArea = parseFloat(p.gross_area)
    if (subjectArea > 0) setIV('E13', subjectArea)

    // Guarda o índice homogeneizado (linha 31) de cada amostra para a análise estatística seguinte

    compsToUse.slice(0, 5).forEach((c: any, idx: number) => {
      const col      = IV_COLS[idx]
      const pctCol   = IV_PCT_COLS[idx]
      const tipologia = c.tipologia || ''
      const uso       = c.uso       || ''
      const anoEstado = c.ano_estado || ''
      const descricao = c.notes     || ''
      const price     = parseFloat(c.price   || 0)
      const area      = parseFloat(c.area_m2 || 0)

      setIV(`${col}9`,  v(c.address))           // Localização
      setIV(`${col}10`, uso)                     // Uso
      setIV(`${col}11`, tipologia)               // Tipologia
      setIV(`${col}12`, anoEstado)               // Ano/Estado
      if (area > 0) setIV(`${col}13`, area)      // Área — valor numérico (não texto), usado nos cálculos
      if (price > 0) setIV(`${col}14`, price)    // Asking Price

      // Índice base (Asking Index, Uso Principal) — sem áreas acessórias (Outros I/II, Logradouro),
      // que esta plataforma não recolhe; equivale a H15/H21 do template quando essas parcelas são 0
      const baseIndex = (price > 0 && area > 0) ? price / area : null
      if (baseIndex !== null) setIV(`${col}15`, baseIndex)
      if (baseIndex !== null) setIV(`${col}21`, baseIndex)

      setIV(`${col}22`, descricao)               // Descrição
      setIV(`${col}34`, v(c.url))                // Fonte

      // HOMOGENEIZAÇÃO (linhas 24-30) — label escolhido na tab Comparáveis + % correspondente
      const pctLoc   = pctGeneric(c.homog_localizacao)
      const pctArea  = areaAdjustment(p.gross_area, c.area_m2)
      const pctAcab  = pctGeneric(c.homog_acabamentos)
      const pctConsv = pctGeneric(c.homog_conservacao)
      const pctCarac = pctGeneric(c.homog_caract_gerais)
      const pctClass = pctGeneric(c.homog_classe_energetica)
      const pctTx    = pctTxDesconto(c.homog_tx_desconto)

      setIV(`${col}24`, v(c.homog_localizacao, 'Semelhante'));        setIV(`${pctCol}24`, pctLoc)
      if (pctArea !== null) setIV(`${pctCol}25`, pctArea)             // Área — sem label, só % (auto)
      setIV(`${col}26`, v(c.homog_acabamentos, 'Semelhante'));        setIV(`${pctCol}26`, pctAcab)
      setIV(`${col}27`, v(c.homog_conservacao, 'Semelhante'));        setIV(`${pctCol}27`, pctConsv)
      setIV(`${col}28`, v(c.homog_caract_gerais, 'Semelhante'));      setIV(`${pctCol}28`, pctCarac)
      setIV(`${col}29`, v(c.homog_classe_energetica, 'Semelhante')); setIV(`${pctCol}29`, pctClass)
      setIV(`${col}30`, v(c.homog_tx_desconto, 'Alinhado com Mercado')); setIV(`${pctCol}30`, pctTx)

      // ÍNDICE DE VENDA HOMOGENEIZADO (linha 31) = índice base × (1 + soma dos 7 ajustes)
      if (baseIndex !== null) {
        const adjustments = [pctLoc, pctArea, pctAcab, pctConsv, pctCarac, pctClass, pctTx]
        const sumAdj = adjustments.reduce((s: number, a) => s + (a ?? 0), 0)
        const homogIndex = baseIndex * (1 + sumAdj)
        setIV(`${col}31`, homogIndex)
        homogIndices.push({ col, pctCol, value: homogIndex })
      }
    })

    // ANÁLISE ESTATÍSTICA — OFERTA HOMOGENEIZADA (linha 38) + SANEAMENTO / Critério de Chauvenet (linhas 41-42)
    if (homogIndices.length >= 2) {
      const values  = homogIndices.map(h => h.value)
      const n       = values.length
      const minV    = Math.min(...values)
      const maxV    = Math.max(...values)
      const avg     = values.reduce((a, b) => a + b, 0) / n
      const med     = median(values)
      const sd      = stdevP(values)

      setIV('H38', minV)
      setIV('L38', maxV)
      setIV('P38', avg)
      setIV('T38', med)
      setIV('X38', sd)

      setIV('F41', n)
      const critical = CHAUVENET_CRITICAL[n]
      if (critical !== undefined) setIV('F42', critical)

      homogIndices.forEach(({ col, value }) => {
        const ratio = sd > 0 ? Math.abs(value - avg) / sd : 0
        setIV(`${col}41`, ratio)
        if (critical !== undefined) {
          setIV(`${col}42`, ratio < critical ? 'AMOSTRA VALIDADA' : 'AMOSTRA REJEITADA')
        }
      })

      // Folha principal, linha 122 "V. Potencial de Mercado" (só no Terreno) — usa a mesma
      // estrutura da linha 116, mas com o €/m² médio homogeneizado (equivalente a 'IV - IV'!P38
      // no template original) em vez de um valor digitado manualmente
      if (isTerreno) {
        const area122 = parseFloat(p.gross_area)
        if (area122 > 0) {
          set('T122', area122)        // T122:X122 — Área Privativa (m2), mesma ABP da linha 116
          set('Y122', avg)            // Y122:AC122 — Valor (€/m2) = média homogeneizada do IV-IV
          set('AD122', Math.round(avg * area122 / 100) * 100) // AD122:AI122 — Valor total
        }
      }
    }
  }

  // 14. CONDICIONALISMOS E ADVERTÊNCIAS (linhas diferentes no template Terreno — não mapeado ainda)
  if (!isTerreno) {
    set('B248', v(p.prev_valuation_conditions))
    set('B254', v(p.cond_observacoes))
    set('B258', v(p.advertencias))
  }


  // TAB IV-IA — preenchida para terreno (Y116 = IV-IA!P38, média homogeneizada da folha IV-IA)
  if (isTerreno && homogIndices.length >= 2) {
    const wsIA = wb.getWorksheet('IV - IA')
    if (wsIA) {
      function setIA(ref: string, val: any) {
        if (val === null || val === undefined || val === '') return
        wsIA.getCell(ref).value = val
      }
      const subjectArea_ia = parseFloat(p.gross_area)
      if (subjectArea_ia > 0) setIA('E13', subjectArea_ia)
      compsToUse.slice(0, 5).forEach((c: any, idx: number) => {
        const col = IV_COLS[idx]
        const price = parseFloat(c.price || 0), area = parseFloat(c.area_m2 || 0)
        setIA(`${col}9`,  v(c.address))
        if (area > 0) setIA(`${col}13`, area)
        if (price > 0) setIA(`${col}14`, price)
        const baseIdx = (price > 0 && area > 0) ? price / area : null
        if (baseIdx) { setIA(`${col}15`, baseIdx); setIA(`${col}21`, baseIdx) }
        setIA(`${col}24`, v(c.homog_localizacao, 'Semelhante'))
        const hEntry = homogIndices[idx]
        if (hEntry) setIA(`${col}31`, hEntry.value)
      })
      const iviaValues = homogIndices.map((h: any) => h.value)
      const iviaAvg = iviaValues.reduce((a: number, b: number) => a + b, 0) / iviaValues.length
      setIA('H38', Math.min(...iviaValues))
      setIA('L38', Math.max(...iviaValues))
      setIA('P38', iviaAvg)
      setIA('T38', median(iviaValues))
      setIA('X38', stdevP(iviaValues))
      const area116_final = parseFloat(p.gross_area)
      if (area116_final > 0 && iviaAvg > 0) {
        set('Y116', iviaAvg)
        set('AD116', Math.round(iviaAvg * area116_final / 100) * 100)
      }
    }
  }

  // IMAGEM DO MAPA
  if (mapImageBlob) {
    const wsm = wb.getWorksheet('RELATÓRIO - PT')
    if (wsm) {
      try {
        const mapBuf = await mapImageBlob.arrayBuffer()
        const mapId  = wb.addImage({ buffer: mapBuf as ArrayBuffer, extension: 'png' })
        const mapRow = isTerreno ? 412 : (isMulti ? 844 : 402)  // linha 413 no terreno, 845 no multi, 403 no standard
        wsm.addImage(mapId, {
          tl:  { col: 1,  row: mapRow } as any,
          br:  { col: 34, row: mapRow + 18 } as any,
          editAs: 'oneCell',
        } as any)
      } catch { /* ignorar erro do mapa */ }
    }
  }

  // FOTOS DO IMÓVEL
  if (photos.length > 0) {
    const wsf = wb.getWorksheet('RELATÓRIO - PT')
    if (wsf) {
      // Template standard: começa linha 347; template multi: começa linha 789; terreno: começa linha 358
      const photoStartRow = isTerreno ? 358 : (isMulti ? 788 : 346)

      const PHOTO_SLOTS = [
        { tl: { col: 1,  row: photoStartRow },      br: { col: 16, row: photoStartRow + 13 } },
        { tl: { col: 17, row: photoStartRow },      br: { col: 35, row: photoStartRow + 13 } },
        { tl: { col: 1,  row: photoStartRow + 13 }, br: { col: 16, row: photoStartRow + 26 } },
        { tl: { col: 17, row: photoStartRow + 13 }, br: { col: 35, row: photoStartRow + 26 } },
        { tl: { col: 1,  row: photoStartRow + 26 }, br: { col: 16, row: photoStartRow + 39 } },
        { tl: { col: 17, row: photoStartRow + 26 }, br: { col: 35, row: photoStartRow + 39 } },
        { tl: { col: 1,  row: photoStartRow + 39 }, br: { col: 16, row: photoStartRow + 52 } },
        { tl: { col: 17, row: photoStartRow + 39 }, br: { col: 35, row: photoStartRow + 52 } },
      ]

      for (let i = 0; i < Math.min(photos.length, 8); i++) {
        const photo = photos[i]
        if (!photo.url) continue
        try {
          const buf = await fetchBuf(photo.url)
          if (!buf) continue
          const ext   = photo.url.toLowerCase().includes('.png') ? 'png' : 'jpeg'
          const imgId = wb.addImage({ buffer: buf as ArrayBuffer, extension: ext })
          const slot  = PHOTO_SLOTS[i]
          wsf.addImage(imgId, {
            tl:     slot.tl as any,
            br:     slot.br as any,
            editAs: 'oneCell',
          } as any)
        } catch { /* ignorar foto com erro */ }
      }
    }
  }

  // Descarregar ficheiro + guardar no Supabase Storage
  const buf  = await wb.xlsx.writeBuffer()


  // ── Custo de Construção — fórmulas automáticas (linhas 148-153, input 140-145)
  const costRows = [
    { c: 148, i: 140 }, { c: 149, i: 141 }, { c: 150, i: 142 },
    { c: 151, i: 143 }, { c: 152, i: 144 }, { c: 153, i: 145 },
  ]
  for (const { c, i } of costRows) {
    setFormula(`K${c}`, `H${c}*H${i}`)
    setFormula(`N${c}`, `H${c}*L${i}`)
    setFormula(`Q${c}`, `N${c}*P${i}`)
    setFormula(`T${c}`, `N${c}*S${i}`)
    setFormula(`X${c}`, `K${c}+N${c}+Q${c}+T${c}`)
    setFormula(`AB${c}`, `W${i}*(N${c}+Q${c}+T${c})`)
    setFormula(`AC${c}`, `X${c}-AB${c}`)
  }


  const SIGNATURE_B64 = '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'

  // ── Assinatura do Perito (coluna AC, linha 324)
  try {
    const sigBytes = Uint8Array.from(atob(SIGNATURE_B64), c => c.charCodeAt(0))
    const sigId = wb.addImage({ buffer: sigBytes.buffer as ArrayBuffer, extension: 'png' })
    ws.addImage(sigId, {
      tl: { col: 28, row: 323 },
      ext: { width: 180, height: 65 }
    })
  } catch(e) { console.warn('Signature image failed:', e) }

  // ── Fix logo Garen ─────────────────────────────────────────────────────────
  // ExcelJS re-codifica imagens ao salvar, corrompendo o logo Garen.
  // Após gerar o buffer, substituímos image1.png pelo logo correcto via JSZip.
  const GAREN_LOGO_B64 = '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'
  let finalBuf: ArrayBuffer = buf as ArrayBuffer
  try {
    const JSZipFix = (await import('jszip')).default
    const zipFix = await JSZipFix.loadAsync(finalBuf)
    if (zipFix.files['xl/media/image1.png']) {
      const logoBytes = Uint8Array.from(atob(GAREN_LOGO_B64), c => c.charCodeAt(0))
      zipFix.file('xl/media/image1.png', logoBytes)
      finalBuf = await zipFix.generateAsync({ type: 'arraybuffer' })
    }
  } catch (e) { console.warn('Logo fix failed:', e) }

  const ref  = v(p.external_ref, v(p.ref, 'imovel')).replace(/[^a-zA-Z0-9_-]/g, '_')
  const date = new Date().toISOString().slice(0, 10)
  const filename = `Relatorio_${ref}_${date}.xlsx`

  // Guarda no bucket reports para acesso online
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
    const storagePath = `${ref}/${filename}`
    await sb.storage.from('reports').upload(storagePath, new Blob([finalBuf as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }), { upsert: true })
    const { data: urlData } = sb.storage.from('reports').getPublicUrl(storagePath)
    if (urlData?.publicUrl) {
      // Guarda URL no imóvel
      try {
        await sb.from('properties').update({ report_url: urlData.publicUrl }).eq('id', p.id)
      } catch {}
      // Abre no Google Sheets para visualização online
      const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(urlData.publicUrl)}`
      window.open(viewerUrl, '_blank')
    }
  } catch { /* continua mesmo se falhar o upload */ }

  saveAs(
    new Blob([finalBuf as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename
  )
}
