# Qred — API Backend

## Task 1 Solution

### Communication and process

- Having something like a API-first communicative process. Since we want the work to be done parallel, then the frontend and backend engineers as well as the project manager could first agree on the API contract before either start the implementation (also relevant with OpenAPI spec talked more about below). This helps all work parallel without blocking one another. By agreeing on the contract, the frontend devs could even have stub data to test on while the be devs implement the real thing.

### OpenAPI

- This is the cornerstone of delivering the API contract between the teams. Should be well designed and informative enough.
- Use tools to automatically generate Swagger UI. Or even packages they can use to generate the types on their side (for example OpenAPI Typescript package, which can generate types automatically on both fe and be from openapi spec)
- Add linting rules and go full type-safe to make sure all endpoints are properly documented and wont be deployed without it.
- If needed, normal Documentation aside from open-api could be added. Tradeoff here is that this requires more manual maintenence, if not using an AI solution called maybe in the CI/CD pipe for example.
- Clear versioning in api's to maintain backwards comp. /api/v1/ prefixes and so on.
- Open API docs also is a strong enabler for transparency across the roles and departments and will reduce the blockers for both sides.

### CI/CD

- Pipeline should test and verify endpoints so that the frontend devs can trust the deployment on the backend.
- Make sure proper suite of unit-tests and that these are run in the pipieline.
- Helps the backend team to ship fast without needing to think to much about deployment or other chores which saves time.

### AI workflow

- A well implemented AI workflow can improve the work in many aspects. This requires well defined design guidelines and guardrails to help the AI-agent work well with the codebase.
- What helps the AI-agent is: A well defined db-schema, proper Open API contracts, lots of unit-tests, strong linting rules and a well though out CI/CD pipeline.
- Non technical project managers could have an agent with read access to the backend to easily help in gather information and answers about implementation details. This will make it easier for them to communicate to new devs for example.
- CodeRabbit or similar PR review AI tool could work perfectly if short on backend engineers to not having to review all the time, so that the LLM PR review tool catches most of the bugs, so that manual review only is needed before final merge or something like that.
- If succeding on implementing AI in the workflow it can significantly reduce blockers and frustration, while enabling more passion in shipping better product.

## Task 2 Summary

### Process

As always I started thinking and taking notes on what needs to be built. Analyzing the assignment and especially the Appendix wireframe. Should I focus on making as few endpoints as possible that are super aligned towards this screens usecase, or should I make more broader endpoints to allow flexibility if design is changed in future? I decided the latter. Then though about tools, frameworks, design decisions, deployment and the neeeded schema and entities. After this I started chatting with my LLM agents (GPT 5.5 in this case) to draw up a more concrete plan.

### General structure and schema

Domain related logic i under features/ directory, then have other util folders. Everything expect the support and dev endpoints are located under the _companies_ feature as this is the main entity a user is connected to. However a user can be connected to multiple companies. A user can be assigned multiple cards, but only users that are the role _admin_ can access all the company cards, while non-admins only can access the cards they themself have access to.

### Card endpoints

Currently there is not that much difference between when fetching all cards and one specific card. This is because most of the data is pretty basic and would make sense to show if listing all the cards and so on. The endpoint to get a specific card however, also includes the remainingSpend and spendUsed that is calculated server-side, which could be seen as the most "expensive" part of the call and should not be done when getting all cards since it involves N amount of transactions bound to a specific card. But this could also be discussed further. The important thing in the design desicion is that this should not be calculated in the client.

### Hono and OpenAPI

Decided to use Hono for this assignment mostly cause it's easy to setup in a serverless environment and has lots of good integrations. The tradeoff here personally is that as the codebase scales in size, it may not be as straightforward to continue have good maintainability with more features where another framework may help with this more.

OpenAPI is crucial here, and I decided to use the hono package zod-openapi to get runtime schema validation with zod while exporting clear request and response types with openapi, while also generating a swagger-ui endpoint for documentation. No drift between code and docs.

### DB decisions and tradeoffs

The largest hurdle I had was the fact that I chose Aurora DSQL as the database. The thinking was that it is design for using postgres in serverless environments, but during the assignment I found out the DSQL db is incompatible with many of the postgres features I wanted to use. I decided to still stick with the DB as I'd already setup the CDK stack and adjust the code logic. The issues was among others that the indexes should be async indexes instead of normal ones, there could be no explicit FK relations added and the migration scripts did not have proper support for all ddl as a normal postgres db would have. Unfortunely this took a lot of my time for this assignment to try to fix.

### Authentication

Implemented a simple middleware checking for JWT token which can for demo purpose be fetched from the /dev/token endpoint. For a production system this entirely depends on the existing auth setup. OAuth with JWKS? Something else?

### Unit tests

Added unit tests for the handlers and repositories. The unit tests for the repositories may be more or less redundant and could be totally rethought since they in some parts just test the drizzle queries and mocks them. The handler test however should cover the business logic

### Other design decisions

- **Spend tracking is derived, not stored.** `spendUsed` is computed as `SUM(amount)` of settled transactions at query time. This avoids stale counters and complex write-time synchronization.
- **`remainingSpend`** is computed server-side (`spendLimit - spendUsed`, floored at 0) so the frontend doesn't need decimal string arithmetic.
- **`cardLabel`** stores a human-readable identifier (e.g. "Visa •••• 4821") for display in the UI without exposing full card numbers.
- **Roles control visibility.** Company admins see all cards; members only see cards explicitly assigned to them via `user_cards`. This is enforced in every handler.
- **Amounts are `numeric(12,2)` serialized as strings.** This avoids floating-point precision loss in JSON transport.

### Future steps

- Add caching for redis and think about cache invalidation
- Add rate limiting to endpoitns
- Fix the migrations logic to work well with DSQL
- Add a working CI/CD pipeline (github actions)

## Quick start for demo

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in DSQL_ENDPOINT from your cluster (or CDK output) and set JWT_SECRET.
# Enable dev helpers for local testing:
#   ENABLE_DEV_ENDPOINTS=true

# 3. Run migrations against Aurora DSQL
pnpm run db:migrate

# 4. Build the Lambda bundle
pnpm run build

# 5. Run tests
pnpm run test:run
```

Once deployed (or running locally via a Lambda emulator), seed demo data and mint a
token using the dev endpoints:

```bash
# Seed deterministic demo rows (resets all tables first)
curl -X POST $API_URL/dev/seed

# Get a JWT for the demo user
curl "$API_URL/dev/token?sub=00000000-0000-4000-8000-000000000001"
```

The API also exposes an interactive Swagger UI at `GET /ui` and the raw OpenAPI 3.0
document at `GET /doc`.

### Database schema rationale

The schema is normalized around the core entities visible in the frontend wireframe:

| Table             | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `users`           | Authenticated users (JWT `sub` = user id)        |
| `companies`       | Business entities; a user can belong to multiple |
| `user_companies`  | Many-to-many with role (`admin` / `member`)      |
| `cards`           | Corporate cards owned by a company               |
| `user_cards`      | Card access assignments for non-admin members    |
| `invoices`        | Company invoices with due-date tracking          |
| `transactions`    | Card transactions with status lifecycle          |
| `support_tickets` | User-initiated support requests                  |

### API structure

All endpoints follow a RESTful resource hierarchy scoped under `/api/v1/`:

```
GET  /api/v1/companies                                    → user's companies
GET  /api/v1/companies/{companyId}/cards                  → company cards
GET  /api/v1/companies/{companyId}/cards/{cardId}         → card detail + spend
GET  /api/v1/companies/{companyId}/cards/{cardId}/transactions → paginated transactions
POST /api/v1/companies/{companyId}/cards/{cardId}/activate    → activate inactive card
GET  /api/v1/companies/{companyId}/invoices/due           → unpaid due invoices
POST /api/v1/support/tickets                              → create support ticket
```

Every endpoint maps directly to a UI element in the frontend wireframe:

| Wireframe element                 | Endpoint                                                           |
| --------------------------------- | ------------------------------------------------------------------ |
| Company dropdown                  | `GET /companies`                                                   |
| "Invoice due" banner              | `GET /companies/{id}/invoices/due`                                 |
| Card display                      | `GET /companies/{id}/cards`                                        |
| Remaining spend (5 400/10 000 kr) | `GET /companies/{id}/cards/{id}` → `remainingSpend` / `spendLimit` |
| Latest transactions               | `GET /companies/{id}/cards/{id}/transactions`                      |
| "54 more items"                   | `total` field in paginated response                                |
| Activate card                     | `POST /companies/{id}/cards/{id}/activate`                         |
| Contact support                   | `POST /support/tickets`                                            |

### Authorization model

- All user-facing routes require a Bearer JWT (HS256) with a UUID `sub` claim.
- Company-scoped routes verify membership via `user_companies` before returning data.
- Card-scoped routes additionally check `user_cards` for non-admin members.
- The activate endpoint rejects cards that are not in `inactive` status (409 Conflict).

### Code organization

```
src/
├── features/
│   ├── companies/          # Cards, invoices, transactions
│   │   ├── companies.schemas.ts    # Zod request/response schemas
│   │   ├── companies.routes.ts     # OpenAPI route definitions
│   │   ├── companies.repository.ts # Drizzle queries
│   │   ├── companies.handlers.ts   # Request handlers
│   │   └── *.test.ts               # Unit tests
│   ├── support/            # Support tickets (same pattern)
│   └── dev/                # Seed + JWT mint (dev-only)
├── db/                     # Schema, client, enums
├── lib/                    # Errors, utils, JWT config
├── middleware/              # jwtAuth, requireUuidSub, devOnly
├── app.ts                  # Route registration + error handlers
└── index.ts                # Lambda entry point
```

### Infrastructure

The `infra/` directory contains a CDK stack that provisions:

- Aurora DSQL cluster
- Lambda function (Node.js 20)
- HTTP API Gateway with `ANY /{proxy+}` routing to Lambda

### Testing

41 unit tests covering handler behavior (auth, mapping, pagination, edge cases)
and repository query shapes. Run with `pnpm run test:run`.

## Useful commands

| Command               | Description                  |
| --------------------- | ---------------------------- |
| `pnpm run build`      | Bundle with esbuild          |
| `pnpm run test:run`   | Run all Vitest tests         |
| `pnpm run db:migrate` | Apply SQL migrations to DSQL |
| `pnpm run cdk:deploy` | Deploy CDK stack             |
| `pnpm run cdk:diff`   | Preview CDK changes          |
