import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type MiniProgramAppConfig = {
  agent?: unknown
  lazyCodeLoading?: string
  subPackages?: Array<{ root?: string }>
}

type ProjectConfig = {
  packOptions?: {
    include?: Array<{ type?: string; value?: string }>
  }
}

const outputRoot = join(process.cwd(), 'dist/full')

const fail = (message: string): never => {
  throw new Error(`[wechat-ai-submission-smoke] ${message}`)
}

const readJson = <T>(filePath: string): T => {
  if (!existsSync(filePath)) fail(`未找到构建产物：${filePath}`)
  return JSON.parse(readFileSync(filePath, 'utf8')) as T
}

const appConfig = readJson<MiniProgramAppConfig>(join(outputRoot, 'app.json'))
const projectConfig = readJson<ProjectConfig>(join(outputRoot, 'project.config.json'))

if (appConfig.agent !== undefined) {
  fail('提测版 app.json 不得包含 agent 配置。')
}

if (appConfig.subPackages?.some((subpackage) => subpackage.root === 'skills')) {
  fail('提测版 app.json 不得声明 skills 分包。')
}

if (existsSync(join(outputRoot, 'skills'))) {
  fail('提测版构建产物不得包含 skills 目录。')
}

if (existsSync(join(outputRoot, 'page-meta.json'))) {
  fail('提测版构建产物不得包含 page-meta.json。')
}

if (projectConfig.packOptions?.include?.some((item) => item.value === 'skills')) {
  fail('提测版 project.config.json 不得包含 skills 打包项。')
}

console.log('微信 AI 提测屏蔽检查通过。')
