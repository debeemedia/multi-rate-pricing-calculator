import Currency, { SUPPORTED_CURRENCIES } from '#models/currency'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import currenciesData from '../data/currencies_symbols.json' with { type: 'json' }

export default class extends BaseSeeder {
  async run() {
    await Currency.updateOrCreateMany(
      'code',
      Object.values(currenciesData).map((currency) => ({
        code: currency.iso_code,
        name: currency.name,
        symbol: currency.symbol,
        decimalDigits: currency.decimal_digits,
        isSupported: SUPPORTED_CURRENCIES.includes(currency.iso_code),
      }))
    )
  }
}
