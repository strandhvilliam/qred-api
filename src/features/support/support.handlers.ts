import type { RouteHandler } from "@hono/zod-openapi"
import { getDb } from "../../db/client"
import { forbidden, internalError } from "../../lib/errors"
import { getUserCompanyMembership } from "../companies/companies.repository"
import { insertSupportTicket } from "./support.repository"
import { createSupportTicketRoute } from "./support.routes"

export const createSupportTicketHandler: RouteHandler<typeof createSupportTicketRoute> = async (
  c,
) => {
  const userId = c.get("userId")
  const body = c.req.valid("json")

  const db = getDb(c)

  let companyId: string | null = null
  if (body.companyId) {
    const membership = await getUserCompanyMembership(db, userId, body.companyId)

    if (!membership) {
      return forbidden.json(c)
    }
    companyId = body.companyId
  }

  const row = await insertSupportTicket(db, {
    userId,
    companyId,
    subject: body.subject ?? null,
    message: body.message,
  })

  if (!row) {
    return internalError.json(c)
  }

  return c.json(
    {
      id: row.id,
      userId: row.userId,
      companyId: row.companyId,
      subject: row.subject,
      message: row.message,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    201,
  )
}

export const supportOpenAPIRoutes = [
  { route: createSupportTicketRoute, handler: createSupportTicketHandler },
] as const
