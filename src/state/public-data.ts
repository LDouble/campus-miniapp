import {
  getCurrentIdentity,
  getCurrentUser,
  seedCurrentIdentity,
} from '../api/account'
import { listAcademicPeriods } from '../api/academic'
import { getAcademicVerificationStatus } from '../api/academic-verification'
import { isAccountCancelled } from '../api/auth'
import {
  getCalendarEducationLevel,
  loadAcademicCalendar,
} from '../features/calendar/repository'

type Settled<T> = { ok: true; value: T } | { ok: false }

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
export const preloadPublicData = async () => {
  if (isAccountCancelled()) return

  void settle(loadAcademicCalendar(getCalendarEducationLevel()))
  const [account, verification] = await Promise.all([
    settle(getCurrentUser()),
    settle(getAcademicVerificationStatus()),
  ])

  if (!account.ok || !verification.ok) return
  seedCurrentIdentity({ user_id: account.value.user.id })
  if (verification.value.identity?.status !== 'verified') return

  await Promise.all([
    settle(getCurrentIdentity()),
    settle(listAcademicPeriods()),
  ])
}
