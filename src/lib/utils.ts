import { z } from "@hono/zod-openapi"

export const jsonResponse = <TSchema extends z.ZodType>(schema: TSchema, description: string) => ({
  description,
  content: {
    "application/json": { schema },
  },
})
