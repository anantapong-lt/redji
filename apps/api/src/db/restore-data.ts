// =============================================================
// Novel Platform — Data Restore (one-off tool)
// วางไว้ที่: apps/api/src/db/restore-data.ts
// รัน: bun run restore-data <path-to-sql-file>
// =============================================================
//
// Runs a plain-SQL dump file (pg_dump --inserts, NOT the default COPY
// format -- COPY needs the special libpq copy protocol that a single
// pool.query() call can't drive) against DATABASE_URL. Meant for moving
// local dev data into a freshly-migrated (schema-only) Railway database.

import { readFileSync } from 'fs'
import { Pool } from 'pg'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const sqlFile = process.argv[2]
  if (!sqlFile) {
    throw new Error('Usage: bun run restore-data <path-to-sql-file>')
  }

  const sql = readFileSync(sqlFile, 'utf-8')
  const pool = new Pool({ connectionString: databaseUrl })

  try {
    console.log(`restoring data from ${sqlFile}...`)
    await pool.query(sql)
    console.log('done')
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
