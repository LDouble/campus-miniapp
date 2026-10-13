import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import {
  createSharedResource,
  invalidateSharedResourceGroup,
} from '../src/state/shared-resource'

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

const run = async () => {
  let now = 1_000
  let calls = 0
  const resource = createSharedResource<number>({
    maxAgeMs: 100,
    group: 'smoke-session',
    now: () => now,
  })
  const loader = async () => ++calls

  assert.equal(await resource.ensure(loader), 1)
  assert.equal(await resource.ensure(loader), 1)
  assert.equal(calls, 1, 'TTL 内必须复用最近成功值')

  now += 100
  assert.equal(await resource.ensure(loader), 2)
  assert.equal(calls, 2, 'TTL 到期边界必须重新请求')
  assert.equal(await resource.ensure(loader, { force: true }), 3)

  let resolvePending: ((value: number) => void) | null = null
  const pendingLoader = () => {
    calls += 1
    return new Promise<number>((resolve) => { resolvePending = resolve })
  }
  const first = resource.ensure(pendingLoader, { force: true })
  const second = resource.ensure(pendingLoader, { force: true })
  assert.equal(first, second, '同一资源的并发请求必须复用同一个 Promise')
  await Promise.resolve()
  resolvePending?.(4)
  assert.equal(await first, 4)

  let failedCalls = 0
  resource.invalidate()
  await assert.rejects(resource.ensure(async () => {
    failedCalls += 1
    throw new Error('network')
  }))
  await assert.rejects(resource.ensure(async () => {
    failedCalls += 1
    throw new Error('network')
  }))
  assert.equal(failedCalls, 2, '失败后必须清理 pending 以允许重试')

  resource.seed(8, now)
  assert.equal(resource.peek(), 8)
  invalidateSharedResourceGroup('smoke-session')
  assert.equal(resource.peek(), null, '会话分组失效必须清除数据')

  let resolveOld: ((value: number) => void) | null = null
  const oldRequest = resource.ensure(() => new Promise<number>((resolve) => { resolveOld = resolve }))
  await Promise.resolve()
  resource.invalidate({ clearData: true })
  resource.seed(9, now)
  resolveOld?.(7)
  assert.equal(await oldRequest, 7)
  await flush()
  assert.equal(resource.peek(), 9, '失效前的旧请求不得覆盖新一代数据')

  now = 0
  resource.seed(10, now)
  resource.invalidate()
  assert.equal(await resource.ensure(loader), calls, '失效不能依赖 updatedAt=0 的时间巧合')

  resource.invalidate({ clearData: true })
  await assert.rejects(resource.ensure(() => { throw new Error('sync loader') }))
  assert.equal(resource.snapshot().loading, false, '同步异常也必须清理 pending')

  const keyed = new Map<string, ReturnType<typeof createSharedResource<string>>>()
  const forKey = (key: string) => {
    const existing = keyed.get(key)
    if (existing) return existing
    const created = createSharedResource<string>({ maxAgeMs: 100, now: () => now })
    keyed.set(key, created)
    return created
  }
  assert.notEqual(forKey('undergraduate'), forKey('graduate'), '不同资源键不得错误合并')

  const appSource = readFileSync(resolvePath(__dirname, '../src/app.ts'), 'utf8')
  const homeSource = readFileSync(resolvePath(__dirname, '../src/pages/index/index.tsx'), 'utf8')
  const academicSource = readFileSync(resolvePath(__dirname, '../src/api/academic.ts'), 'utf8')
  const verificationSource = readFileSync(resolvePath(__dirname, '../src/api/academic-verification.ts'), 'utf8')
  const checkinSource = readFileSync(resolvePath(__dirname, '../src/api/daily-checkins.ts'), 'utf8')
  const authSource = readFileSync(resolvePath(__dirname, '../src/api/auth.ts'), 'utf8')
  const bootstrapSource = readFileSync(resolvePath(__dirname, '../src/api/client-bootstrap.ts'), 'utf8')
  const publicDataSource = readFileSync(resolvePath(__dirname, '../src/state/public-data.ts'), 'utf8')
  const timetableSource = readFileSync(resolvePath(__dirname, '../src/api/personal-timetable.ts'), 'utf8')
  const privateUnreadSource = readFileSync(resolvePath(__dirname, '../src/features/direct-messages/unread.ts'), 'utf8')
  assert.ok(appSource.includes('void preloadPublicData()'), 'App 启动与前台恢复必须预热公共状态')
  assert.ok(homeSource.includes('void loadHome(true)'), '首页下拉刷新必须强制更新公共状态')
  assert.ok(academicSource.includes("group: 'academic'"), '学期必须使用共享 academic 资源')
  assert.ok(authSource.includes("invalidateSharedResourceGroup('session')"), '会话清理必须失效共享状态')
  assert.ok(bootstrapSource.includes("'/api/v1/me/bootstrap'"), '客户端初始化必须优先请求聚合接口')
  assert.ok(bootstrapSource.includes('invalidateClientBootstrap'), '聚合缓存必须提供写操作后的统一失效入口')
  assert.ok(verificationSource.includes('invalidateClientBootstrap()'), '认证状态变更必须失效聚合缓存')
  assert.ok(checkinSource.includes('invalidateClientBootstrap()'), '签到成功必须失效聚合缓存')
  assert.ok(publicDataSource.includes('getClientBootstrap()'), '公共状态预热必须接入聚合接口')
  assert.ok(publicDataSource.includes('const accountPromise = settle(getCurrentUser())'), '账户请求必须与聚合请求并行')
  assert.ok(appSource.includes('preloadPublicData(bootstrap)'), '完整公共数据预热必须复用同一聚合请求')
  assert.ok(appSource.includes('void bootstrap.then('), '运行时配置不得等待完整公共数据预热')
  assert.ok(publicDataSource.includes('getAcademicVerificationStatus()'), '聚合接口降级时必须保留旧认证状态接口兜底')
  assert.ok(timetableSource.includes('PERSONAL_TIMETABLE_FRESH_MS = 30_000'), '课表本地缓存必须为 30 秒')
  assert.ok(timetableSource.includes("group: 'session'"), '课表缓存必须随用户会话失效')
  assert.ok(privateUnreadSource.includes('maxAgeMs: 15_000'), '私信未读数本地缓存必须为 15 秒')
  assert.ok(!appSource.includes('refreshPrivateMessageUnreadCount(true)'), 'App 生命周期刷新不得绕过私信未读缓存')

  process.stdout.write('public request state smoke: ok\n')
}

void run()
