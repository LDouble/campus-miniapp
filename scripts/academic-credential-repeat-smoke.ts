import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isRepeatedRejectedCredential,
  rejectedCredentialHint,
} from '../src/features/academic-verification/credential-rejection'
import {
  ACADEMIC_CHALLENGE_COOLDOWN_MS,
  academicChallengeRemainingMinutes,
  academicChallengeRetryAt,
} from '../src/features/academic-verification/challenge-cooldown'

const rejected = {
  studentNo: '20260001',
  password: 'rejected-password',
  educationLevel: 'undergraduate' as const,
  reason: 'invalid_credentials' as const,
}

assert.equal(isRepeatedRejectedCredential(rejected, rejected), true)
assert.equal(isRepeatedRejectedCredential(rejected, { ...rejected, studentNo: '20260002' }), false)
assert.equal(isRepeatedRejectedCredential(rejected, { ...rejected, password: 'changed-password' }), false)
assert.equal(isRepeatedRejectedCredential(rejected, { ...rejected, educationLevel: 'graduate' }), false)
assert.match(rejectedCredentialHint('invalid_credentials'), /校方明确提示/)
assert.match(rejectedCredentialHint('password_expired'), /过期/)

const challengeStartedAt = 1_000_000
const challengeRetryAt = academicChallengeRetryAt(challengeStartedAt)
assert.equal(challengeRetryAt, challengeStartedAt + ACADEMIC_CHALLENGE_COOLDOWN_MS)
assert.equal(academicChallengeRemainingMinutes(challengeRetryAt, challengeStartedAt), 30)
assert.equal(academicChallengeRemainingMinutes(challengeRetryAt, challengeStartedAt + 29 * 60 * 1000), 1)
assert.equal(academicChallengeRemainingMinutes(challengeRetryAt, challengeRetryAt), 0)

const pageSource = readFileSync(
  resolve(__dirname, '../src/pages/academic-verification/index.tsx'),
  'utf8',
)
const guardPosition = pageSource.indexOf('isRepeatedRejectedCredential(rejectedCredential, attempt)')
const requestPosition = pageSource.indexOf('verifyAcademicCredentials(normalizedStudentNo, password, educationLevel)')
const challengeGuardPosition = pageSource.indexOf('academicChallengeRemainingMinutes(challengeRetryAt)')

assert.ok(pageSource.includes('中国海洋大学信息门户（统一身份认证）'), '页面缺少信息门户来源提示')
assert.ok(pageSource.includes('不是微信密码，也不是本小程序账号密码'), '页面缺少排除其他密码的提示')
assert.ok(guardPosition >= 0 && guardPosition < requestPosition, '重复错误凭据必须在网络请求前拦截')
assert.ok(challengeGuardPosition >= 0 && challengeGuardPosition < requestPosition, '验证码冷却必须在网络请求前拦截')
assert.ok(pageSource.includes("submitError.code === 'invalid_academic_credentials'"), '明确密码错误必须记住当前凭据')
assert.ok(pageSource.includes("submitError.code === 'academic_password_expired'"), '密码过期必须记住当前凭据')
assert.ok(pageSource.includes("submitError.code === 'academic_challenge_required'"), '验证码必须启动冷却')
assert.ok(pageSource.includes('请等待 30 分钟'), '验证码提示必须明确等待 30 分钟')
assert.ok(!pageSource.includes('setStorage'), '被拒绝的密码和验证码冷却不得写入小程序存储')

process.stdout.write('academic credential repeat smoke: ok\n')
