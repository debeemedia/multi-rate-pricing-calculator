import stringHelpers from '@adonisjs/core/helpers/string'
import { beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import { DocumentLineItemSchema } from '#database/schema'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Document from './document.ts'

export default class DocumentLineItem extends DocumentLineItemSchema {
  @belongsTo(() => Document)
  declare document: BelongsTo<typeof Document>

  @beforeCreate()
  public static assignUuid(documentLineItem: DocumentLineItem) {
    if (!documentLineItem.id) {
      documentLineItem.id = stringHelpers.uuid()
    }
  }
}
