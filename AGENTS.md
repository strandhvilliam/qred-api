# Agent Guide: Adding API Endpoints

This file is the handoff guide for AI agents and non-backend developers adding functionality to this API. Follow the existing feature structure first; do not invent a new framework or folder layout.

## What This App Uses

- Runtime: TypeScript ES modules on Node 20.
- HTTP: Hono with `OpenAPIHono` and `@hono/zod-openapi`.
- Validation/docs: Zod schemas with `.openapi(...)` metadata.
- Database: Aurora DSQL (PostgreSQL-compatible) through the AWS DSQL/node-postgres connector and IAM auth. Runtime repositories still use Drizzle query builders, but schema migrations are plain SQL.
- Auth: HS256 Bearer JWTs. Protected user routes use `jwtAuth` and usually `requireUuidSub`.
- Package manager: use `pnpm`.

Useful commands:

- `pnpm run build` checks bundling and TypeScript.
- `pnpm run test:run` runs Vitest tests.
- `pnpm run db:migrate` applies plain SQL migrations from `sql/migrations` to DSQL using `DSQL_*` in `.env` and IAM auth.

## Current Feature Pattern

Most endpoints live in `src/features/<feature>/`:

- `<feature>.schemas.ts`: Zod request/response schemas.
- `<feature>.routes.ts`: `createRoute(...)` definitions only.
- `<feature>.repository.ts`: Drizzle queries and writes.
- `<feature>.handlers.ts`: Hono route handlers and the exported route bundle.
- `<feature>.*.test.ts`: handler and repository tests when behavior is non-trivial.

Routes are registered in `src/app.ts` with `app.openapiRoutes(<feature>OpenAPIRoutes)`.

Examples to copy:

- `src/features/support/*` for a simple authenticated POST with a body.
- `src/features/companies/*` for path params, authorization checks, list/detail endpoints, pagination, and company membership rules.
- `src/features/dev/*` for dev-only endpoints that are hidden behind `ENABLE_DEV_ENDPOINTS`.

## Endpoint Implementation Checklist

When adding an endpoint, do these in order:

1. Understand the requested behavior, actor, path, request shape, success response, error cases, and whether data is read or mutated.
2. Reuse an existing feature folder if the endpoint belongs there. Create `src/features/<feature>/` only for a genuinely new domain area.
3. Add or update Zod schemas in `<feature>.schemas.ts`. Import `z` from `@hono/zod-openapi`, not from `zod`.
4. Add a `createRoute(...)` in `<feature>.routes.ts`. Use OpenAPI path params like `/api/v1/companies/{companyId}`.
5. Add repository functions in `<feature>.repository.ts` for DB access. Keep Drizzle query logic out of handlers unless it is trivial and already local.
6. Add a `RouteHandler<typeof route>` in `<feature>.handlers.ts`. Read validated data with `c.req.valid("param")`, `c.req.valid("query")`, or `c.req.valid("json")`.
7. Add `{ route, handler }` to the feature’s exported `<feature>OpenAPIRoutes` array.
8. If this is a new feature bundle, import it in `src/app.ts`, call `app.openapiRoutes(...)`, and add/update the OpenAPI tag description.
9. Add focused tests for handler behavior and repository query behavior when the endpoint touches authorization, DB logic, mapping, pagination, or error branches.
10. Run `pnpm run build`, `pnpm run test:run`, and relevant narrower tests while developing.

## Route Rules

Public API endpoints must use `createRoute` and `app.openapiRoutes`. Do not add plain `app.get`, `app.post`, etc. for normal API functionality. The exceptions are infrastructure endpoints already in `src/app.ts`, such as `/doc`, `/ui`, and app-level error handlers.

Every route should define:

- `method`, `path`, `tags`, and `summary`.
- `description` when behavior or authorization is not obvious.
- `request.params`, `request.query`, or `request.body` when input exists.
- `responses` for every expected status.

If a route has any `request` validation, document `422: validationError.openapi()`.

For JSON responses, use `jsonResponse(schema, "description")` from `src/lib/utils`.

## Auth And Authorization

Most user-facing endpoints should be protected:

```ts
security: [{ Bearer: [] }],
middleware: [jwtAuth, requireUuidSub] as const,
```

After these middleware run:

- `c.get("jwtPayload")` contains the verified JWT payload.
- `c.get("userId")` contains a validated UUID user id from the JWT `sub`.

Guardrails:

- Do not trust `userId`, `companyId`, `cardId`, or similar IDs from the request without checking ownership or membership.
- For company-scoped routes, call `getUserCompanyMembership(db, userId, companyId)` before returning company data.
- For card-scoped routes, check that the card belongs to the company. Non-admin users must also have a `userCards` assignment.
- Return `forbidden.json(c)` when the user is authenticated but cannot access a company-level resource.
- Return `notFound.json(c, "...")` when revealing whether a nested resource exists would leak data, such as inaccessible cards.
- Only leave an endpoint unauthenticated when it is intentionally public, like `/health`, and make that explicit in the route description.

## Error Conventions

Use `src/lib/errors.ts`; do not hand-roll error JSON.

- `validationError`: 422 from the `OpenAPIHono` default hook.
- `invalidSub`: 400 when JWT `sub` is missing or is not a UUID.
- `unauthorized`: 401 from auth failures.
- `forbidden`: 403 for authenticated users without access.
- `notFound`: 404 for missing resources or intentionally hidden inaccessible nested resources.
- `internalError`: 500 for unexpected server failures or impossible DB write misses.

Handlers should return these helpers directly, for example `return forbidden.json(c)`.

## Schema Rules

- Import `z` from `@hono/zod-openapi`.
- Give reusable objects and responses stable component names with `.openapi("ComponentName")`.
- Add helpful field descriptions for public response fields.
- Use `z.uuid()` for UUIDs.
- Use `z.iso.datetime()` for serialized `Date` values.
- Serialize DB `Date` values with `.toISOString()` in handlers.
- Keep DB `numeric` values as strings unless the existing API shape for that domain says otherwise.
- For query numbers, use `z.coerce.number().int()` and set safe bounds/defaults.
- For request bodies, declare `request.body.content["application/json"].schema`.

## Handler Rules

Handlers should be thin and readable:

- Get `userId`, params, query, and body at the top.
- Create `const db = getDb(c)` once.
- Perform authorization before fetching or mutating sensitive data.
- Delegate DB queries to repository functions.
- Map DB rows to response DTOs explicitly.
- Return the status documented by the route.
- Avoid broad `try/catch` unless the endpoint intentionally converts a known operational failure to a documented error.

Response mapping is part of the API contract. Do not return raw Drizzle rows if they contain internal columns, `Date` objects, or fields not declared in the schema.

## Repository And Database Rules

- Use `AppDb` from `src/db/app-db` for repository signatures.
- Keep SQL/Drizzle expressions in repositories.
- Use `returning()` for inserts/updates that need to return created or updated rows.
- Add plain SQL migrations in `sql/migrations` when the database schema changes. Aurora DSQL requires DDL and DML in separate transactions, and only one DDL statement per transaction; the migration runner handles that for normal migration files.
- Use Aurora DSQL-compatible DDL: no foreign keys, triggers, temp tables, PostgreSQL extensions, `TRUNCATE`, or JSON/JSONB column types. Use `CREATE INDEX ASYNC` for secondary indexes.
- Avoid N+1 queries for list endpoints; prefer joins or batched queries.
- Make ordering explicit for list endpoints.
- Add pagination for endpoints that can grow unbounded.

## Testing Expectations

Use Vitest. Existing tests mock the DB at repository or handler boundaries; copy the style in:

- `src/features/companies/companies.handlers.test.ts`
- `src/features/companies/companies.repository.test.ts`
- `src/features/support/support.handlers.test.ts`
- `src/features/support/support.repository.test.ts`

Add tests for:

- Success response shape and status.
- Authz failures (`403` or `404`) when relevant.
- Validation behavior if custom schema refinements are added.
- Repository query conditions for filters, pagination, ordering, and writes.
- Serialization of dates and nullable values.

At minimum, run the tests for files you changed plus `pnpm run build`. Before claiming completion, run `pnpm run test:run` unless there is a clear reason not to.

## New Endpoint Prompt Template

Non-backend developers can paste this to an AI agent:

```text
Add a new endpoint following AGENTS.md.

Feature/domain:
Method and path:
Authenticated? If yes, who can access it:
Request params/query/body:
Success status and response fields:
Error cases:
Database tables involved:
Sorting/pagination rules:
Tests to add:

Please inspect the closest existing feature first, then implement using schemas, routes, repository, handlers, route registration, and tests.
```

## Review Checklist For Agents

Before finishing, verify:

- The endpoint appears in `/doc` through `createRoute` and `app.openapiRoutes`.
- Protected routes include both `security: [{ Bearer: [] }]` and `[jwtAuth, requireUuidSub] as const`.
- Every request schema has a documented `422`.
- Error responses use `src/lib/errors.ts`.
- The handler never returns data before authorization checks.
- Response data matches the Zod schema exactly.
- New DB schema changes have plain SQL migrations in `sql/migrations`.
- Tests cover the meaningful success and failure branches.
- `pnpm run build` and relevant tests have been run.

## Things Not To Do

- Do not add a second router framework.
- Do not bypass Zod/OpenAPI for public API routes.
- Do not import `z` from plain `zod` for API schemas.
- Do not read environment variables directly in handlers; use Hono `env<AppEnv>(c)` or existing helpers.
- Do not expose raw DB rows without mapping.
- Do not skip membership or ownership checks for company, card, invoice, transaction, or support-ticket data.
- Do not add dependencies unless the endpoint cannot reasonably be built with existing tools.
