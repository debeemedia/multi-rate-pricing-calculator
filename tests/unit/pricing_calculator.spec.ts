import { test } from '@japa/runner'
import { CalculationError, PricingCalculator } from '#services/pricing_calculator_service'
import { DiscountTypesEnum } from '../../app/types/index.ts'

test.group('PricingCalculator', () => {
  test('should match the expected calculation results after discount and tax are applied', ({
    assert,
  }) => {
    const sampleInput = [
      {
        description: 'Widget A',
        quantity: 2,
        unitPrice: 100.0,
        discountType: DiscountTypesEnum.Percent,
        discountValue: 10,
        taxPercent: 5,
      },
      {
        description: 'Widget B',
        quantity: 1,
        unitPrice: 50.0,
        discountType: DiscountTypesEnum.None,
        discountValue: 0,
        taxPercent: 5,
      },
      {
        description: 'Service fee',
        quantity: 1,
        unitPrice: 200.0,
        discountType: DiscountTypesEnum.Fixed,
        discountValue: 20,
        taxPercent: 0,
      },
    ]

    const result = PricingCalculator.calculateDocument(sampleInput)

    // Line Item 1: Widget A
    assert.equal(result.lineItems[0].subtotal, 200.0)
    assert.equal(result.lineItems[0].discountAmount, 20.0)
    assert.equal(result.lineItems[0].afterDiscount, 180.0)
    assert.equal(result.lineItems[0].taxAmount, 9.0)
    assert.equal(result.lineItems[0].lineTotal, 189.0)

    // Line Item 2: Widget B
    assert.equal(result.lineItems[1].subtotal, 50.0)
    assert.equal(result.lineItems[1].discountAmount, 0.0)
    assert.equal(result.lineItems[1].afterDiscount, 50.0)
    assert.equal(result.lineItems[1].taxAmount, 2.5)
    assert.equal(result.lineItems[1].lineTotal, 52.5)

    // Line Item 3: Service fee
    assert.equal(result.lineItems[2].subtotal, 200.0)
    assert.equal(result.lineItems[2].discountAmount, 20.0)
    assert.equal(result.lineItems[2].afterDiscount, 180.0)
    assert.equal(result.lineItems[2].taxAmount, 0.0)
    assert.equal(result.lineItems[2].lineTotal, 180.0)

    // Document Expected Totals
    assert.equal(result.subtotal, 450.0)
    assert.equal(result.totalDiscount, 40.0)
    assert.equal(result.totalTax, 11.5)
    assert.equal(result.grandTotal, 421.5)
  })

  test('should throw CalculationError when fixed discount exceeds line subtotal', ({ assert }) => {
    const item = {
      description: 'Over-discounted Item',
      quantity: 1,
      unitPrice: 50,
      discountType: DiscountTypesEnum.Fixed,
      discountValue: 100, // Exceeds 50 subtotal
      taxPercent: 0,
    }
    assert.throws(
      () => PricingCalculator.calculateLine(item),
      CalculationError,
      `Fixed discount ($${item.discountValue.toFixed(2)}) cannot exceed line subtotal ($${(item.quantity * item.unitPrice).toFixed(2)}) for line: "${item.description}"`
    )
  }).tags(['pricing_calculator'])

  test('should throw CalculationError for invalid quantity or price', ({ assert }) => {
    const badQuantityItemDescription = 'Bad Quantity Item'
    assert.throws(
      () =>
        PricingCalculator.calculateLine({
          description: badQuantityItemDescription,
          quantity: 0,
          unitPrice: 100,
        }),
      CalculationError,
      `Quantity must be at least 1 for line: "${badQuantityItemDescription}"`
    )

    const negativeItemDescription = 'Negative Price Item'
    assert.throws(
      () =>
        PricingCalculator.calculateLine({
          description: negativeItemDescription,
          quantity: 1,
          unitPrice: -10,
        }),
      CalculationError,
      `Unit price cannot be negative for line: "${negativeItemDescription}"`
    )
  }).tags(['pricing_calculator'])

  test('should throw CalculationError when tax percentage value is invalid', ({ assert }) => {
    const description = 'Invalid Tax Item'
    assert.throws(
      () =>
        PricingCalculator.calculateLine({
          description,
          quantity: 1,
          unitPrice: 50,
          discountType: DiscountTypesEnum.Percent,
          discountValue: 100,
          taxPercent: 200,
        }),
      CalculationError,
      `Tax percent must be between 0 and 100 for line: "${description}"`
    )
  }).tags(['pricing_calculator'])

  test('shold throw CalculationError when discount percentage value is invalid', ({ assert }) => {
    const description = 'Invalid Discount Item'
    assert.throws(
      () =>
        PricingCalculator.calculateLine({
          description,
          quantity: 1,
          unitPrice: 50,
          discountType: DiscountTypesEnum.Percent,
          discountValue: 200,
          taxPercent: 10,
        }),
      CalculationError,
      `Discount percent must be between 0 and 100 for line: "${description}"`
    )
  }).tags(['pricing_calculator'])

  test('should throw CalculationError when no line item is provided', ({ assert }) => {
    assert.throws(
      () => PricingCalculator.calculateDocument([]),
      CalculationError,
      'Document must contain at least one line item.'
    )
  }).tags(['pricing_calculator'])
})
