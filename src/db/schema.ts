import { relations } from "drizzle-orm"
import {
  char,
  date,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  numeric,
} from "drizzle-orm/pg-core"

import type {
  CardStatus,
  InvoiceStatus,
  SupportTicketStatus,
  TransactionStatus,
  UserCardRole,
  UserCompanyRole,
} from "./enums"

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  orgNumber: text("org_number").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const userCompanies = pgTable(
  "user_companies",
  {
    userId: uuid("user_id").notNull(),
    companyId: uuid("company_id").notNull(),
    role: text("role").$type<UserCompanyRole>().notNull().default("member"),
  },
  (table) => [primaryKey({ columns: [table.userId, table.companyId] })],
)

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    cardLabel: text("card_label").notNull().default(""),
    spendLimit: numeric("spend_limit", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: char("currency", { length: 3 }).notNull().default("SEK"),
    status: text("status").$type<CardStatus>().notNull().default("inactive"),
    activatedAt: timestamp("activated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
)

export const userCards = pgTable(
  "user_cards",
  {
    userId: uuid("user_id").notNull(),
    cardId: uuid("card_id").notNull(),
    companyId: uuid("company_id").notNull(),
    role: text("role").$type<UserCardRole>().notNull().default("cardholder"),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
    assignedBy: uuid("assigned_by"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.cardId] }),
  ],
)

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("SEK"),
    status: text("status").$type<InvoiceStatus>().notNull().default("pending"),
    dueDate: date("due_date").notNull(),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
)

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id").notNull(),
    invoiceId: uuid("invoice_id"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("SEK"),
    description: text("description"),
    merchantName: text("merchant_name"),
    status: text("status").$type<TransactionStatus>().notNull().default("pending"),
    transactedAt: timestamp("transacted_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
)

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  companyId: uuid("company_id"),
  subject: text("subject"),
  message: text("message").notNull(),
  status: text("status").$type<SupportTicketStatus>().notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const usersRelations = relations(users, ({ many }) => ({
  userCompanies: many(userCompanies),
  userCards: many(userCards),
  supportTickets: many(supportTickets),
}))

export const companiesRelations = relations(companies, ({ many }) => ({
  userCompanies: many(userCompanies),
  cards: many(cards),
  invoices: many(invoices),
}))

export const userCompaniesRelations = relations(userCompanies, ({ one }) => ({
  user: one(users, { fields: [userCompanies.userId], references: [users.id] }),
  company: one(companies, {
    fields: [userCompanies.companyId],
    references: [companies.id],
  }),
}))

export const cardsRelations = relations(cards, ({ one, many }) => ({
  company: one(companies, {
    fields: [cards.companyId],
    references: [companies.id],
  }),
  userCards: many(userCards),
  transactions: many(transactions),
}))

export const userCardsRelations = relations(userCards, ({ one }) => ({
  user: one(users, { fields: [userCards.userId], references: [users.id] }),
  card: one(cards, { fields: [userCards.cardId], references: [cards.id] }),
  company: one(companies, {
    fields: [userCards.companyId],
    references: [companies.id],
  }),
  assignedByUser: one(users, {
    fields: [userCards.assignedBy],
    references: [users.id],
  }),
}))

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  company: one(companies, {
    fields: [invoices.companyId],
    references: [companies.id],
  }),
  transactions: many(transactions),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  card: one(cards, {
    fields: [transactions.cardId],
    references: [cards.id],
  }),
  invoice: one(invoices, {
    fields: [transactions.invoiceId],
    references: [invoices.id],
  }),
}))

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [supportTickets.companyId],
    references: [companies.id],
  }),
}))
