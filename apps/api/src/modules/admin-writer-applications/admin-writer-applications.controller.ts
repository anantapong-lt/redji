import { status } from 'elysia'
import type { adminWriterApplicationActionBodySchema, adminWriterApplicationsQuerySchema } from './admin-writer-applications.schema'
import { countWriterApplications, findWriterApplications, reviewWriterApplication, WriterApplicationError } from './admin-writer-applications.service'

export async function getAdminWriterApplications(query: typeof adminWriterApplicationsQuerySchema.static) {
  try {
    const limit = query.limit ?? 20
    const search = query.search?.trim() ?? ''
    const selectedStatus = query.status ?? null
    const total = await countWriterApplications(selectedStatus, search)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const page = Math.min(query.page ?? 1, totalPages)
    const applications = await findWriterApplications(page, limit, selectedStatus, search)
    return { applications, pagination: { page, limit, total, totalPages } }
  } catch (error) {
    console.error('Unable to load writer applications', error)
    return status(500, { message: 'ไม่สามารถโหลดใบสมัครนักเขียนได้' })
  }
}

export async function updateAdminWriterApplication(
  id: string,
  adminId: string,
  body: typeof adminWriterApplicationActionBodySchema.static,
) {
  try {
    return { application: await reviewWriterApplication(id, adminId, body.action, body.note?.trim() ?? '') }
  } catch (error) {
    if (error instanceof WriterApplicationError) return status(error.statusCode, { message: error.message })
    console.error('Unable to review writer application', error)
    return status(500, { message: 'ไม่สามารถพิจารณาใบสมัครนักเขียนได้' })
  }
}
