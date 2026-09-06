import { status } from 'elysia'
import type { adminSiteConfigBodySchema } from './admin-site.schema'
import { getAdminSiteConfig, saveAdminSiteConfig } from './admin-site.service'

export async function loadAdminSiteConfig() {
  try {
    return await getAdminSiteConfig()
  } catch (error) {
    console.error('Unable to load admin site config', error)
    return status(500, { message: 'ไม่สามารถโหลดการตั้งค่าเว็บไซต์ได้' })
  }
}

export async function updateAdminSiteConfig(body: typeof adminSiteConfigBodySchema.static) {
  try {
    return await saveAdminSiteConfig(body)
  } catch (error) {
    console.error('Unable to save admin site config', error)
    return status(500, { message: 'ไม่สามารถบันทึกการตั้งค่าเว็บไซต์ได้' })
  }
}
