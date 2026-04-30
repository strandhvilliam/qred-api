/** Stored as plain text in the DB (PostgreSQL ENUM types are not used). */

export const USER_COMPANY_ROLES = ["admin", "member"] as const
export type UserCompanyRole = (typeof USER_COMPANY_ROLES)[number]

export const USER_CARD_ROLES = ["admin", "cardholder"] as const
export type UserCardRole = (typeof USER_CARD_ROLES)[number]

export const CARD_STATUSES = ["active", "inactive", "blocked"] as const
export type CardStatus = (typeof CARD_STATUSES)[number]

export const INVOICE_STATUSES = ["pending", "paid", "overdue"] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const TRANSACTION_STATUSES = ["pending", "settled", "declined", "refunded"] as const
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]

export const SUPPORT_TICKET_STATUSES = ["open", "in_progress", "closed"] as const
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number]
