import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const stored = {
  identity: null as unknown,
  password: null as unknown,
  legacy: null as unknown,
}
const storageModulePath = require.resolve('../src/api/academic-credential-storage')
require.cache[storageModulePath] = {
  id: storageModulePath,
  filename: storageModulePath,
  loaded: true,
  exports: {
    readStoredAcademicIdentity: () => stored.identity,
    readStoredAcademicPassword: () => stored.password,
    readLegacyStoredAcademicCredential: () => stored.legacy,
    writeStoredAcademicIdentity: (value: unknown) => {
      stored.identity = JSON.parse(JSON.stringify(value))
    },
    writeStoredAcademicPassword: (value: unknown) => {
      stored.password = JSON.parse(JSON.stringify(value))
    },
    writeStoredAcademicCredential: (identity: unknown, password: unknown) => {
      stored.identity = JSON.parse(JSON.stringify(identity))
      stored.password = JSON.parse(JSON.stringify(password))
      stored.legacy = null
    },
    removeStoredAcademicCredential: (userId?: number) => {
      if (
        userId === undefined
        || (stored.identity as { platformUserId?: number } | null)?.platformUserId === userId
      ) stored.identity = null
      if (
        userId === undefined
        || (stored.password as { platformUserId?: number } | null)?.platformUserId === userId
      ) stored.password = null
      if (
        userId === undefined
        || (stored.legacy as { platformUserId?: number } | null)?.platformUserId === userId
      ) stored.legacy = null
    },
  },
  children: [],
  paths: [],
} as NodeModule

const credentialModulePath = require.resolve('../src/api/academic-credential')
const loadCredentialModule = () => {
  delete require.cache[credentialModulePath]
  return require('../src/api/academic-credential') as typeof import('../src/api/academic-credential')
}

let credentialModule = loadCredentialModule()

const credential = {
  studentNo: '20260001',
  password: 'credential-password',
  educationLevel: 'undergraduate' as const,
}

const expectMissing = (userId: number) => {
  assert.throws(
    () => credentialModule.loadAcademicCredential(userId),
    credentialModule.AcademicCredentialMissingError,
  )
}

const assertLoadedCredential = (
  module: typeof credentialModule,
  userId: number,
  expected: { studentNo: string; password: string; educationLevel: string },
) => {
  const loaded = module.loadAcademicCredential(userId)
  assert.equal(loaded.studentNo, expected.studentNo)
  assert.equal(loaded.password, expected.password)
  assert.equal(loaded.educationLevel, expected.educationLevel)
  assert.equal(typeof loaded.identityScopeToken, 'string', '加载凭证应携带身份 token')
}

credentialModule.clearAcademicCredential()
expectMissing(1)

credentialModule.saveAcademicCredential(1, credential)
assert.equal(credentialModule.getActiveAcademicUserId(), 1)
assertLoadedCredential(credentialModule, 1, credential)

// 模拟小程序进程重启：运行时模块重载，但本地存储仍然存在。
credentialModule = loadCredentialModule()
assert.equal(credentialModule.getActiveAcademicUserId(), 0)
assertLoadedCredential(credentialModule, 1, credential)
assert.equal(credentialModule.getActiveAcademicUserId(), 1)
const unchangedCredentialRevision = credentialModule.getCredentialRevision()
credentialModule.saveAcademicCredential(1, credential)
assert.equal(
  credentialModule.getCredentialRevision(),
  unchangedCredentialRevision,
  '重复绑定相同本机凭据不得增加凭据代际',
)

// 账号切换时不能因尝试读取新账号而删除旧账号凭据。
assert.throws(() => credentialModule.loadAcademicCredential(2), credentialModule.AcademicCredentialMissingError)
assert.equal((stored.identity as { platformUserId?: number }).platformUserId, 1)
assert.equal((stored.password as { platformUserId?: number }).platformUserId, 1)
assertLoadedCredential(credentialModule, 1, credential)

// 新账号成功绑定后只替换本机单槽记录；对旧账号执行本地解绑不能误删新账号数据。
credentialModule.saveAcademicCredential(2, { ...credential, studentNo: '20260002' })
assert.equal(credentialModule.getActiveAcademicUserId(), 2)
assert.equal(credentialModule.loadAcademicCredential(2).studentNo, '20260002')
credentialModule.clearAcademicCredential(1)
assert.equal(credentialModule.loadAcademicCredential(2).studentNo, '20260002')
credentialModule.clearAcademicCredential(2)
assert.equal(credentialModule.getActiveAcademicUserId(), 0)
expectMissing(2)

credentialModule.saveAcademicCredential(3, credential)
credentialModule.clearAcademicCredential()
assert.equal(credentialModule.getActiveAcademicUserId(), 0)
expectMissing(3)

stored.legacy = { version: 1, platformUserId: 4, credential: { password: 'broken' } }
credentialModule = loadCredentialModule()
expectMissing(4)
assert.equal(stored.legacy, null)

stored.legacy = {
  version: 1,
  platformUserId: 5,
  credential: { ...credential, identityScopeToken: 'old-scope' },
}
credentialModule = loadCredentialModule()
assert.equal(credentialModule.loadAcademicCredential(5).password, credential.password)
assert.ok(stored.legacy, '迁移成功前必须保留旧本机密码副本')
assert.ok(stored.identity, '本机身份元数据应分离存储')
assert.equal(stored.password, null, '迁移前不得复制密码到新的秘密存储键')
credentialModule.clearAcademicCredential(5)
assert.equal(stored.legacy, null, '本地解绑应删除原账号的旧密码副本')
assert.equal(stored.identity, null, '本地解绑应删除原账号的身份元数据')
assert.throws(() => credentialModule.loadAcademicCredential(5), credentialModule.AcademicCredentialMissingError)

stored.identity = {
  version: 1,
  platformUserId: 6,
  identity: { studentNo: credential.studentNo, educationLevel: credential.educationLevel },
}
stored.password = null
credentialModule = loadCredentialModule()
assert.equal(credentialModule.hasAcademicCredential(6), false, '只有身份元数据而没有本机密码时不得标记为可查询')
assert.throws(() => credentialModule.loadAcademicCredential(6), credentialModule.AcademicCredentialMissingError)
credentialModule.clearAcademicCredential()

const source = readFileSync(resolve(__dirname, '../src/api/academic-credential.ts'), 'utf8')
assert.ok(source.includes('readStoredAcademicIdentity'), '无秘密身份元数据必须支持从本地存储恢复')
assert.ok(source.includes('readLegacyStoredAcademicCredential'), '旧版本机凭据应支持自动迁移')
assert.ok(source.includes('writeStoredAcademicCredential'), '验证成功后必须持久化教务凭据')
assert.ok(source.includes('removeStoredAcademicCredential(platformUserId)'), '本地解绑必须按原平台账号清理凭据')
assert.doesNotMatch(source, /academic-credential-hosting|apiRequest/, '本地解绑不得调用服务端托管删除接口')

const academicApiSource = readFileSync(resolve(__dirname, '../src/api/academic.ts'), 'utf8')
const academicPostSource = readFileSync(resolve(__dirname, '../src/api/academic-post.ts'), 'utf8')
assert.ok(
  academicPostSource.includes("'invalid_academic_credentials'")
    && academicPostSource.includes("'academic_password_expired'")
    && academicPostSource.includes("'academic_account_restricted'")
    && academicPostSource.includes('clearCredential(currentUser.user_id)'),
  '校方拒绝、密码过期或账号受限时请求执行器必须清理本机旧凭据',
)
assert.ok(
  academicApiSource.includes('clearCredential: clearAcademicCredential')
    && !academicApiSource.includes('academic-credential-hosting')
    && !academicApiSource.includes('runAcademicCredentialHostingTask')
    && !academicApiSource.includes('getAcademicCredentialHostingStatus'),
  '六类普通查询必须只使用本机凭据的教务 API，不读取托管状态或运行托管任务',
)
assert.ok(
  !academicApiSource.includes("from '@tarojs/taro'")
    && !academicApiSource.includes('/pages/academic-verification/index?rebind=1'),
  '教务请求层不得自动跳转，未绑定状态应交由页面明确引导',
)

const loadStateSource = readFileSync(
  resolve(__dirname, '../src/pages/academic/components/academic-load-state.tsx'),
  'utf8',
)
const bindingGuidanceSource = readFileSync(
  resolve(__dirname, '../src/features/academic-verification/binding-guidance.ts'),
  'utf8',
)
const loadStateCardSource = readFileSync(
  resolve(__dirname, '../src/features/academic-verification/academic-load-state.tsx'),
  'utf8',
)
const loadStateStyle = readFileSync(
  resolve(__dirname, '../src/features/academic-verification/academic-load-state.scss'),
  'utf8',
)
const verificationStyle = readFileSync(
  resolve(__dirname, '../src/pages/academic-verification/index.scss'),
  'utf8',
)
const verificationSource = readFileSync(
  resolve(__dirname, '../src/pages/academic-verification/index.tsx'),
  'utf8',
)
const profileSource = readFileSync(resolve(__dirname, '../src/pages/profile/index.tsx'), 'utf8')
const appConfigSource = readFileSync(resolve(__dirname, '../src/app.config.ts'), 'utf8')
assert.ok(
  verificationSource.includes('await verifyAcademicCredentials(')
    && verificationSource.includes('saveAcademicCredential(attemptUser.user_id')
    && verificationSource.includes('登录状态已切换')
    && !verificationSource.includes('academic-credential-hosting'),
  '绑定成功后必须走原教务验证 API 并保存本机账号密码',
)
assert.ok(
  !profileSource.includes('管理教务凭据托管')
    && !profileSource.includes('getAcademicCredentialHostingStatus')
    && !appConfigSource.includes('credential-hosting/index'),
  '小程序不得提供前台托管状态入口或管理页面',
)
assert.ok(
  loadStateSource.includes('isAcademicBindingRequiredError(error)')
    && bindingGuidanceSource.includes('还没有绑定教务账号')
    && bindingGuidanceSource.includes('去绑定教务账号')
    && bindingGuidanceSource.includes("error.code === 'academic_verification_required'")
    && bindingGuidanceSource.includes('isMissingAcademicVerificationStatus(error.statusCode, error.code)'),
  '未绑定状态应展示清晰的绑定说明和操作',
)
assert.ok(
  loadStateCardSource.includes("className='academic-load-state'")
    && loadStateStyle.includes('background: var(--campus-surface')
    && loadStateStyle.includes('border: 1rpx solid var(--campus-border')
    && loadStateStyle.includes('background: var(--campus-primary')
    && loadStateStyle.includes('var(--ousea-radius-card')
    && loadStateStyle.includes('var(--ousea-font-size-title'),
  '教务绑定引导卡必须使用 Ousea surface、line、ocean 和 typography token',
)
assert.ok(
  verificationStyle.includes('background: var(--campus-page')
    && verificationStyle.includes('background: var(--campus-surface')
    && verificationStyle.includes('border: 1rpx solid var(--campus-border')
    && verificationStyle.includes('background: var(--campus-primary')
    && verificationStyle.includes('var(--ousea-radius-card')
    && verificationStyle.includes('var(--ousea-font-size-label'),
  '教务认证页必须使用 Ousea 页面、surface、line、ocean、圆角和字体 token',
)
assert.ok(
  verificationSource.includes('verification-credential-guide__items')
    && verificationSource.includes('密码为信息门户密码')
    && verificationSource.includes('大小写')
    && verificationSource.includes('全角/半角')
    && verificationSource.includes('xmxjouc')
    && verificationSource.includes('学历')
    && verificationSource.includes('请选择你的身份')
    && verificationSource.includes('信息门户认证')
    && verificationSource.includes('材料认证')
    && verificationSource.includes('录取通知书')
    && verificationSource.includes('毕业证')
    && !verificationSource.includes('请选择你使用的教务系统'),
  '教务密码说明应分组展示，并明确密码来源、错误排查和人工联系入口',
)

for (const directory of ['grades', 'schedule', 'exams', 'selection']) {
  const pageSource = readFileSync(
    resolve(__dirname, `../src/pages/academic/${directory}/index.tsx`),
    'utf8',
  )
  assert.ok(
    pageSource.includes('isAcademicBindingRequiredError(loadError)'),
    `${directory} 遇到本机凭据或后端教务身份缺失时应优先提示绑定`,
  )
}

process.stdout.write('academic credential persistence smoke: ok\n')
