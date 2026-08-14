import { DocumentSchema } from '#database/schema'
import stringHelpers from '@adonisjs/core/helpers/string'
import { beforeCreate, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from './user.ts'
import DocumentLineItem from './document_line_item.ts'
import { moneyColumnConfig } from '#helpers/model_helper'

export default class Document extends DocumentSchema {
  /**
   * IMPORTANT: All amount-related columns are stored in minor unit and returned in major unit.
   */
  @column({ ...moneyColumnConfig })
  declare subtotal: number

  @column({
    ...moneyColumnConfig,
  })
  declare totalDiscount: number

  @column({
    ...moneyColumnConfig,
  })
  declare totalTax: number

  @column({
    ...moneyColumnConfig,
  })
  declare grandTotal: number

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => DocumentLineItem)
  declare documentLineItems: HasMany<typeof DocumentLineItem>

  @beforeCreate()
  public static assignUuid(document: Document) {
    if (!document.id) {
      document.id = stringHelpers.uuid()
    }
  }
}
