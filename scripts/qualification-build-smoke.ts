import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const outputRoot = join(process.cwd(), 'dist/qualification')
const appJsonPath = join(outputRoot, 'app.json')
const projectConfigPath = join(outputRoot, 'project.config.json')

const forbiddenPages = [
  'pages/community/index',
  'packages/social/community/detail',
  'packages/social/community/topic/index',
  'packages/social/errands/detail',
  'packages/social/marketplace/detail',
  'packages/social/carpool/detail',
  'packages/social/my-services/index',
  'packages/social/publish/index',
  'pages/materials/index',
  'packages/social/content-report/index',
  'packages/social/direct-messages/index',
  'packages/social/direct-messages/chat',
  'pages/clubs/index',
  'pages/clubs/detail',
  'pages/clubs/edit',
  'pages/clubs/mine'
]

const forbiddenBundleNeedles = [
  '/api/v1/campus-circle/posts',
  '/api/v1/course-materials/upload-sessions',
  '/api/v1/clubs/media/upload-target',
  '/api/v1/carpool/trips',
  '/api/v1/errands',
  '/api/v1/marketplace',
]

const readJson = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, 'utf8')) as T

const listFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  })

const fail = (message: string): never => {
  throw new Error(`[qualification-build-smoke] ${message}`)
}

if (!existsSync(appJsonPath) || !existsSync(projectConfigPath)) {
  fail('未找到 dist/qualification 产物。请先执行 yarn build:weapp:qualification。')
}

const appConfig = readJson<{
  pages?: string[]
  subPackages?: Array<{ root: string; pages?: string[] }>
  tabBar?: { list?: Array<{ pagePath?: string }> }
  navigateToMiniProgramAppIdList?: string[]
}>(appJsonPath)
const projectConfig = readJson<{ appid?: string }>(projectConfigPath)
const pages = appConfig.pages || []
const registeredPages = [
  ...pages,
  ...(appConfig.subPackages || []).flatMap(({ root, pages: packagePages = [] }) => (
    packagePages.map((page) => `${root.replace(/\/$/u, '')}/${page}`)
  )),
]
const tabPagePaths = (appConfig.tabBar?.list || []).map((item) => item.pagePath)

for (const page of forbiddenPages) {
  if (registeredPages.includes(page)) {
    fail(`资格版 app.json 仍注册受限页面：${page}`)
  }
}

if (!pages.includes('pages/feature-migrated/index')) {
  fail('资格版 app.json 未注册 pages/feature-migrated/index。')
}

const expectedTabs = ['pages/index/index', 'pages/messages/index', 'pages/profile/index']
if (JSON.stringify(tabPagePaths) !== JSON.stringify(expectedTabs)) {
  fail(`资格版 Tab 必须且只能为 ${expectedTabs.join('、')}，实际为 ${tabPagePaths.join('、')}。`)
}

const expectedQualificationAppId = process.env.TARO_APP_QUALIFICATION_WECHAT_APP_ID?.trim()
if (expectedQualificationAppId && projectConfig.appid !== expectedQualificationAppId) {
  fail(
    `资格版 project.config.json AppID 不匹配：期望 ${expectedQualificationAppId}，实际 ${projectConfig.appid || '空'}。`,
  )
}

const expectedTargetAppId =
  process.env.TARO_APP_TARGET_WECHAT_APP_ID?.trim() ||
  process.env.TARO_APP_FULL_WECHAT_APP_ID?.trim() ||
  ''
const declaredTargetAppIds = appConfig.navigateToMiniProgramAppIdList || []
if (expectedTargetAppId) {
  if (JSON.stringify(declaredTargetAppIds) !== JSON.stringify([expectedTargetAppId])) {
    fail('资格版 navigateToMiniProgramAppIdList 未准确声明目标新版 AppID。')
  }
} else if (declaredTargetAppIds.length > 0) {
  fail('目标新版 AppID 未配置时，资格版不得声明 navigateToMiniProgramAppIdList。')
}

for (const filePath of listFiles(outputRoot).filter((path) => /\.(?:js|json|wxml)$/u.test(path))) {
  const contents = readFileSync(filePath, 'utf8')
  for (const needle of forbiddenBundleNeedles) {
    if (contents.includes(needle)) {
      fail(`资格版产物仍包含受限接口 ${needle}：${relative(outputRoot, filePath)}`)
    }
  }
}

console.log('资格版构建产物检查通过。')
