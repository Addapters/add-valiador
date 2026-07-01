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
    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(buf)
      const sheetFiles = Object.keys(zip.files).filter(f => /xl\/worksheets\/sheet\d+\.xml/.test(f))
      for (const sf of sheetFiles) {
        let xml: string = await zip.files[sf].async('string')
        // ORDEM CRÍTICA: remover primeiro as tags <f .../> auto-fechadas (usadas em
        // fórmulas partilhadas, ex: <f t="shared" si="2"/>). Se a regex de tags com
        // conteúdo correr primeiro, ao encontrar uma <f .../> auto-fechada ela procura
        // o próximo </f> — que pode estar várias células/linhas depois — e apaga tudo
        // pelo meio (linhas, valores, fronteiras de célula). Foi isto que corrompeu o
        // relatório de Terreno (folha "VM - DCF" tem fórmulas partilhadas em quantidade).
        xml = xml.replace(/<f[^>]*\/>/g, '')
        xml = xml.replace(/<f[^>]*>[\s\S]*?<\/f>/g, '')
        // Remove valores de erro em cache deixados por fórmulas removidas
        // (#DIV/0!, #REF!, etc.) — ao gravar, o ExcelJS interpretava mal estas células
        // e chegava a escrever literalmente "NaN" nalgumas, corrompendo o ficheiro.
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
    // AD116 (Valor total) = ROUND(€/m² × Área, -2), tal como a fórmula original do template
    // (em vez de um valor escrito directamente, que podia ficar desalinhado da área/€/m² reais)
    set('D116', v(prop.metodo_comp_descricao))
    const area116 = parseFloat(prop.gross_area)
    if (area116 > 0) set('T116', area116)
    const valorM2_116 = parseFloat(prop.metodo_comp_valor_m2)
    if (valorM2_116 > 0) {
      set('Y116', valorM2_116)                                          // Y116:AC116
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

  // 1. CABEÇALHO — O3=F8, V3=F10, F9=EDATE(F8,6), X11=F10
  //    Confirmado igual nos 4 relatórios fechados. Escrevemos aqui porque não dependem de fills.
  const reportRef  = v(p.nr_relatorio, v(p.external_ref, v(p.ref, '')))
  const reportDateStr = (p.data_relatorio || p.data_conclusao || new Date().toISOString()).slice(0, 10)
  set('O3',  fmtDate(reportDateStr))  // Data no cabeçalho (= F8)
  set('V3',  reportRef)               // Nº Relatório no cabeçalho (= F10)
  set('X11', reportRef)               // Ref.ª Avaliador (= F10)
  try {
    // F9 como objecto Date para que o Excel o formate como data (EDATE(F8,6))
    set('F9', addMonths(reportDateStr, 6))
  } catch { /* ignorar datas inválidas */ }

  // 1. IDENTIFICAÇÃO
  set('F8',  fmtDate(p.data_relatorio || new Date().toISOString()))
  set('F10', v(p.nr_relatorio, v(p.external_ref, v(p.ref))))  // Relatório N.º = Referência
  set('X9',  v(p.tipo_servico, 'Avaliação'))
  set('X10', v(p.finalidade, 'Adjudicado sem visita interior'))
  // Ref. Avaliador (X11) — não preencher por agora
  if (!isTerreno) set('D101', v(p.banco))   // Banco (célula não existe no template Terreno)

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
    const homogIndices: { col: string; pctCol: string; value: number }[] = []

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
  if (!isTerreno) set('B248', v(p.prev_valuation_conditions, 'Nenhum'))

  // ─── FÓRMULAS CALCULADAS — correm DEPOIS de fillTerreno/fillBlock para ler valores escritos ──
  // Substituem fórmulas removidas por cleanSharedFormulas.
  // Referências de célula confirmadas nos 4 relatórios fechados (002014/002076/002189/002190)
  // e directamente no Template_Terreno.xlsx.

  if (!isTerreno) {
    // VVR STANDARD/MULTI — t=1, i=5%, d=5%, c=6%
    // P297 = ROUND(((1-Z299)*(1-P299))/(1+Z298)^P298,4) — confirmado em 002014
    const vvrCoeff_std = calcVVR(1, 0.05, 0.05, 0.06)  // = 0.8505
    set('P297', vvrCoeff_std)
    set('P298', 1)    // t
    set('Z298', 0.05) // i
    set('P299', 0.05) // d
    set('Z299', 0.06) // c

    // Conclusão: J{265+idx} = D{265+idx} × P297, R{265+idx} = D{265+idx}
    // (D265+idx já foi escrito pelo bloco "16. CONCLUSÃO" acima com valor_mercado do utilizador)
    const nBens = allProps.length
    let totalVM = 0, totalVVR = 0, totalSeg = 0
    for (let idx = 0; idx < nBens; idx++) {
      const vm = parseFloat(String(ws.getCell(`D${265 + idx}`).value || 0))
      if (vm > 0) {
        const vvr = Math.round(vm * vvrCoeff_std * 100) / 100
        set(`J${265 + idx}`, vvr)  // VVR = D265+idx × P297
        set(`R${265 + idx}`, vm)   // Seguro = Valor de Mercado
        totalVM  += vm
        totalVVR += vvr
        totalSeg += vm
      }
    }
    // Totais (linha 272 no standard, confirmado pelo STANDARD_BASE_ROWS[23]=285)
    // Nota: no template standard com múltiplos bens a linha de total está em 265+nBens
    // (abaixo do último bem). Escrevemos em D272/J272/R272 que é o que o template usa.
    if (totalVM > 0) {
      set('D272', totalVM)
      set('J272', Math.round(totalVVR * 100) / 100)
      set('R272', totalSeg)
    }
  }

  if (isTerreno) {
    // VVR TERRENO — t=2, d=10%, c=5×1,23%=6,15%, i=5% (default; VM-DCF usa taxa de capitalização)
    // P288 = ROUND(((1-Z290)*(1-P290))/(1+Z289)^P289, 4) — confirmado em Template_Terreno.xlsx
    const vvrCoeff_t = calcVVR(2, 0.05, 0.10, 5 * 0.0123)
    set('P288', vvrCoeff_t)
    set('P289', 2)         // t = 2 anos
    set('Z289', 0.05)      // i = 5% (default)
    set('P290', 0.10)      // d = 10%
    set('Z290', 5 * 0.0123) // c = 5×1,23%

    // J276 = D276 × P288, R276 = D276 (Seguro = Valor de Mercado)
    // D276 foi escrito por fillTerreno a partir de prop.valor_mercado
    const vmTerminado = parseFloat(String(ws.getCell('D276').value || 0))
    if (vmTerminado > 0) {
      set('J276', Math.round(vmTerminado * vvrCoeff_t * 100) / 100)
      set('R276', vmTerminado)
    }

    // J283 = D283 × P288, D286 = D283, J286 = J283 (total = único bem)
    // D283 foi escrito por fillTerreno a partir de prop.valor_mercado_atual (se disponível)
    const vmAtual = parseFloat(String(ws.getCell('D283').value || 0))
      || parseFloat(p.valor_mercado_atual || 0)
    if (vmAtual > 0) {
      set('D283', vmAtual)
      set('J283', Math.round(vmAtual * vvrCoeff_t * 100) / 100)
      set('D286', vmAtual)
      set('J286', Math.round(vmAtual * vvrCoeff_t * 100) / 100)
    }
  }
  // ──────────────────────────────────────────────────────────────────────────────────────────

  // 16. CONCLUSÃO DA AVALIAÇÃO (terreno já preenchido em fillTerreno, linhas 276/283)
  if (!isTerreno) {
    if (p.valor_mercado)            set('D265', Number(p.valor_mercado))
    if (p.valor_venda_rapida)       set('J265', Number(p.valor_venda_rapida))
    if (p.valor_seguro)             set('R265', Number(p.valor_seguro))
    if (p.valor_mercado_atual)      set('D272', Number(p.valor_mercado_atual))
    if (p.valor_venda_rapida_atual) set('J272', Number(p.valor_venda_rapida_atual))
  }

  // 18. CERTIFICAÇÃO E ASSINATURA (terreno já preenchido em fillTerreno, linha 315)
  if (!isTerreno) {
    set('K303',  fmtDate(p.data_pedido_relatorio || p.data_pedido))
    set('O303',  fmtDate(p.data_visita || p.visit_date))
    set('V303',  fmtDate(p.data_conclusao || p.data_relatorio))
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
