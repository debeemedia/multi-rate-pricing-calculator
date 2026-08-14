import { ColumnOptions } from '@adonisjs/lucid/types/model'
import { PricingCalculator } from '#services/pricing_calculator_service'

/**
 * Column transformer for standard currency fields (minor <-> main unit)
 */
export const moneyColumnConfig: Pick<ColumnOptions, 'consume' | 'prepare'> = {
  consume: (value: number | null) =>
    value !== null && value !== undefined ? PricingCalculator.toMainUnit(Number(value)) : null,

  prepare: (value: number | null) =>
    value !== null && value !== undefined ? PricingCalculator.toMinorUnit(value) : null,
}
