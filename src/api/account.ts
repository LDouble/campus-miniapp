import { apiRequest, createIdempotencyKey } from './client'
import {
  createSharedResource,
  invalidateSharedResourceGroup,
} from '../state/shared-resource'
import type { operations } from './generated/schema'
import type {
  AccountCancellationPreflight,
  AccountCancellationResult,
  CurrentUser,
  User,
} from './types'

const currentUserResource = createSharedResource<CurrentUser>({
  maxAgeMs: 5 * 60 * 1000,
  group: 'session',
})

export type SharedResourceRequestOptions = {
  force?: boolean
}

const requestCurrentUser = () => apiRequest<CurrentUser>({
  path: '/api/v1/auth/me',
  skipAcademicVerificationGuard: true,
})

export const getCurrentUser = (options: SharedResourceRequestOptions = {}) => (
  currentUserResource.ensure(requestCurrentUser, options)
)

export const invalidateCurrentUser = () => currentUserResource.invalidate()

export const seedCurrentUser = (currentUser: CurrentUser) => currentUserResource.seed(currentUser)

export const updateCurrentUsername = async (username: string) => {
  const user = await apiRequest<User>({
    path: '/api/v1/auth/me',
    method: 'PATCH',
    data: { username },
    idempotencyKey: createIdempotencyKey('profile-username'),
    skipAcademicVerificationGuard: true,
  })
  const currentUser = currentUserResource.peek()
  if (currentUser) {
    currentUserResource.seed({ ...currentUser, user })
  } else {
    currentUserResource.invalidate()
  }
  return user
}

export const updateCurrentAvatar = async (mediaId: number) => {
  const data: operations['UpdateMe']['requestBody']['content']['application/json'] = {
    avatar_media_id: mediaId,
  }
  const user = await apiRequest<User>({
    path: '/api/v1/auth/me',
    method: 'PATCH',
    data,
    idempotencyKey: createIdempotencyKey('profile-avatar'),
    skipAcademicVerificationGuard: true,
  })
  const currentUser = currentUserResource.peek()
  if (currentUser) {
    currentUserResource.seed({ ...currentUser, user })
  } else {
    currentUserResource.invalidate()
  }
  return user
}

// CurrentIdentity is intentionally narrow: most mini-program flows only need
// the user-scoped local-storage key and should not trigger the role/permission
// projection exposed by /auth/me.
export type CurrentIdentity = {
  user_id: number
}

const currentIdentityResource = createSharedResource<CurrentIdentity>({
  maxAgeMs: Number.POSITIVE_INFINITY,
  group: 'session',
})

const requestCurrentIdentity = () => apiRequest<CurrentIdentity>({
  path: '/api/v1/auth/identity',
  skipAcademicVerificationGuard: true,
})

export const getCurrentIdentity = (options: SharedResourceRequestOptions = {}) => (
  currentIdentityResource.ensure(requestCurrentIdentity, options)
)

export const invalidateCurrentIdentity = () => currentIdentityResource.invalidate()

export const seedCurrentIdentity = (identity: CurrentIdentity) => {
  if (currentIdentityResource.peek()?.user_id === identity.user_id) return
  currentIdentityResource.seed(identity)
}

export const getAccountCancellationPreflight = () => (
  apiRequest<AccountCancellationPreflight>({
    path: '/api/v1/account/cancellation',
    skipAcademicVerificationGuard: true,
  })
)

export const cancelCurrentAccount = async (input: {
  appId: string
  code: string
  idempotencyKey: string
}) => {
  const result = await apiRequest<AccountCancellationResult>({
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
  invalidateSharedResourceGroup('session')
  invalidateSharedResourceGroup('verification')
  invalidateSharedResourceGroup('academic')
  return result
}
