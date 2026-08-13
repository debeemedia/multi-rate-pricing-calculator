// app/helpers/model_helpers.ts
import { ColumnOptions, LucidRow } from '@adonisjs/lucid/types/model'
import { PricingCalculator } from '#services/pricing_calculator_service'
import { DiscountTypesEnum } from '#types/index'
import DocumentLineItem from '#models/document_line_item'

/**
 * Column transformer for standard currency fields (minor <-> main unit)
 */
export const moneyColumnConfig: Pick<ColumnOptions, 'consume' | 'prepare'> = {
  consume: (value: number) => (value ? PricingCalculator.toMainUnit(Number(value)) : 0),
  prepare: (value: number) => (value ? PricingCalculator.toMinorUnit(value) : 0),
}

/**
 * Column transformer for dynamic discount fields (Fixed vs Percent)
 */
export const dynamicDiscountColumnConfig: Pick<ColumnOptions, 'consume' | 'prepare'> = {
  consume: (value: number, _attribute, model: LucidRow) => {
    const numericValue = Number(value || 0)

    return model instanceof DocumentLineItem && model.discountType === DiscountTypesEnum.Fixed
      ? PricingCalculator.toMainUnit(numericValue)
      : numericValue
  },
  prepare: (value: number, _attribute, model: any) => {
    return model instanceof DocumentLineItem && model.discountType === DiscountTypesEnum.Fixed
      ? PricingCalculator.toMinorUnit(value)
      : value
  },
}
