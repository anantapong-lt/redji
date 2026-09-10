import { getPublicTopupConfig } from '../admin-site/admin-site.service'

export async function loadPublicTopupConfig() {
  try {
    const config = await getPublicTopupConfig()
    return {
      topup: config.topup,
      enabled: config.features.topup,
    }
  } catch (error) {
    console.error('Unable to load public topup config', error)
    return Response.json({ message: 'ไม่สามารถโหลดการตั้งค่าเติมเงินได้' }, { status: 500 })
  }
}
