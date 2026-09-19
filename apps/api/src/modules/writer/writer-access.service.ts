import { db } from '../../db'
import { USER_ROLE } from '../../models/user.model'
import type { AuthenticatedUser } from '../auth/auth.service'

export interface WriterContentAccess {
  creatorUserId: string
  canManageModeratedContent: boolean
}

export async function resolveWriterContentAccess(
  currentUser: Pick<AuthenticatedUser, 'id' | 'role'>,
  contentId: string,
): Promise<WriterContentAccess> {
  if (currentUser.role !== USER_ROLE.SUPER_ADMIN) {
    return { creatorUserId: currentUser.id, canManageModeratedContent: false }
  }

  const [story] = await db<Array<{ creator_user_id: string }>>`
    SELECT creator_user_id
    FROM stories
    WHERE id = ${contentId}
      AND deleted_at IS NULL
    LIMIT 1
  `

  return {
    creatorUserId: story?.creator_user_id ?? currentUser.id,
    canManageModeratedContent: true,
  }
}
