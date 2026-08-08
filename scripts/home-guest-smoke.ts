import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const homeSource = readFileSync(
  resolve(__dirname, '../src/pages/index/index.tsx'),
  'utf8',
)

assert.ok(
  homeSource.includes('getAcademicVerificationStatus()'),
  '首页刷新教务数据前必须先查询校园身份认证状态',
)
assert.ok(
  homeSource.includes("verification.value.identity?.status !== 'verified'"),
  '首页必须让未认证用户直接使用缓存',
)
assert.ok(
  homeSource.includes('academicStorage.getScheduleCache(')
    && homeSource.includes('account.ok ? account.value.user.id : getActiveAcademicUserId()'),
  '首页课表预览应仅使用当前用户的本地缓存',
)
assert.ok(
  homeSource.includes('!hasCachedCourses && hasRuntimeCredential'),
  '首页只有持有当前会话教务凭据时才可刷新课程，避免自动跳转重新绑定',
)

process.stdout.write('home guest access smoke: ok\n')
