import type { AppDb } from "../../db/app-db"
import { supportTickets } from "../../db/schema"
import type { UserId } from "../../lib/types"

export async function insertSupportTicket(
  db: AppDb,
  input: {
    userId: UserId
    companyId: string | null
    subject: string | null
    message: string
  },
) {
  const [row] = await db
    .insert(supportTickets)
    .values({
      userId: input.userId,
      companyId: input.companyId,
      subject: input.subject,
      message: input.message,
    })
    .returning()
  return row
}
