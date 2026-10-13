import {
  getCurrentIdentity,
  getCurrentUser,
  seedCurrentIdentity,
} from '../api/account'
import { listAcademicPeriods } from '../api/academic'
import {
  getAcademicVerificationStatus,
  seedAcademicVerificationStatus,
} from '../api/academic-verification'
import { isAccountCancelled } from '../api/auth'
import { getClientBootstrap } from '../api/client-bootstrap'
import { seedMyDailyCheckinStatus } from '../api/daily-checkins'
import {
  getCalendarEducationLevel,
  loadAcademicCalendar,
} from '../features/calendar/repository'
import { seedMiniappRuntimeConfig } from '../features/runtime-config'
import type { AcademicVerificationStatus } from '../api/types'

type Settled<T> = { ok: true; value: T } | { ok: false }

type ClientBootstrapPreload = {
  verification: AcademicVerificationStatus | null
}

const settle = async <T,>(promise: Promise<T>): Promise<Settled<T>> => {
  try {
    return { ok: true, value: await promise }
  } catch {
    return { ok: false }
  }
}

/**
 * 非阻塞预热页面共同依赖的数据。
 *
 * 页面仍可同时调用相同资源；共享状态会合并同飞请求并按 freshness
 * 决定是否真正访问网络。
 */
export const preloadClientBootstrap = async (): Promise<ClientBootstrapPreload> => {
  if (isAccountCancelled()) return { verification: null }
  const bootstrap = await settle(getClientBootstrap())
  const bootstrapVerification = bootstrap.ok
    ? bootstrap.value.academic_verification ?? null
    : null
  if (bootstrap.ok) {
    if (bootstrapVerification) seedAcademicVerificationStatus(bootstrapVerification)
    if (bootstrap.value.checkin) seedMyDailyCheckinStatus(bootstrap.value.checkin)
    if (bootstrap.value.runtime_config) {
      try {
        seedMiniappRuntimeConfig(bootstrap.value.runtime_config)
      } catch {
        // Invalid aggregate sections fall back to their existing loaders.
      }
    }
  }

  return { verification: bootstrapVerification }
}

export const preloadPublicData = async (
  bootstrapPromise: Promise<ClientBootstrapPreload> = preloadClientBootstrap(),
) => {
  if (isAccountCancelled()) return

  void settle(loadAcademicCalendar(getCalendarEducationLevel()))
  const accountPromise = settle(getCurrentUser())
  const { verification: bootstrapVerification } = await bootstrapPromise

  const [account, fallbackVerification] = await Promise.all([
    accountPromise,
    bootstrapVerification
      ? Promise.resolve({ ok: false } as Settled<AcademicVerificationStatus>)
      : settle(getAcademicVerificationStatus()),
  ])
  const verification: Settled<AcademicVerificationStatus> = bootstrapVerification
    ? { ok: true, value: bootstrapVerification }
    : fallbackVerification

  if (!account.ok || !verification.ok) return
  seedCurrentIdentity({ user_id: account.value.user.id })
  if (verification.value.identity?.status !== 'verified') return

  await Promise.all([
    settle(getCurrentIdentity()),
    settle(listAcademicPeriods()),
  ])
}
