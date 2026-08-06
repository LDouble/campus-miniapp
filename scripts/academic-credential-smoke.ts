import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AcademicCredentialMissingError,
  clearAcademicCredential,
  getActiveAcademicUserId,
  loadAcademicCredential,
  saveAcademicCredential,
} from '../src/api/academic-credential'

const credential = {
  studentNo: '20260001',
  password: 'credential-password',
  educationLevel: 'undergraduate' as const,
}

const expectMissing = (userId: number) => {
  assert.throws(
    () => loadAcademicCredential(userId),
    AcademicCredentialMissingError,
  )
}

clearAcademicCredential()
expectMissing(1)

saveAcademicCredential(1, credential)
assert.equal(getActiveAcademicUserId(), 1)
assert.deepEqual(loadAcademicCredential(1), credential)

// 平台账号切换必须清除前一账号的运行期凭据。
saveAcademicCredential(2, { ...credential, studentNo: '20260002' })
assert.equal(getActiveAcademicUserId(), 2)
assert.equal(loadAcademicCredential(2).studentNo, '20260002')
expectMissing(1)
assert.equal(getActiveAcademicUserId(), 0)
expectMissing(2)

saveAcademicCredential(2, credential)
clearAcademicCredential(2)
assert.equal(getActiveAcademicUserId(), 0)
expectMissing(2)

saveAcademicCredential(3, credential)
clearAcademicCredential()
assert.equal(getActiveAcademicUserId(), 0)
expectMissing(3)

const source = readFileSync(resolve(__dirname, '../src/api/academic-credential.ts'), 'utf8')
assert.ok(!source.includes('@tarojs/taro'), '教务凭据模块不得依赖 Taro Storage')
assert.ok(!source.includes('StorageSync'), '教务凭据不得写入或读取本地存储')

process.stdout.write('academic credential runtime-memory smoke: ok\n')
