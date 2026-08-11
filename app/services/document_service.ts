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
      if (lineItems && lineItems.length) {
        const computed = PricingCalculator.calculateDocument(lineItems)

        await document
          .useTransaction(trx)
          .merge({
            subtotal: PricingCalculator.toMinorUnit(computed.subtotal),
            totalDiscount: PricingCalculator.toMinorUnit(computed.totalDiscount),
            totalTax: PricingCalculator.toMinorUnit(computed.totalTax),
            grandTotal: PricingCalculator.toMinorUnit(computed.grandTotal),
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
            discountValue,
            taxPercent,
          } = item
          await DocumentLineItem.create(
            {
              documentId: document.id,
              description,
              quantity,
              unitPrice: PricingCalculator.toMinorUnit(unitPrice),
              discountType: discountType || DiscountTypesEnum.None,
              discountValue:
                discountType === DiscountTypesEnum.Percent
                  ? discountValue || 0
                  : PricingCalculator.toMinorUnit(discountValue || 0),
              taxPercent: (taxPercent || 0).toFixed(2),
              subtotal: PricingCalculator.toMinorUnit(subtotal),
              discount: PricingCalculator.toMinorUnit(discountAmount),
              tax: PricingCalculator.toMinorUnit(taxAmount),
              lineTotal: PricingCalculator.toMinorUnit(lineTotal),
            },
            { client: trx }
          )
        }
      } else {
        // Empty drafts can be created without line items (e.g. during initial UI creation flow).
        // Database defaults handles 0 totals, and no child documentLineItems are created.
        await document.useTransaction(trx).save()
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

    // Convert stored cents back to LineItemInput format for calculator
    const lineInputs: LineItemInput[] = document.documentLineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: PricingCalculator.toMainUnit(item.unitPrice),
      discountType: item.discountType as DiscountType,
      discountValue:
        item.discountType === DiscountTypesEnum.Percent
          ? Number(item.discountValue)
          : PricingCalculator.toMainUnit(item.discountValue),
      taxPercent: Number(item.taxPercent),
    }))

    const computed = PricingCalculator.calculateDocument(lineInputs)

    const { grandTotal, subtotal, totalDiscount, totalTax } = computed

    await document
      .useTransaction(trx)
      .merge({
        subtotal: PricingCalculator.toMinorUnit(subtotal),
        totalDiscount: PricingCalculator.toMinorUnit(totalDiscount),
        totalTax: PricingCalculator.toMinorUnit(totalTax),
        grandTotal: PricingCalculator.toMinorUnit(grandTotal),
      })
      .save()

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
        discountValue,
        taxPercent,
      } = calculated

      const lineItem = await DocumentLineItem.create(
        {
          documentId: document.id,
          description,
          quantity,
          unitPrice: PricingCalculator.toMinorUnit(unitPrice),
          discountType: discountType || DiscountTypesEnum.None,
          discountValue:
            discountType === DiscountTypesEnum.Percent
              ? discountValue || 0
              : PricingCalculator.toMinorUnit(discountValue || 0),
          taxPercent: (taxPercent || 0).toFixed(2),
          subtotal: PricingCalculator.toMinorUnit(subtotal),
          discount: PricingCalculator.toMinorUnit(discountAmount),
          tax: PricingCalculator.toMinorUnit(taxAmount),
          lineTotal: PricingCalculator.toMinorUnit(lineTotal),
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
}
