import { apiRequest } from '../../api/client'
import type { components } from '../../api/generated/schema'

const userBlockPath = (userId: number) => `/api/v1/users/${userId}/block`

type UserBlockResult = components['schemas']['UserBlockResult']

/** blockUser 按当前登录用户的关系拉黑指定用户。 */
export const blockUser = (userId: number) => apiRequest<UserBlockResult>({
  path: userBlockPath(userId),
  method: 'PUT',
})

/** unblockUser 取消当前登录用户对指定用户的拉黑。 */
export const unblockUser = (userId: number) => apiRequest<UserBlockResult>({
  path: userBlockPath(userId),
  method: 'DELETE',
})
