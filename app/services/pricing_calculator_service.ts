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
    const quantity = Number(item.quantity)
    const unitPrice = Number(item.unitPrice)
    const taxPercent = Number(item.taxPercent || 0)
    const discountType = item.discountType || DiscountTypesEnum.None

    const fixedVal =
      item.discountValueFixed !== null && item.discountValueFixed !== undefined
        ? Number(item.discountValueFixed)
        : null

    const percentVal =
      item.discountValuePercent !== null && item.discountValuePercent !== undefined
        ? Number(item.discountValuePercent)
        : null

    // 1. Basic Line Validations
    if (quantity < 1) {
      throw new CalculationError(`Quantity must be at least 1 for line: "${item.description}"`)
    }
    if (unitPrice < 0) {
      throw new CalculationError(`Unit price cannot be negative for line: "${item.description}"`)
    }
    if (taxPercent < 0 || taxPercent > 100) {
      throw new CalculationError(
        `Tax percent must be between 0 and 100 for line: "${item.description}"`
      )
    }

    const unitPriceInMinorUnit = this.toMinorUnit(unitPrice)
    const subtotalInMinorUnit = quantity * unitPriceInMinorUnit
    let discountInMinorUnit = 0

    // 2. Strict Discount Type & Mutual Exclusivity Validation
    if (discountType === DiscountTypesEnum.None) {
      if (fixedVal !== null || percentVal !== null) {
        throw new CalculationError(
          `Both discount fields must be null when discount type is "${DiscountTypesEnum.None}" for line: "${item.description}"`
        )
      }
    } else if (discountType === DiscountTypesEnum.Fixed) {
      if (fixedVal === null || fixedVal === undefined || fixedVal <= 0) {
        throw new CalculationError(
          `Fixed discount value must be provided and greater than 0 when discount type is "${DiscountTypesEnum.Fixed}" for line: "${item.description}"`
        )
      }
      if (percentVal !== null) {
        throw new CalculationError(
          `Percentage discount value must be null when discount type is "${DiscountTypesEnum.Fixed}" for line: "${item.description}"`
        )
      }

      const fixedDiscountInMinorUnit = this.toMinorUnit(fixedVal)
      if (fixedDiscountInMinorUnit > subtotalInMinorUnit) {
        throw new CalculationError(
          `Fixed discount ($${fixedVal.toFixed(2)}) cannot exceed line subtotal ($${this.toMainUnit(subtotalInMinorUnit).toFixed(2)}) for line: "${item.description}"`
        )
      }
      discountInMinorUnit = fixedDiscountInMinorUnit
    } else if (discountType === DiscountTypesEnum.Percent) {
      if (percentVal === null || percentVal === undefined || percentVal <= 0 || percentVal > 100) {
        throw new CalculationError(
          `Percentage discount value must be greater than 0 and at most 100 when discount type is "${DiscountTypesEnum.Percent}" for line: "${item.description}"`
        )
      }
      if (fixedVal !== null) {
        throw new CalculationError(
          `Fixed discount value must be null when discount type is "${DiscountTypesEnum.Percent}" for line: "${item.description}"`
        )
      }

      discountInMinorUnit = Math.round(subtotalInMinorUnit * (percentVal / 100))
    }

    // 3. Totals Breakdown
    const afterDiscountInMinorUnit = subtotalInMinorUnit - discountInMinorUnit
    const taxAmountInMinorUnit = Math.round(afterDiscountInMinorUnit * (taxPercent / 100))
    const lineTotalInMinorUnit = afterDiscountInMinorUnit + taxAmountInMinorUnit

    return {
      description: item.description,
      quantity,
      unitPrice,
      discountType,
      discountValueFixed: fixedVal,
      discountValuePercent: percentVal,
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
