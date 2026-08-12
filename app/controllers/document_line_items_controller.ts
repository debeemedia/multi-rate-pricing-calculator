import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import DocumentService, { DocumentError } from '#services/document_service'
import { createDocumentLineItemValidator } from '#validators/document'
import { CalculationError } from '#services/pricing_calculator_service'
import db from '@adonisjs/lucid/services/db'
import { isJsonRequest } from '#helpers/http_helper'

@inject()
export default class DocumentLineItemsController {
  constructor(protected documentService: DocumentService) {}

  /**
   * Store a document line item for a document
   *
   * `POST /documents/:document_id/document_line_items`
   */
  public async store({ params, request, response, auth, session }: HttpContext) {
    try {
      const documentId = params.document_id

      const itemInput = await request.validateUsing(createDocumentLineItemValidator)

      const lineItem = await this.documentService.addLineItem(documentId, auth.user!.id, itemInput)

      const successMessage = 'Line item added successfully'

      if (isJsonRequest(request)) {
        return response.created({ message: successMessage, data: lineItem })
      }

      session.flash('success', successMessage)

      return response.redirect().toRoute(`documents.show`, { id: documentId })
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
   * Delete a document line item
   *
   * `DELETE /documents/:document_id/document_line_items/:id`
   */
  public async destroy({ params, request, response, session }: HttpContext) {
    const { document_id, id } = params

    const updatedDocument = await db.transaction(async (trx) => {
      return await this.documentService.removeLineItem(document_id, id, trx)
    })

    const successMessage = 'Line item removed successfully'

    if (isJsonRequest(request)) {
      return response.ok({
        message: successMessage,
        data: updatedDocument,
      })
    }

    session.flash('success', successMessage)

    return response.redirect().toRoute('documents.show', { id: document_id })
  }
}
