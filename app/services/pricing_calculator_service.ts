import { CalculatedLineItem, DocumentTotals, LineItemInput } from '../types/index.ts'

export class CalculationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CalculationError'
  }
}

export class PricingCalculator {
  private static toCents(dollars: number): number {
    return Math.round(dollars * 100)
  }

  private static toDollars(cents: number): number {
    return cents / 100
  }

  public static calculateLine(item: LineItemInput): CalculatedLineItem {
    if (item.quantity < 1) {
      throw new CalculationError(`Quantity must be at least 1 for line: "${item.description}"`)
    }
    if (item.unitPrice < 0) {
      throw new CalculationError(`Unit price cannot be negative for line: "${item.description}"`)
    }

    const discountType = item.discountType || 'none'
    const discountVal = item.discountValue || 0
    const taxPercent = item.taxPercent || 0

    if (taxPercent < 0 || taxPercent > 100) {
      throw new CalculationError(
        `Tax percent must be between 0 and 100 for line: "${item.description}"`
      )
    }

    const qty = item.quantity
    const unitPriceCents = this.toCents(item.unitPrice)
    const subtotalCents = qty * unitPriceCents

    let discountCents = 0
    if (discountType === 'percent') {
      if (discountVal < 0 || discountVal > 100) {
        throw new CalculationError(
          `Discount percent must be between 0 and 100 for line: "${item.description}"`
        )
      }
      discountCents = Math.round(subtotalCents * (discountVal / 100))
    } else if (discountType === 'fixed') {
      const fixedDiscountCents = this.toCents(discountVal)
      if (fixedDiscountCents > subtotalCents) {
        throw new CalculationError(
          `Fixed discount ($${discountVal.toFixed(2)}) cannot exceed line subtotal ($${this.toDollars(subtotalCents).toFixed(2)}) for line: "${item.description}"`
        )
      }
      discountCents = fixedDiscountCents
    }

    const afterDiscountCents = subtotalCents - discountCents
    const taxAmountCents = Math.round(afterDiscountCents * (taxPercent / 100))
    const lineTotalCents = afterDiscountCents + taxAmountCents

    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountType,
      discountValue: discountVal,
      taxPercent,
      subtotal: this.toDollars(subtotalCents),
      discountAmount: this.toDollars(discountCents),
      afterDiscount: this.toDollars(afterDiscountCents),
      taxAmount: this.toDollars(taxAmountCents),
      lineTotal: this.toDollars(lineTotalCents),
    }
  }

  public static calculateDocument(items: LineItemInput[]): DocumentTotals {
    //  if (!items || items.length === 0) {
    //   return {
    //     subtotal: 0,
    //     totalDiscount: 0,
    //     totalTax: 0,
    //     grandTotal: 0,
    //     lineItems: [],
    //   }
    // }

    // Reject empty or missing line item arrays immediately
    if (!items || !items.length) {
      throw new CalculationError('Document must contain at least one line item.')
    }

    const calculatedLines = items.map((item) => this.calculateLine(item))

    const subtotalCents = calculatedLines.reduce(
      (acc, line) => acc + this.toCents(line.subtotal),
      0
    )
    const totalDiscountCents = calculatedLines.reduce(
      (acc, line) => acc + this.toCents(line.discountAmount),
      0
    )
    const totalTaxCents = calculatedLines.reduce(
      (acc, line) => acc + this.toCents(line.taxAmount),
      0
    )
    const grandTotalCents = calculatedLines.reduce(
      (acc, line) => acc + this.toCents(line.lineTotal),
      0
    )

    return {
      subtotal: this.toDollars(subtotalCents),
      totalDiscount: this.toDollars(totalDiscountCents),
      totalTax: this.toDollars(totalTaxCents),
      grandTotal: this.toDollars(grandTotalCents),
      lineItems: calculatedLines,
    }
  }
}
