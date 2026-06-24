export type VisitStatus = 'pending' | 'scheduled' | 'visited' | 'report_done'
export type BillingStatus = 'no_po' | 'awaiting_po' | 'po_received' | 'invoice_pending' | 'invoice_issued' | 'paid'

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  pending: 'Por visitar', scheduled: 'Agendado', visited: 'Visitado', report_done: 'Report OK',
}
export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  no_po: 'Sem PO', awaiting_po: 'A aguardar PO', po_received: 'PO recebida',
  invoice_pending: 'Fatura por emitir', invoice_issued: 'Fatura emitida', paid: 'Pago',
}

export interface Property {
  id: string; portfolio_id: string; client_id: string
  ref: string; external_ref?: string
  address?: string; parish?: string; municipality?: string
  district?: string; postal_code?: string
  property_type?: string; typology?: string
  gross_area?: number; useful_area?: number; land_area?: number
  floor?: number; year_built?: number; condition?: string
  datatape_data: Record<string, any>
  visit_status: VisitStatus; visit_date?: string; visit_notes?: string
  billing_status: BillingStatus; fee_amount?: number
  po_number?: string; po_date?: string
  invoice_number?: string; invoice_date?: string; payment_date?: string
  report_path?: string; notes?: string; created_at: string; updated_at: string
}

export interface Photo {
  id: string; property_id: string; storage_path: string
  original_name?: string; size_bytes?: number
  width?: number; height?: number
  taken_at?: string; sort_order: number; caption?: string; created_at: string
}
