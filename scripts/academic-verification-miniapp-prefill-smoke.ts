import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  captureAcademicVerificationCredentialPrefill,
  consumeAcademicVerificationCredentialPrefill,
  resolveAcademicVerificationCredentialPrefill,
} from '../src/features/academic-verification/miniapp-prefill'

assert.deepEqual(
  resolveAcademicVerificationCredentialPrefill({
    account: '  202312345678  ',
    password: 'encrypted-password',
    type: 'undergraduate',
  }),
  {
    studentNo: '202312345678',
    password: 'encrypted-password',
    educationLevel: 'undergraduate',
  },
)
assert.deepEqual(
  resolveAcademicVerificationCredentialPrefill({
    account: '202312345678',
    password: 'encrypted-password',
    type: 'graduate',
  }),
  {
    studentNo: '202312345678',
    password: 'encrypted-password',
    educationLevel: 'graduate',
  },
)

for (const extraData of [
  null,
  {},
  { account: '202312345678', password: 'encrypted-password', type: 'visitor' },
  { account: '', password: 'encrypted-password', type: 'undergraduate' },
  { account: '202312345678', password: '', type: 'undergraduate' },
]) {
  assert.equal(resolveAcademicVerificationCredentialPrefill(extraData), null)
}

assert.equal(
  captureAcademicVerificationCredentialPrefill({
    account: '202312345678',
    password: 'encrypted-password',
    type: 'undergraduate',
  }),
  true,
)
assert.deepEqual(
  consumeAcademicVerificationCredentialPrefill(),
  {
    studentNo: '202312345678',
    password: 'encrypted-password',
    educationLevel: 'undergraduate',
  },
)
assert.equal(consumeAcademicVerificationCredentialPrefill(), null)

const verificationPage = readFileSync(
  resolve(__dirname, '../src/pages/academic-verification/index.tsx'),
  'utf8',
)
const appSource = readFileSync(resolve(__dirname, '../src/app.ts'), 'utf8')
assert.ok(
  verificationPage.includes('consumeAcademicVerificationCredentialPrefill()')
    && verificationPage.includes('Taro.getEnterOptionsSync().referrerInfo?.extraData')
    && verificationPage.includes('setStudentNo(credentialPrefill.studentNo)')
    && verificationPage.includes('setPassword(credentialPrefill.password)')
    && verificationPage.includes('setEducationLevel(credentialPrefill.educationLevel)')
    && verificationPage.includes('setStudentNo((current) => current || identity?.student_no')
    && verificationPage.includes('setCredentialPrefillGuideVisible(true)')
    && verificationPage.includes("credentialPrefillGuideVisible && !working ? 'verification-primary--guided' : ''"),
  '绑定页必须读取来源小程序的 extraData 并填充完整凭据',
)
assert.ok(
  appSource.includes('captureAcademicVerificationCredentialPrefill(options?.referrerInfo?.extraData)'),
  'App 生命周期必须接收来源小程序的 extraData，兼容热启动和返回场景',
)
const verificationStyles = readFileSync(
  resolve(__dirname, '../src/pages/academic-verification/index.scss'),
  'utf8',
)
const darkModeStyles = readFileSync(resolve(__dirname, '../src/styles/_dark-mode.scss'), 'utf8')
const prefillSource = readFileSync(
  resolve(__dirname, '../src/features/academic-verification/miniapp-prefill.ts'),
  'utf8',
)
assert.ok(
  verificationStyles.includes('.verification-prefill-guide')
    && verificationStyles.includes('verification-bind-guide')
    && verificationStyles.includes('.verification-prefill-guide__arrow')
    && verificationStyles.includes('prefers-reduced-motion: reduce'),
  '预填充后必须提供有限动效的绑定引导，并支持减少动态效果偏好',
)
assert.ok(
  darkModeStyles.includes('page .verification-prefill-guide'),
  '预填充绑定引导必须适配暗色模式',
)
assert.ok(
  prefillSource.includes("console.info('[academic-prefill] extraData'")
    && prefillSource.includes('passwordLength')
    && prefillSource.includes('maskAccount'),
  '必须记录不含密码明文的 extraData 调试信息',
)
assert.doesNotMatch(
  verificationPage,
  /console\.(?:log|info|debug|warn|error)\([^\n]*password/i,
  '不得记录来源小程序传入的密码',
)

process.stdout.write('academic verification miniapp prefill smoke: ok\n')
