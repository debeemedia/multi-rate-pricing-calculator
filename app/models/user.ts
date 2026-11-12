import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { beforeCreate, column, hasMany } from '@adonisjs/lucid/orm'
import stringHelpers from '@adonisjs/core/helpers/string'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Document from './document.ts'
/**
 * User model represents a user in the application.
 * It extends UserSchema and includes authentication capabilities
 * through the withAuthFinder mixin.
 */

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  @column({
    // Tell Lucid to parse/serialize this column as JSON automatically
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
  })
  declare lastInvoiceDefaults: InvoiceDefaults | null

  @hasMany(() => Document)
  declare documents: HasMany<typeof Document>

  @beforeCreate()
  public static assignUuid(user: User) {
    if (!user.id) {
      user.id = stringHelpers.uuid()
    }
  }
}

export interface InvoiceDefaults {
  businessName: string
  businessTagline?: string
  businessContact: string
  bankName: string
  accountName: string
  accountNumber: string
  paymentTerms: string
  notes?: string
}
