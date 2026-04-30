import { createMiddleware } from "hono/factory"
import { env } from "hono/adapter"
import { HTTPException } from "hono/http-exception"
import { jwtVerify, type JWTPayload } from "jose"
import type { AppEnv } from "../env"
import { unauthorized } from "../lib/errors"
import { jwtSecretAndClaimsFromEnv } from "../lib/jwt-options"

/** Context variables set after {@link jwtAuth} runs. */
export type JwtAuthVariables = { jwtPayload: JWTPayload }

/**
 * Bearer JWT auth: HS256 with shared secret from `JWT_SECRET`.
 * No remote JWKS or OAuth flow — verify tokens signed with the same secret.
 */
export const jwtAuth = createMiddleware<{
  Bindings: AppEnv
  Variables: JwtAuthVariables
}>(async (c, next) => {
  const { secretKey, issuer, audience } = jwtSecretAndClaimsFromEnv(env<AppEnv>(c))

  const raw = c.req.header("Authorization")
  const token = raw?.match(/^\s*Bearer\s+(\S+)\s*$/i)?.[1]
  if (!token) {
    throw new HTTPException(401, {
      message: "Authorization header must be a Bearer token",
      res: unauthorized.toResponse(
        "Authorization header must be a Bearer token",
        `Bearer realm="${c.req.url}",error="invalid_request",error_description="Authorization header must be a Bearer token"`,
      ),
    })
  }

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer,
      audience,
      algorithms: ["HS256"],
    })
    c.set("jwtPayload", payload)
    await next()
  } catch (e) {
    throw new HTTPException(401, {
      message: "Token verification failed",
      cause: e,
      res: unauthorized.toResponse(
        "Token verification failed",
        `Bearer realm="${c.req.url}",error="invalid_token",error_description="Token verification failed"`,
      ),
    })
  }
})
