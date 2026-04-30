import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lte,
  ne,
  sql,
  sum,
  type SQL,
} from "drizzle-orm"
import type { AppDb } from "../../db/app-db"
import { cards, companies, invoices, transactions, userCards, userCompanies } from "../../db/schema"
import type { UserId } from "../../lib/types"

export type { AppDb } from "../../db/app-db"

export async function listUserCompaniesWithDetails(db: AppDb, userId: UserId) {
  return db
    .select({
      id: companies.id,
      name: companies.name,
      orgNumber: companies.orgNumber,
      role: userCompanies.role,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt,
    })
    .from(userCompanies)
    .innerJoin(companies, eq(userCompanies.companyId, companies.id))
    .where(eq(userCompanies.userId, userId))
}

export async function getUserCompanyMembership(db: AppDb, userId: UserId, companyId: string) {
  const [row] = await db
    .select({ role: userCompanies.role })
    .from(userCompanies)
    .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, companyId)))
    .limit(1)
  return row
}

export async function listDueUnpaidInvoicesForCompany(db: AppDb, companyId: string) {
  return db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.companyId, companyId),
        ne(invoices.status, "paid"),
        lte(invoices.dueDate, sql`CURRENT_DATE`),
      ),
    )
    .orderBy(asc(invoices.dueDate))
}

export async function listAllCardsForCompany(db: AppDb, companyId: string) {
  return db.select().from(cards).where(eq(cards.companyId, companyId))
}

export async function listCardsAssignedToUserInCompany(
  db: AppDb,
  userId: UserId,
  companyId: string,
) {
  return db
    .select({
      id: cards.id,
      companyId: cards.companyId,
      cardLabel: cards.cardLabel,
      spendLimit: cards.spendLimit,
      currency: cards.currency,
      status: cards.status,
      activatedAt: cards.activatedAt,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt,
    })
    .from(userCards)
    .innerJoin(cards, eq(userCards.cardId, cards.id))
    .where(and(eq(userCards.userId, userId), eq(userCards.companyId, companyId)))
}

export async function getCardInCompany(db: AppDb, companyId: string, cardId: string) {
  const [row] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.companyId, companyId)))
    .limit(1)
  return row
}

export async function getUserCardAssignment(
  db: AppDb,
  userId: UserId,
  companyId: string,
  cardId: string,
) {
  const [row] = await db
    .select({ cardId: userCards.cardId })
    .from(userCards)
    .where(
      and(
        eq(userCards.userId, userId),
        eq(userCards.companyId, companyId),
        eq(userCards.cardId, cardId),
      ),
    )
    .limit(1)
  return row
}

export async function sumSettledAmountForCard(db: AppDb, cardId: string) {
  const [row] = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(and(eq(transactions.cardId, cardId), eq(transactions.status, "settled")))
  return row
}

export async function listCardTransactionsPage(
  db: AppDb,
  cardId: string,
  opts: { page: number; limit: number; from?: string; to?: string },
) {
  const txConditions: SQL[] = [eq(transactions.cardId, cardId)]
  if (opts.from) {
    txConditions.push(gte(transactions.transactedAt, new Date(opts.from)))
  }
  if (opts.to) {
    txConditions.push(lte(transactions.transactedAt, new Date(opts.to)))
  }
  const txWhere = and(...txConditions)

  const [countRow] = await db.select({ total: count() }).from(transactions).where(txWhere)
  const rows = await db
    .select()
    .from(transactions)
    .where(txWhere)
    .orderBy(desc(transactions.transactedAt))
    .limit(opts.limit)
    .offset((opts.page - 1) * opts.limit)

  return { rows, total: Number(countRow?.total ?? 0) }
}

export async function activateCompanyCard(
  db: AppDb,
  companyId: string,
  cardId: string,
  at: Date,
) {
  const [updated] = await db
    .update(cards)
    .set({ status: "active", activatedAt: at, updatedAt: at })
    .where(and(eq(cards.id, cardId), eq(cards.companyId, companyId)))
    .returning()
  return updated
}
