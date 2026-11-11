import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the existing 3-column index
      table.dropIndex(['user_id', 'status', 'issue_date'])

      // Create the expanded 4-column compound index
      table.index(['user_id', 'status', 'currency_code', 'issue_date'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['user_id', 'status', 'currency_code', 'issue_date'])

      table.index(['user_id', 'status', 'issue_date'])
    })
  }
}
