import Taro from '@tarojs/taro'
import { reportClientError } from '../features/error-reporting'

const DEFAULT_NAVIGATION_TIMEOUT_MS = 8_000
const pendingTargets = new Set<string>()

type NavigationSnapshot = {
  currentRoute: string
  stackDepth: number
}

const navigationSnapshot = (): NavigationSnapshot => {
  try {
    const pages = Taro.getCurrentPages() as Array<{ route?: string }>
    return {
      currentRoute: pages[pages.length - 1]?.route || '/',
      stackDepth: pages.length,
    }
  } catch {
    return { currentRoute: '/', stackDepth: 0 }
  }
}

const navigationLog = (
  phase: 'start' | 'success' | 'failure' | 'timeout' | 'deduplicated',
  target: string,
  startedAt: number,
  error?: unknown,
) => {
  const snapshot = navigationSnapshot()
  const entry = {
    phase,
    target,
    currentRoute: snapshot.currentRoute,
    stackDepth: snapshot.stackDepth,
    durationMs: Date.now() - startedAt,
    ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
  }
  if (phase === 'failure' || phase === 'timeout') console.error('[页面导航]', entry)
  else console.info('[页面导航]', entry)
}

export const logForegroundNavigationState = () => {
  const snapshot = navigationSnapshot()
  try {
    const entry = Taro.getEnterOptionsSync()
    console.info('[小程序前台恢复]', {
      currentRoute: snapshot.currentRoute,
      stackDepth: snapshot.stackDepth,
      scene: entry.scene,
      path: entry.path || '',
      query: entry.query || {},
    })
  } catch (error) {
    console.info('[小程序前台恢复]', {
      currentRoute: snapshot.currentRoute,
      stackDepth: snapshot.stackDepth,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

const reportNavigationFailure = (
  phase: 'failure' | 'timeout',
  target: string,
  startedAt: number,
  error?: unknown,
) => {
  const snapshot = navigationSnapshot()
  const errorMessage = error instanceof Error ? error.message : String(error || '')
  void reportClientError({
    kind: 'js_error',
    route: snapshot.currentRoute,
    message: [
      `navigation_${phase}`,
      `target=${target}`,
      `stack_depth=${snapshot.stackDepth}`,
      `duration_ms=${Date.now() - startedAt}`,
      errorMessage ? `error=${errorMessage}` : '',
    ].filter(Boolean).join(' '),
  })
}

export const navigateToWithGuard = async (
  url: string,
  options: { timeoutMs?: number; failureTitle?: string } = {},
) => {
  const target = String(url || '').trim()
  if (!target) return false
  const startedAt = Date.now()
  if (pendingTargets.has(target)) {
    navigationLog('deduplicated', target, startedAt)
    await Taro.showToast({ title: '页面正在打开，请稍候', icon: 'none' })
    return false
  }

  pendingTargets.add(target)
  navigationLog('start', target, startedAt)
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeoutMs = options.timeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS
    await Promise.race([
      Taro.navigateTo({ url: target }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('navigation_timeout')), timeoutMs)
      }),
    ])
    navigationLog('success', target, startedAt)
    return true
  } catch (error) {
    const phase = error instanceof Error && error.message === 'navigation_timeout'
      ? 'timeout'
      : 'failure'
    navigationLog(phase, target, startedAt, error)
    reportNavigationFailure(phase, target, startedAt, error)
    await Taro.showToast({
      title: options.failureTitle || '页面打开失败，请稍后重试',
      icon: 'none',
    }).catch(() => undefined)
    return false
  } finally {
    if (timer) clearTimeout(timer)
    pendingTargets.delete(target)
  }
}
