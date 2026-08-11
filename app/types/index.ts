export const DiscountTypesEnum = {
  None: 'none',
  Fixed: 'fixed',
  Percent: 'percent',
} as const

export const discountTypes = Object.values(DiscountTypesEnum)

export type DiscountType = (typeof DiscountTypesEnum)[keyof typeof DiscountTypesEnum]

export interface LineItemInput {
  description: string
  quantity: number
  unitPrice: number
  discountType?: DiscountType
  discountValue?: number
  taxPercent?: number
}

export interface CalculatedLineItem extends LineItemInput {
  subtotal: number
  discountAmount: number
  afterDiscount: number
  taxAmount: number
  lineTotal: number
}

export interface DocumentTotals {
  subtotal: number
  totalDiscount: number
  totalTax: number
  grandTotal: number
  lineItems: CalculatedLineItem[]
}

// Document Types

export const DocumentStatusesEnum = {
  Draft: 'draft',
  Finalized: 'finalized',
} as const

export const documentStatuses = Object.values(DocumentStatusesEnum)

export type DocumentStatus = (typeof DocumentStatusesEnum)[keyof typeof DocumentStatusesEnum]
