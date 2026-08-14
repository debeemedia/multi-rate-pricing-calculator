import stringHelpers from '@adonisjs/core/helpers/string'
import { beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import { DocumentLineItemSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Document from './document.ts'
import { moneyColumnConfig } from '#helpers/model_helper'

export default class DocumentLineItem extends DocumentLineItemSchema {
  /**
   * IMPORTANT: All amount-related columns are stored in minor unit and returned in main unit.
   */
  @column({
    ...moneyColumnConfig,
  })
  declare unitPrice: number

  @column({
    ...moneyColumnConfig,
  })
  declare discountValueFixed: number | null

  @column({
    ...moneyColumnConfig,
  })
  declare subtotal: number

  @column({
    ...moneyColumnConfig,
  })
  declare discount: number

  @column({
    ...moneyColumnConfig,
  })
  declare tax: number

  @column({
    ...moneyColumnConfig,
  })
  declare lineTotal: number

  @belongsTo(() => Document)
  declare document: BelongsTo<typeof Document>

  @beforeCreate()
  public static assignUuid(documentLineItem: DocumentLineItem) {
    if (!documentLineItem.id) {
      documentLineItem.id = stringHelpers.uuid()
    }
  }
}
