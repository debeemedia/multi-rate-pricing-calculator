import type { HttpContext } from '@adonisjs/core/http'

/**
 * Helper to check if an HTTP request expects JSON (e.g API client / automated tests)
 */
export function isJsonRequest(request: HttpContext['request']): boolean {
  return (
    request.accepts(['json', 'html']) === 'json' ||
    request.header('accept') === 'application/json' ||
    request.header('x-requested-with') === 'XMLHttpRequest'
  )
}
