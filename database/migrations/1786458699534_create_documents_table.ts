// database/migrations/1700000000001_create_documents_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().index()
      table
        .uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')
        .index()
      table.string('title').notNullable()
      table.string('customer_name').notNullable()
      table.timestamp('issue_date', { useTz: true }).notNullable()
      table.enum('status', ['draft', 'finalized']).notNullable().defaultTo('draft')

      // Server-computed totals in minor unit (e.g. cents)
      table.bigInteger('subtotal').notNullable().defaultTo(0)
      table.bigInteger('total_discount').notNullable().defaultTo(0)
      table.bigInteger('total_tax').notNullable().defaultTo(0)
      table.bigInteger('grand_total').notNullable().defaultTo(0)

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Compound index covers user filtering, status filtering, and date range queries
      table.index(['user_id', 'status', 'issue_date'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
