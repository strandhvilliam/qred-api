import type { AppDb } from "../db/app-db"

export function asMockDb(db: { select?: unknown; update?: unknown; insert?: unknown }): AppDb {
  return db as unknown as AppDb
}
