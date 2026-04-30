import { createRoute, z } from "@hono/zod-openapi"
import { internalError, notFound, validationError } from "../../lib/errors"
import { jsonResponse } from "../../lib/utils"
import { devOnly } from "../../middleware/devOnly"

const SeedSummarySchema = z
  .object({
    demoUserId: z.uuid().openapi({ description: "Seeded demo user id (JWT `sub`)" }),
    demoCompanyId: z.uuid().openapi({ description: "Seeded demo company id" }),
    demoEmail: z.string().openapi({ description: "Email on the seeded user row" }),
    inactiveCardId: z.uuid().openapi({ description: "Demo card in `inactive` state" }),
    activeCardId: z.uuid().openapi({ description: "Demo card in `active` state" }),
  })
  .openapi("SeedSummary")

const devSeedOkSchema = z
  .object({
    ok: z.literal(true).openapi({ description: "Indicates the seed completed successfully" }),
    summary: SeedSummarySchema,
  })
  .openapi("DevSeedOk")

const DevMintTokenQuerySchema = z.object({
  sub: z.uuid().optional().openapi({
    description:
      "JWT `sub` claim; defaults to the seeded demo user (`00000000-0000-4000-8000-000000000001`).",
    example: "00000000-0000-4000-8000-000000000001",
  }),
  expiresInMinutes: z.coerce.number().int().min(1).max(10080).optional().openapi({
    description: "Token lifetime in minutes (max one week). Default 120.",
    example: 120,
  }),
})

const DevMintTokenOkSchema = z
  .object({
    ok: z.literal(true).openapi({ description: "Indicates the token was minted" }),
    token: z
      .string()
      .openapi({ description: "HS256 JWT; pass as `Authorization: Bearer <token>`" }),
    tokenType: z.literal("Bearer").openapi({ description: "Always `Bearer` for use in the Authorization header" }),
    sub: z.string().openapi({ description: "JWT `sub` claim (user id) embedded in the token" }),
    expiresAt: z.iso.datetime().openapi({ description: "RFC 3339 expiry time" }),
  })
  .openapi("DevMintTokenOk")

export const devSeedRoute = createRoute({
  method: "post",
  path: "/dev/seed",
  tags: ["Development"],
  summary: "Reset database with demo data",
  description:
    "Requires env `ENABLE_DEV_ENDPOINTS=true` (otherwise 404). Truncates all application tables then inserts deterministic demo rows. Needs DSQL connectivity (`DSQL_ENDPOINT`, …).",
  middleware: [devOnly] as const,
  responses: {
    200: jsonResponse(devSeedOkSchema, "Database reset with demo dataset"),
    404: notFound.openapi("Dev endpoints disabled (set ENABLE_DEV_ENDPOINTS)"),
    500: internalError.openapi("Truncate/insert failed or DSQL unreachable"),
  },
})

export const devMintTokenRoute = createRoute({
  method: "get",
  path: "/dev/token",
  tags: ["Development"],
  summary: "Mint a development JWT",
  description:
    "Requires env `ENABLE_DEV_ENDPOINTS=true` (otherwise 404). Issues an HS256 JWT using `JWT_SECRET` and optional `JWT_ISSUER` / `JWT_AUDIENCE` matching production verification.",
  middleware: [devOnly] as const,
  request: {
    query: DevMintTokenQuerySchema,
  },
  responses: {
    200: jsonResponse(DevMintTokenOkSchema, "JWT suitable for Bearer auth against this API"),
    404: notFound.openapi("Dev endpoints disabled (set ENABLE_DEV_ENDPOINTS)"),
    422: validationError.openapi(),
    500: internalError.openapi("JWT_SECRET missing or signing failed"),
  },
})
