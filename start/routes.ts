/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'
import db from '@adonisjs/lucid/services/db'

router.on('/').render('pages/home').as('home')

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

// Auth protected routes
router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])

    // Documents Management Routes
    router
      .resource('documents', controllers.Documents)
      .only(['create', 'destroy', 'index', 'show', 'store', 'update'])

    router
      .patch('documents/:id/finalize', [controllers.Documents, 'finalize'])
      .as('documents.finalize') // Finalize a document draft

    router
      .get('documents/reports/summary', [controllers.Documents, 'summaryReport'])
      .as('documents.summary_report')

    // Document Line Items Resourceful Routes
    router
      .resource('documents.document_line_items', controllers.DocumentLineItems)
      .apiOnly()
      .only(['store', 'destroy'])
  })
  .use(middleware.auth())

// Health check endpoint
router
  .get('/health', async ({ response }) => {
    const uptimeInSeconds = process.uptime()
    try {
      // Quick query to confirm DB is reachable
      await db.rawQuery('SELECT 1')
      return response.ok({
        status: 'ok',
        uptimeInSeconds,
        timestamp: new Date().toISOString(),
        database: 'connected',
      })
    } catch (error) {
      const err = error as Error
      return response.status(500).json({
        status: 'error',
        uptimeInSeconds,
        database: 'disconnected',
        message: err.message,
      })
    }
  })
  .as('health_check')
