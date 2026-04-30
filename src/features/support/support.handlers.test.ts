import type { Next } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { UserId } from "../../lib/types"
import { createSupportTicketHandler } from "./support.handlers"
import * as companiesRepo from "../companies/companies.repository"
import * as supportRepo from "./support.repository"

const noopNext = (async () => {}) as Next

function asResponse(r: unknown): Response {
  return r as Response
}

const userId = "550e8400-e29b-41d4-a716-446655440000" as UserId
const companyId = "660e8400-e29b-41d4-a716-446655440001"

vi.mock("../../db/client", () => ({
  getDb: vi.fn(() => ({})),
}))

vi.mock("../companies/companies.repository", () => ({
  getUserCompanyMembership: vi.fn(),
}))

vi.mock("./support.repository", () => ({
  insertSupportTicket: vi.fn(),
}))

function mockContext(options: {
  userId?: UserId
  param?: Record<string, string>
  query?: Record<string, unknown>
  json?: unknown
}) {
  const uid = options.userId ?? userId
  const validMap = {
    param: options.param ?? {},
    query: options.query ?? {},
    json: options.json ?? {},
  }
  return {
    get: (key: string) => (key === "userId" ? uid : undefined),
    req: {
      valid: (segment: "param" | "query" | "json") => validMap[segment],
    },
    json: (body: unknown, status?: number) =>
      new Response(JSON.stringify(body), {
        status: status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
  }
}

async function parseJson(res: Response) {
  return JSON.parse(await res.text()) as Record<string, unknown>
}

beforeEach(() => {
  vi.mocked(companiesRepo.getUserCompanyMembership).mockReset()
  vi.mocked(supportRepo.insertSupportTicket).mockReset()
})

describe("createSupportTicketHandler", () => {
  it("creates a ticket without a company link when companyId is omitted", async () => {
    vi.mocked(supportRepo.insertSupportTicket).mockResolvedValue({
      id: "990e8400-e29b-41d4-a716-446655440010",
      userId,
      companyId: null,
      subject: "Hi",
      message: "Need help",
      status: "open",
      createdAt: new Date("2025-01-03T08:00:00.000Z"),
      updatedAt: new Date("2025-01-03T08:00:00.000Z"),
    })

    const res = asResponse(
      await createSupportTicketHandler(
        mockContext({ json: { message: "Need help", subject: "Hi" } }) as Parameters<
          typeof createSupportTicketHandler
        >[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(201)
    expect(companiesRepo.getUserCompanyMembership).not.toHaveBeenCalled()
    expect(supportRepo.insertSupportTicket).toHaveBeenCalledWith({}, {
      userId,
      companyId: null,
      subject: "Hi",
      message: "Need help",
    })

    await expect(parseJson(res)).resolves.toEqual(
      expect.objectContaining({
        id: "990e8400-e29b-41d4-a716-446655440010",
        userId,
        companyId: null,
        message: "Need help",
        subject: "Hi",
        status: "open",
      }),
    )
  })

  it("returns 403 when a company id is sent but the user is not a member", async () => {
    vi.mocked(companiesRepo.getUserCompanyMembership).mockResolvedValue(undefined as never)

    const res = asResponse(
      await createSupportTicketHandler(
        mockContext({
          json: { message: "x", companyId },
        }) as Parameters<typeof createSupportTicketHandler>[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(403)
    await expect(parseJson(res)).resolves.toMatchObject({ error: "forbidden" })
    expect(supportRepo.insertSupportTicket).not.toHaveBeenCalled()
  })

  it("links the ticket to the company when membership exists", async () => {
    vi.mocked(companiesRepo.getUserCompanyMembership).mockResolvedValue({ role: "member" })
    vi.mocked(supportRepo.insertSupportTicket).mockResolvedValue({
      id: "aa0e8400-e29b-41d4-a716-446655440020",
      userId,
      companyId,
      subject: null,
      message: "Billing",
      status: "open",
      createdAt: new Date("2025-02-02T02:02:02.000Z"),
      updatedAt: new Date("2025-02-02T02:02:02.000Z"),
    })

    const res = asResponse(
      await createSupportTicketHandler(
        mockContext({ json: { message: "Billing", companyId } }) as Parameters<
          typeof createSupportTicketHandler
        >[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(201)
    expect(supportRepo.insertSupportTicket).toHaveBeenCalledWith({}, {
      userId,
      companyId,
      subject: null,
      message: "Billing",
    })
    await expect(parseJson(res)).resolves.toEqual(
      expect.objectContaining({ companyId, message: "Billing" }),
    )
  })

  it("returns 500 when insert yields no row", async () => {
    vi.mocked(supportRepo.insertSupportTicket).mockResolvedValue(undefined as never)

    const res = asResponse(
      await createSupportTicketHandler(
        mockContext({ json: { message: "Only message" } }) as Parameters<
          typeof createSupportTicketHandler
        >[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(500)
    await expect(parseJson(res)).resolves.toMatchObject({ error: "internal_error" })
  })
})
