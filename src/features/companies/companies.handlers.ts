import type { RouteHandler } from "@hono/zod-openapi"
import { getDb } from "../../db/client"
import { conflict, forbidden, notFound } from "../../lib/errors"
import {
  activateCompanyCard,
  getCardInCompany,
  getUserCardAssignment,
  getUserCompanyMembership,
  listAllCardsForCompany,
  listCardsAssignedToUserInCompany,
  listCardTransactionsPage,
  listDueUnpaidInvoicesForCompany,
  listUserCompaniesWithDetails,
  sumSettledAmountForCard,
} from "./companies.repository"
import {
  companiesListRoute,
  companyCardActivateRoute,
  companyCardDetailRoute,
  companyCardTransactionsRoute,
  companyCardsRoute,
  companyInvoicesDueRoute,
} from "./companies.routes"

export const listCompaniesHandler: RouteHandler<typeof companiesListRoute> = async (c) => {
  const userId = c.get("userId")
  const db = getDb(c)
  const rows = await listUserCompaniesWithDetails(db, userId)

  return c.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      orgNumber: row.orgNumber,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    200,
  )
}

export const listCompanyInvoicesDueHandler: RouteHandler<typeof companyInvoicesDueRoute> = async (
  c,
) => {
  const userId = c.get("userId")
  const { companyId } = c.req.valid("param")

  const db = getDb(c)
  const membership = await getUserCompanyMembership(db, userId, companyId)

  if (!membership) {
    return forbidden.json(c)
  }

  const rows = await listDueUnpaidInvoicesForCompany(db, companyId)

  return c.json(
    rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      dueDate: row.dueDate,
      paidAt: row.paidAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    200,
  )
}

export const listCompanyCardsHandler: RouteHandler<typeof companyCardsRoute> = async (c) => {
  const userId = c.get("userId")
  const { companyId } = c.req.valid("param")

  const db = getDb(c)
  const membership = await getUserCompanyMembership(db, userId, companyId)

  if (!membership) {
    return forbidden.json(c)
  }

  if (membership.role === "admin") {
    const rows = await listAllCardsForCompany(db, companyId)
    return c.json(
      rows.map((row) => ({
        id: row.id,
        companyId: row.companyId,
        cardLabel: row.cardLabel,
        spendLimit: row.spendLimit,
        currency: row.currency,
        status: row.status,
        activatedAt: row.activatedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      200,
    )
  }

  const rows = await listCardsAssignedToUserInCompany(db, userId, companyId)

  return c.json(
    rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      cardLabel: row.cardLabel,
      spendLimit: row.spendLimit,
      currency: row.currency,
      status: row.status,
      activatedAt: row.activatedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    200,
  )
}

export const getCompanyCardDetailHandler: RouteHandler<typeof companyCardDetailRoute> = async (
  c,
) => {
  const userId = c.get("userId")
  const { companyId, cardId } = c.req.valid("param")

  const db = getDb(c)
  const membership = await getUserCompanyMembership(db, userId, companyId)

  if (!membership) {
    return forbidden.json(c)
  }

  const cardRow = await getCardInCompany(db, companyId, cardId)

  if (!cardRow) {
    return notFound.json(
      c,
      "Card not found for this company, or the caller may not access this card",
    )
  }

  if (membership.role !== "admin") {
    const assignment = await getUserCardAssignment(db, userId, companyId, cardId)

    if (!assignment) {
      return notFound.json(
        c,
        "Card not found for this company, or the caller may not access this card",
      )
    }
  }

  const spent = await sumSettledAmountForCard(db, cardId)
  const spendUsed = spent?.total ?? "0"
  const remaining = Math.max(0, Number(cardRow.spendLimit) - Number(spendUsed))

  return c.json(
    {
      id: cardRow.id,
      companyId: cardRow.companyId,
      cardLabel: cardRow.cardLabel,
      spendLimit: cardRow.spendLimit,
      currency: cardRow.currency,
      status: cardRow.status,
      activatedAt: cardRow.activatedAt?.toISOString() ?? null,
      createdAt: cardRow.createdAt.toISOString(),
      updatedAt: cardRow.updatedAt.toISOString(),
      spendUsed,
      remainingSpend: remaining.toFixed(2),
    },
    200,
  )
}

export const listCompanyCardTransactionsHandler: RouteHandler<
  typeof companyCardTransactionsRoute
> = async (c) => {
  const userId = c.get("userId")
  const { companyId, cardId } = c.req.valid("param")
  const { page, limit, from, to } = c.req.valid("query")

  const db = getDb(c)
  const membership = await getUserCompanyMembership(db, userId, companyId)

  if (!membership) {
    return forbidden.json(c)
  }

  const cardRow = await getCardInCompany(db, companyId, cardId)

  if (!cardRow) {
    return notFound.json(
      c,
      "Card not found for this company, or the caller may not access this card",
    )
  }

  if (membership.role !== "admin") {
    const assignment = await getUserCardAssignment(db, userId, companyId, cardId)

    if (!assignment) {
      return notFound.json(
        c,
        "Card not found for this company, or the caller may not access this card",
      )
    }
  }

  const { rows, total } = await listCardTransactionsPage(db, cardId, { page, limit, from, to })

  return c.json(
    {
      items: rows.map((row) => ({
        id: row.id,
        cardId: row.cardId,
        invoiceId: row.invoiceId,
        amount: row.amount,
        currency: row.currency,
        description: row.description,
        merchantName: row.merchantName,
        status: row.status,
        transactedAt: row.transactedAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      limit,
      total,
    },
    200,
  )
}

export const activateCompanyCardHandler: RouteHandler<typeof companyCardActivateRoute> = async (
  c,
) => {
  const userId = c.get("userId")
  const { companyId, cardId } = c.req.valid("param")

  const db = getDb(c)
  const membership = await getUserCompanyMembership(db, userId, companyId)

  if (!membership) {
    return forbidden.json(c)
  }

  const cardRow = await getCardInCompany(db, companyId, cardId)

  if (!cardRow) {
    return notFound.json(
      c,
      "Card not found for this company, or the caller may not access this card",
    )
  }

  if (membership.role !== "admin") {
    const assignment = await getUserCardAssignment(db, userId, companyId, cardId)

    if (!assignment) {
      return notFound.json(
        c,
        "Card not found for this company, or the caller may not access this card",
      )
    }
  }

  if (cardRow.status !== "inactive") {
    return conflict.json(
      c,
      cardRow.status === "active"
        ? "Card is already active"
        : "Card is blocked and cannot be activated",
    )
  }

  const updated = await activateCompanyCard(db, companyId, cardId, new Date())

  if (!updated) {
    return notFound.json(
      c,
      "Card not found for this company, or the caller may not access this card",
    )
  }

  return c.json(
    {
      id: updated.id,
      companyId: updated.companyId,
      cardLabel: updated.cardLabel,
      spendLimit: updated.spendLimit,
      currency: updated.currency,
      status: updated.status,
      activatedAt: updated.activatedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
    200,
  )
}

export const companyOpenAPIRoutes = [
  { route: companiesListRoute, handler: listCompaniesHandler },
  { route: companyInvoicesDueRoute, handler: listCompanyInvoicesDueHandler },
  { route: companyCardsRoute, handler: listCompanyCardsHandler },
  { route: companyCardDetailRoute, handler: getCompanyCardDetailHandler },
  {
    route: companyCardTransactionsRoute,
    handler: listCompanyCardTransactionsHandler,
  },
  { route: companyCardActivateRoute, handler: activateCompanyCardHandler },
] as const
