// database/migrations/1700000000002_create_document_line_items_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'document_line_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().index()
      table
        .uuid('document_id')
        .notNullable()
        .references('id')
        .inTable('documents')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')
        .index()

      table.string('description').notNullable()
      table.integer('quantity').notNullable()

      // Unit price in minor unit (e.g. cents)
      table.bigInteger('unit_price').notNullable()

      table.enum('discount_type', ['none', 'fixed', 'percent']).notNullable()

      // Fixed discounts stored in minor unit; percentage value stored as standard number (e.g. 10 for 10%)
      table.bigInteger('discount_value').notNullable()
      table.decimal('tax_percent', 5, 2).notNullable()

      // Server-computed line breakdowns in minor unit (e.g. cents)
      table.bigInteger('subtotal').notNullable()
      table.bigInteger('discount').notNullable()
      table.bigInteger('tax').notNullable()
      table.bigInteger('line_total').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

/**
 * IMPORTANT NOTE: In a subsequent migration, the `discount_value` column has been replaced with `discount_value_fixed` (bigint, for fixed discount type) and `discount_value_percent` (numeric(5,2), for percent discount type).
 */
