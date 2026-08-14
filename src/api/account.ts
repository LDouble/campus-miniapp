import { apiRequest, createIdempotencyKey } from './client'
import type {
  AccountCancellationPreflight,
  AccountCancellationResult,
  CurrentUser,
  User,
} from './types'

export const getCurrentUser = () => apiRequest<CurrentUser>({
  path: '/api/v1/auth/me',
  skipAcademicVerificationGuard: true,
})

export const updateCurrentUsername = (username: string) => apiRequest<User>({
  path: '/api/v1/auth/me',
  method: 'PATCH',
  data: { username },
  idempotencyKey: createIdempotencyKey('profile-username'),
  skipAcademicVerificationGuard: true,
})

// CurrentIdentity is intentionally narrow: most mini-program flows only need
// the user-scoped local-storage key and should not trigger the role/permission
// projection exposed by /auth/me.
export type CurrentIdentity = {
  user_id: number
}

export const getCurrentIdentity = () => apiRequest<CurrentIdentity>({
  path: '/api/v1/auth/identity',
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
