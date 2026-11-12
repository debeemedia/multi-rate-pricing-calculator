import type { HttpContext } from '@adonisjs/core/http'
import DocumentService, { DocumentError } from '#services/document_service'
import Document from '#models/document'
import {
  createDocumentValidator,
  generatePdfValidator,
  summaryReportValidator,
  updateDocumentValidator,
} from '#validators/document'
import { CalculationError } from '#services/pricing_calculator_service'
import { DocumentStatusesEnum } from '#types/index'
import { inject } from '@adonisjs/core'
import { isJsonRequest } from '#helpers/http_helper'
import puppeteer from 'puppeteer'
import app from '@adonisjs/core/services/app'
import fs from 'node:fs/promises'
import Currency, { defaultCurrencyCode } from '#models/currency'

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
    const documents = await DocumentService.preloadCurrencyRelation(
      Document.query().where({ userId: user.id })
    ).orderBy('issueDate', 'desc')

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
    const supportedCurrencies = await returnSupportedCurrencies()

    return view.render('pages/documents/create', { supportedCurrencies })
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

        // Keep all submitted form input in the session after the error is flashed
        session.flashAll()

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
    const document = await DocumentService.preloadCurrencyRelation(
      Document.query().where({ id: params.id, userId: auth.user!.id })
    )
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

  /**
   * Render Document PDF generation page
   *
   * `GET /documents/:id/export`
   */
  public async showExportForm({ params, auth, view, response }: HttpContext) {
    const document = await Document.query()
      .where({ id: params.id, userId: auth.user!.id })
      .preload('documentLineItems')
      .firstOrFail()

    if (!document.documentLineItems?.length) {
      return response.redirect().back()
    }

    return view.render('pages/documents/show_export_form', {
      document,
      // Provide last invoice defaults for autofill
      lastInvoiceDefaults: auth.user!.lastInvoiceDefaults,
    })
  }

  /**
   * Generate Document PDF:
   * Handle form submission, validate, generate PDF via Puppeteer, and stream download
   *
   * `POST /documents/:id/export`
   */
  public async generatePdf({ params, request, auth, response, view }: HttpContext) {
    const payload = await request.validateUsing(generatePdfValidator)

    const document = await DocumentService.preloadCurrencyRelation(
      Document.query().where({ id: params.id, userId: auth.user!.id })
    )
      .preload('documentLineItems')
      .firstOrFail()

    if (!document.documentLineItems?.length) {
      return response.redirect().back()
    }

    // Save the invoice defaults for next autofill
    const { customerName, customerContact, paymentReference, ...invoiceDefaults } = payload

    auth.user!.lastInvoiceDefaults = invoiceDefaults
    await auth.user!.save()

    /**
     * @todo: Move the PDF generation into background job.
     */

    // Launch headless browser instance to render PDF HTML template
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()

    const pdfTemplateStyles = `<style>\n${await fs.readFile(
      app.makePath('resources/css/pdf_template.css'),
      'utf-8'
    )}\n</style>`

    const htmlContent = await view.render('pages/documents/pdf_template', {
      document,
      lineItems: document.documentLineItems,
      payload, // Contains bank details, business branding, customer contact, etc.
      pdfTemplateStyles,
    })

    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '25mm', left: '20mm', right: '20mm' },
    })

    await browser.close()

    //  Stream file download back to the client
    const filename = `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_invoice.pdf`

    response.header('Content-Type', 'application/pdf')
    response.header('Content-Disposition', `attachment; filename="${filename}"`)

    return response.send(pdfBuffer)
  }

  /**
   * Summary Report Endpoint
   *
   * `GET /documents/reports/summary`
   */
  public async summaryReport({ request, response, auth, view, session }: HttpContext) {
    const payload = await request.validateUsing(summaryReportValidator)

    const supportedCurrencies = await returnSupportedCurrencies()

    const currencyCode = payload.currencyCode ?? defaultCurrencyCode
    const currencySymbol = supportedCurrencies.find(
      (currency) => currency.code === currencyCode
    )!.symbol

    const viewData = {
      supportedCurrencies,
      defaultCurrencyCode,
      filters: {
        startDate: payload.startDate ? payload.startDate.toISODate() : '',
        endDate: payload.endDate ? payload.endDate.toISODate() : '',
        currencyCode,
        currencySymbol,
      },
    }

    if (payload.endDate && payload.startDate && payload.endDate < payload.startDate) {
      const errorMessage = 'End date cannot be earlier than start date.'

      if (isJsonRequest(request)) {
        return response.badRequest({ message: errorMessage })
      }

      // Clear any session flash messages so we rely strictly on local state
      session.flashMessages.clear()

      // Render view immediately with zeroed metrics and raw filter inputs preserved
      return view.render('pages/documents/summary_report', {
        // Pass the errorMessage into the view
        errorMessage,
        report: {
          totalDocuments: 0,
          aggregateTotalDiscount: 0,
          aggregateTotalTax: 0,
          aggregateGrandTotal: 0,
        },
        ...viewData,
      })
    }

    // Clear lingering error flash messages on success
    session.flashMessages.clear()

    const report = await this.documentService.getSummaryReport({
      userId: auth.user!.id,
      currencyCode,
      startDate: payload.startDate,
      endDate: payload.endDate,
    })

    if (isJsonRequest(request)) {
      return response.ok({ data: report })
    }

    return view.render('pages/documents/summary_report', {
      errorMessage: null, // Clear explicit error state report,
      report,
      ...viewData,
    })
  }
}

export async function returnSupportedCurrencies() {
  return await Currency.query()
    .select(['code', 'name', 'symbol'])
    .where('is_supported', true)
    .orderBy('code', 'asc')
}
