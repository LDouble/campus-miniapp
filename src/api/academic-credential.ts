export type AcademicCredential = {
  studentNo: string
  password: string
  educationLevel: AcademicEducationLevel
}

export type AcademicEducationLevel = 'undergraduate' | 'graduate'

export class AcademicCredentialMissingError extends Error {
  constructor() {
    super('请重新绑定教务账号')
    Object.setPrototypeOf(this, AcademicCredentialMissingError.prototype)
    this.name = 'AcademicCredentialMissingError'
  }
}

const credentialsByUser = new Map<number, AcademicCredential>()
let activeUserId = 0

const validUserId = (value: number) => Number.isSafeInteger(value) && value > 0

export const isAcademicEducationLevel = (
  value: unknown,
): value is AcademicEducationLevel => (
  value === 'undergraduate' || value === 'graduate'
)

const clearRuntimeCredentials = () => {
  credentialsByUser.clear()
  activeUserId = 0
}

export const getActiveAcademicUserId = () => (
  activeUserId && credentialsByUser.has(activeUserId) ? activeUserId : 0
)

export const saveAcademicCredential = (
  platformUserId: number,
  credential: AcademicCredential,
) => {
  if (!validUserId(platformUserId)) {
    throw new Error('无法识别当前平台账号')
  }
  const studentNo = credential.studentNo.trim()
  if (
    !studentNo
    || !credential.password
    || !isAcademicEducationLevel(credential.educationLevel)
  ) {
    throw new Error('教务账号、密码或学生类型无效')
  }

  // 小程序运行期间若平台账号发生切换，不能让新账号复用旧账号的凭据。
  if (activeUserId && activeUserId !== platformUserId) clearRuntimeCredentials()

  credentialsByUser.set(platformUserId, {
    studentNo,
    password: credential.password,
    educationLevel: credential.educationLevel,
  })
  activeUserId = platformUserId
}

export const loadAcademicCredential = (platformUserId: number): AcademicCredential => {
  if (!validUserId(platformUserId)) throw new AcademicCredentialMissingError()

  if (activeUserId && activeUserId !== platformUserId) {
    clearRuntimeCredentials()
    throw new AcademicCredentialMissingError()
  }

  const credential = credentialsByUser.get(platformUserId)
  if (!credential) throw new AcademicCredentialMissingError()

  activeUserId = platformUserId
  return { ...credential }
}

export const clearAcademicCredential = (platformUserId?: number) => {
  if (!platformUserId) {
    clearRuntimeCredentials()
    return
  }
  if (!validUserId(platformUserId)) return

  credentialsByUser.delete(platformUserId)
  if (activeUserId === platformUserId) activeUserId = 0
}
