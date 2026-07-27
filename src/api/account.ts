import { apiRequest } from './client'
import type { CurrentUser } from './types'

export const getCurrentUser = () => apiRequest<CurrentUser>({
  path: '/api/v1/auth/me',
  skipAcademicVerificationGuard: true,
})
