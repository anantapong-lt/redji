import { db } from '../../db'

export interface PublicFeatureConfig {
  registration: boolean
  writer_application: boolean
  comments: boolean
}

export async function getPublicFeatureConfig(): Promise<PublicFeatureConfig> {
  const [row] = await db<{ value: Partial<PublicFeatureConfig> }[]>`
    SELECT value
    FROM website_configs
    WHERE key = 'features'
  `
  const features = row?.value

  return {
    registration: features?.registration === true,
    writer_application: features?.writer_application === true,
    comments: features?.comments === true,
  }
}

export async function isFeatureEnabled(feature: keyof PublicFeatureConfig): Promise<boolean> {
  const features = await getPublicFeatureConfig()
  return features[feature]
}
