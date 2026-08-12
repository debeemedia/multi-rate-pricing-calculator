import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { beforeCreate } from '@adonisjs/lucid/orm'
import string from '@adonisjs/core/helpers/string'
/**
 * User model represents a user in the application.
 * It extends UserSchema and includes authentication capabilities
 * through the withAuthFinder mixin.
 */

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  @beforeCreate()
  public static assignUuid(user: User) {
    if (!user.id) {
      user.id = string.uuid()
    }
  }
}
