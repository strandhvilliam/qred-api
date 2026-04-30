import type { Context } from "hono"
import type { ZodError } from "zod"
import { z } from "@hono/zod-openapi"
import { jsonResponse } from "./utils"

const ZodIssueInResponseSchema = z
  .object({
    path: z.array(z.union([z.string(), z.number()])),
    message: z.string(),
    code: z.string().optional(),
  })
  .loose()
  .openapi("ZodIssueInResponse", {
    description: "Zod validation issue; additional properties may be present depending on `code`",
  })

const ValidationErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.literal("validation_error"),
    issues: z.array(ZodIssueInResponseSchema),
  })
  .openapi("ValidationError")

const messageErrorSchema = <TCode extends string>(componentName: string, code: TCode) =>
  z
    .object({
      ok: z.literal(false),
      error: z.literal(code),
      message: z.string(),
    })
    .openapi(componentName)

const InvalidSubErrorResponseSchema = messageErrorSchema("InvalidSubError", "invalid_sub")
const UnauthorizedErrorResponseSchema = messageErrorSchema("UnauthorizedError", "unauthorized")
const ForbiddenErrorResponseSchema = messageErrorSchema("ForbiddenError", "forbidden")
const NotFoundErrorResponseSchema = messageErrorSchema("NotFoundError", "not_found")
const InternalErrorResponseSchema = messageErrorSchema("InternalError", "internal_error")

export const validationError = {
  schema: ValidationErrorResponseSchema,
  openapi: (message = "Path or query failed Zod validation (OpenAPIHono `defaultHook`)") =>
    jsonResponse(ValidationErrorResponseSchema, message),
  json(c: Context, error: ZodError): Response {
    const body: z.infer<typeof ValidationErrorResponseSchema> = {
      ok: false,
      error: "validation_error",
      issues: error.issues.map((issue) => ({
        ...issue,
        path: issue.path.filter(
          (segment): segment is string | number => typeof segment !== "symbol",
        ),
      })),
    }
    return c.json(body, 422)
  },
}

export const invalidSub = {
  schema: InvalidSubErrorResponseSchema,
  openapi: (message = "JWT is missing a valid `sub` claim (user id as UUID)") =>
    jsonResponse(InvalidSubErrorResponseSchema, message),
  json(c: Context, message = "JWT is missing a valid `sub` claim (user id as UUID)") {
    const body: z.infer<typeof InvalidSubErrorResponseSchema> = {
      ok: false,
      error: "invalid_sub",
      message,
    }
    return c.json(body, 400)
  },
}

export const unauthorized = {
  schema: UnauthorizedErrorResponseSchema,
  openapi: (message = "Missing or invalid Bearer token") =>
    jsonResponse(UnauthorizedErrorResponseSchema, message),
  /** JSON 401 with `WWW-Authenticate` (RFC 6750) for `jwtAuth` middleware. */
  toResponse(message: string, wwwAuthenticate: string): Response {
    const body: z.infer<typeof UnauthorizedErrorResponseSchema> = {
      ok: false,
      error: "unauthorized",
      message,
    }
    return new Response(JSON.stringify(body), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": wwwAuthenticate,
      },
    })
  },
}

export const forbidden = {
  schema: ForbiddenErrorResponseSchema,
  openapi: (message = "Authenticated user is not authorized to access this resource") =>
    jsonResponse(ForbiddenErrorResponseSchema, message),
  json(c: Context, message = "Authenticated user is not authorized to access this resource") {
    const body: z.infer<typeof ForbiddenErrorResponseSchema> = {
      ok: false,
      error: "forbidden",
      message,
    }
    return c.json(body, 403)
  },
}

export const notFound = {
  schema: NotFoundErrorResponseSchema,
  openapi: (message = "Resource not found") => jsonResponse(NotFoundErrorResponseSchema, message),
  json(c: Context, message = "Resource not found") {
    const body: z.infer<typeof NotFoundErrorResponseSchema> = {
      ok: false,
      error: "not_found",
      message,
    }
    return c.json(body, 404)
  },
}

export const conflict = {
  schema: messageErrorSchema("ConflictError", "conflict"),
  openapi: (message = "Request conflicts with the current state of the resource") =>
    jsonResponse(messageErrorSchema("ConflictError", "conflict"), message),
  json(c: Context, message = "Request conflicts with the current state of the resource") {
    const body = {
      ok: false as const,
      error: "conflict" as const,
      message,
    }
    return c.json(body, 409)
  },
}

export const internalError = {
  schema: InternalErrorResponseSchema,
  openapi: (message = "Unexpected server error while processing the request") =>
    jsonResponse(InternalErrorResponseSchema, message),
  json(c: Context, message = "Unexpected server error while processing the request") {
    const body: z.infer<typeof InternalErrorResponseSchema> = {
      ok: false,
      error: "internal_error",
      message,
    }
    return c.json(body, 500)
  },
}
