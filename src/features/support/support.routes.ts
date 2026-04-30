import { createRoute } from "@hono/zod-openapi"
import { jwtAuth } from "../../middleware/jwtAuth"
import { requireUuidSub } from "../../middleware/requireUuidSub"
import {
  forbidden,
  internalError,
  invalidSub,
  unauthorized,
  validationError,
} from "../../lib/errors"
import { jsonResponse } from "../../lib/utils"
import { CreateSupportTicketBodySchema, SupportTicketResponseSchema } from "./support.schemas"

export const createSupportTicketRoute = createRoute({
  method: "post",
  path: "/api/v1/support/tickets",
  tags: ["Support"],
  summary: "Create a support ticket",
  description: "Creates a ticket associated with the authenticated user. Optional `companyId` must be a company the user belongs to.",
  security: [{ Bearer: [] }],
  middleware: [jwtAuth, requireUuidSub] as const,
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateSupportTicketBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: jsonResponse(
      SupportTicketResponseSchema,
      "Support ticket created for the authenticated user",
    ),
    422: validationError.openapi(),
    400: invalidSub.openapi(),
    401: unauthorized.openapi(),
    403: forbidden.openapi(),
    500: internalError.openapi(),
  },
})
