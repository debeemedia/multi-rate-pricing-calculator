import { DocumentSchema } from '#database/schema'
import stringHelpers from '@adonisjs/core/helpers/string'
import { beforeCreate, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from './user.ts'
import DocumentLineItem from './document_line_item.ts'

export default class Document extends DocumentSchema {
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
