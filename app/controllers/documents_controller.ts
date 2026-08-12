import type { HttpContext } from '@adonisjs/core/http'
import DocumentService, { DocumentError } from '#services/document_service'
import Document from '#models/document'
import { createDocumentValidator, updateDocumentValidator } from '#validators/document'
import { CalculationError } from '#services/pricing_calculator_service'
import { DocumentStatusesEnum } from '#types/index'
import { inject } from '@adonisjs/core'
import { isJsonRequest } from '#helpers/http_helper'

@inject()
export default class DocumentsController {
  constructor(protected documentService: DocumentService) {}
  /**
   * List all documents for the authenticated user
   *
   * `GET /documents`
   */
  public async index({ auth, request, response, view }: HttpContext) {
    const user = auth.user!
    const documents = await Document.query().where({ userId: user.id }).orderBy('issueDate', 'desc')

    if (isJsonRequest(request)) {
      return response.ok({ data: documents })
    }

    return view.render('pages/documents/index', { documents })
  }

  /**
   * Render HTML page for document creation form
   *
   * `GET /documents/create`
   */
  async create({ view }: HttpContext) {
    return view.render('pages/documents/create')
  }

  /**
   * Store a new Document draft
   *
   * `POST /documents`
   */
  public async store({ request, response, auth, session }: HttpContext) {
    try {
      const payload = await request.validateUsing(createDocumentValidator)

      const document = await this.documentService.createDocument(auth.user!.id, payload)

      const successMessage = 'Document created successfully'

      if (isJsonRequest(request)) {
        return response.created({ message: successMessage, data: document })
      }

      session.flash('success', successMessage)

      return response.redirect().toRoute(`documents.show`, { id: document.id })
    } catch (error) {
      if (error instanceof DocumentError || error instanceof CalculationError) {
        if (isJsonRequest(request)) {
          return response.badRequest({ message: error.message })
        }

        session.flash('error', error.message)

        return response.redirect().back()
      }
      throw error
    }
  }

  /**
   * View a single document with its line items
   *
   * `GET /documents/:id`
   */
  public async show({ params, auth, request, response, view }: HttpContext) {
    const document = await Document.query()
      .where({ id: params.id, userId: auth.user!.id })
      .preload('documentLineItems')
      .firstOrFail()

    if (isJsonRequest(request)) {
      return response.ok({ data: document })
    }

    return view.render('pages/documents/show', { document })
  }

  /**
   * Update a draft document
   *
   * `PUT /documents/:id`
   */
  public async update({ params, request, response, session, auth }: HttpContext) {
    const documentId = params.id

    const payload = await request.validateUsing(updateDocumentValidator)

    const document = await this.documentService.updateDocument(documentId, auth.user!.id, payload)

    const successMessage = 'Document updated successfully'

    if (isJsonRequest(request)) {
      return response.ok({
        message: successMessage,
        data: document,
      })
    }

    session.flash('success', successMessage)

    return response.redirect().toRoute('documents.show', { id: document.id })
  }

  /**
   * Finalize a draft document (Locks it permanently)
   *
   * `PATCH /documents/:id/finalize`
   */
  public async finalize({ params, auth, request, response, session }: HttpContext) {
    try {
      const document = await this.documentService.finalizeDocument(params.id, auth.user!.id)

      const successMessage = 'Document finalized successfully'

      if (isJsonRequest(request)) {
        return response.ok({ message: successMessage, data: document })
      }

      session.flash('success', successMessage)

      return response.redirect().toRoute('documents.show', { id: document.id })
    } catch (error) {
      if (error instanceof DocumentError) {
        if (isJsonRequest(request)) {
          return response.badRequest({ message: error.message })
        }
        session.flash('error', error.message)

        return response.redirect().back()
      }
      throw error
    }
  }

  /**
   * Delete a draft document
   *
   * `DELETE /documents/:id`
   */
  public async destroy({ params, auth, request, response, session }: HttpContext) {
    const document = await Document.query()
      .where({ id: params.id, userId: auth.user!.id })
      .firstOrFail()

    if (document.status === DocumentStatusesEnum.Finalized) {
      const errorMessage = 'Finalized documents cannot be deleted.'

      if (isJsonRequest(request)) {
        return response.badRequest({ message: errorMessage })
      }
      session.flash('error', errorMessage)

      return response.redirect().back()
    }

    await document.delete()

    const successMessage = 'Document deleted successfully'

    if (isJsonRequest(request)) {
      return response.ok({ message: successMessage })
    }

    session.flash('success', successMessage)

    return response.redirect().toRoute('documents.index')
  }
}
