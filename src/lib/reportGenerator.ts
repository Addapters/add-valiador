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
    'TERRENO FINCA RUSTICA':       'Terreno rústico',
    'TERRENO FINCA RÚSTICA':       'Terreno rústico',
    'TERRENO FINCA URBANA':        'Terreno urbano',
    'SOLAR':                       'Terreno urbano',
    'FINCA RUSTICA':               'Propriedade rústica',
    'FINCA RÚSTICA':               'Propriedade rústica',
    'EDIFICIO':                    'Edifício',
    'CHALET':                      'Moradia',
    'CHALET ADOSADO':              'Moradia em banda',
    'CHALET PAREADO':              'Moradia geminada',
    'DUPLEX':                      'Duplex',
    'ATICO':                       'Cobertura',
    'ÁTICO':                       'Cobertura',
    'ESTUDIO':                     'Estúdio',
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

  // Pré-processa para remover shared formulas que o ExcelJS não suporta
  async function cleanSharedFormulas(buf: ArrayBuffer): Promise<ArrayBuffer> {
    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(buf)
      const sheetFiles = Object.keys(zip.files).filter(f => /xl\/worksheets\/sheet\d+\.xml/.test(f))
      for (const sf of sheetFiles) {
        let xml: string = await zip.files[sf].async('string')
        // Master shared formula: <f t="shared" ref="A1:A10" si="0">FORMULA</f> → <f>FORMULA</f>
        xml = xml.replace(/<f\s[^>]*t="shared"[^>]*ref="[^"]*"[^>]*>([^<]*)<\/f>/g, '<f>$1</f>')
        xml = xml.replace(/<f\s[^>]*ref="[^"]*"[^>]*t="shared"[^>]*>([^<]*)<\/f>/g, '<f>$1</f>')
        // Clone shared formula (sem conteúdo) → remove
        xml = xml.replace(/<f\s[^>]*t="shared"[^>]*\/>/g, '')
        xml = xml.replace(/<f\s[^>]*si="\d+"[^>]*\/>/g, '')
        zip.file(sf, xml)
      }
      return await zip.generateAsync({ type: 'arraybuffer' })
    } catch {
      return buf
    }
  }

  const cleanBuf = await cleanSharedFormulas(tmplBuf as ArrayBuffer)
  await wb.xlsx.load(cleanBuf)

  const ws = wb.getWorksheet('RELATÓRIO - PT')
  if (!ws) throw new Error('Folha "RELATÓRIO - PT" não encontrada no modelo.')

  // Detecta se é template multi (4+ bens) pela URL
  const isMulti = templateUrl.includes('multiplos') || templateUrl.includes('multi')

  // Todos os imóveis a preencher
  const maxProps = isMulti ? 18 : 3
  const allProps = [property, ...siblings].slice(0, maxProps)

  const p = property

  function set(ref: string, val: any) {
    if (val === null || val === undefined || val === '') return
    ws.getCell(ref).value = val
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

  // 1. IDENTIFICAÇÃO
  set('F8',  fmtDate(p.data_relatorio || new Date().toISOString()))
  set('F10', v(p.nr_relatorio, v(p.external_ref, v(p.ref))))  // Relatório N.º = Referência
  set('X9',  v(p.tipo_servico, 'Avaliação'))
  set('X10', v(p.finalidade, 'Adjudicado sem visita interior'))
  // Ref. Avaliador (X11) — não preencher por agora
  set('D101', v(p.banco))                    // Banco

  // Id e IdRel — removido mapeamento automático (não preencher estas células)

  // Preenche blocos por imóvel (1, 2 ou 3 no standard; 1-18 no multi)
  allProps.forEach((prop, idx) => fillBlock(idx, prop))

  // 3. DESCRIÇÃO DO IMÓVEL — apenas no template standard (no multi colidem com linhas dos bens)
  if (!isMulti) {
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

    // 6. ÁREAS
    const areaVal = p.area_considerada || p.area_m2 || p.gross_area
    set('D105', tr(v(p.composicao_imovel, v(p.typology))))
    set('L105', fmtArea(p.land_area))
    set('Q105', fmtArea(areaVal))
    set('T105', fmtArea(p.area_annex_m2))
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

  // TAB IV-IV — 5 comparáveis seleccionados
  const IV_COLS = ['H', 'L', 'P', 'T', 'X']
  const wsIV = wb.getWorksheet('IV - IV')
  if (wsIV) {
    function setIV(ref: string, val: any) {
      if (val === null || val === undefined || val === '') return
      wsIV.getCell(ref).value = val
    }

    compsToUse.slice(0, 5).forEach((c: any, idx: number) => {
      const col      = IV_COLS[idx]
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
      setIV(`${col}13`, fmtArea(c.area_m2))     // Área
      if (price > 0) setIV(`${col}14`, price)    // Asking Price
      setIV(`${col}22`, descricao)               // Descrição
      setIV(`${col}34`, v(c.url))                // Fonte
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

  // IMAGEM DO MAPA
  if (mapImageBlob) {
    const wsm = wb.getWorksheet('RELATÓRIO - PT')
    if (wsm) {
      try {
        const mapBuf = await mapImageBlob.arrayBuffer()
        const mapId  = wb.addImage({ buffer: mapBuf as ArrayBuffer, extension: 'png' })
        const mapRow = isMulti ? 844 : 402  // linha 845 no multi, 403 no standard
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
      // Template standard: começa linha 347; template multi: começa linha 789
      const photoStartRow = isMulti ? 788 : 346

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
    await sb.storage.from('reports').upload(storagePath, new Blob([buf as BlobPart], {
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
    new Blob([buf as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename
  )
}
