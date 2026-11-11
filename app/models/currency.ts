import { CurrencySchema } from '#database/schema'

export default class Currency extends CurrencySchema {}

export const SUPPORTED_CURRENCIES: string[] = ['USD', 'NGN']
