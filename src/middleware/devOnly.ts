import { createMiddleware } from "hono/factory"
import { env } from "hono/adapter"
import type { AppEnv } from "../env"
import { notFound } from "../lib/errors"

function isDevEndpointsEnabled(bindings?: AppEnv) {
  const v = bindings?.ENABLE_DEV_ENDPOINTS?.trim().toLowerCase()
  return v === "true" || v === "1" || v === "yes"
}

/** Returns 404 unless `ENABLE_DEV_ENDPOINTS` is set to `1`, `true`, or `yes`. */
export const devOnly = createMiddleware<{ Bindings: AppEnv }>(async (c, next) => {
  if (!isDevEndpointsEnabled(env<AppEnv>(c))) {
    return notFound.json(c, "Not Found")
  }
  await next()
})
