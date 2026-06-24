// API INE — dados de transacções imobiliárias
// Endpoint público, sem autenticação necessária

export interface IneTransaction {
  periodo: string
  concelho: string
  tipologia: string
  valor_mediano: number
  n_transacoes: number
}

// Indicador INE: "Índice de Preços da Habitação" e "Valor mediano das vendas"
// Base: https://www.ine.pt/ine/json_indicador/
export async function fetchIneMedianPrices(concelho: string): Promise<IneTransaction[]> {
  // Indicador 0011254 = Valor mediano das vendas de alojamentos familiares (€/m²)
  const url = `https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0011254&lang=PT`
  try {
    const res = await fetch(url)
    const data = await res.json()
    // Filtrar por concelho
    const rows = data?.DataObj?.filter((r: any) =>
      r.geocod && r.dim_3 && String(r.geocod_label || '').toLowerCase().includes(concelho.toLowerCase())
    ) ?? []
    return rows.slice(0, 8).map((r: any) => ({
      periodo:       r.periodo || '',
      concelho:      r.geocod_label || concelho,
      tipologia:     r.dim_3_label || 'Habitação',
      valor_mediano: parseFloat(r.valor) || 0,
      n_transacoes:  parseInt(r.dim_4) || 0,
    }))
  } catch { return [] }
}
