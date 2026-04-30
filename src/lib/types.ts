import { z } from "@hono/zod-openapi"

/** Validated UUID from JWT `sub` and DB user id columns. */
export const UserIdSchema = z.uuid().openapi({
  description: "User id; must match JWT `sub` for authenticated routes",
})

export type UserId = z.infer<typeof UserIdSchema>
