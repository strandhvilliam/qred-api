import { z } from "@hono/zod-openapi"
import { SUPPORT_TICKET_STATUSES } from "../../db/enums"
import { UserIdSchema } from "../../lib/types"

export const CreateSupportTicketBodySchema = z
  .object({
    subject: z.string().optional().openapi({ description: "Optional ticket subject" }),
    message: z.string().min(1).openapi({ description: "Ticket message body" }),
    companyId: z
      .uuid()
      .optional()
      .openapi({ description: "Company to link the ticket to; caller must be a member" }),
  })
  .openapi("CreateSupportTicketBody")

export const SupportTicketResponseSchema = z
  .object({
    id: z.uuid().openapi({ description: "Support ticket id" }),
    userId: UserIdSchema,
    companyId: z
      .uuid()
      .nullable()
      .openapi({ description: "Associated company id when supplied in the request" }),
    subject: z
      .string()
      .nullable()
      .openapi({ description: "Subject line; null if not provided when creating the ticket" }),
    message: z.string().openapi({ description: "Ticket body" }),
    status: z.enum(SUPPORT_TICKET_STATUSES).openapi({
      description: "`open` (new), `in_progress` (being handled), `closed` (resolved or archived)",
    }),
    createdAt: z.iso.datetime().openapi({ description: "Creation time" }),
    updatedAt: z.iso.datetime().openapi({ description: "Last mutation time" }),
  })
  .openapi("SupportTicket")
