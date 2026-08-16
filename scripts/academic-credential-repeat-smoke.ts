import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isRepeatedRejectedCredential,
  rejectedCredentialHint,
  rejectedCredentialModal,
} from '../src/features/academic-verification/credential-rejection'
import {
  ACADEMIC_CHALLENGE_COOLDOWN_MS,
  academicChallengeRemainingMinutes,
  academicChallengeRetryAt,
} from '../src/features/academic-verification/challenge-cooldown'
import {
  convertAcademicPasswordToEnglishSymbols,
  hasConvertibleAcademicPasswordSymbols,
} from '../src/features/academic-verification/password-symbols'

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
assert.match(rejectedCredentialHint('invalid_credentials'), /my\.ouc\.edu\.cn/)
assert.match(rejectedCredentialHint('password_expired'), /my\.ouc\.edu\.cn/)
assert.match(rejectedCredentialHint('account_restricted'), /my\.ouc\.edu\.cn/)
assert.match(rejectedCredentialModal('invalid_credentials').content, /my\.ouc\.edu\.cn/)
assert.match(rejectedCredentialModal('password_expired').content, /my\.ouc\.edu\.cn/)
assert.match(rejectedCredentialModal('account_restricted').content, /my\.ouc\.edu\.cn/)

const challengeStartedAt = 1_000_000
const challengeRetryAt = academicChallengeRetryAt(challengeStartedAt)
assert.equal(challengeRetryAt, challengeStartedAt + ACADEMIC_CHALLENGE_COOLDOWN_MS)
assert.equal(academicChallengeRemainingMinutes(challengeRetryAt, challengeStartedAt), 30)
assert.equal(academicChallengeRemainingMinutes(challengeRetryAt, challengeStartedAt + 29 * 60 * 1000), 1)
assert.equal(academicChallengeRemainingMinutes(challengeRetryAt, challengeRetryAt), 0)

assert.equal(convertAcademicPasswordToEnglishSymbols('Abc！＠＃１２３'), 'Abc!@#123')
assert.equal(convertAcademicPasswordToEnglishSymbols('，。；：？！'), ',.;:?!')
assert.equal(convertAcademicPasswordToEnglishSymbols('“A”‘B’（）【】《》'), '"A"\'B\'()[]<>')
assert.equal(convertAcademicPasswordToEnglishSymbols('A、B￥C·D'), 'A\\B$C`D')
assert.equal(convertAcademicPasswordToEnglishSymbols('a……b——c'), 'a^b_c')
assert.equal(convertAcademicPasswordToEnglishSymbols('中文Abc123'), '中文Abc123')
assert.equal(hasConvertibleAcademicPasswordSymbols('abc！'), true)
assert.equal(hasConvertibleAcademicPasswordSymbols('abc!'), false)

const pageSource = readFileSync(
  resolve(__dirname, '../src/pages/academic-verification/index.tsx'),
  'utf8',
)
const guardPosition = pageSource.indexOf('isRepeatedRejectedCredential(rejectedCredential, attempt)')
const requestPosition = pageSource.indexOf('await completeCredentialAttempt(password)')
const challengeGuardPosition = pageSource.indexOf('academicChallengeRemainingMinutes(challengeRetryAt)')
const cancelRetryBranch = pageSource.match(
  /if \(!shouldRetryWithEnglishSymbols\) \{([\s\S]*?)\n\s*\}/,
)?.[1] || ''

assert.ok(pageSource.includes('中国海洋大学信息门户（统一身份认证）'), '页面缺少信息门户来源提示')
assert.ok(pageSource.includes('不是微信密码，也不是本小程序账号密码'), '页面缺少排除其他密码的提示')
assert.ok(
  pageSource.includes('const [passwordVisible, setPasswordVisible] = useState(false)'),
  '密码输入框必须默认隐藏密码',
)
assert.ok(pageSource.includes('const PASSWORD_REVEAL_DURATION = 1000'), '最后输入字符必须在 1 秒后隐藏')
assert.ok(pageSource.includes("index === revealedIndex ? character : '*'"), '非最新字符必须显示为星号')
assert.ok(pageSource.includes('onBlur={clearPasswordReveal}'), '密码输入框失焦时必须立即隐藏明文字符')
assert.ok(!pageSource.includes('password={!passwordVisible}'), '不得依赖微信原生密码框的末位展示行为')
assert.ok(pageSource.includes("require('../../assets/icons/eye.svg')"), '密码隐藏时必须显示眼睛图标')
assert.ok(pageSource.includes("require('../../assets/icons/eye-off.svg')"), '密码可见时必须显示划线眼睛图标')
assert.ok(guardPosition >= 0 && guardPosition < requestPosition, '重复错误凭据必须在网络请求前拦截')
assert.ok(challengeGuardPosition >= 0 && challengeGuardPosition < requestPosition, '验证码冷却必须在网络请求前拦截')
assert.ok(pageSource.includes("submitError.code === 'invalid_academic_credentials'"), '明确密码错误必须记住当前凭据')
assert.ok(pageSource.includes("submitError.code === 'academic_password_expired'"), '密码过期必须记住当前凭据')
assert.ok(pageSource.includes("submitError.code === 'academic_account_restricted'"), '账号锁定或冻结必须记住当前凭据')
assert.ok(!pageSource.includes("confirmText: restricted ? '已解锁'"), '账号锁定后不得提供原凭据重试按钮')
assert.ok(pageSource.includes("confirmText: '我知道了'"), '认证业务错误只能确认提示')
assert.ok(pageSource.includes("submitError.code === 'academic_challenge_required'"), '验证码必须启动冷却')
assert.ok(pageSource.includes('请等待 30 分钟'), '验证码提示必须明确等待 30 分钟')
assert.ok(!pageSource.includes('setStorage'), '被拒绝的密码和验证码冷却不得写入小程序存储')
assert.ok(
  pageSource.includes("initialSubmitError.code === 'invalid_academic_credentials'"),
  '仅明确密码错误时允许提示转换符号',
)
assert.ok(
  pageSource.includes('hasConvertibleAcademicPasswordSymbols(password)'),
  '提示前必须确认密码中存在可转换的中文或全角符号',
)
assert.ok(pageSource.includes("title: '密码符号可能输错了'"), '转换提示文案缺失')
assert.ok(pageSource.includes("confirmText: '转换重试'"), '确认按钮必须明确转换后重试')
assert.ok(pageSource.includes("cancelText: '保持原样'"), '取消按钮必须明确保留原密码')
assert.equal(Array.from('转换重试').length, 4, '确认按钮不得超过微信弹窗四字限制')
assert.equal(Array.from('保持原样').length, 4, '取消按钮不得超过微信弹窗四字限制')
assert.ok(
  pageSource.includes('submittedPassword = convertAcademicPasswordToEnglishSymbols(password)'),
  '确认后必须使用显式映射转换密码',
)
assert.ok(
  pageSource.includes('await completeCredentialAttempt(submittedPassword)'),
  '转换后必须自动重新验证一次',
)
assert.match(cancelRetryBranch, /return/, '取消转换时必须直接结束本次提交')
assert.doesNotMatch(cancelRetryBranch, /setPassword|setRejectedCredential|completeCredentialAttempt/, '取消转换不得修改密码、记录错误凭据或发起重试')
assert.doesNotMatch(pageSource, /console\.(?:log|info|debug|warn|error)\([^\n]*password/i, '不得打印密码')

process.stdout.write('academic credential repeat smoke: ok\n')
