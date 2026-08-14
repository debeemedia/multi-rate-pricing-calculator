import { test } from '@japa/runner'
import { CalculationError, PricingCalculator } from '#services/pricing_calculator_service'
import { DiscountTypesEnum } from '#types/index'

test.group('PricingCalculator', () => {
  test('should test the `calculateDocument` method and return the expected calculation results after discount and tax are applied', ({
    assert,
  }) => {
    const sampleInput = [
      {
        description: 'Widget A',
        quantity: 2,
        unitPrice: 100.0,
        discountType: DiscountTypesEnum.Percent,
        discountValueFixed: null,
        discountValuePercent: 10,
        taxPercent: 5,
      },
      {
        description: 'Widget B',
        quantity: 1,
        unitPrice: 50.0,
        discountType: DiscountTypesEnum.None,
        discountValueFixed: null,
        discountValuePercent: null,
        taxPercent: 5,
      },
      {
        description: 'Service fee',
        quantity: 1,
        unitPrice: 200.0,
        discountType: DiscountTypesEnum.Fixed,
        discountValueFixed: 20,
        discountValuePercent: null,
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
  }).tags(['pricing_calculator'])

  test('should test the `calculateDocument` method and return zero totals and an empty lineItems array when no line items are provided', ({
    assert,
  }) => {
    const result = PricingCalculator.calculateDocument([])

    assert.containSubset(result, {
      subtotal: 0,
      totalDiscount: 0,
      totalTax: 0,
      grandTotal: 0,
      lineItems: [],
    })
  }).tags(['pricing_calculator'])

  test('should test the `calculateLine` method and throw CalculationError when fixed discount exceeds line subtotal', ({
    assert,
  }) => {
    const item = {
      description: 'Over-discounted Item',
      quantity: 1,
      unitPrice: 50,
      discountType: DiscountTypesEnum.Fixed,
      discountValueFixed: 100, // Exceeds 50 subtotal
      discountValuePercent: null,
      taxPercent: 0,
    }
    assert.throws(
      () => PricingCalculator.calculateLine(item),
      CalculationError,
      `Fixed discount ($${item.discountValueFixed.toFixed(2)}) cannot exceed line subtotal ($${(item.quantity * item.unitPrice).toFixed(2)}) for line: "${item.description}"`
    )
  }).tags(['pricing_calculator'])

  test('should test the `calculateLine` method and throw CalculationError for invalid quantity or price', ({
    assert,
  }) => {
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

  test('should test the `calculateLine` method and throw CalculationError when tax percentage value is invalid', ({
    assert,
  }) => {
    const description = 'Invalid Tax Item'
    assert.throws(
      () =>
        PricingCalculator.calculateLine({
          description,
          quantity: 1,
          unitPrice: 50,
          discountType: DiscountTypesEnum.Percent,
          discountValueFixed: null,
          discountValuePercent: 10,
          taxPercent: 200,
        }),
      CalculationError,
      `Tax percent must be between 0 and 100 for line: "${description}"`
    )
  }).tags(['pricing_calculator'])

  test('should test the `calculateLine` method and throw CalculationError when discount type is "none" but discount values are provided', ({
    assert,
  }) => {
    const description = 'Invalid Discount Values For None'
    assert.throws(
      () =>
        PricingCalculator.calculateLine({
          description,
          quantity: 1,
          unitPrice: 50,
          discountType: DiscountTypesEnum.None,
          discountValueFixed: 10,
          discountValuePercent: null,
          taxPercent: 10,
        }),
      CalculationError,
      `Both discount fields must be null when discount type is "none" for line: "${description}"`
    )
  }).tags(['pricing_calculator'])

  test('should test the `calculateLine` method and throw CalculationError when discount type is "fixed" but value is missing or <= 0', ({
    assert,
  }) => {
    const description = 'Invalid Fixed Discount'
    assert.throws(
      () =>
        PricingCalculator.calculateLine({
          description,
          quantity: 1,
          unitPrice: 50,
          discountType: DiscountTypesEnum.Fixed,
          discountValueFixed: 0,
          discountValuePercent: null,
          taxPercent: 0,
        }),
      CalculationError,
      `Fixed discount value must be provided and greater than 0 when discount type is "fixed" for line: "${description}"`
    )
  }).tags(['pricing_calculator'])

  test('should test the `calculateLine` method and throw CalculationError when discount type is "fixed" but percent value is also provided', ({
    assert,
  }) => {
    const description = 'Conflicting Discount Fields'
    assert.throws(
      () =>
        PricingCalculator.calculateLine({
          description,
          quantity: 1,
          unitPrice: 50,
          discountType: DiscountTypesEnum.Fixed,
          discountValueFixed: 10,
          discountValuePercent: 5,
          taxPercent: 0,
        }),
      CalculationError,
      `Percentage discount value must be null when discount type is "fixed" for line: "${description}"`
    )
  }).tags(['pricing_calculator'])

  test('should test the `calculateLine` method and throw CalculationError when discount type is "percent" but value is invalid or <= 0', ({
    assert,
  }) => {
    const description = 'Invalid Percent Discount'
    assert.throws(
      () =>
        PricingCalculator.calculateLine({
          description,
          quantity: 1,
          unitPrice: 50,
          discountType: DiscountTypesEnum.Percent,
          discountValueFixed: null,
          discountValuePercent: 0,
          taxPercent: 0,
        }),
      CalculationError,
      `Percentage discount value must be greater than 0 and at most 100 when discount type is "percent" for line: "${description}"`
    )

    assert.throws(
      () =>
        PricingCalculator.calculateLine({
          description,
          quantity: 1,
          unitPrice: 50,
          discountType: DiscountTypesEnum.Percent,
          discountValueFixed: null,
          discountValuePercent: 120,
          taxPercent: 0,
        }),
      CalculationError,
      `Percentage discount value must be greater than 0 and at most 100 when discount type is "percent" for line: "${description}"`
    )
  }).tags(['pricing_calculator'])

  test('should test the `calculateLine` method and throw CalculationError when discount type is "percent" but fixed value is also provided', ({
    assert,
  }) => {
    const description = 'Conflicting Discount Fields'
    assert.throws(
      () =>
        PricingCalculator.calculateLine({
          description,
          quantity: 1,
          unitPrice: 50,
          discountType: DiscountTypesEnum.Percent,
          discountValueFixed: 10,
          discountValuePercent: 10,
          taxPercent: 0,
        }),
      CalculationError,
      `Fixed discount value must be null when discount type is "percent" for line: "${description}"`
    )
  }).tags(['pricing_calculator'])
})
