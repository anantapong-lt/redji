// =============================================================
// Novel Platform — Social Routes
// วางไว้ที่: apps/api/src/modules/social/social.routes.ts
// =============================================================

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { accountRateLimitRule, enforceRateLimit } from '../../lib/rate-limit'
import {
  followUser, unfollowUser, getFollowing,
  addFavorite, removeFavorite, getFavorites,
  addBookmark, removeBookmark, getBookmarks, setBookmarkFeatured,
  addEpisodeBookmark, removeEpisodeBookmark, getEpisodeBookmarks,
  deleteComment, likeComment, unlikeComment, reportContent,
  getNotifications, markAsRead, markAllAsRead,
  getReadingHistory,
} from './social.service'

// ---- Helper: แปลง error → HTTP response ----
function handleSocialError(err: any, set: any) {
  const map: Record<string, { status: number; message: string }> = {
    USER_NOT_FOUND:           { status: 404, message: 'ไม่พบผู้ใช้นี้' },
    CANNOT_FOLLOW_SELF:       { status: 400, message: 'ไม่สามารถ follow ตัวเองได้' },
    ALREADY_FOLLOWING:        { status: 400, message: 'คุณ follow คนนี้ไปแล้ว' },
    NOT_FOLLOWING:            { status: 400, message: 'คุณยังไม่ได้ follow คนนี้' },
    WORK_NOT_FOUND:           { status: 404, message: 'ไม่พบผลงานนี้' },
    EPISODE_NOT_FOUND:        { status: 404, message: 'ไม่พบตอนนี้' },
    ALREADY_FAVORITED:        { status: 400, message: 'กดหัวใจไปแล้ว' },
    NOT_FAVORITED:            { status: 400, message: 'ยังไม่ได้กดหัวใจผลงานนี้' },
    CANNOT_FAVORITE_OWN_WORK: { status: 400, message: 'ไม่สามารถกดหัวใจผลงานตัวเองได้' },
    ALREADY_BOOKMARKED:       { status: 400, message: 'เก็บเข้าคลังไปแล้ว' },
    NOT_BOOKMARKED:           { status: 400, message: 'ยังไม่ได้เก็บผลงานนี้เข้าคลัง' },
    CANNOT_BOOKMARK_OWN_WORK: { status: 400, message: 'ไม่สามารถเก็บผลงานตัวเองเข้าคลังได้' },
    EP_ALREADY_BOOKMARKED:    { status: 400, message: 'บันทึกตอนนี้ไปแล้ว' },
    EP_NOT_BOOKMARKED:        { status: 400, message: 'ยังไม่ได้บันทึกตอนนี้ไว้' },
    FEATURED_LIMIT:           { status: 400, message: 'ตั้งนิยายแนะนำได้สูงสุด 8 เรื่องเท่านั้น' },
    COMMENT_NOT_FOUND:        { status: 404, message: 'ไม่พบความคิดเห็นนี้' },
    NOT_YOUR_COMMENT:         { status: 403, message: 'ลบได้เฉพาะความคิดเห็นของตัวเองเท่านั้น' },
    NESTED_REPLY_NOT_ALLOWED: { status: 400, message: 'ไม่รองรับการ reply ซ้อนกัน' },
    ALREADY_LIKED:            { status: 400, message: 'กด like ไปแล้ว' },
    NOT_LIKED:                { status: 400, message: 'ยังไม่ได้กด like' },
    NOTIFICATION_NOT_FOUND:   { status: 404, message: 'ไม่พบการแจ้งเตือนนี้' },
    EMPTY_REASON:             { status: 400, message: 'กรุณาระบุเหตุผลในการรายงาน' },
    CANNOT_REPORT_OWN_CONTENT: { status: 400, message: 'ไม่สามารถรายงานเนื้อหาของตัวเองได้' },
    ALREADY_REPORTED:         { status: 400, message: 'คุณรายงานเนื้อหานี้ไปแล้ว กำลังรอตรวจสอบ' },
    INVALID_CATEGORY:         { status: 400, message: 'กรุณาเลือกหมวดหมู่ที่ถูกต้อง' },
  }

  const matched = map[err.message]
  if (matched) {
    set.status = matched.status
    return { success: false, message: matched.message }
  }
  throw err
}

// =============================================================
// Social Routes — /social (ทุก endpoint ต้องล็อกอิน)
// =============================================================

export const socialRoutes = new Elysia({ prefix: '/social' })
  .use(authMiddleware)

  // --------------------------------------------------
  // POST /social/follow/:user_uuid
  // Follow writer
  // --------------------------------------------------
  .post('/follow/:user_uuid', async ({ user, params, set }) => {
    try {
      await followUser(BigInt(user.id), params.user_uuid)
      return { success: true, message: 'Follow สำเร็จ' }
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    params: t.Object({ user_uuid: t.String() }),
    detail: { summary: 'Follow writer', tags: ['Social'] },
  })

  // --------------------------------------------------
  // DELETE /social/follow/:user_uuid
  // Unfollow writer
  // --------------------------------------------------
  .delete('/follow/:user_uuid', async ({ user, params, set }) => {
    try {
      await unfollowUser(BigInt(user.id), params.user_uuid)
      return { success: true, message: 'Unfollow สำเร็จ' }
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    params: t.Object({ user_uuid: t.String() }),
    detail: { summary: 'Unfollow writer', tags: ['Social'] },
  })

  // --------------------------------------------------
  // GET /social/following
  // รายการ writer ที่ฉัน follow
  // --------------------------------------------------
  .get('/following', async ({ user, query }) => {
    const data = await getFollowing(
      BigInt(user.id),
      query.page  ?? 1,
      query.limit ?? 20,
    )
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
    }),
    detail: { summary: 'รายการที่ฉัน follow', tags: ['Social'] },
  })

  // --------------------------------------------------
  // POST /social/favorites/:work_uuid
  // กดหัวใจผลงาน ("ชอบ" เฉยๆ — คนละอันกับเก็บเข้าคลังด้านล่าง)
  // --------------------------------------------------
  .post('/favorites/:work_uuid', async ({ user, params, set }) => {
    try {
      await addFavorite(BigInt(user.id), params.work_uuid)
      return { success: true, message: 'กดหัวใจสำเร็จ' }
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    params: t.Object({ work_uuid: t.String() }),
    detail: { summary: 'กดหัวใจผลงาน', tags: ['Social'] },
  })

  // --------------------------------------------------
  // DELETE /social/favorites/:work_uuid
  // เลิกกดหัวใจ
  // --------------------------------------------------
  .delete('/favorites/:work_uuid', async ({ user, params, set }) => {
    try {
      await removeFavorite(BigInt(user.id), params.work_uuid)
      return { success: true, message: 'เลิกกดหัวใจสำเร็จ' }
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    params: t.Object({ work_uuid: t.String() }),
    detail: { summary: 'เลิกกดหัวใจ', tags: ['Social'] },
  })

  // --------------------------------------------------
  // GET /social/favorites
  // รายการผลงานที่กดหัวใจไว้
  // --------------------------------------------------
  .get('/favorites', async ({ user, query }) => {
    const data = await getFavorites(
      BigInt(user.id),
      query.page  ?? 1,
      query.limit ?? 20,
    )
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
    }),
    detail: { summary: 'รายการที่กดหัวใจไว้', tags: ['Social'] },
  })

  // --------------------------------------------------
  // POST /social/bookmarks/:work_uuid
  // เก็บผลงานเข้าคลัง (ตั้งใจเก็บไว้อ่านทีหลัง — migration 009, คนละตารางกับหัวใจ)
  // --------------------------------------------------
  .post('/bookmarks/:work_uuid', async ({ user, params, set }) => {
    try {
      await addBookmark(BigInt(user.id), params.work_uuid)
      return { success: true, message: 'เก็บเข้าคลังสำเร็จ' }
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    params: t.Object({ work_uuid: t.String() }),
    detail: { summary: 'เก็บผลงานเข้าคลัง', tags: ['Social'] },
  })

  // --------------------------------------------------
  // DELETE /social/bookmarks/:work_uuid
  // เอาออกจากคลัง
  // --------------------------------------------------
  .delete('/bookmarks/:work_uuid', async ({ user, params, set }) => {
    try {
      await removeBookmark(BigInt(user.id), params.work_uuid)
      return { success: true, message: 'เอาออกจากคลังสำเร็จ' }
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    params: t.Object({ work_uuid: t.String() }),
    detail: { summary: 'เอาผลงานออกจากคลัง', tags: ['Social'] },
  })

  // --------------------------------------------------
  // GET /social/bookmarks
  // รายการผลงานที่เก็บเข้าคลังไว้
  // --------------------------------------------------
  .get('/bookmarks', async ({ user, query }) => {
    const data = await getBookmarks(
      BigInt(user.id),
      query.page  ?? 1,
      query.limit ?? 20,
      query.featured ?? false,
    )
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:     t.Optional(t.Numeric({ minimum: 1 })),
      limit:    t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
      featured: t.Optional(t.Boolean()),
    }),
    detail: { summary: 'รายการที่เก็บเข้าคลังไว้', tags: ['Social'] },
  })

  // --------------------------------------------------
  // PATCH /social/bookmarks/:work_uuid/featured
  // ตั้ง/เอาออกจาก "นิยายแนะนำ" หน้าโปรไฟล์ (นักอ่านทั่วไป, migration 022 — สูงสุด 8 เรื่อง)
  // --------------------------------------------------
  .patch('/bookmarks/:work_uuid/featured', async ({ user, params, body, set }) => {
    try {
      await setBookmarkFeatured(BigInt(user.id), params.work_uuid, body.featured)
      return { success: true }
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    params: t.Object({ work_uuid: t.String() }),
    body: t.Object({ featured: t.Boolean() }),
    detail: { summary: 'ตั้ง/เอาออกจากนิยายแนะนำ', tags: ['Social'] },
  })

  // --------------------------------------------------
  // POST /social/episode-bookmarks/:work_uuid/:ep_no
  // เก็บตอนนี้ไว้ดูทีหลัง (แยกจากเก็บเข้าคลังทั้งเรื่องด้านบน — migration 023, 2026-07-29)
  // --------------------------------------------------
  .post('/episode-bookmarks/:work_uuid/:ep_no', async ({ user, params, set }) => {
    try {
      await addEpisodeBookmark(BigInt(user.id), params.work_uuid, params.ep_no)
      return { success: true, message: 'บันทึกตอนนี้สำเร็จ' }
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    params: t.Object({ work_uuid: t.String(), ep_no: t.Numeric({ minimum: 0 }) }),
    detail: { summary: 'บันทึกตอนนี้ไว้ดูทีหลัง', tags: ['Social'] },
  })

  // --------------------------------------------------
  // DELETE /social/episode-bookmarks/:work_uuid/:ep_no
  // --------------------------------------------------
  .delete('/episode-bookmarks/:work_uuid/:ep_no', async ({ user, params, set }) => {
    try {
      await removeEpisodeBookmark(BigInt(user.id), params.work_uuid, params.ep_no)
      return { success: true, message: 'เอาออกจากที่บันทึกไว้สำเร็จ' }
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    params: t.Object({ work_uuid: t.String(), ep_no: t.Numeric({ minimum: 0 }) }),
    detail: { summary: 'เอาตอนนี้ออกจากที่บันทึกไว้', tags: ['Social'] },
  })

  // --------------------------------------------------
  // GET /social/episode-bookmarks
  // รายการตอนที่บันทึกไว้ดูทีหลัง (ยังไม่มีหน้าแสดงผลจริง — เตรียม endpoint ไว้ก่อน)
  // --------------------------------------------------
  .get('/episode-bookmarks', async ({ user, query }) => {
    const data = await getEpisodeBookmarks(BigInt(user.id), query.page ?? 1, query.limit ?? 20)
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
    }),
    detail: { summary: 'รายการตอนที่บันทึกไว้ดูทีหลัง', tags: ['Social'] },
  })

  // --------------------------------------------------
  // GET /social/reading-history
  // ประวัติการอ่าน แบ่งกลุ่ม ล่าสุด/สัปดาห์นี้/นานกว่านั้น — pagination ใช้กับกลุ่ม
  // "นานกว่านั้น" เท่านั้น (page/limit หมายถึงกลุ่มนี้โดยเฉพาะ)
  // --------------------------------------------------
  .get('/reading-history', async ({ user, query }) => {
    const data = await getReadingHistory(
      BigInt(user.id),
      query.page  ?? 1,
      query.limit ?? 20,
    )
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
    }),
    detail: { summary: 'ประวัติการอ่าน (แบ่งกลุ่มล่าสุด/สัปดาห์นี้/นานกว่านั้น)', tags: ['Social'] },
  })

  // --------------------------------------------------
  // DELETE /social/comments/:comment_id
  // ลบ comment ของตัวเอง (soft delete)
  // --------------------------------------------------
  .delete('/comments/:comment_id', async ({ user, params, set }) => {
    try {
      await deleteComment(BigInt(user.id), BigInt(params.comment_id))
      set.status = 204
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    params: t.Object({ comment_id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'ลบความคิดเห็นของตัวเอง', tags: ['Social'] },
  })

  // --------------------------------------------------
  // POST /social/comments/:comment_id/like
  // Like comment
  // --------------------------------------------------
  .post('/comments/:comment_id/like', async ({ user, params, set }) => {
    try {
      await likeComment(BigInt(user.id), BigInt(params.comment_id))
      return { success: true, message: 'Like สำเร็จ' }
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    params: t.Object({ comment_id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'Like comment', tags: ['Social'] },
  })

  // --------------------------------------------------
  // DELETE /social/comments/:comment_id/like
  // Unlike comment
  // --------------------------------------------------
  .delete('/comments/:comment_id/like', async ({ user, params, set }) => {
    try {
      await unlikeComment(BigInt(user.id), BigInt(params.comment_id))
      return { success: true, message: 'Unlike สำเร็จ' }
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    params: t.Object({ comment_id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'Unlike comment', tags: ['Social'] },
  })

  // --------------------------------------------------
  // POST /social/reports
  // รายงาน comment, work, หรือ user (แทนปุ่ม "รายงาน" ที่เดิม mock — ดู content_reports,
  // migration 025) — target_ref คือ comment id (ตัวเลข) ถ้า target_type='comment',
  // work uuid ถ้า target_type='work', หรือ user uuid ถ้า target_type='user' (2026-08-18)
  //
  // migration 032: บังคับเลือก category ด้วยเสมอ — 'content_error' เด้งเข้าคิวนักเขียน
  // เจ้าของผลงาน ที่เหลือเข้าคิวแอดมินเหมือนเดิม (ดู isWriterRoutedCategory ใน
  // lib/report-categories.ts) — target_type='user' ไม่มีทางเด้งเข้าคิวนักเขียนเลย (ไม่มี
  // work_author_id เกี่ยวข้อง) ไม่ว่าจะเลือกหมวดไหนก็ตาม
  // --------------------------------------------------
  .post('/reports', async ({ user, body, set }) => {
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('content-report-create', user.id, 10, 60 * 60),
    ])
    if (limited) return limited

    try {
      const data = await reportContent(BigInt(user.id), body.target_type, body.target_ref, body.category, body.reason)
      set.status = 201
      return { success: true, data }
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    body: t.Object({
      target_type: t.Union([t.Literal('comment'), t.Literal('work'), t.Literal('user')]),
      target_ref:  t.String({ minLength: 1, maxLength: 100 }),
      category:    t.Union([
        t.Literal('content_error'), t.Literal('copyright'), t.Literal('unrated_18plus'),
        t.Literal('inappropriate'), t.Literal('scam'), t.Literal('spam'),
        t.Literal('impersonation'), t.Literal('harassment'), t.Literal('general'), t.Literal('other'),
      ]),
      reason:      t.String({ minLength: 1, maxLength: 500 }),
    }),
    detail: { summary: 'รายงาน comment, work, หรือ user', tags: ['Social'] },
  })

// =============================================================
// Notification Routes — /notifications (ทุก endpoint ต้องล็อกอิน)
// =============================================================

export const notificationRoutes = new Elysia({ prefix: '/notifications' })
  .use(authMiddleware)

  // --------------------------------------------------
  // GET /notifications
  // รายการแจ้งเตือนพร้อม unread_count
  // --------------------------------------------------
  .get('/', async ({ user, query }) => {
    const data = await getNotifications(
      BigInt(user.id),
      query.page  ?? 1,
      query.limit ?? 20,
    )
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
    }),
    detail: { summary: 'รายการแจ้งเตือน', tags: ['Notifications'] },
  })

  // --------------------------------------------------
  // PATCH /notifications/read-all
  // Mark ทั้งหมดเป็น read
  // ⚠️ ต้องวาง route นี้ก่อน /:id/read
  //    เพราะ Elysia match จากบนลงล่าง
  //    ถ้าวาง /:id ก่อน มัน match "read-all" เป็น id แทน
  // --------------------------------------------------
  .patch('/read-all', async ({ user }) => {
    await markAllAsRead(BigInt(user.id))
    return { success: true, message: 'อ่านทั้งหมดแล้ว' }
  }, {
    detail: { summary: 'Mark ทั้งหมดเป็น read', tags: ['Notifications'] },
  })

  // --------------------------------------------------
  // PATCH /notifications/:id/read
  // Mark แจ้งเตือนเดียวเป็น read
  // --------------------------------------------------
  .patch('/:id/read', async ({ user, params, set }) => {
    try {
      await markAsRead(BigInt(user.id), BigInt(params.id))
      return { success: true }
    } catch (err: any) { return handleSocialError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'Mark แจ้งเตือนเป็น read', tags: ['Notifications'] },
  })
