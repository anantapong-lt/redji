import { db } from '../../db'
import { TopupStatus } from '../../models/topup.model'

export interface AdminTopup {
  id: string
  provider: string
  provider_payment_id: string | null
  requested_amount: string
  base_coins: string
  bonus_coins: string
  credited_coins: string
  status: TopupStatus
  user_display_name: string
  user_username: string
  user_email: string
  user_avatar_url: string | null
  expires_at: Date | null
  paid_at: Date | null
  created_at: Date
}

interface AdminTopupFilters {
  search: string
  status: TopupStatus | null
  dateFrom: string | null
  dateTo: string | null
}

export async function countAdminTopups(filters: AdminTopupFilters) {
  if (filters.status === null) {
    const [row] = await db<{ total: string }[]>`
      SELECT COUNT(*)::TEXT AS total
      FROM topup_transactions
      JOIN users ON users.id = topup_transactions.user_id
      WHERE (
          ${filters.search} = ''
          OR STRPOS(LOWER(users.display_name), LOWER(${filters.search})) > 0
          OR STRPOS(LOWER(users.username), LOWER(${filters.search})) > 0
          OR STRPOS(LOWER(users.email), LOWER(${filters.search})) > 0
        )
        AND (
          ${filters.dateFrom}::DATE IS NULL
          OR topup_transactions.created_at >= (${filters.dateFrom}::DATE::TIMESTAMP AT TIME ZONE 'Asia/Bangkok')
        )
        AND (
          ${filters.dateTo}::DATE IS NULL
          OR topup_transactions.created_at < (((${filters.dateTo}::DATE + 1)::TIMESTAMP) AT TIME ZONE 'Asia/Bangkok')
        )
    `
    return Number(row?.total ?? 0)
  }

  const [row] = await db<{ total: string }[]>`
    SELECT COUNT(*)::TEXT AS total
    FROM topup_transactions
    JOIN users ON users.id = topup_transactions.user_id
    WHERE (
        ${filters.search} = ''
        OR STRPOS(LOWER(users.display_name), LOWER(${filters.search})) > 0
        OR STRPOS(LOWER(users.username), LOWER(${filters.search})) > 0
        OR STRPOS(LOWER(users.email), LOWER(${filters.search})) > 0
      )
      AND CASE
          WHEN topup_transactions.status = ${TopupStatus.PENDING}
            AND topup_transactions.expires_at IS NOT NULL
            AND topup_transactions.expires_at <= NOW()
            THEN ${TopupStatus.EXPIRED}::topup_transaction_status
          ELSE topup_transactions.status
        END = ${filters.status}::topup_transaction_status
      AND (
        ${filters.dateFrom}::DATE IS NULL
        OR topup_transactions.created_at >= (${filters.dateFrom}::DATE::TIMESTAMP AT TIME ZONE 'Asia/Bangkok')
      )
      AND (
        ${filters.dateTo}::DATE IS NULL
        OR topup_transactions.created_at < (((${filters.dateTo}::DATE + 1)::TIMESTAMP) AT TIME ZONE 'Asia/Bangkok')
      )
  `
  return Number(row?.total ?? 0)
}

export function findAdminTopups(page: number, limit: number, filters: AdminTopupFilters) {
  if (filters.status === null) {
    return db<AdminTopup[]>`
      SELECT
        topup_transactions.id,
        topup_transactions.provider,
        topup_transactions.provider_payment_id,
        topup_transactions.requested_amount::NUMERIC(12, 2)::TEXT,
        topup_transactions.base_coins::NUMERIC(12, 2)::TEXT,
        topup_transactions.bonus_coins::NUMERIC(12, 2)::TEXT,
        topup_transactions.credited_coins::NUMERIC(12, 2)::TEXT,
        CASE
          WHEN topup_transactions.status = ${TopupStatus.PENDING}
            AND topup_transactions.expires_at IS NOT NULL
            AND topup_transactions.expires_at <= NOW()
            THEN ${TopupStatus.EXPIRED}::topup_transaction_status
          ELSE topup_transactions.status
        END AS status,
        users.display_name AS user_display_name,
        users.username AS user_username,
        users.email AS user_email,
        users.avatar_url AS user_avatar_url,
        topup_transactions.expires_at,
        topup_transactions.paid_at,
        topup_transactions.created_at
      FROM topup_transactions
      JOIN users ON users.id = topup_transactions.user_id
      WHERE (
          ${filters.search} = ''
          OR STRPOS(LOWER(users.display_name), LOWER(${filters.search})) > 0
          OR STRPOS(LOWER(users.username), LOWER(${filters.search})) > 0
          OR STRPOS(LOWER(users.email), LOWER(${filters.search})) > 0
        )
        AND (
          ${filters.dateFrom}::DATE IS NULL
          OR topup_transactions.created_at >= (${filters.dateFrom}::DATE::TIMESTAMP AT TIME ZONE 'Asia/Bangkok')
        )
        AND (
          ${filters.dateTo}::DATE IS NULL
          OR topup_transactions.created_at < (((${filters.dateTo}::DATE + 1)::TIMESTAMP) AT TIME ZONE 'Asia/Bangkok')
        )
      ORDER BY topup_transactions.created_at DESC, topup_transactions.id DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `
  }

  return db<AdminTopup[]>`
    SELECT
      topup_transactions.id,
      topup_transactions.provider,
      topup_transactions.provider_payment_id,
      topup_transactions.requested_amount::NUMERIC(12, 2)::TEXT,
      topup_transactions.base_coins::NUMERIC(12, 2)::TEXT,
      topup_transactions.bonus_coins::NUMERIC(12, 2)::TEXT,
      topup_transactions.credited_coins::NUMERIC(12, 2)::TEXT,
      CASE
        WHEN topup_transactions.status = ${TopupStatus.PENDING}
          AND topup_transactions.expires_at IS NOT NULL
          AND topup_transactions.expires_at <= NOW()
          THEN ${TopupStatus.EXPIRED}::topup_transaction_status
        ELSE topup_transactions.status
      END AS status,
      users.display_name AS user_display_name,
      users.username AS user_username,
      users.email AS user_email,
      users.avatar_url AS user_avatar_url,
      topup_transactions.expires_at,
      topup_transactions.paid_at,
      topup_transactions.created_at
    FROM topup_transactions
    JOIN users ON users.id = topup_transactions.user_id
    WHERE (
        ${filters.search} = ''
        OR STRPOS(LOWER(users.display_name), LOWER(${filters.search})) > 0
        OR STRPOS(LOWER(users.username), LOWER(${filters.search})) > 0
        OR STRPOS(LOWER(users.email), LOWER(${filters.search})) > 0
      )
      AND CASE
          WHEN topup_transactions.status = ${TopupStatus.PENDING}
            AND topup_transactions.expires_at IS NOT NULL
            AND topup_transactions.expires_at <= NOW()
            THEN ${TopupStatus.EXPIRED}::topup_transaction_status
          ELSE topup_transactions.status
        END = ${filters.status}::topup_transaction_status
      AND (
        ${filters.dateFrom}::DATE IS NULL
        OR topup_transactions.created_at >= (${filters.dateFrom}::DATE::TIMESTAMP AT TIME ZONE 'Asia/Bangkok')
      )
      AND (
        ${filters.dateTo}::DATE IS NULL
        OR topup_transactions.created_at < (((${filters.dateTo}::DATE + 1)::TIMESTAMP) AT TIME ZONE 'Asia/Bangkok')
      )
    ORDER BY topup_transactions.created_at DESC, topup_transactions.id DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `
}
