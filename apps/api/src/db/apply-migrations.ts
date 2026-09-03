// =============================================================
// Novel Platform — Migration Runner
// วางไว้ที่: apps/api/src/db/apply-migrations.ts
// รัน: bun run migrate  (จาก apps/api)
// =============================================================
//
// Applies every .sql file in src/db/migrations/, in filename order, that
// hasn't been recorded in _schema_migrations yet. Safe to re-run against
// the same database: already-applied files are skipped. Each file runs in
// its own transaction; a failure stops the run immediately so later files
// never run against a half-applied schema.

import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { Pool } from 'pg'

const MIGRATIONS_DIR = join(import.meta.dir, 'migrations')

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    const { rows: appliedRows } = await pool.query<{ filename: string }>(
      'SELECT filename FROM _schema_migrations'
    )
    const applied = new Set(appliedRows.map((row) => row.filename))

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .sort()

    let appliedCount = 0
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip (already applied): ${file}`)
        continue
      }

      console.log(`applying: ${file}`)
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8')

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO _schema_migrations (filename) VALUES ($1)', [file])
        await client.query('COMMIT')
        appliedCount++
      } catch (error) {
        await client.query('ROLLBACK')
        console.error(`FAILED: ${file}`)
        throw error
      } finally {
        client.release()
      }
    }

    console.log(
      `done — applied ${appliedCount} new migration(s), ${files.length - appliedCount} already up to date`
    )
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
