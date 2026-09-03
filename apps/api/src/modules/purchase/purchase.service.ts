// =============================================================
// Novel Platform — Purchase Service
// วางไว้ที่: apps/api/src/modules/purchase/purchase.service.ts
// =============================================================
//
// ❗ Security Critical — อ่านก่อนแก้ไข:
//
//   1. Atomic Deduction:
//      ใช้ SQL `WHERE point >= cost` ในคำสั่งเดียว
//      ป้องกัน race condition กรณี user กด "ซื้อ" พร้อมกัน 2 tab
//      ถ้า WHERE ไม่ตรง → 0 rows updated → เราจับได้ = เงินไม่พอ
//
//   2. Partial Unique Index + Advisory Lock:
//      ep_shop มี UNIQUE INDEX (user_id, ep_id) WHERE lock_after_datetime IS NULL
//      ครอบคลุมแค่กรณีถาวร (partial index predicate ต้อง IMMUTABLE, now() ไม่ใช่)
//      กรณี "ยังไม่หมดอายุ" (time-dependent, static index ครอบคลุมไม่ได้ในหลักการ)
//      ป้องกันด้วย pg_advisory_xact_lock ในทรานแซกชันด้านล่างแทน — ล็อกต่อคู่
//      (user_id, ep_id) ก่อน re-check ซ้ำ ปิด TOCTOU gap ระหว่างเช็คนอกทรานแซกชัน
//      (ด้านล่าง, แค่ early-exit message) กับตอน insert จริง
//
//   3. Idempotency:
//      coin_ledger.idempotency_key มี UNIQUE constraint
//      ป้องกัน double-deduct ถ้า request มาซ้ำ
// =============================================================

import { db } from '../../db'
import { sql } from 'kysely'
import { uuidv7 } from 'uuidv7'

// =============================================================
// ซื้อตอน (single หรือ bulk สูงสุด 20 ตอน)
// =============================================================

export async function purchaseEpisodes(userId: bigint, epIds: bigint[]) {
  // "ระงับการใช้จ่ายและเติมเงิน" (migration 027, 2026-07-30) — เช็คก่อนแตะ point เลย
  const spendSuspended = await db
    .selectFrom('user_spend_suspensions')
    .select('id')
    .where('user_id', '=', userId)
    .where('lifted_at', 'is', null)
    .executeTakeFirst()

  if (spendSuspended) throw new Error('SPEND_SUSPENDED')

  // ---- Validate input ----
  if (epIds.length === 0)  throw new Error('NO_EPISODES')
  if (epIds.length > 20)   throw new Error('TOO_MANY_EPISODES')

  // ---- ดึงข้อมูลตอนทั้งหมด ----
  const episodes = await db
    .selectFrom('work_ep as ep')
    .innerJoin('works as c', 'c.p_id', 'ep.p_id')
    .select([
      'ep.ep_id',
      'ep.p_id',
      'ep.ep_no',
      'ep.ep_price',
      'ep.lock_duration_days',
      'c.author_id',
    ])
    .where('ep.ep_id', 'in', epIds)
    .where('ep.status', '=', 'active')
    .where('ep.publish_status', '=', 'now')
    .execute()

  // ถ้าหา episode ไม่ครบ แสดงว่ามีบางตอนที่ไม่มีอยู่หรือยังไม่ publish
  if (episodes.length !== epIds.length) {
    throw new Error('EPISODE_NOT_FOUND')
  }

  // ---- ห้ามซื้องานตัวเอง ----
  // pg คืนคอลัมน์ BIGINT เป็น string เสมอ (ไม่ใช่ native bigint) ต้อง BigInt() ครอบก่อนเทียบ
  // ไม่งั้น === กับ userId (bigint) จะ false เสมอ เช็คนี้จะไม่ทำงานเลย
  const ownWork = episodes.find((ep) => BigInt(ep.author_id) === userId)
  if (ownWork) throw new Error('CANNOT_BUY_OWN_WORK')

  // ---- เช็คว่าซื้อไปแล้วยัง (ที่ยังไม่หมดอายุ) ----
  // partial unique index จะจัดการให้ที่ DB ด้วย แต่เช็คล่วงหน้าเพื่อ error message ที่ดีกว่า
  const alreadyPurchased = await db
    .selectFrom('ep_shop')
    .select('ep_id')
    .where('user_id', '=', userId)
    .where('ep_id', 'in', epIds)
    .where((eb) =>
      eb.or([
        eb('lock_after_datetime', 'is', null),
        eb('lock_after_datetime', '>', new Date()),
      ])
    )
    .execute()

  if (alreadyPurchased.length > 0) {
    throw new Error('ALREADY_PURCHASED')
  }

  // ---- ตอนฟรีไม่ต้องซื้อ ----
  const hasFreEpisode = episodes.some((ep) => Number(ep.ep_price) === 0)
  if (hasFreEpisode) throw new Error('HAS_FREE_EPISODE')

  // ---- คำนวณราคารวม ----
  // ep_price เป็น NUMERIC(10,2) → แปลงเป็น number ก่อน sum
  const totalCost = episodes.reduce((sum, ep) => sum + Number(ep.ep_price), 0)
  // ปัดเป็นจำนวนเต็มเพราะ point ใน DB เป็น BIGINT
  const totalCostInt = Math.round(totalCost)

  // ---- DB Transaction ----
  const result = await db.transaction().execute(async (trx) => {
    // ขั้นที่ 0: Advisory lock ต่อคู่ (user_id, ep_id) -- serialize concurrent
    // purchase attempts สำหรับ episode เดียวกัน แม้ยังไม่มีแถว ep_shop ให้
    // FOR UPDATE ล็อกเลยก็ตาม (จำเป็นเพราะ DB-level unique index คุ้มครองได้
    // แค่กรณีถาวร ดู comment ที่ migration 001) hashtextextended() รวม
    // user_id/ep_id เป็น lock key เดียว (เลี่ยง int4 overflow ของ overload
    // pg_advisory_xact_lock(int,int) เพราะทั้งคู่เป็น BIGINT) เรียงลำดับ epId
    // ก่อนล็อกเพื่อกันเดดล็อกเวลาสอง transaction ล็อกชุด episode ที่ overlap กัน
    const sortedEpIds = [...epIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    for (const epId of sortedEpIds) {
      const lockKey = `${userId}:${epId}`
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`.execute(trx)
    }

    // Re-check หลังได้ล็อกแล้ว -- เช็คก่อนเข้าทรานแซกชัน (ด้านบน) เป็นแค่
    // early-exit เพื่อ error message ที่เร็วกว่า ไม่ได้ปิด race condition จริง
    // เพราะ request คู่ขนานอาจซื้อสำเร็จไปแล้วระหว่างเช็คนั้นกับตอนได้ล็อกนี้
    const stillAvailable = await trx
      .selectFrom('ep_shop')
      .select('ep_id')
      .where('user_id', '=', userId)
      .where('ep_id', 'in', epIds)
      .where((eb) =>
        eb.or([
          eb('lock_after_datetime', 'is', null),
          eb('lock_after_datetime', '>', new Date()),
        ])
      )
      .execute()

    if (stillAvailable.length > 0) throw new Error('ALREADY_PURCHASED')

    // ขั้นที่ 1: Atomic deduction
    // ทำไมต้อง WHERE point >= cost?
    //   ถ้า user กด "ซื้อ" พร้อมกัน 2 ครั้ง (race condition)
    //   DB จะ process ทีละ query — query แรกหักได้, query ที่สอง WHERE ไม่ตรง → 0 rows
    //   เราจับ 0 rows → throw INSUFFICIENT_COINS → rollback
    const updatedUser = await trx
      .updateTable('users')
      .set({
        // as any จำเป็น — point เป็น ColumnType<bigint, never, never> (readonly ใน types.ts)
        // แต่ atomic SQL expression ไม่ใช่การ set ค่าตรงๆ จึงปลอดภัย
        point: sql<bigint>`point - ${totalCostInt}` as any,
      })
      .where('id', '=', userId)
      .where('point', '>=', BigInt(totalCostInt))   // ❗ key: เช็ค balance ในคำสั่งเดียว
      .returning('point')
      .executeTakeFirst()

    // ถ้า point ไม่พอ → WHERE ไม่ match → updatedUser จะเป็น undefined
    if (!updatedUser) throw new Error('INSUFFICIENT_COINS')

    const newBalance = updatedUser.point

    // ขั้นที่ 2: สร้าง ep_shop records (ทีละตอน)
    const shopRows = await Promise.all(
      episodes.map(async (ep) => {
        // คำนวณวันหมดอายุ ถ้ามี lock_duration_days
        // null = ถาวร (ซื้อแล้วอ่านได้ตลอด)
        const lockAfter = ep.lock_duration_days
          ? new Date(Date.now() + ep.lock_duration_days * 86_400_000)  // days → ms
          : null

        return trx
          .insertInto('ep_shop')
          .values({
            user_id:             userId,
            ep_id:               ep.ep_id,
            p_id:                ep.p_id,
            ep_no:               ep.ep_no,
            price:               ep.ep_price,
            remain_point:        newBalance,
            lock_after_datetime: lockAfter,
            // ledger_id จะอัปเดตทีหลัง
          })
          .returning(['id', 'ep_id', 'price', 'lock_after_datetime'])
          .executeTakeFirstOrThrow()
      })
    )

    // ขั้นที่ 3: เขียน coin_ledger (append-only)
    // ใช้ 1 entry ต่อ 1 purchase session (แม้จะซื้อหลายตอน)
    // idempotency_key ใช้ UUID ใหม่ทุกครั้ง เพราะแต่ละ purchase session ต่างกัน
    const idempotencyKey = `purchase:${uuidv7()}`

    const ledgerRow = await trx
      .insertInto('coin_ledger')
      .values({
        user_id:         userId,
        delta:           BigInt(-totalCostInt),   // - = หักเหรียญ
        reason:          'purchase',
        ref_type:        'ep_shop',
        ref_id:          shopRows[0].id,          // ref ตอนแรก (ตัวแทน session)
        idempotency_key: idempotencyKey,
        balance_after:   newBalance,
      })
      .returning('id')
      .executeTakeFirstOrThrow()

    // ขั้นที่ 4: อัปเดต ledger_id ใน ep_shop ทุกแถว
    await trx
      .updateTable('ep_shop')
      .set({ ledger_id: ledgerRow.id })
      .where('id', 'in', shopRows.map((r) => r.id))
      .execute()

    // ขั้นที่ 5: เพิ่ม sales ของ author แต่ละคน
    // group by author_id ก่อน เพื่อ UPDATE ทีเดียวต่อ author
    // (ป้องกัน N queries ถ้าซื้อหลายตอนของ author เดียวกัน)
    const authorSales = new Map<string, number>()
    for (const ep of episodes) {
      const key = String(ep.author_id)
      authorSales.set(key, (authorSales.get(key) ?? 0) + Number(ep.ep_price))
    }

    await Promise.all(
      Array.from(authorSales.entries()).map(([authorId, salesAmount]) =>
        trx
          .updateTable('users')
          // as any — sales เป็น readonly ใน types.ts เหมือน point ด้านบน
          .set({ sales: sql<bigint>`sales + ${Math.round(salesAmount)}` as any })
          .where('id', '=', BigInt(authorId))
          .execute()
      )
    )

    return {
      purchased:   shopRows.map((r) => ({
        ep_id:               String(r.ep_id),
        price:               r.price,
        lock_after_datetime: r.lock_after_datetime,
      })),
      total_cost:  totalCostInt,
      new_balance: String(newBalance),
    }
  })

  return result
}

// =============================================================
// ประวัติการซื้อตอน
// =============================================================

export async function getPurchaseHistory(userId: bigint, page: number, limit: number) {
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('ep_shop as s')
    .innerJoin('work_ep as ep', 'ep.ep_id', 's.ep_id')
    .innerJoin('works as c',  'c.p_id', 's.p_id')
    .select([
      's.id',
      's.ep_id',
      's.price',
      's.lock_after_datetime',
      's.created_at',
      'ep.ep_name',
      'ep.ep_no',
      'c.title as work_title',
      'c.uuid as work_uuid',
      'c.type as work_type',
      'c.cover_image',
    ])
    .where('s.user_id', '=', userId)
    .orderBy('s.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const countRow = await db
    .selectFrom('ep_shop')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow()

  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id:                  String(r.id),
      ep_id:               String(r.ep_id),
      ep_name:             r.ep_name,
      ep_no:               r.ep_no,
      work_title:          r.work_title,
      work_uuid:           r.work_uuid,
      work_type:           r.work_type,
      cover_image:         r.cover_image,
      price:               r.price,
      lock_after_datetime: r.lock_after_datetime,
      is_expired: r.lock_after_datetime
        ? new Date(r.lock_after_datetime) < new Date()
        : false,
      created_at: r.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}
