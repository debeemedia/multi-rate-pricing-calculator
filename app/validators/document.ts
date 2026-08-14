import { discountTypes, DiscountTypesEnum } from '#types/index'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

/**
 * Custom rule: Strips HTML tags from string fields
 */
const stripTags = vine.createRule((value, _options, field) => {
  if (typeof value === 'string') {
    const cleanValue = value.replace(/<[^>]*>?/gm, '')
    field.mutate(cleanValue)
  }
}, { isAsync: false })

/**
 * Custom rule: Enforces at most 2 decimal places (e.g. 10.50 is valid, 10.555 is invalid)
 */
const maxTwoDecimals = vine.createRule((value, _, field) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return
  }

  // Multiply by 100 and check if it's an integer (handles floating point precision safely)
  const isTwoDecimalsOrLess = Number.isInteger(Math.round(value * 1000000) / 10000)

  if (!isTwoDecimalsOrLess) {
    field.report(
      `The ${field.name} field cannot have more than 2 decimal places`,
      'max_two_decimals',
      field
    )
  }
})

// Enforces whole number integer
const isInteger = vine.createRule((value, _options, field) => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    field.report('Quantity must be a whole number', 'integer', field)
  }
})

// Document line item schema
export const documentLineItemSchema = vine.object({
  description: vine.string().trim().use(stripTags()).minLength(1).maxLength(100),
  quantity: vine.number().min(1).use(isInteger()),
  unitPrice: vine.number().min(0).use(maxTwoDecimals()),
  discountType: vine.enum(discountTypes).optional(),
  discountValueFixed: vine
    .number()
    .min(0)
    .use(maxTwoDecimals())
    .nullable()
    .optional()
    .transform((value, field) => {
      const parent = field.parent
      const discountType = parent.discountType || DiscountTypesEnum.None

      if (discountType === DiscountTypesEnum.None) {
        if (value !== null && value !== undefined) {
          field.report(
            `Fixed discount value must be null when discount type is set to "${DiscountTypesEnum.None}"`,
            'invalid_discount_value_fixed',
            field
          )
        }
        return null // Explicitly force output to null for DB constraint
      }

      if (discountType === DiscountTypesEnum.Fixed && (!value || value <= 0)) {
        field.report(
          `Must provide a fixed discount value greater than 0 when discount type is set to "${DiscountTypesEnum.Fixed}"`,
          'invalid_discount_value_fixed',
          field
        )
      }

      if (discountType === DiscountTypesEnum.Percent) {
        if (value !== null && value !== undefined) {
          field.report(
            `Fixed discount value must be null when discount type is set to "${DiscountTypesEnum.Percent}"`,
            'invalid_discount_value_fixed',
            field
          )
        }
        return null // Explicitly force output to null for DB constraint
      }

      return value ?? null
    }),
  discountValuePercent: vine
    .number()
    .min(0)
    .max(100)
    .use(maxTwoDecimals())
    .nullable()
    .optional()
    .transform((value, field) => {
      const parent = field.parent
      const discountType = parent.discountType || DiscountTypesEnum.None

      if (discountType === DiscountTypesEnum.None) {
        if (value !== null && value !== undefined) {
          field.report(
            `Percentage discount value must be null when discount type is set to "${DiscountTypesEnum.None}"`,
            'invalid_discount_value_percent',
            field
          )
        }
        return null // Explicitly force output to null for DB constraint
      }

      if (discountType === DiscountTypesEnum.Fixed) {
        if (value !== null && value !== undefined) {
          field.report(
            `Percentage discount value must be null when discount type is set to "${DiscountTypesEnum.Fixed}"`,
            'invalid_discount_value_percent',
            field
          )
        }
        return null // Explicitly force output to null for DB constraint
      }

      if (discountType === DiscountTypesEnum.Percent && (!value || value <= 0 || value > 100)) {
        field.report(
          `Must provide a percentage discount value greater than 0 and at most 100 when discount type is set to "${DiscountTypesEnum.Percent}"`,
          'invalid_discount_value_percent',
          field
        )
      }

      return value ?? null
    }),
  taxPercent: vine.number().min(0).max(100).use(maxTwoDecimals()).optional(),
})

// Fields for document schema
const titleSchema = vine.string().trim().use(stripTags()).minLength(1).maxLength(50)
const customerNameSchema = vine.string().trim().use(stripTags()).minLength(1).maxLength(50)
const issueDateSchema = vine
  .string()
  .transform((value) => DateTime.fromISO(value, { zone: 'utc' }).startOf('day'))

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
    // Clone so as not to mutate the original
    title: titleSchema.clone().optional(),
    customerName: customerNameSchema.clone().optional(),
    issueDate: issueDateSchema.clone().optional(),
  })
)

/**
 * Validator for creating a line item for a document
 */
export const createDocumentLineItemValidator = vine.create(documentLineItemSchema)

/**
 * Validator for Summary Report Date Range Query
 */
export const summaryReportValidator = vine.create(
  vine.object({
    startDate: vine
      .string()
      .transform((val) => DateTime.fromISO(val, { zone: 'utc' }).startOf('day'))
      .optional(),
    endDate: vine
      .string()
      .transform((val) => DateTime.fromISO(val, { zone: 'utc' }).endOf('day'))
      .optional(),
  })
)
