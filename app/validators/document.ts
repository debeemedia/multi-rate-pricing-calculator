import { discountTypes } from '#types/index'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

// Document line item schema
export const documentLineItemSchema = vine.object({
  description: vine.string().trim().minLength(1).maxLength(100),
  quantity: vine.number().min(1),
  unitPrice: vine.number().min(0),
  discountType: vine.enum(discountTypes).optional(),
  discountValue: vine.number().min(0).optional(),
  taxPercent: vine.number().min(0).max(100).optional(),
})

// Felds for document schema
const titleSchema = vine.string().trim().minLength(1).maxLength(50)
const customerNameSchema = vine.string().trim().minLength(1).maxLength(50)
const issueDateSchema = vine.string().transform((value) => DateTime.fromISO(value))

/**
 * Validator for Document creation (with optional inline line items)
 */
export const createDocumentValidator = vine.create(
  vine.object({
    title: titleSchema,
    customerName: customerNameSchema,
    issueDate: issueDateSchema,
    lineItems: vine.array(documentLineItemSchema).optional(), // Optional during creation so UI can create a bare document draft first
  })
)

/**
 * Validator for Document update (all fields optional)
 */
export const updateDocumentValidator = vine.create(
  vine.object({
    // CLone so as not to mutate the original
    title: titleSchema.clone().optional(),
    customerName: customerNameSchema.clone().optional(),
    issueDate: issueDateSchema.clone().optional(),
  })
)

/**
 * Validator for creating a line item for a document
 */
export const createDocumentLineItemValidator = vine.create(documentLineItemSchema)
