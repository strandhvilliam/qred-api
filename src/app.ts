import { OpenAPIHono, z } from "@hono/zod-openapi"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "./env"
import { companyOpenAPIRoutes } from "./features/companies/companies.handlers"
import { devOpenAPIRoutes } from "./features/dev/dev.handlers"
import { supportOpenAPIRoutes } from "./features/support/support.handlers"
import { internalError, notFound, validationError } from "./lib/errors"
import { swaggerUI } from "@hono/swagger-ui"

export const app = new OpenAPIHono<{ Bindings: AppEnv }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return validationError.json(c, result.error)
    }
  },
})

app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description:
    "HS256 JWT signed with the API's `JWT_SECRET`. Send as `Authorization: Bearer <token>`. Optional `iss` / `aud` are validated when `JWT_ISSUER` / `JWT_AUDIENCE` are set.",
})

const openApiDescription = [
  "JSON API for companies, corporate cards, transactions, invoices, and support tickets.",
  "",
  "**Authentication** — Include `Authorization: Bearer <JWT>`. Tokens use HS256; the JWT `sub` claim must be a UUID (user id).",
  "",
  "**Errors** — Unless noted, error bodies are JSON: `{ ok: false, error: \"<code>\", message?: string }` or `{ ok: false, error: \"validation_error\", issues: [...] }` for HTTP 422.",
  "",
  "**Development** — When `ENABLE_DEV_ENDPOINTS=true`, `GET /dev/token` mints a JWT and `POST /dev/seed` reloads demo data; otherwise those routes return 404.",
].join("\n")

// Health check route
app.openapi(
  {
    method: "get",
    path: "/health",
    tags: ["System"],
    summary: "Liveness check",
    description: "Public endpoint. Returns 200 when the service process is running; does not verify the database.",
    responses: {
      200: {
        description: "Service is reachable",
        content: {
          "application/json": {
            schema: z
              .object({
                status: z.literal("ok").openapi({ description: "Always `ok` when the process is responding" }),
              })
              .openapi("HealthOk"),
          },
        },
      },
    },
  },
  (c) => c.json({ status: "ok" }, 200),
)

// Domain logic routes
app.openapiRoutes(companyOpenAPIRoutes)
app.openapiRoutes(supportOpenAPIRoutes)
app.openapiRoutes(devOpenAPIRoutes)

// OpenAPI document endpoint
app.get(
  "/ui",
  swaggerUI({
    url: "/doc",
  }),
)
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    title: "Qred Assignment API",
    version: "1.0.0",
    description: openApiDescription,
  },
  servers: [{ url: "/", description: "Current host (local, API Gateway, or Lambda URL)" }],
  tags: [
    {
      name: "System",
      description: "Health and operational endpoints without authentication.",
    },
    {
      name: "Companies",
      description:
        "Companies, cards, card transactions, and invoices. All routes require a valid Bearer JWT with UUID `sub`.",
    },
    { name: "Support", description: "Authenticated users can create and track support tickets." },
    {
      name: "Development",
      description:
        "Seeding and token minting for local development. Disabled unless environment variable `ENABLE_DEV_ENDPOINTS=true`.",
    },
  ],
})

// Error handling
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  console.error(err)
  return internalError.json(c)
})

app.notFound((c) => notFound.json(c, "Not Found"))
