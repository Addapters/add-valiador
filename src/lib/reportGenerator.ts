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

// Mapa de traduções ES→PT (nível do módulo, partilhado por traduzTipo e tr)
const TRADUZ_MAP: Record<string, string> = {
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

// Traduz termos em espanhol; se não houver tradução, aplica titleCase
function traduzTipo(val: any): string {
  if (!val) return ''
  const translated = TRADUZ_MAP[String(val).toUpperCase().trim()]
  return translated || titleCase(val)
}

// Traduz termos em espanhol; se não houver tradução, devolve o valor ORIGINAL
// exactamente como está na BD/portal — SEM titleCase, SEM uppercase
function tr(val: any): string {
  if (!val) return ''
  const translated = TRADUZ_MAP[String(val).toUpperCase().trim()]
  return translated || String(val).trim()
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

        // Passo 5 — Safety net: remover QUAISQUER referências shared restantes que o ExcelJS rejeita
        // Cobre self-closing slaves (<f t="shared" si="N"/>) não apanhados pelo regex do passo 2
        xml = xml.replace(/<f\b([^>]*)\s*\/>/g, (m, attrs) => {
          if (!attrs.includes('t="shared"')) return m
          return '' // slave sem fórmula → remover completamente
        })
        // Cobre slaves com tag explícita vazia (<f t="shared" si="N"></f>)
        xml = xml.replace(/<f\b([^>]*)><\/f>/g, (m, attrs) => {
          if (!attrs.includes('t="shared"')) return m
          return ''
        })

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

  // ── Remover fórmulas de referência simples (=+B19, =+I19, ...) que duplicam
  // campos ao longo do documento (ex.: "Travessa" a aparecer em B39).
  // Preserva apenas as fórmulas do cabeçalho: O3 (IF), V3 (=+F10), F8, F9 (EDATE).
  const KEEP_FORMULAS = new Set(['O3', 'V3', 'F8', 'F9'])
  const PURE_REF = /^\+?\$?[A-Z]{1,3}\$?\d{1,4}$/
  ws.eachRow({ includeEmpty: false }, (row: any) => {
    row.eachCell({ includeEmpty: false }, (cell: any) => {
      const cv: any = cell.value
      if (cv && typeof cv === 'object' && cv.formula !== undefined) {
        if (KEEP_FORMULAS.has(cell.address)) return
        const f = String(cv.formula).trim()
        if (PURE_REF.test(f)) cell.value = null
      }
    })
  })

  // Detecta se é template multi (4+ bens) ou terreno (capacidade construtiva) pela URL
  const isMulti   = templateUrl.includes('multiplos') || templateUrl.includes('multi')
  const isTerreno = templateUrl.toLowerCase().includes('terreno')

  // Todos os imóveis a preencher (terreno é sempre 1 bem, sem irmãos)
  const maxProps = isMulti ? 18 : 3
  const allProps = [property, ...siblings].slice(0, maxProps)

  const p = property

  function set(ref: string, val: any) {
    if (val === null || val === undefined || val === '') return
    const cell = ws.getCell(ref)
    cell.value = val
    // O template usa fonte branca (theme=1) na maioria das células de dados.
    // Forçar preto para garantir visibilidade no ficheiro gerado.
    try {
      const f = cell.font || {}
      cell.font = {
        name:      f.name      || 'Arial',
        size:      f.size      || 10,
        bold:      f.bold      || false,
        italic:    f.italic    || false,
        underline: f.underline || false,
        color: { argb: 'FF000000' }
      }
    } catch(_) {}
  }
  function setFormula(ref: string, formula: string) {
    const cell = ws.getCell(ref)
    cell.value = { formula, result: 0 }
    try { cell.font = { name: cell.font?.name || 'Arial', size: cell.font?.size || 10, color: { argb: 'FF000000' } } } catch(_) {}
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
    set(`I${codPostalRow + off}`,  v(prop.district))
    set(`P${codPostalRow + off}`,  v(prop.municipality))
    set(`W${codPostalRow + off}`,  v(prop.parish))

    // Coordenadas
    if (prop.longitude) set(`D${coordRow + off}`, prop.longitude)
    if (prop.latitude)  set(`G${coordRow + off}`, prop.latitude)

    // Campos de descrição por bem (rows 38-98) — usa off para cada imóvel
    if (!isMulti) {
      set(`AF${91 + off}`, v(prop.external_ref))   // Relatório nº
      set(`D${38 + off}`,  tr(v(prop.property_type)))
      set(`K${38 + off}`,  tr(v(prop.property_subtype)))
      set(`U${38 + off}`,  tr(v(prop.use_type)))
      set(`AD${38 + off}`, tr(v(prop.use_subtype)))
      set(`D${44 + off}`,  tr(v(prop.estado_construcao, v(prop.property_state))))
      set(`O${44 + off}`,  tr(v(prop.destino)))
      set(`V${44 + off}`,  tr(v(prop.estado_conservacao)))
      set(`AC${44 + off}`, tr(v(prop.estado_ocupacao)))
      set(`D${50 + off}`,  tr(v(prop.composicao_imovel, v(prop.typology))))
      set(`D${56 + off}`,  v(prop.id_registo_predial))
      set(`D${62 + off}`,  v(prop.id_registo_matricial))
      set(`G${62 + off}`,  v(prop.fracao))
      set(`D${68 + off}`,  tr(v(prop.tipo_predio)))
      if (prop.nr_quartos)         set(`D${86 + off}`, Number(prop.nr_quartos))
      if (prop.nr_inst_sanitarias) set(`G${86 + off}`, Number(prop.nr_inst_sanitarias))
      set(`J${86 + off}`, v(prop.nr_pisos, 1))
      set(`L${86 + off}`, tr(v(prop.qualidade_construcao, 'Média')))
      set(`P${86 + off}`, tr(v(prop.orientacao_solar, 'Não influi no valor')))
      set(`D${92 + off}`, v(prop.nr_certificado_energ))
      set(`J${92 + off}`, v(prop.classe_energetica))
      set(`N${92 + off}`, fmtDate(prop.data_emissao_cert))
      set(`R${92 + off}`, fmtDate(prop.data_validade_cert))
      set(`M${98 + off}`, v(prop.year_built))
      set(`D${98 + off}`, v(prop.ano_licenca_utilizacao))
    }
    // Multi: campos de descrição por bem usando índices da MULTI_BASE_ROWS
    if (isMulti && MULTI_BASE_ROWS.length > 8) {
      const descRow = MULTI_BASE_ROWS[3]
      set(`D${descRow + off}`,   tr(v(prop.property_type)))
      set(`K${descRow + off}`,   tr(v(prop.property_subtype)))
      set(`U${descRow + off}`,   tr(v(prop.use_type)))
      set(`AD${descRow + off}`,  tr(v(prop.use_subtype)))
      const estadoRow = MULTI_BASE_ROWS[4]
      set(`D${estadoRow + off}`,  tr(v(prop.estado_construcao, v(prop.property_state))))
      set(`O${estadoRow + off}`,  tr(v(prop.destino)))
      set(`V${estadoRow + off}`,  tr(v(prop.estado_conservacao)))
      set(`AC${estadoRow + off}`, tr(v(prop.estado_ocupacao)))
      const compRow = MULTI_BASE_ROWS[5]
      set(`D${compRow + off}`,   tr(v(prop.composicao_imovel, v(prop.typology))))
      const regRow = MULTI_BASE_ROWS[6]
      set(`D${regRow + off}`,    v(prop.id_registo_predial))
      const matricRow = MULTI_BASE_ROWS[7]
      set(`D${matricRow + off}`, v(prop.id_registo_matricial))
      set(`G${matricRow + off}`, v(prop.fracao))
      const tipPredRow = MULTI_BASE_ROWS[8]
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

    // 6. ÁREAS (terreno)
    const areaVal = prop.area_considerada || prop.area_m2 || prop.gross_area
    set('D105', fmtArea(areaVal))
    set('L105', fmtArea(prop.land_area))
    set('Q105', fmtArea(prop.gross_area))
    set('T105', fmtArea(prop.area_annex_m2))
  }

  // ─── VALORES DERIVADOS DE FÓRMULAS ─────────────────────────────────────────────────────────
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
  const reportRef = v(p.external_ref, v(p.nr_relatorio, v(p.ref, '')))
  set('F10', reportRef)  // alimenta V3=+F10 se o template tiver essa fórmula
  set('X9',  v(p.tipo_servico, 'Avaliação'))
  set('X10', v(p.finalidade, 'Adjudicado sem visita interior'))
  if (!isTerreno) set('D101', v(p.banco))

  if (isTerreno) {
    fillTerreno(p)
  } else {
    allProps.forEach((prop, idx) => fillBlock(idx, prop))
  }

  // ── SECÇÕES GLOBAIS (correm para todos os templates — standard, multi e terreno) ────────────

  // 7. MÉTODO COMPARATIVO DE MERCADO (tab principal)
  set('D116', v(p.metodo_comp_descricao))
  const area116 = parseFloat(p.metodo_comp_area || p.gross_area || p.area_m2)
  if (area116 > 0) set('T116', area116)
  const valorM2_116 = parseFloat(p.metodo_comp_valor_m2)
  if (valorM2_116 > 0) {
    set('Y116', valorM2_116)
    set('Z116', valorM2_116)
    const totalComp = area116 > 0 ? Math.round(valorM2_116 * area116 / 100) * 100 : null
    if (totalComp) { set('AD116', totalComp); set('AE116', totalComp) }
  }

  // Valor de Renda Efetiva — dados na linha 131 (headers na 130)
  set('D131', v(p.renda_ef_descricao))
  set('P131', fmtArea(p.renda_ef_area))
  if (p.renda_ef_valor_m2) set('T131', Number(p.renda_ef_valor_m2))
  if (p.renda_ef_mensal)   set('X131', Number(p.renda_ef_mensal))
  if (p.renda_ef_taxa)     set('AB131', Number(p.renda_ef_taxa))
  if (p.renda_ef_total)    set('AE131', Number(p.renda_ef_total))

  // Valor de Renda Potencial — dados na linha 138 (headers na 137)
  set('D138', v(p.renda_pot_descricao))
  set('P138', fmtArea(p.renda_pot_area))
  if (p.renda_pot_valor_m2) set('T138', Number(p.renda_pot_valor_m2))
  if (p.renda_pot_mensal)   set('X138', Number(p.renda_pot_mensal))
  if (p.renda_pot_taxa)     set('AB138', Number(p.renda_pot_taxa))
  if (p.renda_pot_total)    set('AE138', Number(p.renda_pot_total))

  // 16. CONCLUSÃO — Valor Terminado: dados linha 265, Total linha 268
  //                 Valor Atual:     dados linha 272, Total linha 275
  if (p.valor_mercado)            { set('D265', Number(p.valor_mercado));            if (!isMulti) set('D268', Number(p.valor_mercado)) }
  if (p.valor_venda_rapida)       { set('J265', Number(p.valor_venda_rapida));       if (!isMulti) set('J268', Number(p.valor_venda_rapida)) }
  if (p.valor_seguro)             { set('R265', Number(p.valor_seguro));             if (!isMulti) set('R268', Number(p.valor_seguro)) }
  if (p.pct_obra)                 set('Y265', Number(p.pct_obra))
  if (p.valor_mercado_atual)      { set('D272', Number(p.valor_mercado_atual));      if (!isMulti) set('D275', Number(p.valor_mercado_atual)) }
  if (p.valor_venda_rapida_atual) { set('J272', Number(p.valor_venda_rapida_atual)); if (!isMulti) set('J275', Number(p.valor_venda_rapida_atual)) }
  if (p.valor_seguro_atual)       { set('R272', Number(p.valor_seguro_atual));       if (!isMulti) set('R275', Number(p.valor_seguro_atual)) }
  if (p.pct_obra_atual)           set('Y272', Number(p.pct_obra_atual))

  // 17. JUSTIFICAÇÃO DA ESCOLHA DOS MÉTODOS — Valor Terminado (M285) e Valor Atual (M291)
  set('M285', v(p.justificacao_metodo))
  set('M291', v(p.justificacao_metodo))
  // Justificação da depreciação (secção 9, label B194 → texto B195)
  set('B195', v(p.justificacao_depreciacao))

  // 18. CERTIFICAÇÃO E ASSINATURA (template real: labels linha 303/305-311, valores 304 e 306-311)
  set('K304',  fmtDate(p.data_pedido_relatorio || p.data_pedido))   // Data do pedido
  set('O304',  fmtDate(p.data_visita || p.visit_date))              // Data de visita
  set('V304',  fmtDate(p.data_conclusao || p.data_relatorio))       // Data de conclusão e entrega
  set('AC304', fmtDate(p.prev_valuation_date))                      // Data de avaliação anterior
  // Empresa de avaliação (F306-F311)
  set('F306', v(p.empresa_nome));  set('F307', v(p.empresa_nif))
  set('F308', v(p.empresa_cmvm)); set('F309', v(p.empresa_apolice))
  set('F310', fmtDate(p.empresa_data_validade)); set('F311', v(p.empresa_seguradora))
  // Perito Avaliador Certificador (R306-R311, R307 = qualificação)
  set('R306', v(p.pac_nome));    set('R307', v(p.pac_ordem, 'Arq.')); set('R308', v(p.pac_cmvm))
  set('R309', v(p.pac_apolice)); set('R310', fmtDate(p.pac_data_validade)); set('R311', v(p.pac_seguradora))
  // Perito Avaliador (AC306-AC311)
  set('AC306', v(p.perito_avaliador)); set('AC307', v(p.perito_ordem, 'Arq.'))
  set('AC308', v(p.perito_cmvm));  set('AC309', v(p.nr_apolice))
  set('AC310', fmtDate(p.data_validade_seguro)); set('AC311', v(p.seguradora))

  // DOCUMENTOS (L235-L241 = esquerda, AC235-AC241 = direita)
  const docPairs: [any, string][] = [
    [(p as any).doc_caderneta_predial,           'L235'],
    [(p as any).doc_certid_o_da_crp,             'L236'],
    [(p as any).doc_contrato_de_arrendamento,    'L237'],
    [(p as any)['doc_alvar__de_loteamento'],      'L238'],
    [(p as any).doc_planta_de_loteamento,        'L239'],
    [(p as any).doc_licen_a_de_constru__o_obras, 'L240'],
    [(p as any).doc_licen_a_de_utiliza__o,       'L241'],
    [(p as any).doc_or_amento_de_obras,          'AC235'],
    [(p as any).doc_mem_ria_descritiva,          'AC236'],
    [(p as any).doc_ficha_t_cnica_habita__o,     'AC237'],
    [(p as any).doc_projeto_aprovado,            'AC238'],
    [(p as any).doc_projeto_n_o_aprovado,        'AC239'],
    [(p as any).doc_certificado_energ_tico,      'AC240'],
    [(p as any).doc_outro,                       'AC241'],
  ]
  for (const [dbVal, ref] of docPairs) {
    set(ref, v(dbVal, 'Não entregue'))
  }

  // 3. ENQUADRAMENTO NO MERCADO LOCAL (global — não varia por bem)
  if (!isMulti && !isTerreno) {
    set('J75', tr(v(p.caract_mercado)))
    set('J78', tr(v(p.tipo_expectativa_mercado)))
    set('J79', tr(v(p.ocupacao_laboral)))
    set('J80', v(p.populacao_concelho))
    set('J81', tr(v(p.evolucao_mercado)))

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
    return HOMOG_PCT_TX[String(label ?? 'Sem Margem Negociação').toUpperCase().trim()]
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

      // Dados exactamente como estão no portal — sem transformação de case
      setIV(`${col}9`,  v(c.address))           // Localização (zona/morada breve)
      setIV(`${col}10`, v(c.uso))               // Uso (exactamente como no portal)
      setIV(`${col}11`, v(c.tipologia))         // Tipologia
      setIV(`${col}12`, v(c.ano_estado))        // Ano/Estado
      if (area > 0) setIV(`${col}13`, area)     // Área
      if (price > 0) setIV(`${col}14`, price)   // Asking Price

      // Índice base (Asking Index)
      const baseIndex = (price > 0 && area > 0) ? price / area : null
      if (baseIndex !== null) setIV(`${col}15`, baseIndex)
      if (baseIndex !== null) setIV(`${col}21`, baseIndex)

      setIV(`${col}22`, v(c.notes || c.address))   // Localização / Descrição Geral
      setIV(`${col}34`, v(c.url))                   // Fonte

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
      setIV(`${col}30`, v(c.homog_tx_desconto, 'Sem Margem Negociação')); setIV(`${pctCol}30`, pctTx)

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

  // ── 9. MÉTODO DO CUSTO DE CONSTRUÇÃO — Estado Terminado ─────────────────────
  // Valores ESTÁTICOS lidos da BD (campos custo_* preenchidos na plataforma,
  // com auto-cálculo no PropertyDetail). Fórmulas com result:0 mostravam 0 no
  // viewer online, e as células de input nunca eram preenchidas — por isso a
  // secção saía vazia. Linha de input: 140. Linha calculada: 148.
  if (!isTerreno) {
    const cNum = (x: any) => { const n = parseFloat(x); return isNaN(n) ? null : n }
    const ctm2  = cNum(p.custo_terreno_m2)
    const ccm2  = cNum(p.custo_construcao_m2)
    const cipct = cNum(p.custos_indiretos_pct)
    const mppct = cNum(p.margem_promotor_pct)
    const dpct  = cNum(p.depreciacao_pct)
    const cArea = cNum(p.custo_area)
    const ctTot = cNum(p.custo_terreno_total)
    const ccTot = cNum(p.custo_construcao_total)
    const bruto = cNum(p.custo_repos_bruto)
    const depr  = cNum(p.depreciacao_valor)
    const liq   = cNum(p.custo_repos_liquido)

    // Linha de input (152, headers na 151): custos unitários e percentagens (fracção)
    if (ctm2  !== null) set('H152', ctm2)
    if (ccm2  !== null) set('L152', ccm2)
    if (cipct !== null) set('P152', cipct / 100)
    if (mppct !== null) set('S152', mppct / 100)
    if (dpct  !== null) set('W152', dpct / 100)

    // Linha calculada (157, headers na 156) + linha Total (160)
    const ci = (ccTot !== null && cipct !== null) ? Math.round(ccTot * cipct / 100) : null
    const mp = (ccTot !== null && mppct !== null) ? Math.round(ccTot * mppct / 100) : null
    if (cArea !== null) set('H157', cArea)
    if (ctTot !== null) { set('K157', ctTot); set('K160', ctTot) }
    if (ccTot !== null) { set('N157', ccTot); set('N160', ccTot) }
    if (ci    !== null) { set('Q157', ci);    set('Q160', ci) }
    if (mp    !== null) { set('T157', mp);    set('T160', mp) }
    if (bruto !== null) { set('X157', bruto); set('X160', bruto) }
    if (depr  !== null) { set('AB157', depr); set('AB160', depr) }
    if (liq   !== null) { set('AF157', liq);  set('AF160', liq) }
  }

  // ── Assinatura do Perito (coluna AC, linha 324)
  const SIGNATURE_B64 = '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'
  try {
    const sigBytes = Uint8Array.from(atob(SIGNATURE_B64), c => c.charCodeAt(0))
    const sigId = wb.addImage({ buffer: sigBytes.buffer as ArrayBuffer, extension: 'png' })
    ws.addImage(sigId, {
      tl: { col: 28, row: 312 },  // coluna AC, linha 313 — ao lado do label 'Assinatura:' (Y313)
      ext: { width: 180, height: 55 }
    })
  } catch(e) { console.warn('Signature image failed:', e) }

  // Descarregar ficheiro + guardar no Supabase Storage
  const buf  = await wb.xlsx.writeBuffer()

  // Nota: o template já contém os logos correctos (image1.png = ABANCA,
  // image3.jpeg = Garen). A substituição antiga de image1.png via JSZip
  // apagava o logo ABANCA — removida.
  const finalBuf: ArrayBuffer = buf as ArrayBuffer

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
