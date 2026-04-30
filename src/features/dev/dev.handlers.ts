import type { RouteHandler } from "@hono/zod-openapi"
import { env } from "hono/adapter"
import { SignJWT } from "jose"
import { getDb, getPool } from "../../db/client"
import type { AppEnv } from "../../env"
import { internalError } from "../../lib/errors"
import { jwtSecretAndClaimsFromEnv } from "../../lib/jwt-options"
import { DEMO_USER_ID } from "./demo-ids"
import { devMintTokenRoute, devSeedRoute } from "./dev.routes"
import { resetAndSeed } from "./seed-demo"

export const seedDevDbHandler: RouteHandler<typeof devSeedRoute> = async (c) => {
  try {
    const pool = getPool(c)
    const db = getDb(c)
    const summary = await resetAndSeed(db, pool)
    return c.json({ ok: true as const, summary }, 200)
  } catch (e) {
    console.error(e)
    return internalError.json(c)
  }
}

export const devMintJwtHandler: RouteHandler<typeof devMintTokenRoute> = async (c) => {
  try {
    const { secretKey, issuer, audience } = jwtSecretAndClaimsFromEnv(env<AppEnv>(c))
    const query = c.req.valid("query")

    const sub = query.sub ?? DEMO_USER_ID
    const expiresInMinutes = query.expiresInMinutes ?? 120

    const expSecs = Math.floor(Date.now() / 1000) + expiresInMinutes * 60

    let signer = new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setIssuedAt()

    signer = signer.setExpirationTime(expSecs)

    if (issuer) {
      signer = signer.setIssuer(issuer)
    }
    if (audience) {
      signer = signer.setAudience(audience)
    }

    const token = await signer.sign(secretKey)
    const expiresAt = new Date(expSecs * 1000).toISOString()

    return c.json(
      {
        ok: true as const,
        token,
        tokenType: "Bearer" as const,
        sub,
        expiresAt,
      },
      200,
    )
  } catch (e) {
    console.error(e)
    return internalError.json(c)
  }
}

export const devOpenAPIRoutes = [
  { route: devSeedRoute, handler: seedDevDbHandler },
  { route: devMintTokenRoute, handler: devMintJwtHandler },
] as const
