import {
  CalculatedLineItem,
  DiscountTypesEnum,
  DocumentTotals,
  LineItemInput,
} from '../types/index.ts'

export class CalculationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CalculationError'
  }
}

export class PricingCalculator {
  public static toMinorUnit(amountInMainUnit: number): number {
    return Math.round(amountInMainUnit * 100)
  }

  public static toMainUnit(amountInMinorUnit: number | bigint): number {
    if (typeof amountInMinorUnit === 'bigint') {
      return Number(amountInMinorUnit) / 100
    }
    return amountInMinorUnit / 100
  }

  public static calculateLine(item: LineItemInput): CalculatedLineItem {
    if (item.quantity < 1) {
      throw new CalculationError(`Quantity must be at least 1 for line: "${item.description}"`)
    }
    if (item.unitPrice < 0) {
      throw new CalculationError(`Unit price cannot be negative for line: "${item.description}"`)
    }

    const discountType = item.discountType || DiscountTypesEnum.None
    const discountVal = item.discountValue || 0
    const taxPercent = item.taxPercent || 0

    if (discountType === DiscountTypesEnum.None) {
      if (discountVal !== 0) {
        throw new CalculationError(
          `Discount value must be zero when discount type is "${discountType}" for line: "${item.description}"`
        )
      }
    } else {
      if (discountVal <= 0) {
        throw new CalculationError(
          `Discount value must be greater than zero when discount type is "${discountType}" for line: "${item.description}"`
        )
      }
    }

    if (taxPercent < 0 || taxPercent > 100) {
      throw new CalculationError(
        `Tax percent must be between 0 and 100 for line: "${item.description}"`
      )
    }

    const qty = item.quantity
    const unitPriceInMinorUnit = this.toMinorUnit(item.unitPrice)
    const subtotalInMinorUnit = qty * unitPriceInMinorUnit

    let discountInMinorUnit = 0
    if (discountType === 'percent') {
      if (discountVal < 0 || discountVal > 100) {
        throw new CalculationError(
          `Discount percent must be between 0 and 100 for line: "${item.description}"`
        )
      }
      discountInMinorUnit = Math.round(subtotalInMinorUnit * (discountVal / 100))
    } else if (discountType === 'fixed') {
      const fixedDiscountInMinorUnit = this.toMinorUnit(discountVal)
      if (fixedDiscountInMinorUnit > subtotalInMinorUnit) {
        throw new CalculationError(
          `Fixed discount ($${discountVal.toFixed(2)}) cannot exceed line subtotal ($${this.toMainUnit(subtotalInMinorUnit).toFixed(2)}) for line: "${item.description}"`
        )
      }
      discountInMinorUnit = fixedDiscountInMinorUnit
    }

    const afterDiscountInMinorUnit = subtotalInMinorUnit - discountInMinorUnit
    const taxAmountInMinorUnit = Math.round(afterDiscountInMinorUnit * (taxPercent / 100))
    const lineTotalInMinorUnit = afterDiscountInMinorUnit + taxAmountInMinorUnit

    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountType,
      discountValue: discountVal,
      taxPercent,
      subtotal: this.toMainUnit(subtotalInMinorUnit),
      discountAmount: this.toMainUnit(discountInMinorUnit),
      afterDiscount: this.toMainUnit(afterDiscountInMinorUnit),
      taxAmount: this.toMainUnit(taxAmountInMinorUnit),
      lineTotal: this.toMainUnit(lineTotalInMinorUnit),
    }
  }

  public static calculateDocument(items: LineItemInput[]): DocumentTotals {
    if (!items || items.length === 0) {
      return {
        subtotal: 0,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 0,
        lineItems: [],
      }
    }

    const calculatedLines = items.map((item) => this.calculateLine(item))

    const subtotalInMinorUnit = calculatedLines.reduce(
      (acc, line) => acc + this.toMinorUnit(line.subtotal),
      0
    )
    const totalDiscountInMinorUnit = calculatedLines.reduce(
      (acc, line) => acc + this.toMinorUnit(line.discountAmount),
      0
    )
    const totalTaxInMinorUnit = calculatedLines.reduce(
      (acc, line) => acc + this.toMinorUnit(line.taxAmount),
      0
    )
    const grandTotalInMinorUnit = calculatedLines.reduce(
      (acc, line) => acc + this.toMinorUnit(line.lineTotal),
      0
    )

    return {
      subtotal: this.toMainUnit(subtotalInMinorUnit),
      totalDiscount: this.toMainUnit(totalDiscountInMinorUnit),
      totalTax: this.toMainUnit(totalTaxInMinorUnit),
      grandTotal: this.toMainUnit(grandTotalInMinorUnit),
      lineItems: calculatedLines,
    }
  }
}
