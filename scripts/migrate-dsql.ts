import "dotenv/config"

import { AuroraDSQLPool } from "@aws/aurora-dsql-node-postgres-connector"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import type { Pool, PoolClient, QueryResult } from "pg"

const rootDir = process.cwd()
const migrationsDir = join(rootDir, "sql", "migrations")

function normalizeDsqlHost(raw: string): string {
  let host = raw.trim()
  host = host.replace(/^https?:\/\//u, "")
  host = host.split("/")[0] ?? host
  return host
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

function createPool(): Pool {
  return new AuroraDSQLPool({
    host: normalizeDsqlHost(requireEnv("DSQL_ENDPOINT")),
    user: process.env.DSQL_USER?.trim() || "admin",
    database: process.env.DSQL_DATABASE?.trim() || "postgres",
    region: process.env.DSQL_REGION?.trim() || process.env.AWS_REGION?.trim(),
    max: 1,
  })
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ""
  let quote: "'" | '"' | null = null
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i]
    const next = sql[i + 1]

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false
        current += char
      }
      continue
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false
        i += 1
      }
      continue
    }

    if (!quote && char === "-" && next === "-") {
      inLineComment = true
      i += 1
      continue
    }

    if (!quote && char === "/" && next === "*") {
      inBlockComment = true
      i += 1
      continue
    }

    if (quote) {
      current += char
      if (char === quote) {
        if (quote === "'" && next === "'") {
          current += next
          i += 1
        } else {
          quote = null
        }
      }
      continue
    }

    if (char === "'" || char === '"') {
      quote = char
      current += char
      continue
    }

    if (char === ";") {
      const statement = current.trim()
      if (statement) {
        statements.push(statement)
      }
      current = ""
      continue
    }

    current += char
  }

  const finalStatement = current.trim()
  if (finalStatement) {
    statements.push(finalStatement)
  }

  return statements
}

function getAsyncJobId(result: QueryResult): string | undefined {
  const row = result.rows[0] as { job_id?: unknown } | undefined
  return typeof row?.job_id === "string" ? row.job_id : undefined
}

async function waitForAsyncJob(client: PoolClient, jobId: string): Promise<void> {
  await client.query("CALL sys.wait_for_job($1)", [jobId])
}

async function executeDdl(client: PoolClient, statement: string): Promise<void> {
  await client.query("BEGIN")
  try {
    const result = await client.query(statement)
    await client.query("COMMIT")

    const jobId = getAsyncJobId(result)
    if (jobId) {
      console.log(`Waiting for Aurora DSQL async job ${jobId}`)
      await waitForAsyncJob(client, jobId)
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  }
}

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await executeDdl(
    client,
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  )
}

async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(migrationsDir)
  return entries.filter((entry) => entry.endsWith(".sql")).sort()
}

async function isApplied(client: PoolClient, version: string): Promise<boolean> {
  const result = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1 LIMIT 1", [
    version,
  ])
  return result.rowCount !== null && result.rowCount > 0
}

async function markApplied(client: PoolClient, version: string): Promise<void> {
  await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version])
}

async function migrate(): Promise<void> {
  const pool = createPool()
  const client = await pool.connect()

  try {
    await ensureMigrationTable(client)

    for (const file of await listMigrationFiles()) {
      if (await isApplied(client, file)) {
        console.log(`Skipping ${file}`)
        continue
      }

      console.log(`Applying ${file}`)
      const sql = await readFile(join(migrationsDir, file), "utf8")
      const statements = splitSqlStatements(sql)

      for (const statement of statements) {
        await executeDdl(client, statement)
      }

      await markApplied(client, file)
      console.log(`Applied ${file}`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
