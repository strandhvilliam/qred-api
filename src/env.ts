/**
 * Environment keys available to the app via `env()` from `hono/adapter`.
 * On Node.js and AWS Lambda this maps to `process.env`; on Workers, to bindings.
 */
export type AppEnv = {
  JWT_SECRET?: string
  JWT_ISSUER?: string
  JWT_AUDIENCE?: string
  /** Aurora DSQL cluster hostname (from CDK `DatabaseEndpoint`). */
  DSQL_ENDPOINT?: string
  DSQL_REGION?: string
  DSQL_USER?: string
  DSQL_DATABASE?: string
  /** When `"1"` / `"true"` / `"yes"`, exposes `/dev/seed` and `/dev/token` (see handlers). Off by default for production safety. */
  ENABLE_DEV_ENDPOINTS?: string
}
