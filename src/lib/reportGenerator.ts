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

async function fetchBuf(url: string): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return r.arrayBuffer()
  } catch { return null }
}

// Traduz termos em espanhol para português europeu
function traduzTipo(val: any): string {
  if (!val) return ''
  const map: Record<string, string> = {
    // Tipos de imóvel
    'VIVIENDA':              'Habitação',
    'PISO':                  'Apartamento',
    'CASA':                  'Moradia',
    'GARAJE':                'Garagem',
    'TRASTERO':              'Arrumos',
    'LOCAL COMERCIAL':       'Loja Comercial',
    'OFICINA':               'Escritório',
    'NAVE INDUSTRIAL':       'Nave Industrial',
    'TERRENO FINCA RUSTICA': 'Terreno Rústico',
    'TERRENO FINCA URBANA':  'Terreno Urbano',
    'SOLAR':                 'Terreno Urbano',
    'FINCA RUSTICA':         'Propriedade Rústica',
    'EDIFICIO':              'Edifício',
    'CHALET':                'Moradia',
    'DUPLEX':                'Duplex',
    'ATICO':                 'Cobertura',
    'ESTUDIO':               'Estúdio',
    // Finalidades
    'ADJUDICADO CON VISITA INTERIOR':    'Adjudicado com visita interior',
    'ADJUDICADO SIN VISITA INTERIOR':    'Adjudicado sem visita interior',
    // Estados
    'NUEVA CONSTRUCCION':  'Construção Nova',
    'SEGUNDA MANO':        'Usado',
    'EN PROYECTO':         'Em Projecto',
    'EN CONSTRUCCION':     'Em Construção',
    'REHABILITADO':        'Reabilitado',
    // Conservação
    'MUY BUENO':           'Muito Bom',
    'BUENO':               'Bom',
    'NORMAL':              'Normal',
    'DEFICIENTE':          'Deficiente',
    'MUY DEFICIENTE':      'Muito Deficiente',
    'RUINOSO':             'Ruinoso',
    // Ocupação
    'OCUPADO':             'Ocupado',
    'LIBRE':               'Livre',
    'ARRENDADO':           'Arrendado',
    // Mercado
    'POSITIVA':            'Positiva',
    'NEGATIVA':            'Negativa',
    'ESTABLE':             'Estável',
    'EN ALZA':             'Em Alta',
    'EN BAJA':             'Em Baixa',
    // Tipo via
    'CALLE':               'Rua',
    'AVENIDA':             'Avenida',
    'PLAZA':               'Praça',
    'PASEO':               'Passeio',
    'CARRETERA':           'Estrada',
  }
  const upper = String(val).toUpperCase().trim()
  return map[upper] || val
}

// Traduz campos genéricos que possam conter texto em espanhol
function tr(val: any): string {
  if (!val) return ''
  return traduzTipo(val)
}

export async function generateAbancaReport(
  property: any,
  photos: { url: string; slot?: number }[],
  comps: any[],
  templateUrl: string,
  mapImageBlob?: Blob | null
): Promise<void> {
  const tmplBuf = await fetchBuf(templateUrl)
  if (!tmplBuf) throw new Error('Não foi possível carregar o modelo. Verifique a variável VITE_REPORT_TEMPLATE_URL.')

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(tmplBuf)

  const ws = wb.getWorksheet('RELATÓRIO - PT')
  if (!ws) throw new Error('Folha "RELATÓRIO - PT" não encontrada no modelo.')

  const p = property

  function set(ref: string, val: any) {
    if (val === null || val === undefined || val === '') return
    ws.getCell(ref).value = val
  }

  // 1. IDENTIFICAÇÃO
  set('F8',  fmtDate(p.data_relatorio || new Date().toISOString()))
  set('F10', v(p.nr_relatorio, v(p.ref)))
  set('X9',  v(p.tipo_servico, 'Avaliação'))
  set('X10', v(p.finalidade, 'Adjudicado sem visita interior'))
  set('X11', v(p.external_ref, v(p.ref)))   // IdRel = Referência externa
  set('X8',  v(p.id_bien))                   // Id = ID do Bem (id_bien)

  // 2. MORADA
  set('D19',  tr(v(p.tipo_via)))
  set('I19',  v(p.street, v(p.address)))
  set('X19',  v(p.number))
  set('Z19',  v(p.floor_letter))
  set('AB19', v(p.fracao))
  set('AD19', v(p.block))
  set('D25',  v(p.postal_code))
  set('I25',  v(p.district))
  set('P25',  v(p.municipality))
  set('W25',  v(p.parish))
  if (p.longitude) set('D31', p.longitude)
  if (p.latitude)  set('G31', p.latitude)

  // 3. DESCRIÇÃO DO IMÓVEL
  set('D38',  tr(v(p.property_type)))
  set('K38',  tr(v(p.property_subtype)))
  set('U38',  tr(v(p.use_type)))
  set('AD38', tr(v(p.use_subtype)))
  set('D44',  tr(v(p.estado_construcao, v(p.property_state))))
  set('O44',  tr(v(p.destino)))
  set('V44',  tr(v(p.estado_conservacao)))
  set('AC44', tr(v(p.estado_ocupacao)))
  set('D50',  v(p.composicao_imovel, v(p.typology)))
  set('D56',  v(p.id_registo_predial))
  set('D62',  v(p.id_registo_matricial))
  set('G62',  v(p.fracao))
  set('D68',  tr(v(p.tipo_predio)))

  // 4. ENQUADRAMENTO NO MERCADO LOCAL
  set('J75', tr(v(p.caract_mercado)))
  set('J78', tr(v(p.tipo_expectativa_mercado)))
  set('J79', tr(v(p.ocupacao_laboral)))
  set('J80', v(p.populacao_concelho))
  set('J81', tr(v(p.evolucao_mercado, 'Tendencialmente positiva')))

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

  // 6. ÁREAS
  const areaVal = p.area_considerada || p.area_m2 || p.gross_area
  set('D105', v(p.composicao_imovel, v(p.typology)))
  set('L105', fmtArea(p.land_area))
  set('Q105', fmtArea(areaVal))
  set('T105', fmtArea(p.area_annex_m2))

  // 7. ELEMENTOS COMPARÁVEIS (folha principal — 3 primeiros seleccionados)
  // Usa apenas os comparáveis seleccionados (selected=true), ordenados por epm2
  const selectedComps = comps
    .filter((c: any) => c.selected)
    .sort((a: any, b: any) => {
      const epmA = a.price && a.area_m2 ? parseFloat(a.price)/parseFloat(a.area_m2) : 0
      const epmB = b.price && b.area_m2 ? parseFloat(b.price)/parseFloat(b.area_m2) : 0
      return epmA - epmB
    })

  // Se não houver seleccionados, usa todos (compatibilidade)
  const compsToUse = selectedComps.length > 0 ? selectedComps : comps

  compsToUse.slice(0, 3).forEach((c: any, idx: number) => {
    const row  = 116 + idx
    const desc = v(c.notes, `${v(c.portal)} ref.${v(c.listing_ref)}`)
    set(`D${row}`, desc)
    set(`T${row}`, fmtArea(c.area_m2))
    const price = parseFloat(c.price || 0)
    const area  = parseFloat(c.area_m2 || 0)
    if (price > 0 && area > 0) {
      set(`Z${row}`,  Math.round(price / area * 100) / 100)
      set(`AE${row}`, price)
    }
  })

  // TAB IV-IV — 5 comparáveis seleccionados
  // Comp 1: col H, Comp 2: col L, Comp 3: col P, Comp 4: col T, Comp 5: col X
  // (intervalo de 4 colunas entre cada comparável)
  const IV_COLS = ['H', 'L', 'P', 'T', 'X']
  const wsIV = wb.getWorksheet('IV - IV')
  if (wsIV) {
    function setIV(ref: string, val: any) {
      if (val === null || val === undefined || val === '') return
      wsIV.getCell(ref).value = val
    }

    compsToUse.slice(0, 5).forEach((c: any, idx: number) => {
      const col  = IV_COLS[idx]
      const price = parseFloat(c.price || 0)
      const area  = parseFloat(c.area_m2 || 0)
      const epm2  = price > 0 && area > 0 ? Math.round(price / area * 100) / 100 : null

      const noteParts = (c.notes || '').split('|').map((s: string) => s.trim())
      const tipologia = noteParts[0] || ''
      const uso       = noteParts[1] || ''
      const anoEstado = noteParts[2] || ''
      const descricao = noteParts[3] || c.notes || ''

      setIV(`${col}9`,  v(c.address))        // Localização
      setIV(`${col}10`, uso || v(c.portal))   // Uso
      setIV(`${col}11`, tipologia)            // Tipologia
      setIV(`${col}12`, anoEstado)            // Ano/Estado
      setIV(`${col}13`, fmtArea(c.area_m2))  // Área Privativa/Locável
      if (epm2) setIV(`${col}14`, epm2)       // Asking Price (€/m²)
      setIV(`${col}22`, descricao || tipologia) // Descrição Geral
      setIV(`${col}34`, v(c.url))             // Fonte (Link)
    })
  }

  // 14. CONDICIONALISMOS E ADVERTÊNCIAS
  set('B248', v(p.prev_valuation_conditions, 'Nenhum'))

  // 16. CONCLUSÃO DA AVALIAÇÃO
  if (p.valor_mercado)            set('D265', Number(p.valor_mercado))
  if (p.valor_venda_rapida)       set('J265', Number(p.valor_venda_rapida))
  if (p.valor_seguro)             set('R265', Number(p.valor_seguro))
  if (p.valor_mercado_atual)      set('D272', Number(p.valor_mercado_atual))
  if (p.valor_venda_rapida_atual) set('J272', Number(p.valor_venda_rapida_atual))

  // 18. CERTIFICAÇÃO E ASSINATURA
  set('K303',  fmtDate(p.data_pedido_relatorio || p.data_pedido))
  set('O303',  fmtDate(p.data_visita || p.visit_date))
  set('V303',  fmtDate(p.data_conclusao || p.data_relatorio))
  set('AC303', fmtDate(p.prev_valuation_date))
  set('D306',  v(p.perito_avaliador))

  // IMAGEM DO MAPA — B406:AI423 (centrada, sem esticar)
  if (mapImageBlob) {
    const wsm = wb.getWorksheet('RELATÓRIO - PT')
    if (wsm) {
      try {
        const mapBuf = await mapImageBlob.arrayBuffer()
        const mapId  = wb.addImage({ buffer: mapBuf as ArrayBuffer, extension: 'png' })
        // Slot B(col 1) a AI(col 34) = 33 colunas, linhas 406-423 = 18 linhas
        // Usa tl + br para preencher o slot todo mantendo proporção
        wsm.addImage(mapId, {
          tl:  { col: 1,  row: 405 } as any,
          br:  { col: 34, row: 423 } as any,
          editAs: 'oneCell',
        } as any)
      } catch { /* ignorar erro do mapa */ }
    }
  }

  // FOTOS DO IMÓVEL — posições exactas no template (folha RELATÓRIO - PT)
  // Foto 1: B350:Q362  Foto 2: R350:AI362
  // Foto 3: B363:Q375  Foto 4: R363:AI375
  // Foto 5: B376:Q388  Foto 6: R376:AI388
  // Foto 7: B389:Q401  Foto 8: R389:AI401
  // Colunas: B=1, Q=16, R=17, AI=34 (0-indexed: B=1, Q=16, R=17, AI=34)
  if (photos.length > 0) {
    const wsf = wb.getWorksheet('RELATÓRIO - PT')
    if (wsf) {
      // Posições das 8 fotos com tl+br para preencher o slot sem esticar
      // ExcelJS com tl+br preenche o espaço disponível mantendo aspect ratio
      const PHOTO_SLOTS = [
        { tl: { col: 1,  row: 349 }, br: { col: 16, row: 362 } }, // Foto 1 — B350:Q362
        { tl: { col: 17, row: 349 }, br: { col: 35, row: 362 } }, // Foto 2 — R350:AI362
        { tl: { col: 1,  row: 362 }, br: { col: 16, row: 375 } }, // Foto 3 — B363:Q375
        { tl: { col: 17, row: 362 }, br: { col: 35, row: 375 } }, // Foto 4 — R363:AI375
        { tl: { col: 1,  row: 375 }, br: { col: 16, row: 388 } }, // Foto 5 — B376:Q388
        { tl: { col: 17, row: 375 }, br: { col: 35, row: 388 } }, // Foto 6 — R376:AI388
        { tl: { col: 1,  row: 388 }, br: { col: 16, row: 401 } }, // Foto 7 — B389:Q401
        { tl: { col: 17, row: 388 }, br: { col: 35, row: 401 } }, // Foto 8 — R389:AI401
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

  // Descarregar ficheiro
  const buf = await wb.xlsx.writeBuffer()
  const ref  = v(p.external_ref, v(p.ref, 'imovel')).replace(/[^a-zA-Z0-9_-]/g, '_')
  const date = new Date().toISOString().slice(0, 10)
  saveAs(
    new Blob([buf as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Relatorio_${ref}_${date}.xlsx`
  )
}
