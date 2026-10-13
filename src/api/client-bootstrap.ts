import { apiRequest } from './client'
import type { ClientBootstrap } from './types'
import { createSharedResource } from '../state/shared-resource'

const clientBootstrapResource = createSharedResource<ClientBootstrap>({
  maxAgeMs: 15_000,
  group: 'session',
})

export const getClientBootstrap = (options: { force?: boolean } = {}) => (
  clientBootstrapResource.ensure(
    () => apiRequest<ClientBootstrap>({
      path: '/api/v1/me/bootstrap',
      skipAcademicVerificationGuard: true,
    }),
    options,
  )
)

export const invalidateClientBootstrap = () => (
  clientBootstrapResource.invalidate({ clearData: true })
)
