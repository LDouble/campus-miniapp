import Taro from '@tarojs/taro'

const ACTIVE_USER_KEY = 'campus.academicCredential.activeUser.v1'
const CREDENTIAL_KEY_PREFIX = 'campus.academicCredential.user.v1.'

export type AcademicCredential = {
  studentNo: string
  password: string
  educationLevel: AcademicEducationLevel
}

export type AcademicEducationLevel = 'undergraduate' | 'graduate'

type StoredAcademicCredential = AcademicCredential & {
  version: 2
  platformUserId: number
  updatedAt: number
}

export class AcademicCredentialMissingError extends Error {
  constructor() {
    super('请重新绑定教务账号')
    Object.setPrototypeOf(this, AcademicCredentialMissingError.prototype)
    this.name = 'AcademicCredentialMissingError'
  }
}

const credentialKey = (userId: number) => `${CREDENTIAL_KEY_PREFIX}${userId}`

const validUserId = (value: number) => Number.isSafeInteger(value) && value > 0

export const getActiveAcademicUserId = () => {
  const userId = Number(Taro.getStorageSync<number>(ACTIVE_USER_KEY) || 0)
  return validUserId(userId) ? userId : 0
}

export const isAcademicEducationLevel = (
  value: unknown,
): value is AcademicEducationLevel => (
  value === 'undergraduate' || value === 'graduate'
)

const removeUserCredential = (userId: number) => {
  if (!validUserId(userId)) return
  Taro.removeStorageSync(credentialKey(userId))
}

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

  const previousUserId = Number(Taro.getStorageSync<number>(ACTIVE_USER_KEY) || 0)
  if (previousUserId && previousUserId !== platformUserId) {
    removeUserCredential(previousUserId)
  }

  const value: StoredAcademicCredential = {
    version: 2,
    platformUserId,
    studentNo,
    password: credential.password,
    educationLevel: credential.educationLevel,
    updatedAt: Date.now(),
  }
  Taro.setStorageSync(credentialKey(platformUserId), value)
  Taro.setStorageSync(ACTIVE_USER_KEY, platformUserId)
}

export const loadAcademicCredential = (platformUserId: number): AcademicCredential => {
  if (!validUserId(platformUserId)) throw new AcademicCredentialMissingError()

  const activeUserId = Number(Taro.getStorageSync<number>(ACTIVE_USER_KEY) || 0)
  if (activeUserId && activeUserId !== platformUserId) {
    removeUserCredential(activeUserId)
    Taro.removeStorageSync(ACTIVE_USER_KEY)
    throw new AcademicCredentialMissingError()
  }

  const value = Taro.getStorageSync<StoredAcademicCredential>(credentialKey(platformUserId))
  if (
    !value
    || value.version !== 2
    || value.platformUserId !== platformUserId
    || !String(value.studentNo || '').trim()
    || !String(value.password || '')
    || !isAcademicEducationLevel(value.educationLevel)
  ) {
    removeUserCredential(platformUserId)
    throw new AcademicCredentialMissingError()
  }
  Taro.setStorageSync(ACTIVE_USER_KEY, platformUserId)
  return {
    studentNo: String(value.studentNo).trim(),
    password: String(value.password),
    educationLevel: value.educationLevel,
  }
}

export const clearAcademicCredential = (platformUserId?: number) => {
  const activeUserId = Number(Taro.getStorageSync<number>(ACTIVE_USER_KEY) || 0)
  const targetUserId = platformUserId || activeUserId
  removeUserCredential(targetUserId)
  if (!platformUserId || activeUserId === platformUserId) {
    Taro.removeStorageSync(ACTIVE_USER_KEY)
  }
}
