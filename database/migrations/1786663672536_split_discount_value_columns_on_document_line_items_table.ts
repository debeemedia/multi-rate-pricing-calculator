import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'document_line_items'

  async up() {
    // 1. Add new columns as nullable directly after `discount_type`
    this.schema.alterTable(this.tableName, (table) => {
      table.bigInteger('discount_value_fixed').nullable().after('discount_type')
      table.decimal('discount_value_percent', 5, 2).nullable().after('discount_value_fixed')
    })

    // 2. Defer data backfill and strict check constraints
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE ${this.tableName}
        SET 
          discount_value_fixed = CASE 
            WHEN discount_type = 'fixed' THEN discount_value 
            ELSE NULL 
          END,
          discount_value_percent = CASE 
            WHEN discount_type = 'percent' THEN discount_value::DECIMAL(5, 2) 
            ELSE NULL 
          END;
      `)

      await db.rawQuery(`
        ALTER TABLE ${this.tableName}
          ADD CONSTRAINT check_line_item_discount_percent_range 
            CHECK (discount_value_percent IS NULL OR (discount_value_percent >= 0 AND discount_value_percent <= 100)),
          ADD CONSTRAINT check_line_item_discount_fixed_positive 
            CHECK (discount_value_fixed IS NULL OR discount_value_fixed >= 0),
          ADD CONSTRAINT check_line_item_discount_exclusivity CHECK (
            (discount_type = 'fixed'   AND discount_value_fixed IS NOT NULL AND discount_value_percent IS NULL) OR
            (discount_type = 'percent' AND discount_value_percent IS NOT NULL AND discount_value_fixed IS NULL) OR
            (discount_type = 'none'    AND discount_value_fixed IS NULL     AND discount_value_percent IS NULL)
          );
      `)
    })

    // 3. Defer dropping old column
    this.defer(async () => {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn('discount_value')
      })
    })
  }

  async down() {
    // 1. Re-add old column as nullable after discount_type
    this.schema.alterTable(this.tableName, (table) => {
      table.bigInteger('discount_value').nullable().after('discount_type')
    })

    // 2. Restore data and drop constraints
    this.defer(async (db) => {
      await db.rawQuery(`
        ALTER TABLE ${this.tableName}
          DROP CONSTRAINT IF EXISTS check_line_item_discount_exclusivity,
          DROP CONSTRAINT IF EXISTS check_line_item_discount_percent_range,
          DROP CONSTRAINT IF EXISTS check_line_item_discount_fixed_positive;
      `)

      await db.rawQuery(`
        UPDATE ${this.tableName}
        SET discount_value = CASE 
          WHEN discount_type = 'fixed' THEN COALESCE(discount_value_fixed, 0)
          WHEN discount_type = 'percent' THEN COALESCE(discount_value_percent::BIGINT, 0)
          ELSE 0
        END;
      `)
    })

    // 3. Set discount_value back to NOT NULL and drop new columns
    this.defer(async () => {
      this.schema.alterTable(this.tableName, (table) => {
        table.bigInteger('discount_value').notNullable().alter()
        table.dropColumn('discount_value_fixed')
        table.dropColumn('discount_value_percent')
      })
    })
  }
}
