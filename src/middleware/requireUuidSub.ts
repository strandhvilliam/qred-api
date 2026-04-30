import { createMiddleware } from "hono/factory"
import type { AppEnv } from "../env"
import { invalidSub } from "../lib/errors"
import { type UserId, UserIdSchema } from "../lib/types"
import type { JwtAuthVariables } from "./jwtAuth"

/** Context variables after JWT auth + UUID `sub` validation (see {@link requireUuidSub}). */
export type AuthedUserVariables = JwtAuthVariables & { userId: UserId }

/**
 * After `jwtAuth()`, requires `sub` to be a UUID and sets `userId` for handlers.
 */
export const requireUuidSub = createMiddleware<{
  Bindings: AppEnv
  Variables: AuthedUserVariables
}>(async (c, next) => {
  const sub = c.get("jwtPayload").sub
  const parsed = UserIdSchema.safeParse(sub)
  if (!parsed.success) {
    return invalidSub.json(c)
  }
  c.set("userId", parsed.data)
  await next()
})
