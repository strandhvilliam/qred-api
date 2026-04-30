import type { Next } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { UserId } from "../../lib/types"
import {
  activateCompanyCardHandler,
  getCompanyCardDetailHandler,
  listCompaniesHandler,
  listCompanyCardTransactionsHandler,
  listCompanyCardsHandler,
  listCompanyInvoicesDueHandler,
} from "./companies.handlers"
import * as repo from "./companies.repository"

const noopNext = (async () => {}) as Next

function asResponse(r: unknown): Response {
  return r as Response
}

const userId = "550e8400-e29b-41d4-a716-446655440000" as UserId
const companyId = "660e8400-e29b-41d4-a716-446655440001"
const cardId = "770e8400-e29b-41d4-a716-446655440002"

vi.mock("../../db/client", () => ({
  getDb: vi.fn(() => ({})),
}))

vi.mock("./companies.repository", () => ({
  listUserCompaniesWithDetails: vi.fn(),
  getUserCompanyMembership: vi.fn(),
  listDueUnpaidInvoicesForCompany: vi.fn(),
  listAllCardsForCompany: vi.fn(),
  listCardsAssignedToUserInCompany: vi.fn(),
  getCardInCompany: vi.fn(),
  getUserCardAssignment: vi.fn(),
  sumSettledAmountForCard: vi.fn(),
  listCardTransactionsPage: vi.fn(),
  activateCompanyCard: vi.fn(),
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
  vi.mocked(repo.listUserCompaniesWithDetails).mockReset()
  vi.mocked(repo.getUserCompanyMembership).mockReset()
  vi.mocked(repo.listDueUnpaidInvoicesForCompany).mockReset()
  vi.mocked(repo.listAllCardsForCompany).mockReset()
  vi.mocked(repo.listCardsAssignedToUserInCompany).mockReset()
  vi.mocked(repo.getCardInCompany).mockReset()
  vi.mocked(repo.getUserCardAssignment).mockReset()
  vi.mocked(repo.sumSettledAmountForCard).mockReset()
  vi.mocked(repo.listCardTransactionsPage).mockReset()
  vi.mocked(repo.activateCompanyCard).mockReset()
})

describe("listCompaniesHandler", () => {
  it("returns companies with ISO timestamps", async () => {
    const createdAt = new Date("2025-01-01T00:00:00.000Z")
    const updatedAt = new Date("2025-01-02T00:00:00.000Z")
    vi.mocked(repo.listUserCompaniesWithDetails).mockResolvedValue([
      {
        id: companyId,
        name: "Acme",
        orgNumber: "556677-8899",
        role: "admin",
        createdAt,
        updatedAt,
      },
    ])

    const res = asResponse(
      await listCompaniesHandler(
        mockContext({}) as Parameters<typeof listCompaniesHandler>[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(200)
    await expect(parseJson(res)).resolves.toEqual([
      {
        id: companyId,
        name: "Acme",
        orgNumber: "556677-8899",
        role: "admin",
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    ])
  })
})

describe("listCompanyInvoicesDueHandler", () => {
  it("returns 403 when the user has no membership", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue(undefined as never)

    const res = asResponse(
      await listCompanyInvoicesDueHandler(
        mockContext({ param: { companyId } }) as Parameters<
          typeof listCompanyInvoicesDueHandler
        >[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(403)
    await expect(parseJson(res)).resolves.toMatchObject({ error: "forbidden" })
  })

  it("returns due invoices when the user belongs to the company", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue({ role: "member" })
    const paidAt = new Date("2025-06-01T12:00:00.000Z")
    vi.mocked(repo.listDueUnpaidInvoicesForCompany).mockResolvedValue([
      {
        id: "880e8400-e29b-41d4-a716-446655440003",
        companyId,
        amount: "100",
        currency: "SEK",
        status: "pending",
        dueDate: "2025-07-01",
        paidAt,
        createdAt: new Date("2025-05-01"),
        updatedAt: new Date("2025-05-02"),
      },
    ])

    const res = asResponse(
      await listCompanyInvoicesDueHandler(
        mockContext({ param: { companyId } }) as Parameters<
          typeof listCompanyInvoicesDueHandler
        >[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(200)
    await expect(parseJson(res)).resolves.toEqual([
      expect.objectContaining({
        id: "880e8400-e29b-41d4-a716-446655440003",
        companyId,
        amount: "100",
        currency: "SEK",
        status: "pending",
        paidAt: paidAt.toISOString(),
      }),
    ])
  })
})

describe("listCompanyCardsHandler", () => {
  it("returns 403 without membership", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue(undefined as never)

    const res = asResponse(
      await listCompanyCardsHandler(
        mockContext({ param: { companyId } }) as Parameters<typeof listCompanyCardsHandler>[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(403)
  })

  it("lists all cards for an admin", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue({ role: "admin" })
    const row = {
      id: cardId,
      companyId,
      cardLabel: "Visa •••• 4821",
      spendLimit: "5000",
      currency: "SEK",
      status: "active" as const,
      activatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vi.mocked(repo.listAllCardsForCompany).mockResolvedValue([row])

    const res = asResponse(
      await listCompanyCardsHandler(
        mockContext({ param: { companyId } }) as Parameters<typeof listCompanyCardsHandler>[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(200)
    expect(repo.listAllCardsForCompany).toHaveBeenCalled()
    expect(repo.listCardsAssignedToUserInCompany).not.toHaveBeenCalled()
    await expect(parseJson(res)).resolves.toEqual([
      expect.objectContaining({ id: cardId, cardLabel: "Visa •••• 4821", spendLimit: "5000", status: "active" }),
    ])
  })

  it("lists only assigned cards for a non-admin", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue({ role: "member" })
    const row = {
      id: cardId,
      companyId,
      cardLabel: "MC •••• 7390",
      spendLimit: "1000",
      currency: "SEK",
      status: "inactive" as const,
      activatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vi.mocked(repo.listCardsAssignedToUserInCompany).mockResolvedValue([row])

    const res = asResponse(
      await listCompanyCardsHandler(
        mockContext({ param: { companyId } }) as Parameters<typeof listCompanyCardsHandler>[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(200)
    expect(repo.listCardsAssignedToUserInCompany).toHaveBeenCalledWith({}, userId, companyId)
    expect(repo.listAllCardsForCompany).not.toHaveBeenCalled()
    await expect(parseJson(res)).resolves.toHaveLength(1)
  })
})

describe("getCompanyCardDetailHandler", () => {
  const cardRow = () => ({
    id: cardId,
    companyId,
    cardLabel: "Visa •••• 4821",
    spendLimit: "200",
    currency: "SEK",
    status: "active" as const,
    activatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const param = { companyId, cardId }

  it("returns 403 without membership", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue(undefined as never)

    const res = asResponse(
      await getCompanyCardDetailHandler(
        mockContext({ param }) as Parameters<typeof getCompanyCardDetailHandler>[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(403)
  })

  it("returns 404 when the card is not in the company", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue({ role: "admin" })
    vi.mocked(repo.getCardInCompany).mockResolvedValue(undefined as never)

    const res = asResponse(
      await getCompanyCardDetailHandler(
        mockContext({ param }) as Parameters<typeof getCompanyCardDetailHandler>[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(404)
    await expect(parseJson(res)).resolves.toMatchObject({ error: "not_found" })
  })

  it("returns 404 for a member without an assignment when the card exists", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue({ role: "member" })
    vi.mocked(repo.getCardInCompany).mockResolvedValue(cardRow())
    vi.mocked(repo.getUserCardAssignment).mockResolvedValue(undefined as never)

    const res = asResponse(
      await getCompanyCardDetailHandler(
        mockContext({ param }) as Parameters<typeof getCompanyCardDetailHandler>[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(404)
  })

  it("returns detail with spendUsed and remainingSpend for an admin", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue({ role: "admin" })
    vi.mocked(repo.getCardInCompany).mockResolvedValue(cardRow())
    vi.mocked(repo.sumSettledAmountForCard).mockResolvedValue({ total: "42.45" })

    const res = asResponse(
      await getCompanyCardDetailHandler(
        mockContext({ param }) as Parameters<typeof getCompanyCardDetailHandler>[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(200)
    await expect(parseJson(res)).resolves.toEqual(
      expect.objectContaining({
        id: cardId,
        cardLabel: "Visa •••• 4821",
        spendUsed: "42.45",
        remainingSpend: "157.55",
      }),
    )
  })

  it("uses spendUsed 0 and full limit as remainingSpend when there is no settled total row", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue({ role: "admin" })
    vi.mocked(repo.getCardInCompany).mockResolvedValue(cardRow())
    vi.mocked(repo.sumSettledAmountForCard).mockResolvedValue(undefined as never)

    const res = asResponse(
      await getCompanyCardDetailHandler(
        mockContext({ param }) as Parameters<typeof getCompanyCardDetailHandler>[0],
        noopNext,
      ),
    )

    await expect(parseJson(res)).resolves.toEqual(
      expect.objectContaining({ spendUsed: "0", remainingSpend: "200.00" }),
    )
  })

  it("floors remainingSpend at 0 when overspent", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue({ role: "admin" })
    vi.mocked(repo.getCardInCompany).mockResolvedValue(cardRow())
    vi.mocked(repo.sumSettledAmountForCard).mockResolvedValue({ total: "999.99" })

    const res = asResponse(
      await getCompanyCardDetailHandler(
        mockContext({ param }) as Parameters<typeof getCompanyCardDetailHandler>[0],
        noopNext,
      ),
    )

    await expect(parseJson(res)).resolves.toEqual(
      expect.objectContaining({ spendUsed: "999.99", remainingSpend: "0.00" }),
    )
  })
})

describe("listCompanyCardTransactionsHandler", () => {
  const param = { companyId, cardId }
  const query = { page: 1, limit: 20 }

  function memberWithCardAssignment() {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue({ role: "member" })
    vi.mocked(repo.getCardInCompany).mockResolvedValue({
      id: cardId,
      companyId,
      cardLabel: "Visa •••• 4821",
      spendLimit: "100",
      currency: "SEK",
      status: "active",
      activatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(repo.getUserCardAssignment).mockResolvedValue({ cardId })
  }

  it("returns paginated transactions with ISO transactedAt", async () => {
    memberWithCardAssignment()
    const ta = new Date("2025-04-01T10:00:00.000Z")
    vi.mocked(repo.listCardTransactionsPage).mockResolvedValue({
      rows: [
        {
          id: "990e8400-e29b-41d4-a716-446655440099",
          cardId,
          invoiceId: null,
          amount: "-100.00",
          currency: "SEK",
          description: null,
          merchantName: "Cafe",
          status: "settled",
          transactedAt: ta,
          createdAt: new Date(),
        },
      ],
      total: 42,
    })

    const res = asResponse(
      await listCompanyCardTransactionsHandler(
        mockContext({ param, query }) as Parameters<
          typeof listCompanyCardTransactionsHandler
        >[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(200)
    await expect(parseJson(res)).resolves.toEqual({
      items: [
        expect.objectContaining({
          transactedAt: ta.toISOString(),
          merchantName: "Cafe",
        }),
      ],
      page: 1,
      limit: 20,
      total: 42,
    })
  })
})

describe("activateCompanyCardHandler", () => {
  const param = { companyId, cardId }

  const inactiveCard = () => ({
    id: cardId,
    companyId,
    cardLabel: "MC •••• 7390",
    spendLimit: "100",
    currency: "SEK",
    status: "inactive" as const,
    activatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  it("returns 404 when activation updates no row", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue({ role: "admin" })
    vi.mocked(repo.getCardInCompany).mockResolvedValue(inactiveCard())
    vi.mocked(repo.activateCompanyCard).mockResolvedValue(undefined as never)

    const res = asResponse(
      await activateCompanyCardHandler(
        mockContext({ param }) as Parameters<typeof activateCompanyCardHandler>[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(404)
  })

  it("returns the updated card after activation", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue({ role: "admin" })
    vi.mocked(repo.getCardInCompany).mockResolvedValue(inactiveCard())
    const at = new Date("2025-08-08T09:09:09.123Z")
    vi.mocked(repo.activateCompanyCard).mockResolvedValue({
      id: cardId,
      companyId,
      cardLabel: "MC •••• 7390",
      spendLimit: "100",
      currency: "SEK",
      status: "active",
      activatedAt: at,
      createdAt: new Date(),
      updatedAt: at,
    })

    const res = asResponse(
      await activateCompanyCardHandler(
        mockContext({ param }) as Parameters<typeof activateCompanyCardHandler>[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(200)
    await expect(parseJson(res)).resolves.toEqual(
      expect.objectContaining({
        status: "active",
        cardLabel: "MC •••• 7390",
        activatedAt: at.toISOString(),
      }),
    )
  })

  it("returns 409 when the card is already active", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue({ role: "admin" })
    vi.mocked(repo.getCardInCompany).mockResolvedValue({
      ...inactiveCard(),
      status: "active",
      activatedAt: new Date(),
    })

    const res = asResponse(
      await activateCompanyCardHandler(
        mockContext({ param }) as Parameters<typeof activateCompanyCardHandler>[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(409)
    await expect(parseJson(res)).resolves.toMatchObject({
      error: "conflict",
      message: "Card is already active",
    })
  })

  it("returns 409 when the card is blocked", async () => {
    vi.mocked(repo.getUserCompanyMembership).mockResolvedValue({ role: "admin" })
    vi.mocked(repo.getCardInCompany).mockResolvedValue({
      ...inactiveCard(),
      status: "blocked",
    })

    const res = asResponse(
      await activateCompanyCardHandler(
        mockContext({ param }) as Parameters<typeof activateCompanyCardHandler>[0],
        noopNext,
      ),
    )

    expect(res.status).toBe(409)
    await expect(parseJson(res)).resolves.toMatchObject({
      error: "conflict",
      message: "Card is blocked and cannot be activated",
    })
  })
})
