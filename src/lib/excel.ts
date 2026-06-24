import * as XLSX from 'xlsx'
import type { Property, Photo } from '@/types/database'

// ── Photo compression ────────────────────────────────────────
// Compress image to ≤ 1 MB, max 1920px on longest side
export async function compressPhoto(file: File, maxBytes = 1_000_000, maxDim = 1920): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')

      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim }
        else                { width  = Math.round((width  * maxDim) / height); height = maxDim }
      }
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)

      // Try decreasing quality until under maxBytes
      const tryQuality = (quality: number) => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Falha ao comprimir imagem')); return }
          if (blob.size <= maxBytes || quality <= 0.3) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          } else {
            tryQuality(quality - 0.1)
          }
        }, 'image/jpeg', quality)
      }
      tryQuality(0.85)
    }
    img.onerror = reject
    img.src = url
  })
}

// ── Report generation ────────────────────────────────────────
// Generates a structured Excel report.
// When a template is provided (via field_map JSON), it writes into the mapped cells.
// Otherwise, it produces a standard default layout.

export async function generateReport(
  property: Property & { portfolios?: any },
  photos: Photo[],
  templateFieldMap?: Record<string, string> // { "A3": "address", "B5": "gross_area", ... }
) {
  const wb = XLSX.utils.book_new()

  if (templateFieldMap && Object.keys(templateFieldMap).length > 0) {
    await generateFromTemplate(wb, property, templateFieldMap)
  } else {
    generateDefaultReport(wb, property, photos)
  }

  const filename = `${property.ref}_report.xlsx`
  XLSX.writeFile(wb, filename)
}

// ── Default report layout ────────────────────────────────────
function generateDefaultReport(wb: XLSX.WorkBook, property: Property & { portfolios?: any }, photos: Photo[]) {
  // Sheet 1: Identificação
  const identData = [
    ['ADD-VALIADOR — RELATÓRIO DE AVALIAÇÃO'],
    [],
    ['Referência',         property.ref],
    ['Ref. externa',       property.external_ref ?? ''],
    ['Portfólio',          (property as any).portfolios?.name ?? ''],
    [],
    ['LOCALIZAÇÃO'],
    ['Morada',             property.address ?? ''],
    ['Freguesia',          property.parish ?? ''],
    ['Concelho',           property.municipality ?? ''],
    ['Distrito',           property.district ?? ''],
    ['Código postal',      property.postal_code ?? ''],
    [],
    ['CARACTERÍSTICAS'],
    ['Tipo de imóvel',     property.property_type ?? ''],
    ['Tipologia',          property.typology ?? ''],
    ['Área bruta (m²)',    property.gross_area ?? ''],
    ['Área útil (m²)',     property.useful_area ?? ''],
    ['Área terreno (m²)',  property.land_area ?? ''],
    ['Piso',               property.floor ?? ''],
    ['Ano de construção',  property.year_built ?? ''],
    ['Estado',             property.condition ?? ''],
    [],
    ['VISITA'],
    ['Estado visita',      property.visit_status ?? ''],
    ['Data visita',        property.visit_date ?? ''],
    ['Notas',              property.visit_notes ?? ''],
    [],
    ['DADOS ADICIONAIS (data-tape)'],
  ]

  // Append any extra data-tape fields
  if (property.datatape_data && typeof property.datatape_data === 'object') {
    for (const [k, v] of Object.entries(property.datatape_data as Record<string, unknown>)) {
      identData.push([k, String(v ?? '')])
    }
  }

  const wsIdent = XLSX.utils.aoa_to_sheet(identData)
  wsIdent['!cols'] = [{ wch: 28 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsIdent, 'Identificação')

  // Sheet 2: Fotos (list with paths)
  if (photos.length > 0) {
    const photoData = [
      ['Nº', 'Ficheiro', 'Dimensões', 'Tamanho (KB)', 'Data'],
      ...photos.map((p, i) => [
        i + 1,
        p.original_name ?? p.storage_path,
        p.width && p.height ? `${p.width}×${p.height}` : '',
        p.size_bytes ? Math.round(p.size_bytes / 1024) : '',
        p.taken_at ? new Date(p.taken_at).toLocaleDateString('pt-PT') : '',
      ])
    ]
    const wsPhotos = XLSX.utils.aoa_to_sheet(photoData)
    wsPhotos['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsPhotos, 'Fotos')
  }
}

// ── Template-based report ────────────────────────────────────
// field_map format: { "B3": "address", "C5": "gross_area", ... }
async function generateFromTemplate(
  wb: XLSX.WorkBook,
  property: Property,
  fieldMap: Record<string, string>
) {
  const ws: XLSX.WorkSheet = {}

  for (const [cell, field] of Object.entries(fieldMap)) {
    const value = (property as Record<string, any>)[field]
      ?? (property.datatape_data as Record<string, any>)?.[field]
      ?? ''
    ws[cell] = { v: value, t: typeof value === 'number' ? 'n' : 's' }
  }

  // Determine sheet range
  const cellRefs = Object.keys(fieldMap)
  const cols = cellRefs.map(c => XLSX.utils.decode_cell(c).c)
  const rows = cellRefs.map(c => XLSX.utils.decode_cell(c).r)
  ws['!ref'] = XLSX.utils.encode_range(
    { r: Math.min(...rows), c: Math.min(...cols) },
    { r: Math.max(...rows), c: Math.max(...cols) }
  )

  XLSX.utils.book_append_sheet(wb, ws, 'Report')
}
