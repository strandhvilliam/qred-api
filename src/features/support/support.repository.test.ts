import { describe, expect, it } from "vitest"
import { asMockDb } from "../../lib/test-utils"
import type { UserId } from "../../lib/types"
import type { AppDb } from "../../db/app-db"
import { insertSupportTicket } from "./support.repository"

/** Minimal insert→values→returning stub: only what the repository calls, no call assertions. */
function dbThatInsertReturns(rows: unknown[]): AppDb {
  const returning = () => Promise.resolve(rows)
  const values = () => ({ returning })
  const insert = () => ({ values })
  return asMockDb({ insert })
}

const userId = "550e8400-e29b-41d4-a716-446655440000" as UserId
const companyId = "660e8400-e29b-41d4-a716-446655440001"

describe("insertSupportTicket", () => {
  it("inserts and returns the created row", async () => {
    const createdAt = new Date("2025-03-01T10:00:00.000Z")
    const updatedAt = new Date("2025-03-01T10:00:00.000Z")
    const row = {
      id: "990e8400-e29b-41d4-a716-446655440099",
      userId,
      companyId,
      subject: "Help",
      message: "Please assist",
      status: "open" as const,
      createdAt,
      updatedAt,
    }
    await expect(
      insertSupportTicket(dbThatInsertReturns([row]), {
        userId,
        companyId,
        subject: "Help",
        message: "Please assist",
      }),
    ).resolves.toEqual(row)
  })

  it("allows null company and subject", async () => {
    const row = {
      id: "aa0e8400-e29b-41d4-a716-446655440088",
      userId,
      companyId: null,
      subject: null,
      message: "No company",
      status: "open" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await expect(
      insertSupportTicket(dbThatInsertReturns([row]), {
        userId,
        companyId: null,
        subject: null,
        message: "No company",
      }),
    ).resolves.toEqual(row)
  })

  it("returns undefined when insert returns no row", async () => {
    await expect(
      insertSupportTicket(dbThatInsertReturns([]), {
        userId,
        companyId: null,
        subject: null,
        message: "x",
      }),
    ).resolves.toBeUndefined()
  })
})
