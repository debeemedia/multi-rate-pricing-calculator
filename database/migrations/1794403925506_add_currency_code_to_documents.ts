import { BaseSchema } from '@adonisjs/lucid/schema'
import { DateTime } from 'luxon'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    // 1. Add the column as nullable first
    this.schema.alterTable(this.tableName, (table) => {
      table
        .string('currency_code')
        .nullable()
        .references('code')
        .inTable('currencies')
        .onDelete('RESTRICT')
        .onUpdate('CASCADE')
    })

    // 2. Defer the data backfill and final constraint until after schema execution
    this.defer(async (db) => {
      // Seed foundational currencies directly so the backfill never fails
      await db
        .table('currencies')
        .multiInsert([
          {
            code: 'USD',
            name: 'US Dollar',
            symbol: '$',
            decimal_digits: 2,
            is_supported: true,
            created_at: DateTime.now(),
            updated_at: DateTime.now(),
          },
        ])
        .onConflict('code')
        .ignore()

      // Backfill existing records to USD
      await db.from(this.tableName).whereNull('currency_code').update({ currency_code: 'USD' })

      // Make the column non-nullable now that rows are populated
      await this.schema.alterTable(this.tableName, (table) => {
        table.string('currency_code').notNullable().alter()
      })
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('currency_code')
    })
  }
}
