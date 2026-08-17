import type {
  AcademicCredential,
  AcademicEducationLevel,
} from '../../api/academic-credential'

export type AcademicVerificationCredentialPrefill = AcademicCredential

let pendingCredentialPrefill: AcademicVerificationCredentialPrefill | null = null

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

const isAcademicEducationLevel = (
  value: unknown,
): value is AcademicEducationLevel => (
  value === 'undergraduate' || value === 'graduate'
)

const maskAccount = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return 'missing'
  const account = value.trim()
  if (account.length <= 4) return `*** (${account.length})`
  return `${account.slice(0, 2)}***${account.slice(-2)} (${account.length})`
}

const logExtraDataDiagnostic = (extraData: unknown, accepted: boolean) => {
  const data = isRecord(extraData) ? extraData : null
  console.info('[academic-prefill] extraData', {
    received: extraData !== undefined && extraData !== null,
    payloadType: Array.isArray(extraData) ? 'array' : typeof extraData,
    account: maskAccount(data?.account),
    passwordLength: typeof data?.password === 'string' ? data.password.length : 0,
    type: typeof data?.type === 'string' ? data.type : typeof data?.type,
    accepted,
  })
}

// extraData 由来源小程序提供；仅使用完整且合法的一组凭据，避免异常数据部分覆盖表单。
export const resolveAcademicVerificationCredentialPrefill = (
  extraData: unknown,
): AcademicVerificationCredentialPrefill | null => {
  if (!isRecord(extraData)) return null

  const studentNo = typeof extraData.account === 'string'
    ? extraData.account.trim()
    : ''
  const password = typeof extraData.password === 'string'
    ? extraData.password
    : ''
  const educationLevel = extraData.type

  if (!studentNo || !password || !isAcademicEducationLevel(educationLevel)) {
    return null
  }

  return { studentNo, password, educationLevel }
}

// 来源小程序的数据由 App.onLaunch/App.onShow 接收；只在绑定页消费一次，避免密码在运行时长期保留。
export const captureAcademicVerificationCredentialPrefill = (extraData: unknown) => {
  const credentialPrefill = resolveAcademicVerificationCredentialPrefill(extraData)
  logExtraDataDiagnostic(extraData, !!credentialPrefill)
  if (!credentialPrefill) return false
  pendingCredentialPrefill = credentialPrefill
  return true
}

export const consumeAcademicVerificationCredentialPrefill = () => {
  const credentialPrefill = pendingCredentialPrefill
  pendingCredentialPrefill = null
  return credentialPrefill
}
