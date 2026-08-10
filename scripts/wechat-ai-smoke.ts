import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

type AgentSkill = {
  name?: string
  description?: string
  path?: string
}

type MiniProgramAppConfig = {
  agent?: {
    skills?: AgentSkill[]
    pageMetadata?: string
  }
  lazyCodeLoading?: string
  subPackages?: Array<{
    root?: string
    pages?: string[]
    independent?: boolean
  }>
}

type ProjectConfig = {
  packOptions?: {
    include?: Array<{
      type?: string
      value?: string
    }>
  }
}

type McpConfig = {
  apis?: Array<{
    name?: string
    _meta?: {
      ui?: {
        componentPath?: string
      }
    }
  }>
  components?: Array<{
    path?: string
    relatedPage?: string
  }>
}

const projectRoot = process.cwd()
const fullOutputRoot = join(projectRoot, 'dist/full')
const qualificationOutputRoot = join(projectRoot, 'dist/qualification')
const expectedSkillPath = 'skills/campus-info'
const expectedSkillFiles = ['SKILL.md', 'mcp.json', 'index.js']
const expectedComponents = [
  {
    apiName: 'searchOfficialNotices',
    path: 'components/official-notice-list/index',
    relatedPage: '/pages/official-notices/index',
  },
  {
    apiName: 'queryShuttleSchedule',
    path: 'components/shuttle-route-list/index',
    relatedPage: '/pages/shuttle/index',
  },
  {
    apiName: 'findEmptyClassrooms',
    path: 'components/empty-classroom-list/index',
    relatedPage: '/pages/empty-classroom/index',
  },
]
const expectedComponentFiles = ['index.js', 'index.json', 'index.wxml', 'index.wxss']

const fail = (message: string): never => {
  throw new Error(`[wechat-ai-smoke] ${message}`)
}

const readJson = <T>(filePath: string): T => {
  if (!existsSync(filePath)) {
    fail(`未找到构建产物：${filePath}`)
  }

  return JSON.parse(readFileSync(filePath, 'utf8')) as T
}

const assertFile = (filePath: string, message: string) => {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    fail(message)
  }
}

const fullAppConfig = readJson<MiniProgramAppConfig>(join(fullOutputRoot, 'app.json'))
const fullProjectConfig = readJson<ProjectConfig>(join(fullOutputRoot, 'project.config.json'))
const fullSkill = fullAppConfig.agent?.skills?.find((skill) => skill.path === expectedSkillPath)
const fullSkillsPackage = fullAppConfig.subPackages?.find((subpackage) => subpackage.root === 'skills')

if (fullAppConfig.lazyCodeLoading !== 'requiredComponents') {
  fail('完整版 app.json 必须配置 lazyCodeLoading=requiredComponents。')
}

if (
  !fullSkillsPackage
  || fullSkillsPackage.independent !== true
  || JSON.stringify(fullSkillsPackage.pages) !== JSON.stringify([])
) {
  fail('完整版 app.json 必须将 skills 声明为 pages=[] 的独立分包。')
}

if (
  !fullSkill
  || fullSkill.name !== 'campus-info'
  || !fullSkill.description?.trim()
) {
  fail('完整版 app.json 必须注册带非空 description 的 campus-info Skill。')
}

if (fullAppConfig.agent?.pageMetadata !== 'page-meta.json') {
  fail('完整版 app.json 必须将 agent.pageMetadata 指向 page-meta.json。')
}

const includesSkills = fullProjectConfig.packOptions?.include?.some(
  (item) => item.type === 'folder' && item.value === 'skills',
)
if (!includesSkills) {
  fail('完整版 project.config.json 的 packOptions.include 必须包含 skills 目录。')
}

assertFile(join(fullOutputRoot, 'page-meta.json'), '完整版缺少 page-meta.json。')
for (const fileName of expectedSkillFiles) {
  assertFile(
    join(fullOutputRoot, expectedSkillPath, fileName),
    `完整版缺少 Skill 文件：${expectedSkillPath}/${fileName}。`,
  )
}

const fullMcpConfig = readJson<McpConfig>(join(fullOutputRoot, expectedSkillPath, 'mcp.json'))
for (const component of expectedComponents) {
  const registered = fullMcpConfig.components?.some(
    (item) => item.path === component.path && item.relatedPage === component.relatedPage,
  )
  if (!registered) {
    fail(`mcp.json 未注册组件或 relatedPage 不正确：${component.path}。`)
  }

  const api = fullMcpConfig.apis?.find((item) => item.name === component.apiName)
  if (api?._meta?.ui?.componentPath !== component.path) {
    fail(`${component.apiName} 未绑定组件：${component.path}。`)
  }

  for (const fileName of expectedComponentFiles) {
    assertFile(
      join(fullOutputRoot, expectedSkillPath, `${component.path.replace(/\/index$/, '')}/${fileName}`),
      `完整版缺少组件文件：${component.path.replace(/\/index$/, '')}/${fileName}。`,
    )
  }
}

const qualificationAppConfig = readJson<MiniProgramAppConfig>(
  join(qualificationOutputRoot, 'app.json'),
)
if (qualificationAppConfig.agent !== undefined) {
  fail('资格版 app.json 不得包含 agent 配置。')
}

if (qualificationAppConfig.lazyCodeLoading === 'requiredComponents') {
  fail('资格版 app.json 不得启用 AI Mode 的 lazyCodeLoading 配置。')
}

if (qualificationAppConfig.subPackages?.some((subpackage) => subpackage.root === 'skills')) {
  fail('资格版 app.json 不得声明 skills 分包。')
}

if (existsSync(join(qualificationOutputRoot, 'skills'))) {
  fail('资格版构建产物不得复制 skills 目录。')
}

if (existsSync(join(qualificationOutputRoot, 'page-meta.json'))) {
  fail('资格版构建产物不得复制 page-meta.json。')
}

console.log('微信 AI Mode 构建产物检查通过。')
