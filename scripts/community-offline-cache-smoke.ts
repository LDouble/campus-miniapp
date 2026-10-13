import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import Module = require('node:module')
import { resolve } from 'node:path'
import ts = require('typescript')

const page = readFileSync('src/pages/community/index.tsx', 'utf8')
const feed = readFileSync('src/features/community/feed-panel.tsx', 'utf8')
const cache = readFileSync('src/features/community/community-cache.ts', 'utf8')

assert.match(page, /readPageCache/, '社区板块和话题必须在请求前同步读取持久化缓存')
assert.match(page, /writePageCache/, '社区板块和话题成功刷新后必须写入持久化缓存')
assert.match(page, /subscribePageCacheScope/, '账号作用域切换必须清空社区页面内存状态')
assert.doesNotMatch(page, /setCommunityRoots\(\[\]\)[\s\S]{0,180}setCommunitySectionsError/, '板块刷新失败不能清空已有内容')
assert.doesNotMatch(page, /catch \{[\s\S]{0,120}setHotTopics\(\[\]\)/, '话题刷新失败不能清空已有内容')
assert.match(feed, /readPageCache/, '帖子列表必须在请求前同步读取持久化缓存')
assert.match(feed, /writePageCache/, '帖子列表成功刷新后必须写入持久化缓存')
assert.match(page, /key=\{getPageCacheScope\(\)\}/, '账号作用域切换必须重挂载帖子列表')
assert.match(feed, /removePageCache/, '点赞、评论等本地变更必须使持久化列表缓存失效')
assert.match(feed, /communityFeedCache\.get\(feedCacheKey\)/, '内存帖子缓存必须使用包含账号和校区的完整键读取')
assert.match(feed, /saveCommunityFeedCache\(requestCacheKey/, '内存帖子缓存必须使用请求时捕获的完整键写入')
assert.match(feed, /activeFeedCacheKeyRef\.current === feedCacheKey/, '同查询在账号或校区切换后不得复用旧列表状态')
assert.match(cache, /\$\{getPageCacheScope\(\)\}:community:/, '缓存键必须按环境和账号作用域隔离')

const pagePath = resolve(__dirname, '../src/features/community/feed-panel.tsx')
const pageSource = readFileSync(pagePath, 'utf8')
const deferred = <T,>() => {
  let resolvePromise!: (value: T) => void
  let rejectPromise!: (error?: unknown) => void
  const promise = new Promise<T>((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await new Promise<void>((done) => setImmediate(done)) }
const post = (content: string) => ({
  id: 1, section_id: 1, version: 1, author_id: 1, author_nickname: '同学', author_deleted: false,
  author_level: {}, created_at: '', updated_at: '', content, comment_count: 0, like_count: 0,
  liked: false, images: [], comment_previews: [], liked_by_nicknames: [], available_actions: [],
})
const key = JSON.stringify({ activeSectionId: 1, activeParentSectionId: null, keyword: '', sort: 'latest' })

async function exerciseFeed(cachePosts: any[], outcome: 'reject' | 'empty' | 'late' | 'cross') {
  let scope = 'A'
  const cache = new Map<string, any>([[`${scope}:community:all:feed:${key}`, { posts: cachePosts, page: 1, total: cachePosts.length }]])
  let request = deferred<any>()
  const hooks: any[] = []; const effects: Array<() => any> = []; let index = 0
  const React = {
    createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children }),
    useState: (initial: any) => { const i = index++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial; return [hooks[i], (value: any) => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value }] },
    useRef: (value: any) => { const i = index++; return hooks[i] || (hooks[i] = { current: value }) },
    useEffect: (effect: any) => { index++; effects.push(effect) }, useCallback: (fn: any) => { index++; return fn },
    useMemo: (fn: any) => { index++; return fn() },
  }
  const noop = () => undefined; const component = new Proxy(noop, { get: () => noop })
  const taro = new Proxy({ hideKeyboard: async () => undefined, showToast: noop }, { get: (target, name) => (target as any)[name] || noop })
  const modules: Record<string, any> = {
    react: React, '@tarojs/taro': { default: taro }, '@tarojs/components': component,
    './use-view-page-visible': { useViewPageVisible: () => true }, './community-cache': { communityCacheKey: (suffix: string) => `${scope}:community:all:${suffix}`, isCommunityFeedCache: (value: any) => Boolean(value?.posts) },
    '../../state/page-cache': { getPageCacheScope: () => scope, readPageCache: (cacheKey: string) => cache.get(cacheKey) || null, writePageCache: (cacheKey: string, value: any) => cache.set(cacheKey, value), removePageCache: (cacheKey: string) => cache.delete(cacheKey) },
    '../life-services/repository': { lifeServicesRepository: { listCampusCirclePosts: () => request.promise } }, '../runtime-config': { getMiniappRuntimeConfig: () => ({}), getSelectedCampus: () => '', },
    '../life-services/refresh-policy': { getLifeHubRefreshRevision: () => 0, isLifeHubCacheReusable: () => true, markLifeHubSectionDirty: noop, markLifeHubSectionFresh: noop },
  }
  const originalLoad = (Module as any)._load
  ;(Module as any)._load = (name: string, parent: any, isMain: boolean) => parent?.filename === pagePath
    ? (name.endsWith('.scss') ? {} : modules[name] || component) : originalLoad(name, parent, isMain)
  try {
    const output = ts.transpileModule(`var React = require('react');\n${pageSource}\nexports.Test = CommunityFeedPanel`, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: pagePath }).outputText
    const loaded = new Module(pagePath, module); loaded.filename = pagePath; (loaded as any)._compile(output, pagePath)
    const render = () => { index = 0; (loaded.exports as any).Test({ sectionRoots: [], activeSection: { id: 1, parent_id: null, children: [], name: '全部' }, sectionsReady: true }) }
    render()
    assert.deepEqual(hooks[2], cachePosts, '网络请求未完成时必须同步显示持久化帖子缓存')
    effects.splice(0).forEach((effect) => effect())
    if (outcome === 'reject') request.reject(new Error('timeout'))
    else { if (outcome === 'late') scope = 'B'; request.resolve({ items: outcome === 'cross' ? [post('A 网络内容')] : [], page: 1, total: outcome === 'cross' ? 1 : 0 }) }
    await tick(); render()
    if (outcome === 'reject') assert.deepEqual(hooks[2], cachePosts, '请求失败不得清空已展示帖子')
    if (outcome === 'empty') assert.deepEqual(hooks[2], [], '成功空结果必须覆盖旧缓存')
    if (outcome === 'late') assert.deepEqual(hooks[2], cachePosts, '作用域过期响应不得写回')
    if (outcome === 'cross') {
      scope = 'B'
      hooks.length = 0
      effects.length = 0
      request = deferred<any>()
      render()
      assert.deepEqual(hooks[2], [], 'B 首次挂载同一查询时不得读取 A 的内存缓存')
      effects.splice(0).forEach((effect) => effect())
      request.reject(new Error('B offline'))
      await tick(); render()
      assert.deepEqual(hooks[2], [], 'B 请求失败时也不得回退到 A 的内存缓存')
    }
  } finally { ;(Module as any)._load = originalLoad }
}

void (async () => {
  await exerciseFeed([post('缓存内容')], 'reject')
  await exerciseFeed([post('旧内容')], 'empty')
  await exerciseFeed([post('A内容')], 'late')
  await exerciseFeed([], 'cross')
  console.log('community offline cache smoke: ok')
})().catch((error) => { console.error(error); process.exitCode = 1 })
