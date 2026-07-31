import { apiRequest } from './client'
import type {
  AccountCancellationPreflight,
  AccountCancellationResult,
  CurrentUser,
} from './types'

export const getCurrentUser = () => apiRequest<CurrentUser>({
  path: '/api/v1/auth/me',
  skipAcademicVerificationGuard: true,
})

export const getAccountCancellationPreflight = () => (
  apiRequest<AccountCancellationPreflight>({
    path: '/api/v1/account/cancellation',
    skipAcademicVerificationGuard: true,
  })
)

export const cancelCurrentAccount = (input: {
  appId: string
  code: string
  idempotencyKey: string
}) => apiRequest<AccountCancellationResult>({
  path: '/api/v1/account/cancellation',
  method: 'POST',
  idempotencyKey: input.idempotencyKey,
  skipAcademicVerificationGuard: true,
  retryAfterRefresh: false,
  data: {
    app_id: input.appId,
    code: input.code,
    confirmed: true,
  },
})
