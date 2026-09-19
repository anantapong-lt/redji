import { db } from '../../db'

export type AgreementType = 'website' | 'writer'

export interface UsageAgreement {
  id: string
  type: AgreementType
  version: number
  content_html: string
  is_active: boolean
  created_at: Date
}

export async function findActiveAgreement(type: AgreementType): Promise<UsageAgreement | null> {
  const [agreement] = await db<UsageAgreement[]>`
    SELECT id, type, version, content_html, is_active, created_at
    FROM usage_agreements WHERE type = ${type}::usage_agreement_type AND is_active
    LIMIT 1
  `
  return agreement ?? null
}

export async function findAgreements(type: AgreementType): Promise<UsageAgreement[]> {
  return db<UsageAgreement[]>`
    SELECT id, type, version, content_html, is_active, created_at
    FROM usage_agreements WHERE type = ${type}::usage_agreement_type
    ORDER BY version DESC
  `
}

export async function createAgreement(type: AgreementType, contentHtml: string): Promise<UsageAgreement> {
  const [agreement] = await db<UsageAgreement[]>`
    INSERT INTO usage_agreements (type, version, content_html)
    VALUES (${type}::usage_agreement_type,
      (SELECT COALESCE(MAX(version), 0) + 1 FROM usage_agreements WHERE type = ${type}::usage_agreement_type),
      ${contentHtml})
    RETURNING id, type, version, content_html, is_active, created_at
  `
  return agreement
}

export async function activateAgreement(type: AgreementType, id: string): Promise<boolean> {
  return db.begin(async (transaction) => {
    await transaction`UPDATE usage_agreements SET is_active = FALSE, updated_at = NOW() WHERE type = ${type}::usage_agreement_type AND is_active`
    const [agreement] = await transaction<{ id: string }[]>`
      UPDATE usage_agreements SET is_active = TRUE, updated_at = NOW()
      WHERE id = ${id} AND type = ${type}::usage_agreement_type RETURNING id
    `
    return Boolean(agreement)
  })
}
