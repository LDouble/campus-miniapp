import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let storedCredential: unknown = null
const storageModulePath = require.resolve('../src/api/academic-credential-storage')
require.cache[storageModulePath] = {
  id: storageModulePath,
  filename: storageModulePath,
  loaded: true,
  exports: {
    readStoredAcademicCredential: () => storedCredential,
    writeStoredAcademicCredential: (value: unknown) => {
      storedCredential = JSON.parse(JSON.stringify(value))
    },
    removeStoredAcademicCredential: () => {
      storedCredential = null
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

credentialModule.clearAcademicCredential()
expectMissing(1)

credentialModule.saveAcademicCredential(1, credential)
assert.equal(credentialModule.getActiveAcademicUserId(), 1)
assert.deepEqual(credentialModule.loadAcademicCredential(1), credential)

// 模拟小程序进程重启：运行时模块重载，但本地存储仍然存在。
credentialModule = loadCredentialModule()
assert.equal(credentialModule.getActiveAcademicUserId(), 0)
assert.deepEqual(credentialModule.loadAcademicCredential(1), credential)
assert.equal(credentialModule.getActiveAcademicUserId(), 1)

// 平台账号切换必须清除前一账号的运行期及本地凭据。
credentialModule.saveAcademicCredential(2, { ...credential, studentNo: '20260002' })
assert.equal(credentialModule.getActiveAcademicUserId(), 2)
assert.equal(credentialModule.loadAcademicCredential(2).studentNo, '20260002')
expectMissing(1)
assert.equal(credentialModule.getActiveAcademicUserId(), 0)
expectMissing(2)

credentialModule.saveAcademicCredential(2, credential)
credentialModule.clearAcademicCredential(2)
assert.equal(credentialModule.getActiveAcademicUserId(), 0)
expectMissing(2)

credentialModule.saveAcademicCredential(3, credential)
credentialModule.clearAcademicCredential()
assert.equal(credentialModule.getActiveAcademicUserId(), 0)
expectMissing(3)

storedCredential = { version: 1, platformUserId: 4, credential: { password: 'broken' } }
credentialModule = loadCredentialModule()
expectMissing(4)
assert.equal(storedCredential, null)

const source = readFileSync(resolve(__dirname, '../src/api/academic-credential.ts'), 'utf8')
assert.ok(source.includes('readStoredAcademicCredential'), '教务凭据必须支持从本地存储恢复')
assert.ok(source.includes('writeStoredAcademicCredential'), '验证成功后必须持久化教务凭据')
assert.ok(source.includes('removeStoredAcademicCredential'), '解绑或账号切换时必须清理本地凭据')

const academicApiSource = readFileSync(resolve(__dirname, '../src/api/academic.ts'), 'utf8')
assert.ok(
  academicApiSource.includes("'invalid_academic_credentials'")
    && academicApiSource.includes("'academic_password_expired'")
    && academicApiSource.includes("'academic_account_restricted'")
    && academicApiSource.includes('clearAcademicCredential()'),
  '校方拒绝、密码过期或账号受限时必须清理本机旧凭据',
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
assert.ok(
  loadStateSource.includes('isAcademicBindingRequiredError(error)')
    && bindingGuidanceSource.includes('还没有绑定教务账号')
    && bindingGuidanceSource.includes('去绑定教务账号')
    && bindingGuidanceSource.includes("error.code === 'academic_verification_required'")
    && bindingGuidanceSource.includes('isMissingAcademicVerificationStatus(error.statusCode, error.code)'),
  '未绑定状态应展示清晰的绑定说明和操作',
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
