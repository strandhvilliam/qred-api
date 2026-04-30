import { AuroraDSQLPool } from "@aws/aurora-dsql-node-postgres-connector"
import type { Context } from "hono"
import { env } from "hono/adapter"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import type { AppEnv } from "../env"
import * as schema from "./schema"

let pool: pg.Pool | undefined

function normalizeDsqlHost(raw: string): string {
  let host = raw.trim()
  host = host.replace(/^https?:\/\//u, "")
  host = host.split("/")[0] ?? host
  return host
}

function readAppEnv(c: Context<{ Bindings: AppEnv }>) {
  return env<AppEnv>(c as Context<{ Bindings: AppEnv }>)
}

export function getPool(c: Context<{ Bindings: AppEnv }>): pg.Pool {
  const e = readAppEnv(c)
  const dsqlHost = e.DSQL_ENDPOINT?.trim()
  if (!dsqlHost) {
    throw new Error("DSQL_ENDPOINT is required (and usually DSQL_REGION)")
  }
  if (!pool) {
    pool = new AuroraDSQLPool({
      host: normalizeDsqlHost(dsqlHost),
      user: e.DSQL_USER?.trim() || "admin",
      database: e.DSQL_DATABASE?.trim() || "postgres",
      region: e.DSQL_REGION?.trim(),
      max: 1,
    })
  }
  return pool
}

export function getDb(c: Context) {
  return drizzle(getPool(c), { schema })
}
