import { db } from '../../db'
import { TopupStatus } from '../../models/topup.model'

export interface AdminDashboardData {
  selected_period: { year: number; month: number }
  stats: {
    user_count: string
    writer_count: string
    story_count: string
    chapter_count: string
    total_views: string
    topup_total: string
    purchase_total: string
  }
  topup_chart: { date: string; amount: string }[]
  recent_topups: { id: string; username: string; amount: string; status: TopupStatus; created_at: Date }[]
  recent_transactions: {
    id: string
    type: 'topup' | 'purchase'
    description: string
    username: string
    amount: string
    created_at: Date
  }[]
}

export async function getAdminDashboard(year: number, month: number): Promise<AdminDashboardData> {
  const [stats, chart, recentTopups, recentTransactions] = await Promise.all([
    db<AdminDashboardData['stats'][]>`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'user' AND deleted_at IS NULL)::TEXT AS user_count,
        (SELECT COUNT(*) FROM users WHERE role = 'writer' AND deleted_at IS NULL)::TEXT AS writer_count,
        (SELECT COUNT(*) FROM stories WHERE deleted_at IS NULL)::TEXT AS story_count,
        (SELECT COUNT(*) FROM chapters INNER JOIN stories ON stories.id = chapters.story_id WHERE stories.deleted_at IS NULL)::TEXT AS chapter_count,
        (SELECT COALESCE(SUM(total_views), 0) FROM stories WHERE deleted_at IS NULL)::TEXT AS total_views,
        (SELECT COALESCE(SUM(requested_amount), 0)::NUMERIC(12, 2) FROM topup_transactions WHERE status = ${TopupStatus.PAID})::TEXT AS topup_total,
        (SELECT COALESCE(SUM(price), 0)::NUMERIC(12, 2) FROM chapter_purchases)::TEXT AS purchase_total
    `,
    db<AdminDashboardData['topup_chart']>`
      WITH bounds AS (
        SELECT make_date(${year}, ${month}, 1) AS starts_at,
          (make_date(${year}, ${month}, 1) + INTERVAL '1 month')::DATE AS ends_at
      ), days AS (
        SELECT generate_series(starts_at, ends_at - 1, INTERVAL '1 day')::DATE AS day
        FROM bounds
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(topup_transactions.requested_amount) FILTER (WHERE topup_transactions.status = ${TopupStatus.PAID}), 0)::NUMERIC(12, 2)::TEXT AS amount
      FROM days
      LEFT JOIN topup_transactions
        ON topup_transactions.created_at >= days.day::TIMESTAMPTZ
        AND topup_transactions.created_at < (days.day + 1)::TIMESTAMPTZ
      GROUP BY days.day
      ORDER BY days.day
    `,
    db<AdminDashboardData['recent_topups']>`
      SELECT topup_transactions.id, users.username,
        topup_transactions.requested_amount::NUMERIC(12, 2)::TEXT AS amount,
        CASE
          WHEN topup_transactions.status = ${TopupStatus.PENDING} AND topup_transactions.expires_at IS NOT NULL AND topup_transactions.expires_at <= NOW()
            THEN ${TopupStatus.EXPIRED}::topup_transaction_status
          ELSE topup_transactions.status
        END AS status,
        topup_transactions.created_at
      FROM topup_transactions
      INNER JOIN users ON users.id = topup_transactions.user_id
      ORDER BY topup_transactions.created_at DESC, topup_transactions.id DESC
      LIMIT 5
    `,
    db<AdminDashboardData['recent_transactions']>`
      SELECT id, type, description, username, amount::NUMERIC(12, 2)::TEXT, created_at
      FROM (
        SELECT topup_transactions.id, 'topup'::TEXT AS type,
          'เติมเงิน'::TEXT AS description, users.username,
          topup_transactions.requested_amount AS amount, topup_transactions.paid_at AS created_at
        FROM topup_transactions
        INNER JOIN users ON users.id = topup_transactions.user_id
        WHERE topup_transactions.status = ${TopupStatus.PAID}
        UNION ALL
        SELECT chapter_purchases.id, 'purchase'::TEXT AS type,
          chapters.title AS description, users.username,
          chapter_purchases.price AS amount, chapter_purchases.purchased_at AS created_at
        FROM chapter_purchases
        INNER JOIN users ON users.id = chapter_purchases.buyer_user_id
        INNER JOIN chapters ON chapters.id = chapter_purchases.chapter_id
      ) AS transactions
      ORDER BY created_at DESC, id DESC
      LIMIT 10
    `,
  ])

  return {
    selected_period: { year, month },
    stats: stats[0] ?? {
      user_count: '0', writer_count: '0', story_count: '0', chapter_count: '0',
      total_views: '0', topup_total: '0.00', purchase_total: '0.00',
    },
    topup_chart: chart,
    recent_topups: recentTopups,
    recent_transactions: recentTransactions,
  }
}
