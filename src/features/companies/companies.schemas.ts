import { z } from "@hono/zod-openapi"
import {
  CARD_STATUSES,
  INVOICE_STATUSES,
  TRANSACTION_STATUSES,
  USER_COMPANY_ROLES,
} from "../../db/enums"

export const CompanyIdPathParamsSchema = z
  .object({
    companyId: z.uuid().openapi({
      param: {
        name: "companyId",
        in: "path",
        description: "Company id (caller must be a member)",
      },
    }),
  })
  .openapi("CompanyIdPathParams")

export const CompanyCardPathParamsSchema = z
  .object({
    companyId: z.uuid().openapi({
      param: {
        name: "companyId",
        in: "path",
        description: "Company id that owns the card",
      },
    }),
    cardId: z.uuid().openapi({
      param: {
        name: "cardId",
        in: "path",
        description: "Card id within the company",
      },
    }),
  })
  .openapi("CompanyCardPathParams")

export const CompanyResponseSchema = z
  .object({
    id: z.uuid().openapi({ description: "Company id" }),
    name: z.string().openapi({ description: "Legal or display name of the company" }),
    orgNumber: z
      .string()
      .nullable()
      .openapi({ description: "Organization registration number; null if not set" }),
    role: z.enum(USER_COMPANY_ROLES).openapi({
      description:
        "Caller's role in this company: `admin` may list all company cards; `member` sees only cards assigned to them",
    }),
    createdAt: z.iso.datetime().openapi({ description: "Row creation time (RFC 3339)" }),
    updatedAt: z.iso.datetime().openapi({ description: "Last update time (RFC 3339)" }),
  })
  .openapi("Company")

export const CardResponseSchema = z
  .object({
    id: z.uuid().openapi({ description: "Card id" }),
    companyId: z.uuid().openapi({ description: "Company that owns this card" }),
    cardLabel: z.string().openapi({
      description: "Human-readable label for the card (e.g. last four digits, cardholder name)",
    }),
    spendLimit: z.string().openapi({
      description: "Maximum allowed spend as a decimal string (DB `numeric` serialized)",
    }),
    currency: z
      .string()
      .length(3)
      .openapi({ description: "ISO 4217 alphabetic currency code (e.g. SEK)" }),
    status: z.enum(CARD_STATUSES).openapi({
      description: "`inactive` until activated via API; `blocked` prevents use; `active` is usable",
    }),
    activatedAt: z.iso.datetime().nullable().openapi({
      description: "Server time when the card was activated; null if never activated",
    }),
    createdAt: z.iso.datetime().openapi({ description: "Row creation time" }),
    updatedAt: z.iso.datetime().openapi({ description: "Last update time" }),
  })
  .openapi("Card")

export const CompaniesListResponseSchema = z
  .array(CompanyResponseSchema)
  .openapi("CompaniesListResponse")

export const CompanyCardsListResponseSchema = z
  .array(CardResponseSchema)
  .openapi("CompanyCardsListResponse")

export const InvoiceResponseSchema = z
  .object({
    id: z.uuid().openapi({ description: "Invoice id" }),
    companyId: z.uuid().openapi({ description: "Company this invoice belongs to" }),
    amount: z.string().openapi({ description: "Invoice amount as a decimal string" }),
    currency: z
      .string()
      .length(3)
      .openapi({ description: "ISO 4217 currency code" }),
    status: z.enum(INVOICE_STATUSES).openapi({
      description: "`pending` (not yet paid), `overdue` (past due, unpaid), `paid` (settled)",
    }),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .openapi({ description: "Calendar due date (YYYY-MM-DD)" }),
    paidAt: z.iso.datetime().nullable().openapi({
      description: "When the invoice was marked paid; null if unpaid",
    }),
    createdAt: z.iso.datetime().openapi({ description: "Row creation time" }),
    updatedAt: z.iso.datetime().openapi({ description: "Last update time" }),
  })
  .openapi("Invoice")

export const CompanyInvoicesDueListResponseSchema = z
  .array(InvoiceResponseSchema)
  .openapi("CompanyInvoicesDueListResponse")

export const CardDetailResponseSchema = CardResponseSchema.extend({
  spendUsed: z.string().openapi({
    description: "Sum of `settled` transaction amounts on this card (decimal string)",
  }),
  remainingSpend: z.string().openapi({
    description: "spendLimit minus spendUsed as a decimal string; never negative (floored at 0)",
  }),
}).openapi("CardDetail")

export const TransactionResponseSchema = z
  .object({
    id: z.uuid().openapi({ description: "Transaction id" }),
    cardId: z.uuid().openapi({ description: "Card this transaction is posted to" }),
    invoiceId: z.uuid().nullable().openapi({ description: "Related invoice id when allocated" }),
    amount: z.string().openapi({ description: "Posted amount as a decimal string" }),
    currency: z
      .string()
      .length(3)
      .openapi({ description: "ISO 4217 currency code" }),
    description: z.string().nullable().openapi({ description: "Narrative or internal description" }),
    merchantName: z.string().nullable().openapi({ description: "Merchant or counterparty name when known" }),
    status: z.enum(TRANSACTION_STATUSES).openapi({
      description:
        "`pending` (authorized, not finalized), `settled` (counts toward spend), `declined`, `refunded`",
    }),
    transactedAt: z
      .iso.datetime()
      .openapi({ description: "When the transaction was captured (sort order is newest first)" }),
    createdAt: z.iso.datetime().openapi({ description: "Persisted-at timestamp" }),
  })
  .openapi("Transaction")

export const CardTransactionsPageResponseSchema = z
  .object({
    items: z.array(TransactionResponseSchema).openapi({
      description: "Slice of transactions for `page`, ordered by `transactedAt` descending",
    }),
    page: z.number().int().min(1).openapi({ description: "Current 1-based page" }),
    limit: z.number().int().min(1).openapi({ description: "Requested page size" }),
    total: z
      .number()
      .int()
      .min(0)
      .openapi({ description: "Total rows matching filters (use with `limit` for page count)" }),
  })
  .openapi("CardTransactionsPage")

export const CardTransactionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({
      param: { name: "page", in: "query" },
      description: "1-based page index",
      example: 1,
    }),
    limit: z.coerce.number().int().min(1).default(20).openapi({
      param: { name: "limit", in: "query" },
      description: "Number of transactions per page",
      example: 20,
    }),
    from: z.iso.datetime().optional().openapi({
      param: { name: "from", in: "query" },
      description: "Inclusive lower bound on `transactedAt` (ISO 8601)",
    }),
    to: z.iso.datetime().optional().openapi({
      param: { name: "to", in: "query" },
      description: "Inclusive upper bound on `transactedAt` (ISO 8601)",
    }),
  })
  .superRefine((q, ctx) => {
    if (q.from && q.to && q.from > q.to) {
      ctx.addIssue({
        code: "custom",
        message: "`from` must be less than or equal to `to`",
        path: ["from"],
      })
    }
  })
  .openapi("CardTransactionsQuery")
