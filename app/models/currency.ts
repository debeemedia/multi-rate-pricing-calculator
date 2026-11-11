import { CurrencySchema } from '#database/schema'

export default class Currency extends CurrencySchema {}

export const SUPPORTED_CURRENCY_CODES = [
  'USD',
  'NGN',
  'EUR',
  'GBP',
  'CAD',
  'NZD',
  'AUD',
  'JPY',
  'CNY',
  'KES',
  'ZAR',
  'GHS',
  'CHF',
  'KWD',
  'EGP',
  'MAD',
  'XOF',
  'XAF',
  'ETB',
] as const

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCY_CODES)[number]

export const defaultCurrencyCode = 'USD'
