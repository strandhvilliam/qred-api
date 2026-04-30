import { createRoute } from "@hono/zod-openapi"
import { jwtAuth } from "../../middleware/jwtAuth"
import { requireUuidSub } from "../../middleware/requireUuidSub"
import { conflict, forbidden, invalidSub, notFound, unauthorized, validationError } from "../../lib/errors"
import { jsonResponse } from "../../lib/utils"
import {
  CardDetailResponseSchema,
  CardResponseSchema,
  CardTransactionsPageResponseSchema,
  CardTransactionsQuerySchema,
  CompaniesListResponseSchema,
  CompanyCardPathParamsSchema,
  CompanyCardsListResponseSchema,
  CompanyIdPathParamsSchema,
  CompanyInvoicesDueListResponseSchema,
} from "./companies.schemas"

export const companiesListRoute = createRoute({
  method: "get",
  path: "/api/v1/companies",
  tags: ["Companies"],
  summary: "List companies for the current user",
  security: [{ Bearer: [] }],
  middleware: [jwtAuth, requireUuidSub] as const,
  responses: {
    200: jsonResponse(CompaniesListResponseSchema, "Companies the authenticated user belongs to"),
    400: invalidSub.openapi(),
    401: unauthorized.openapi(),
  },
})

export const companyCardsRoute = createRoute({
  method: "get",
  path: "/api/v1/companies/{companyId}/cards",
  tags: ["Companies"],
  summary: "List cards in a company",
  security: [{ Bearer: [] }],
  middleware: [jwtAuth, requireUuidSub] as const,
  request: {
    params: CompanyIdPathParamsSchema,
  },
  responses: {
    200: jsonResponse(
      CompanyCardsListResponseSchema,
      "Cards in the company the caller may access (all cards if company admin, otherwise cards linked via user_cards)",
    ),
    422: validationError.openapi(),
    400: invalidSub.openapi(),
    401: unauthorized.openapi(),
    403: forbidden.openapi(),
  },
})

export const companyCardDetailRoute = createRoute({
  method: "get",
  path: "/api/v1/companies/{companyId}/cards/{cardId}",
  tags: ["Companies"],
  summary: "Get card details",
  security: [{ Bearer: [] }],
  middleware: [jwtAuth, requireUuidSub] as const,
  request: {
    params: CompanyCardPathParamsSchema,
  },
  responses: {
    200: jsonResponse(
      CardDetailResponseSchema,
      "Card details including spend limit and spend used (sum of settled transaction amounts)",
    ),
    422: validationError.openapi(),
    400: invalidSub.openapi(),
    401: unauthorized.openapi(),
    403: forbidden.openapi(),
    404: notFound.openapi(
      "Card not found for this company, or the caller may not access this card",
    ),
  },
})

export const companyCardTransactionsRoute = createRoute({
  method: "get",
  path: "/api/v1/companies/{companyId}/cards/{cardId}/transactions",
  tags: ["Companies"],
  summary: "List transactions for a card",
  security: [{ Bearer: [] }],
  middleware: [jwtAuth, requireUuidSub] as const,
  request: {
    params: CompanyCardPathParamsSchema,
    query: CardTransactionsQuerySchema,
  },
  responses: {
    200: jsonResponse(
      CardTransactionsPageResponseSchema,
      "Transactions for the card, newest first (`transactedAt` descending), with pagination",
    ),
    422: validationError.openapi(),
    400: invalidSub.openapi(),
    401: unauthorized.openapi(),
    403: forbidden.openapi(),
    404: notFound.openapi(
      "Card not found for this company, or the caller may not access this card",
    ),
  },
})

export const companyInvoicesDueRoute = createRoute({
  method: "get",
  path: "/api/v1/companies/{companyId}/invoices/due",
  tags: ["Companies"],
  summary: "List unpaid overdue invoices",
  security: [{ Bearer: [] }],
  middleware: [jwtAuth, requireUuidSub] as const,
  request: {
    params: CompanyIdPathParamsSchema,
  },
  responses: {
    200: jsonResponse(
      CompanyInvoicesDueListResponseSchema,
      "Unpaid invoices for the company whose due date is today or in the past (`pending` or `overdue`), ordered by due date ascending",
    ),
    422: validationError.openapi(),
    400: invalidSub.openapi(),
    401: unauthorized.openapi(),
    403: forbidden.openapi(),
  },
})

export const companyCardActivateRoute = createRoute({
  method: "post",
  path: "/api/v1/companies/{companyId}/cards/{cardId}/activate",
  tags: ["Companies"],
  summary: "Activate a card",
  description:
    "Only cards with status `inactive` can be activated. Already-active or blocked cards return 409.",
  security: [{ Bearer: [] }],
  middleware: [jwtAuth, requireUuidSub] as const,
  request: {
    params: CompanyCardPathParamsSchema,
  },
  responses: {
    200: jsonResponse(
      CardResponseSchema,
      "Card is now active; `activatedAt` is set to the server time of this request",
    ),
    409: conflict.openapi(
      "Card is not in `inactive` state (already active or blocked)",
    ),
    422: validationError.openapi(),
    400: invalidSub.openapi(),
    401: unauthorized.openapi(),
    403: forbidden.openapi(),
    404: notFound.openapi(
      "Card not found for this company, or the caller may not access this card",
    ),
  },
})
