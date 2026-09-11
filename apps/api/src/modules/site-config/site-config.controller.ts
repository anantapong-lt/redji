import { getPublicTopupConfig } from '../admin-site/admin-site.service'
import { getPublicFeatureConfig } from './site-config.service'

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

export async function loadPublicFeatureConfig() {
  try {
    return { features: await getPublicFeatureConfig() }
  } catch (error) {
    console.error('Unable to load public feature config', error)
    return Response.json({ message: 'ไม่สามารถโหลดการตั้งค่าฟีเจอร์ได้' }, { status: 500 })
  }
}
