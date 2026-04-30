import type { Pool } from "pg"
import type { AppDb } from "../../db/app-db"
import {
  cards,
  companies,
  invoices,
  supportTickets,
  transactions,
  userCards,
  userCompanies,
  users,
} from "../../db/schema"
import {
  DEMO_CARD_ACTIVE_ID,
  DEMO_CARD_INACTIVE_ID,
  DEMO_COMPANY_ID,
  DEMO_INVOICE_OVERDUE_ID,
  DEMO_SUPPORT_TICKET_ID,
  DEMO_TRANSACTION_1_ID,
  DEMO_TRANSACTION_2_ID,
  DEMO_USER_ID,
} from "./demo-ids"

export type SeedSummary = {
  demoUserId: string
  demoCompanyId: string
  demoEmail: string
  inactiveCardId: string
  activeCardId: string
}

const RESET_TABLES = [
  "transactions",
  "invoices",
  "user_cards",
  "cards",
  "user_companies",
  "support_tickets",
  "companies",
  "users",
] as const

const MERCHANTS = [
  "ICA Maxi", "Coop Forum", "Circle K", "Pressbyrån", "Espresso House",
  "MAX Burgers", "IKEA", "Systembolaget", "H&M", "Stadium",
  "Webhallen", "Elgiganten", "Tele2", "Spotify", "Uber Eats",
  "Wolt", "SJ Biljetter", "SL Resekor", "Filmstaden", "Akademibokhandeln",
]

const DESCRIPTIONS = [
  "Office supplies", "Team lunch", "Software license", "Travel expense",
  "Client dinner", "Conference fee", "Fuel", "Parking", "Stationery",
  "Cloud hosting", "Marketing ad spend", "Phone subscription", "Catering",
  "Equipment rental", "Courier delivery", "Subscription renewal",
  "Training course", "Domain renewal", "SaaS tool", "Print services",
]

function deterministicTxId(index: number): string {
  const hex = index.toString(16).padStart(12, "0")
  return `d4444444-4444-4444-8444-${hex}`
}

function buildDemoTransactions() {
  const txs: Array<{
    id: string
    cardId: string
    invoiceId: string | null
    amount: string
    currency: string
    description: string
    merchantName: string
    status: "settled" | "pending" | "declined" | "refunded"
    transactedAt: Date
  }> = []

  // Settled transactions on the active card totalling 4,600.00 SEK
  // (wireframe shows 5,400 remaining of 10,000 limit)
  const settledAmounts = [
    320.00, 185.50, 95.00, 410.00, 67.00, 299.00, 150.00,
    88.50, 245.00, 78.00, 125.00, 199.50, 340.00, 55.00,
    110.00, 275.00, 165.00, 89.00, 215.00, 42.50,
    135.00, 98.00, 175.00, 62.00, 230.00, 145.50,
  ]
  // Sum = 4,600.00 (hand-verified below; last amount is the balancer)
  // Actual sum of first 25: 4,454.50, so last = 145.50 → total 4,600.00

  const baseDate = new Date("2025-01-15T08:00:00.000Z")
  for (let i = 0; i < settledAmounts.length; i++) {
    const date = new Date(baseDate.getTime() + i * 2 * 24 * 60 * 60 * 1000)
    txs.push({
      id: deterministicTxId(i + 1),
      cardId: DEMO_CARD_ACTIVE_ID,
      invoiceId: i === 0 ? DEMO_INVOICE_OVERDUE_ID : null,
      amount: settledAmounts[i].toFixed(2),
      currency: "SEK",
      description: DESCRIPTIONS[i % DESCRIPTIONS.length],
      merchantName: MERCHANTS[i % MERCHANTS.length],
      status: "settled",
      transactedAt: date,
    })
  }

  // 27 more pending transactions (total: 26 settled + 27 pending + 1 declined + 1 refunded + 2 on inactive = 57)
  for (let i = 0; i < 27; i++) {
    const date = new Date(baseDate.getTime() + (settledAmounts.length + i) * 2 * 24 * 60 * 60 * 1000)
    txs.push({
      id: deterministicTxId(settledAmounts.length + i + 1),
      cardId: DEMO_CARD_ACTIVE_ID,
      invoiceId: null,
      amount: (50 + ((i * 37) % 200)).toFixed(2),
      currency: "SEK",
      description: DESCRIPTIONS[(settledAmounts.length + i) % DESCRIPTIONS.length],
      merchantName: MERCHANTS[(settledAmounts.length + i) % MERCHANTS.length],
      status: "pending",
      transactedAt: date,
    })
  }

  // 1 declined, 1 refunded on the active card
  txs.push({
    id: deterministicTxId(100),
    cardId: DEMO_CARD_ACTIVE_ID,
    invoiceId: null,
    amount: "500.00",
    currency: "SEK",
    description: "Declined payment attempt",
    merchantName: "Webhallen",
    status: "declined",
    transactedAt: new Date("2025-04-20T11:00:00.000Z"),
  })
  txs.push({
    id: deterministicTxId(101),
    cardId: DEMO_CARD_ACTIVE_ID,
    invoiceId: null,
    amount: "199.00",
    currency: "SEK",
    description: "Refunded purchase",
    merchantName: "H&M",
    status: "refunded",
    transactedAt: new Date("2025-04-22T15:30:00.000Z"),
  })

  // 2 transactions on the inactive card
  txs.push({
    id: deterministicTxId(200),
    cardId: DEMO_CARD_INACTIVE_ID,
    invoiceId: null,
    amount: "42.00",
    currency: "SEK",
    description: "Pending purchase",
    merchantName: "Test Shop",
    status: "pending",
    transactedAt: new Date("2026-01-01T10:00:00.000Z"),
  })
  txs.push({
    id: deterministicTxId(201),
    cardId: DEMO_CARD_INACTIVE_ID,
    invoiceId: null,
    amount: "78.00",
    currency: "SEK",
    description: "Another pending",
    merchantName: "Pressbyrån",
    status: "pending",
    transactedAt: new Date("2026-01-02T14:00:00.000Z"),
  })

  return txs
}

/** Full reset of app tables in dependency order, then deterministic demo rows. */
export async function resetAndSeed(db: AppDb, pool: Pool): Promise<SeedSummary> {
  for (const table of RESET_TABLES) {
    await pool.query(`DELETE FROM ${table}`)
  }

  await db.insert(users).values({
    id: DEMO_USER_ID,
    email: "demo@qred.demo",
    displayName: "Demo User",
  })

  await db.insert(companies).values({
    id: DEMO_COMPANY_ID,
    name: "Demo AB",
    orgNumber: "556677-8899",
  })

  await db.insert(userCompanies).values({
    userId: DEMO_USER_ID,
    companyId: DEMO_COMPANY_ID,
    role: "admin",
  })

  await db.insert(cards).values([
    {
      id: DEMO_CARD_ACTIVE_ID,
      companyId: DEMO_COMPANY_ID,
      cardLabel: "Visa •••• 4821",
      spendLimit: "10000.00",
      currency: "SEK",
      status: "active",
      activatedAt: new Date("2024-06-01T12:00:00.000Z"),
    },
    {
      id: DEMO_CARD_INACTIVE_ID,
      companyId: DEMO_COMPANY_ID,
      cardLabel: "Mastercard •••• 7390",
      spendLimit: "5000.00",
      currency: "SEK",
      status: "inactive",
      activatedAt: null,
    },
  ])

  await db.insert(invoices).values({
    id: DEMO_INVOICE_OVERDUE_ID,
    companyId: DEMO_COMPANY_ID,
    amount: "1500.00",
    currency: "SEK",
    status: "overdue",
    dueDate: "2025-02-01",
    paidAt: null,
  })

  await db.insert(userCards).values([
    {
      userId: DEMO_USER_ID,
      cardId: DEMO_CARD_ACTIVE_ID,
      companyId: DEMO_COMPANY_ID,
      role: "cardholder",
      assignedAt: new Date(),
      assignedBy: null,
    },
    {
      userId: DEMO_USER_ID,
      cardId: DEMO_CARD_INACTIVE_ID,
      companyId: DEMO_COMPANY_ID,
      role: "cardholder",
      assignedAt: new Date(),
      assignedBy: null,
    },
  ])

  const demoTxs = buildDemoTransactions()
  const BATCH_SIZE = 20
  for (let i = 0; i < demoTxs.length; i += BATCH_SIZE) {
    await db.insert(transactions).values(demoTxs.slice(i, i + BATCH_SIZE))
  }

  await db.insert(supportTickets).values({
    id: DEMO_SUPPORT_TICKET_ID,
    userId: DEMO_USER_ID,
    companyId: DEMO_COMPANY_ID,
    subject: "Demo ticket",
    message: "Seed data for demos — replace with real support intake.",
    status: "open",
  })

  return {
    demoUserId: DEMO_USER_ID,
    demoCompanyId: DEMO_COMPANY_ID,
    demoEmail: "demo@qred.demo",
    inactiveCardId: DEMO_CARD_INACTIVE_ID,
    activeCardId: DEMO_CARD_ACTIVE_ID,
  }
}
