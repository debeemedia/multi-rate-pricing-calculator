import { isJsonRequest } from '#helpers/http_helper'
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * SessionController handles user authentication and session management.
 * It provides methods for displaying the login page, authenticating users,
 * and logging out.
 */
export default class SessionController {
  /**
   * Display the login page
   */
  async create({ view }: HttpContext) {
    return view.render('pages/auth/login')
  }

  /**
   * Authenticate user credentials and create a new session
   */
  async store({ request, auth, response }: HttpContext) {
    const { email, password } = request.all()
    const user = await User.verifyCredentials(email, password)

    await auth.use('web').login(user)

    if (isJsonRequest(request)) {
      return response.ok({ message: 'Login successful' })
    }

    return response.redirect().toRoute('documents.index')
  }

  /**
   * Log out the current user and destroy their session
   */
  async destroy({ auth, response, request }: HttpContext) {
    await auth.use('web').logout()

    if (isJsonRequest(request)) {
      return response.ok({ message: 'Logout successful' })
    }

    return response.redirect().toRoute('session.create')
  }
}
