import db from '@adonisjs/lucid/services/db'
import Document from '#models/document'
import DocumentLineItem from '#models/document_line_item'
import { PricingCalculator } from '#services/pricing_calculator_service'
import { DiscountType, DiscountTypesEnum, DocumentStatusesEnum, LineItemInput } from '#types/index'
import { DateTime } from 'luxon'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

export class DocumentError extends Error {
  public status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'DocumentError'
    this.status = status
  }
}

export default class DocumentService {
  /**
   * Creates a new Document (and optional initial line items)
   */
  public async createDocument(
    userId: string,
    data: {
      title: string
      customerName: string
      issueDate: DateTime
      lineItems?: LineItemInput[]
    }
  ) {
    const { customerName, issueDate, title, lineItems } = data
    return await db.transaction(async (trx) => {
      // 1. Create base document draft
      const document = await Document.create(
        {
          userId,
          title,
          customerName,
          issueDate,
          status: DocumentStatusesEnum.Draft,
        },
        { client: trx }
      )

      // 2. Compute totals if line items provided
      // Empty drafts can be created without line items (e.g. during initial UI creation flow).
      // Database defaults handles 0 totals, and no child documentLineItems are created.
      if (lineItems && lineItems.length) {
        const computed = PricingCalculator.calculateDocument(lineItems)

        await document
          .useTransaction(trx)
          .merge({
            subtotal: computed.subtotal,
            totalDiscount: computed.totalDiscount,
            totalTax: computed.totalTax,
            grandTotal: computed.grandTotal,
          })
          .save()

        // Insert computed child document line items
        for (const item of computed.lineItems) {
          const {
            description,
            discountAmount,
            lineTotal,
            quantity,
            subtotal,
            taxAmount,
            unitPrice,
            discountType,
            discountValueFixed,
            discountValuePercent,
            taxPercent,
          } = item
          await DocumentLineItem.create(
            {
              documentId: document.id,
              description,
              quantity,
              unitPrice,
              discountType: discountType || DiscountTypesEnum.None,
              discountValueFixed: discountValueFixed ?? null,
              discountValuePercent:
                discountValuePercent !== null && discountValuePercent !== undefined
                  ? discountValuePercent.toFixed(2)
                  : null,
              taxPercent: (taxPercent || 0).toFixed(2),
              subtotal,
              discount: discountAmount,
              tax: taxAmount,
              lineTotal: lineTotal,
            },
            { client: trx }
          )
        }
      }

      return document
    })
  }

  /**
   * Recalculates and updates Document aggregate totals from its DB line items
   */
  public async recalculateDocumentTotals(documentId: string, trx: TransactionClientContract) {
    const document = await Document.query({ client: trx })
      .where({ id: documentId })
      .preload('documentLineItems')
      .firstOrFail()

    if (document.status === DocumentStatusesEnum.Finalized) {
      throw new DocumentError('Cannot modify or recalculate a finalized document.')
    }

    const lineInputs: LineItemInput[] = document.documentLineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountType: item.discountType as DiscountType,
      discountValueFixed: item.discountValueFixed,
      discountValuePercent:
        item.discountValuePercent !== null ? Number(item.discountValuePercent) : null,
      taxPercent: Number(item.taxPercent),
    }))

    const computed = PricingCalculator.calculateDocument(lineInputs)

    const { grandTotal, subtotal, totalDiscount, totalTax } = computed

    await document
      .useTransaction(trx)
      .merge({
        subtotal,
        totalDiscount,
        totalTax,
        grandTotal,
      })
      .save()

    return document
  }

  /**
   * Updates metadata (title, customerName, issueDate) for a draft document
   */
  async updateDocument(
    documentId: string,
    userId: string,
    data: {
      title?: string
      customerName?: string
      issueDate?: DateTime
    }
  ) {
    const document = await Document.query().where({ id: documentId, userId }).firstOrFail()

    if (document.status === DocumentStatusesEnum.Finalized) {
      throw new DocumentError('Cannot update a finalized document.')
    }

    await document.merge(data).save()

    return document
  }

  /**
   * Finalizes a draft document and freezes it permanently
   */
  public async finalizeDocument(documentId: string, userId: string) {
    const document = await Document.query()
      .where({ id: documentId, userId })
      .preload('documentLineItems')
      .firstOrFail()

    if (document.status === DocumentStatusesEnum.Finalized) {
      return document // Already finalized
    }

    if (!document.documentLineItems || !document.documentLineItems.length) {
      throw new DocumentError('Cannot finalize a document with zero line items.')
    }

    await document.merge({ status: DocumentStatusesEnum.Finalized }).save()

    return document
  }

  /**
   * Adds a new line item to a draft document
   */
  public async addLineItem(documentId: string, userId: string, itemInput: LineItemInput) {
    const document = await Document.query().where({ id: documentId, userId }).firstOrFail()

    if (document.status === DocumentStatusesEnum.Finalized) {
      throw new DocumentError('Cannot add line items to a finalized document.')
    }

    return await db.transaction(async (trx) => {
      const calculated = PricingCalculator.calculateLine(itemInput)

      const {
        description,
        discountAmount,
        lineTotal,
        quantity,
        subtotal,
        taxAmount,
        unitPrice,
        discountType,
        discountValueFixed,
        discountValuePercent,
        taxPercent,
      } = calculated

      const lineItem = await DocumentLineItem.create(
        {
          documentId: document.id,
          description,
          quantity,
          unitPrice,
          discountType: discountType || DiscountTypesEnum.None,
          discountValueFixed: discountValueFixed ?? null,
          discountValuePercent:
            discountValuePercent !== null && discountValuePercent !== undefined
              ? discountValuePercent.toFixed(2)
              : null,
          taxPercent: (taxPercent || 0).toFixed(2),
          subtotal,
          discount: discountAmount,
          tax: taxAmount,
          lineTotal,
        },
        { client: trx }
      )

      await this.recalculateDocumentTotals(document.id, trx)

      return lineItem
    })
  }

  /**
   * Removes a line item from a document
   */
  public async removeLineItem(
    documentId: string,
    lineItemId: string,
    trx: TransactionClientContract
  ) {
    const document = await Document.query({ client: trx }).where({ id: documentId }).firstOrFail()

    if (document.status === DocumentStatusesEnum.Finalized) {
      throw new DocumentError('Cannot remove line items from a finalized document.')
    }

    const lineItem = await DocumentLineItem.query({ client: trx })
      .where({ id: lineItemId, documentId })
      .firstOrFail()

    await lineItem.delete()

    // Recalculate and update document totals
    return await this.recalculateDocumentTotals(documentId, trx)
  }

  /**
   * Generates Summary Report for Finalized Documents in Date Range
   */
  public async getSummaryReport(userId: string, startDate: DateTime, endDate: DateTime) {
    const startIso = startDate.startOf('day').toISO()
    const endIso = endDate.endOf('day').toISO()

    const result = await db
      .from('documents')
      .where({
        user_id: userId,
        status: DocumentStatusesEnum.Finalized,
      })
      .whereBetween('issue_date', [startIso!, endIso!])
      .select(
        db.raw('COUNT(*)::integer as total_documents'),
        db.raw('COALESCE(SUM(total_discount), 0) as aggregate_total_discount'),
        db.raw('COALESCE(SUM(total_tax), 0) as aggregate_total_tax'),
        db.raw('COALESCE(SUM(grand_total), 0) as aggregate_grand_total')
      )
      .first()

    return {
      startDate,
      endDate,
      totalDocuments: Number(result.total_documents),
      // IMPORTANT: Ensure to convert amount-related columns to main unit since we bypassed the Model
      aggregateTotalDiscount: PricingCalculator.toMainUnit(Number(result.aggregate_total_discount)),
      aggregateTotalTax: PricingCalculator.toMainUnit(Number(result.aggregate_total_tax)),
      aggregateGrandTotal: PricingCalculator.toMainUnit(Number(result.aggregate_grand_total)),
    }
  }
}
