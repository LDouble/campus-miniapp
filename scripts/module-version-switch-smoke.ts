import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as vm from 'node:vm'
import { normalizeMiniappVersion } from '../src/utils/miniapp-version-value.ts'
import { isMiniappModuleDisabledForVersion } from '../src/features/runtime-config/module-version.ts'
import { createHomeFeedRequestCoordinator } from '../src/features/home/feed-request-coordinator.ts'
import { resolveMyServicesDidShowRefresh } from '../src/features/life-services/my-services-refresh.ts'

assert.equal(normalizeMiniappVersion(' 1.2.3 '), '1.2.3')
assert.equal(normalizeMiniappVersion(''), '')
assert.equal(normalizeMiniappVersion(undefined), '')
assert.equal(isMiniappModuleDisabledForVersion(['1.2.3'], '1.2.3'), true)
assert.equal(isMiniappModuleDisabledForVersion(['1.2.3'], '1.2.4'), false)
assert.equal(isMiniappModuleDisabledForVersion(['1.2.3'], ''), false)

;(global as Record<string, unknown>).__CAMPUS_REVIEW_API_BASE_URL__ = 'https://review.example.invalid'
;(global as Record<string, unknown>).__CAMPUS_PRODUCTION_API_BASE_URL__ = 'https://api.example.invalid'
;(global as Record<string, unknown>).__CAMPUS_WECHAT_APP_ID__ = 'test-miniapp'
;(global as Record<string, unknown>).__CAMPUS_APP_EDITION__ = 'full'
let configuredMiniappVersion = '1.2.3'
;(global as Record<string, unknown>).__CAMPUS_MINIAPP_VERSION__ = configuredMiniappVersion
let runtimeMiniappVersion = ''
const taro = require('@tarojs/taro').default
taro.getAccountInfoSync = () => ({ miniProgram: { version: runtimeMiniappVersion, envVersion: 'trial' } })
const { getMiniappVersion, miniappVersionCacheScope } = require('../src/utils/miniapp-version')
assert.equal(
  getMiniappVersion(),
  '1.2.3',
  'trial 运行时版本为空时必须使用构建注入版本',
)
assert.notEqual(
  miniappVersionCacheScope(''),
  miniappVersionCacheScope('unversioned'),
  '空版本缓存作用域不得与合法字面版本冲突',
)

const {
  DEFAULT_MINIAPP_RUNTIME_CONFIG,
  getMiniappRuntimeConfig,
  resolveMiniappModule,
  seedMiniappRuntimeConfig,
} = require('../src/features/runtime-config')
const {
  canPersistPublisherDraft,
  resolvePublisherCreateSection,
} = require('../src/features/life-services/publisher-create-state')
const {
  consumeBusinessDetailSnapshot,
  saveBusinessDetailSnapshot,
} = require('../src/features/life-services/business-detail-snapshot')
const {
  consumeCommunityDetailSnapshot,
  saveCommunityDetailSnapshot,
} = require('../src/features/community/detail-snapshot')
const {
  getPageCacheScope,
  readPageCache,
  saveCachedPageUser,
  writePageCache,
} = require('../src/state/page-cache')
const { communityCacheKey } = require('../src/features/community/community-cache')
const {
  availableLifeServicePublicationTypes,
  availableLifeServiceOrderTypes,
  normalizeLifeServicePublicationType,
  isLifeServicePublicationTypeAvailable,
  resolveLifeServicePublicationTarget,
  lifeServiceModuleAvailabilitySignature,
} = require('../src/features/life-services/module-availability')
const enabledCarpoolConfig = {
  ...DEFAULT_MINIAPP_RUNTIME_CONFIG,
  modules: {
    ...DEFAULT_MINIAPP_RUNTIME_CONFIG.modules,
    community: { state: 'enabled' },
    errand: { state: 'enabled' },
    marketplace: { state: 'enabled' },
    carpool: { state: 'enabled', disabled_versions: ['1.2.3'] },
  },
}
assert.deepEqual(
  resolveMiniappModule(enabledCarpoolConfig, 'carpool', ''),
  { state: 'hidden' },
  '已启用模块必须在精确命中版本时关闭',
)
assert.equal(
  resolveMiniappModule(enabledCarpoolConfig, 'community', '').state,
  'enabled',
  '同行版本限制不得影响普通社区模块',
)
assert.deepEqual(availableLifeServiceOrderTypes(enabledCarpoolConfig), ['all', 'marketplace', 'errand'])
assert.deepEqual(availableLifeServiceOrderTypes({ ...enabledCarpoolConfig, modules: {
  ...enabledCarpoolConfig.modules,
  marketplace: { state: 'hidden' },
} }), ['errand'], '配置切换后订单必须只保留跑腿筛选')
assert.deepEqual(
  availableLifeServicePublicationTypes(enabledCarpoolConfig),
  ['community', 'errands', 'market'],
  '同行关闭时必须保留普通社区、跑腿和二手发布类型',
)
assert.equal(
  normalizeLifeServicePublicationType('carpool', enabledCarpoolConfig),
  'community',
  '直达已关闭同行发布类型必须回退到可用类型',
)
assert.equal(
  isLifeServicePublicationTypeAvailable('carpool', enabledCarpoolConfig),
  false,
  '关闭同行后发布器不得允许在页内切换、恢复草稿或提交同行',
)
assert.equal(
  isLifeServicePublicationTypeAvailable('community', enabledCarpoolConfig),
  true,
  '同行版本限制不得误伤普通社区发布',
)
assert.equal(
  resolveLifeServicePublicationTarget('market', {
    ...enabledCarpoolConfig,
    modules: {
      ...enabledCarpoolConfig.modules,
      community: { state: 'hidden' },
      marketplace: { state: 'hidden' },
    },
  }),
  'errands',
  '订单页发起发布时，二手关闭且跑腿可用应转到跑腿发布',
)
assert.equal(
  resolvePublisherCreateSection('carpool', false, enabledCarpoolConfig),
  'community',
  '创建同行在审核版本关闭时必须回退到可用发布类型',
)
assert.equal(
  resolvePublisherCreateSection('community', true, {
    ...enabledCarpoolConfig,
    modules: { ...enabledCarpoolConfig.modules, community: { state: 'hidden' } },
  }),
  null,
  '课堂讨论锁定社区时不得回退到跑腿或二手',
)
assert.equal(canPersistPublisherDraft(false, true), false, '草稿恢复前不得写入空表单')
assert.equal(canPersistPublisherDraft(true, false), false, '模块关闭时不得覆盖既有草稿')
assert.equal(canPersistPublisherDraft(true, true), true, '草稿恢复且模块可用时才允许自动保存')
assert.equal(
  resolvePublisherCreateSection('carpool', false, {
    ...enabledCarpoolConfig,
    modules: { ...enabledCarpoolConfig.modules, carpool: { state: 'enabled' } },
  }),
  'carpool',
  '配置重新开启后必须恢复原请求类型，供该类型草稿按原键恢复',
)
assert.equal(
  lifeServiceModuleAvailabilitySignature(enabledCarpoolConfig),
  lifeServiceModuleAvailabilitySignature({ ...enabledCarpoolConfig }),
  '配置未改变模块可用性时不得触发服务记录重置',
)
assert.notEqual(
  lifeServiceModuleAvailabilitySignature(enabledCarpoolConfig),
  lifeServiceModuleAvailabilitySignature({
    ...enabledCarpoolConfig,
    modules: { ...enabledCarpoolConfig.modules, errand: { state: 'hidden' } },
  }),
  '模块可用性变化必须触发服务记录重新归一化',
)
assert.deepEqual(
  availableLifeServicePublicationTypes({
    ...enabledCarpoolConfig,
    modules: Object.fromEntries(Object.keys(enabledCarpoolConfig.modules).map((key) => [key, { state: 'hidden' }])) as typeof enabledCarpoolConfig.modules,
  }),
  [],
  '全部模块关闭时发布器不得保留任何发布类型',
)
const homeRequests = createHomeFeedRequestCoordinator()
const firstFeed = homeRequests.beginFeed()
const configRequest = homeRequests.beginConfig()
const loadMore = homeRequests.beginFeed()
assert.equal(homeRequests.isFeedCurrent(firstFeed), false, '加载更多应淘汰旧 Feed 响应')
assert.equal(homeRequests.isConfigCurrent(configRequest), true, '加载更多不得取消仍在进行的配置刷新')
homeRequests.invalidateFeed()
assert.equal(homeRequests.isFeedCurrent(loadMore), false, '配置变更应淘汰按旧模块集合启动的加载更多')
assert.equal(
  resolveMyServicesDidShowRefresh(true, false, false),
  'skip',
  '首次显示已由 useLoad 请求时不得重复加载',
)
assert.equal(
  resolveMyServicesDidShowRefresh(false, false, false),
  'reload',
  '从详情返回且模块不变时必须刷新一次列表',
)
assert.equal(
  resolveMyServicesDidShowRefresh(false, true, false),
  'reload',
  '模块变化但当前视图仍可用时必须刷新一次且不清空列表',
)
assert.equal(
  resolveMyServicesDidShowRefresh(false, true, true),
  'normalize',
  '模块变化使当前筛选失效时必须归一化并刷新一次',
)
configuredMiniappVersion = '1.2.4'
;(global as Record<string, unknown>).__CAMPUS_MINIAPP_VERSION__ = configuredMiniappVersion
assert.equal(
  resolveMiniappModule(enabledCarpoolConfig, 'carpool', '').state,
  'enabled',
  '不匹配版本不得关闭模块',
)
assert.equal(
  isLifeServicePublicationTypeAvailable('carpool', enabledCarpoolConfig),
  true,
  '配置逆向开启后发布器必须重新允许同行类型',
)
assert.equal(
  resolveMiniappModule({ ...enabledCarpoolConfig, modules: {
    ...enabledCarpoolConfig.modules,
    carpool: { state: 'maintenance', disabled_versions: ['1.2.4'] },
  } }, 'carpool', '').state,
  'maintenance',
  '全局模块状态必须优先于版本关闭规则',
)

seedMiniappRuntimeConfig({
  version: 1,
  value: { ...DEFAULT_MINIAPP_RUNTIME_CONFIG, title: 'version-1.2.4' },
})
assert.equal(getMiniappRuntimeConfig().title, 'version-1.2.4')
saveBusinessDetailSnapshot('carpool', { id: 11 })
saveCommunityDetailSnapshot({ id: 12 })
seedMiniappRuntimeConfig({
  version: 2,
  value: { ...DEFAULT_MINIAPP_RUNTIME_CONFIG, title: 'version-1.2.4-next', modules: {
    ...DEFAULT_MINIAPP_RUNTIME_CONFIG.modules,
    carpool: { state: 'enabled' },
  } },
})
assert.equal(consumeBusinessDetailSnapshot('carpool', 11), null, '模块配置变化后不得恢复业务详情快照')
assert.equal(consumeCommunityDetailSnapshot(12), null, '模块配置变化后不得恢复社区详情快照')
configuredMiniappVersion = '1.2.5'
;(global as Record<string, unknown>).__CAMPUS_MINIAPP_VERSION__ = configuredMiniappVersion
assert.equal(
  getMiniappRuntimeConfig().title,
  DEFAULT_MINIAPP_RUNTIME_CONFIG.title,
  '不同小程序版本不得读取此前缓存的运行时配置',
)
saveCachedPageUser({ id: 99, username: '缓存同学', avatar_url: '' })
const communityCacheKeyA = communityCacheKey('feed:all')
writePageCache(communityCacheKeyA, { posts: [], page: 1, total: 0 })
assert.ok(readPageCache(communityCacheKeyA, (value: unknown): value is { posts: unknown[] } => (
  Boolean(value && typeof value === 'object' && 'posts' in value)
)))
configuredMiniappVersion = '1.2.6'
;(global as Record<string, unknown>).__CAMPUS_MINIAPP_VERSION__ = configuredMiniappVersion
const communityCacheKeyB = communityCacheKey('feed:all')
assert.notEqual(communityCacheKeyB, communityCacheKeyA, '社区 feed 缓存必须按构建版本隔离')
assert.equal(
  readPageCache(communityCacheKeyB, (value: unknown): value is { posts: unknown[] } => (
    Boolean(value && typeof value === 'object' && 'posts' in value)
  )),
  null,
  '新版本不得读取旧版本社区 feed 快照',
)
assert.notEqual(getPageCacheScope(), communityCacheKeyA.split(':community:')[0])
configuredMiniappVersion = ''
;(global as Record<string, unknown>).__CAMPUS_MINIAPP_VERSION__ = configuredMiniappVersion
runtimeMiniappVersion = '2.0.0'
assert.equal(getMiniappVersion(), '2.0.0', '未注入构建版本时才回退运行时版本')
runtimeMiniappVersion = ''
assert.equal(getMiniappVersion(), '', '构建和运行时版本都缺失时不得伪造版本')

const runtimeConfig = readFileSync(resolve(process.cwd(), 'src/features/runtime-config/index.ts'), 'utf8')
assert.match(runtimeConfig, /disabled_versions\?: string\[\]/u, '模块配置必须支持按版本关闭')
assert.match(runtimeConfig, /isMiniappModuleDisabledForVersion\(module\.disabled_versions, getMiniappVersion\(\)\)/u, '版本号命中时必须关闭已启用模块')
assert.match(runtimeConfig, /miniappVersionCacheScope\(\)/u, '运行时配置缓存必须按版本隔离')

const buildConfig = readFileSync(resolve(process.cwd(), 'config/index.ts'), 'utf8')
assert.match(buildConfig, /TARO_APP_MINIAPP_VERSION/u, '构建必须读取上传版本变量')
assert.match(buildConfig, /__CAMPUS_MINIAPP_VERSION__/u, '构建必须注入上传版本常量')
assert.match(buildConfig, /\^\[A-Za-z0-9\]\[A-Za-z0-9\._-\]\{0,63\}\$/u, '构建校验必须与后端版本契约一致')

const client = readFileSync(resolve(process.cwd(), 'src/api/client.ts'), 'utf8')
assert.match(client, /'X-Miniapp-Version': miniappVersion/u, '所有 API 请求必须携带已填写的小程序版本')

const auth = readFileSync(resolve(process.cwd(), 'src/api/auth.ts'), 'utf8')
assert.match(auth, /'X-Miniapp-Version': getMiniappVersion\(\)/u, '登录和刷新令牌请求必须携带小程序版本')

const errorReporting = readFileSync(resolve(process.cwd(), 'src/features/error-reporting/index.ts'), 'utf8')
assert.match(errorReporting, /'X-Miniapp-Version': getMiniappVersion\(\)/u, '错误上报请求必须携带小程序版本')

const aiVersion = readFileSync(resolve(process.cwd(), 'src/ai-mode/skills/campus-info/utils/miniapp-version.js'), 'utf8')
const aiRequest = readFileSync(resolve(process.cwd(), 'src/ai-mode/skills/campus-info/utils/request.js'), 'utf8')
const aiAuth = readFileSync(resolve(process.cwd(), 'src/ai-mode/skills/campus-info/utils/auth.js'), 'utf8')
assert.match(aiVersion, /__CAMPUS_MINIAPP_VERSION__/u, 'AI Skill 必须保留构建版本占位符，供复制阶段注入')
assert.match(aiVersion, /getAccountInfoSync/u, 'AI Skill 未注入版本时必须回退微信运行时版本')
assert.match(aiRequest, /withMiniappVersion/u, 'AI Skill 业务请求必须携带小程序版本')
assert.match(aiAuth, /withMiniappVersion/u, 'AI Skill 登录和刷新请求必须携带小程序版本')

const myServices = readFileSync(resolve(process.cwd(), 'src/pages/my-services/index.tsx'), 'utf8')
assert.match(myServices, /'private_message'\)\.state === 'enabled'/u, '我的服务联系入口必须检查私信模块')
assert.match(myServices, /loadMiniappRuntimeConfig\(\{ force: true \}\)/u, '发起私信前必须强制刷新模块配置')

const homeCache = readFileSync(resolve(process.cwd(), 'src/features/home/page-cache.ts'), 'utf8')
assert.match(homeCache, /getPageCacheScope\(\)\}:home/u, '首页快照必须使用全局版本缓存作用域')

const pageCache = readFileSync(resolve(process.cwd(), 'src/state/page-cache.ts'), 'utf8')
assert.match(pageCache, /miniappVersionCacheScope\(\)/u, '所有页面展示缓存必须按版本隔离')

type AiRequestRecord = {
  url: string
  method?: string
  header?: Record<string, string>
}

const loadAiSkillRuntime = (compiledVersion: string, runtimeVersion: string) => {
  const storage = new Map<string, unknown>()
  const requests: AiRequestRecord[] = []
  const wx = {
    getAccountInfoSync: () => ({ miniProgram: { appId: 'skill-test-app', version: runtimeVersion } }),
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: unknown) => { storage.set(key, value) },
    removeStorageSync: (key: string) => { storage.delete(key) },
    login: ({ success }: { success: (result: { code: string }) => void }) => success({ code: 'skill-code' }),
    request: (options: AiRequestRecord & { success: (response: unknown) => void }) => {
      requests.push(options)
      options.success({
        statusCode: 200,
        data: {
          data: options.url.includes('/auth/')
            ? { access_token: 'next-access', refresh_token: 'next-refresh', expires_in: 3600 }
            : { items: [], total: 0 },
        },
      })
    },
  }
  const modules = new Map<string, { exports: Record<string, unknown> }>()
  const utilsRoot = resolve(process.cwd(), 'src/ai-mode/skills/campus-info/utils')
  const load = (name: string): Record<string, unknown> => {
    const existing = modules.get(name)
    if (existing) return existing.exports
    const module = { exports: {} as Record<string, unknown> }
    modules.set(name, module)
    const file = resolve(utilsRoot, `${name}.js`)
    const source = readFileSync(file, 'utf8').replace(
      "'__CAMPUS_MINIAPP_VERSION__'",
      JSON.stringify(compiledVersion),
    )
    const evaluate = vm.runInNewContext(
      `(function (module, exports, require) { ${source}\n})`,
      { wx, console },
      { filename: file },
    ) as (
      module: { exports: Record<string, unknown> },
      exports: Record<string, unknown>,
      require: (request: string) => Record<string, unknown>,
    ) => void
    evaluate(module, module.exports, (request) => {
      if (!request.startsWith('./') || !request.endsWith('.js')) {
        throw new Error(`AI Skill 测试不支持的依赖：${request}`)
      }
      return load(request.slice(2, -3))
    })
    return module.exports
  }
  return { storage, requests, load }
}

const aiHeader = (request: AiRequestRecord) => request.header?.['X-Miniapp-Version']

const verifyAiRequestVersionHeaders = async () => {
  const compiled = loadAiSkillRuntime('1.2.3', '1.2.4')
  const compiledVersion = compiled.load('miniapp-version')
  assert.equal(compiledVersion.getMiniappVersion(), '1.2.3', 'AI Skill 必须优先使用复制时注入的版本')
  compiled.storage.set('campus.auth.accessToken.v1', 'existing-token')
  compiled.storage.set('campus.auth.expiresAt.v1', Date.now() + 60_000)
  await (compiled.load('request').get as (path: string, query: unknown) => Promise<unknown>)('/api/v1/shuttle/routes', {})
  assert.equal(aiHeader(compiled.requests.at(-1)!), '1.2.3', 'AI Skill GET 必须携带编译版本')

  const runtime = loadAiSkillRuntime('', '1.2.4')
  assert.equal(runtime.load('miniapp-version').getMiniappVersion(), '1.2.4', 'AI Skill 未注入版本时必须回退运行时版本')
  runtime.storage.set('campus.auth.accessToken.v1', 'existing-token')
  runtime.storage.set('campus.auth.expiresAt.v1', Date.now() + 60_000)
  await (runtime.load('request').get as (path: string, query: unknown) => Promise<unknown>)('/api/v1/classrooms/available', {})
  assert.equal(aiHeader(runtime.requests.at(-1)!), '1.2.4', 'AI Skill GET 必须携带运行时回退版本')

  const unversioned = loadAiSkillRuntime('', '')
  unversioned.storage.set('campus.auth.accessToken.v1', 'existing-token')
  unversioned.storage.set('campus.auth.expiresAt.v1', Date.now() + 60_000)
  await (unversioned.load('request').get as (path: string, query: unknown) => Promise<unknown>)('/api/v1/shuttle/routes', {})
  assert.equal(aiHeader(unversioned.requests.at(-1)!), undefined, '无版本时不得发送空版本头')

  const login = loadAiSkillRuntime('1.2.3', '1.2.4')
  await (login.load('auth').ensureAccessToken as () => Promise<string>)()
  assert.equal(aiHeader(login.requests.at(-1)!), '1.2.3', 'AI Skill 登录必须携带编译版本')

  const refresh = loadAiSkillRuntime('1.2.3', '1.2.4')
  refresh.storage.set('campus.auth.accessToken.v1', 'expired-token')
  refresh.storage.set('campus.auth.refreshToken.v1', 'refresh-token')
  refresh.storage.set('campus.auth.expiresAt.v1', 0)
  await (refresh.load('auth').refreshAccessToken as () => Promise<string>)()
  assert.equal(aiHeader(refresh.requests.at(-1)!), '1.2.3', 'AI Skill 刷新令牌必须携带编译版本')
}

void verifyAiRequestVersionHeaders()
  .then(() => console.log('module version switch smoke checks passed'))
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
