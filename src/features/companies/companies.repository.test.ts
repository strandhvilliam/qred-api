import { describe, expect, it } from "vitest"
import type { AppDb } from "../../db/app-db"
import { asMockDb } from "../../lib/test-utils"
import type { UserId } from "../../lib/types"
import {
  activateCompanyCard,
  getCardInCompany,
  getUserCardAssignment,
  getUserCompanyMembership,
  listAllCardsForCompany,
  listCardTransactionsPage,
  listCardsAssignedToUserInCompany,
  listDueUnpaidInvoicesForCompany,
  listUserCompaniesWithDetails,
  sumSettledAmountForCard,
} from "./companies.repository"

/** Minimal stubs: only the chain shapes the repository calls; no assertions on Drizzle. */

function dbSelectInnerJoinWhere(result: unknown): AppDb {
  const end = Promise.resolve(result)
  const where = () => end
  const innerJoin = () => ({ where })
  const from = () => ({ innerJoin })
  const select = () => ({ from })
  return asMockDb({ select })
}

function dbSelectWhereLimit(result: unknown): AppDb {
  const end = Promise.resolve(result)
  const limit = () => end
  const where = () => ({ limit })
  const from = () => ({ where })
  const select = () => ({ from })
  return asMockDb({ select })
}

function dbSelectWhereOrderBy(result: unknown): AppDb {
  const end = Promise.resolve(result)
  const orderBy = () => end
  const where = () => ({ orderBy })
  const from = () => ({ where })
  const select = () => ({ from })
  return asMockDb({ select })
}

function dbSelectWhere(result: unknown): AppDb {
  const end = Promise.resolve(result)
  const where = () => end
  const from = () => ({ where })
  const select = () => ({ from })
  return asMockDb({ select })
}

function dbUpdateSetWhereReturning(result: unknown): AppDb {
  const end = Promise.resolve(result)
  const returning = () => end
  const where = () => ({ returning })
  const set = () => ({ where })
  const update = () => ({ set })
  return asMockDb({ update })
}

/** Two `select()` calls: count query then paginated rows (same shape as real Drizzle usage). */
function dbListCardTransactionsPageResult(params: {
  countTotal: string | number | bigint | null | undefined
  rows: unknown
}): AppDb {
  const countPromise = Promise.resolve([{ total: params.countTotal }])
  const rowsPromise = Promise.resolve(params.rows)
  const offsetFn = () => rowsPromise
  const limitFn = () => ({ offset: offsetFn })
  const orderByFn = () => ({ limit: limitFn })
  const whereRows = () => ({ orderBy: orderByFn })
  const fromRows = () => ({ where: whereRows })
  const chainRows = { from: fromRows }
  const whereCount = () => countPromise
  const fromCount = () => ({ where: whereCount })
  const chainCount = { from: fromCount }
  const chains = [chainCount, chainRows]
  const select = () => chains.shift() as (typeof chainCount | typeof chainRows)
  return asMockDb({ select })
}

const userId = "550e8400-e29b-41d4-a716-446655440000" as UserId
const otherUserId = "550e8400-e29b-41d4-a716-446655440099" as UserId
const companyId = "660e8400-e29b-41d4-a716-446655440001"
const cardId = "770e8400-e29b-41d4-a716-446655440002"

describe("listUserCompaniesWithDetails", () => {
  it("returns rows from the select chain", async () => {
    const rows = [
      {
        id: companyId,
        name: "Acme",
        orgNumber: "556677-8899",
        role: "admin",
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-02"),
      },
    ]
    await expect(listUserCompaniesWithDetails(dbSelectInnerJoinWhere(rows), userId)).resolves.toEqual(rows)
  })
})

describe("getUserCompanyMembership", () => {
  it("returns the first row when present", async () => {
    await expect(
      getUserCompanyMembership(dbSelectWhereLimit([{ role: "member" }]), userId, companyId),
    ).resolves.toEqual({ role: "member" })
  })

  it("returns undefined when no row", async () => {
    await expect(getUserCompanyMembership(dbSelectWhereLimit([]), userId, companyId)).resolves.toBeUndefined()
  })
})

describe("listDueUnpaidInvoicesForCompany", () => {
  it("returns invoices from orderBy chain", async () => {
    const invoices = [{ id: "880e8400-e29b-41d4-a716-446655440003" }]
    await expect(listDueUnpaidInvoicesForCompany(dbSelectWhereOrderBy(invoices), companyId)).resolves.toBe(
      invoices,
    )
  })
})

describe("listAllCardsForCompany", () => {
  it("returns cards for company", async () => {
    const cards = [{ id: cardId }]
    await expect(listAllCardsForCompany(dbSelectWhere(cards), companyId)).resolves.toBe(cards)
  })
})

describe("listCardsAssignedToUserInCompany", () => {
  it("returns assigned card rows", async () => {
    const rows = [
      {
        id: cardId,
        companyId,
        cardLabel: "Visa •••• 4821",
        spendLimit: "1000.00",
        currency: "SEK",
        status: "inactive" as const,
        activatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    await expect(listCardsAssignedToUserInCompany(dbSelectInnerJoinWhere(rows), userId, companyId)).resolves.toBe(
      rows,
    )
  })
})

describe("getCardInCompany", () => {
  it("returns card when found", async () => {
    const card = { id: cardId, companyId }
    await expect(getCardInCompany(dbSelectWhereLimit([card]), companyId, cardId)).resolves.toEqual(card)
  })

  it("returns undefined when not found", async () => {
    await expect(getCardInCompany(dbSelectWhereLimit([]), companyId, cardId)).resolves.toBeUndefined()
  })
})

describe("getUserCardAssignment", () => {
  it("returns assignment when present", async () => {
    await expect(
      getUserCardAssignment(dbSelectWhereLimit([{ cardId }]), userId, companyId, cardId),
    ).resolves.toEqual({ cardId })
  })

  it("returns undefined when missing", async () => {
    await expect(
      getUserCardAssignment(dbSelectWhereLimit([]), otherUserId, companyId, cardId),
    ).resolves.toBeUndefined()
  })
})

describe("sumSettledAmountForCard", () => {
  it("returns aggregate row", async () => {
    await expect(sumSettledAmountForCard(dbSelectWhere([{ total: "42.50" }]), cardId)).resolves.toEqual({
      total: "42.50",
    })
  })

  it("returns undefined when no aggregate row", async () => {
    await expect(sumSettledAmountForCard(dbSelectWhere([]), cardId)).resolves.toBeUndefined()
  })
})

describe("listCardTransactionsPage", () => {
  it("maps count and rows to total and resolved rows", async () => {
    const txRows = [{ id: "aa0e8400-e29b-41d4-a716-446655440010" }]
    const db = dbListCardTransactionsPageResult({ countTotal: 5n, rows: txRows })
    const out = await listCardTransactionsPage(db, cardId, { page: 2, limit: 2 })
    expect(out).toEqual({ rows: txRows, total: 5 })
  })

  it("coerces null/undefined count total to 0", async () => {
    const db = dbListCardTransactionsPageResult({ countTotal: undefined, rows: [] })
    const out = await listCardTransactionsPage(db, cardId, { page: 1, limit: 10 })
    expect(out.total).toBe(0)
  })

  it("runs with optional from/to filters", async () => {
    const rows = [{ id: "x" }]
    const db = dbListCardTransactionsPageResult({ countTotal: 1, rows })
    const out = await listCardTransactionsPage(db, cardId, {
      page: 1,
      limit: 20,
      from: "2025-06-01T00:00:00.000Z",
      to: "2025-06-30T23:59:59.999Z",
    })
    expect(out).toEqual({ rows, total: 1 })
  })
})

describe("activateCompanyCard", () => {
  it("returns updated card row", async () => {
    const at = new Date("2025-03-15T12:00:00.000Z")
    const updated = {
      id: cardId,
      companyId,
      status: "active" as const,
      activatedAt: at,
      updatedAt: at,
    }
    await expect(activateCompanyCard(dbUpdateSetWhereReturning([updated]), companyId, cardId, at)).resolves.toEqual(
      updated,
    )
  })

  it("returns undefined when no row updated", async () => {
    const at = new Date()
    await expect(activateCompanyCard(dbUpdateSetWhereReturning([]), companyId, cardId, at)).resolves.toBeUndefined()
  })
})
