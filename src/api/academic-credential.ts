import {
  readStoredAcademicCredential,
  removeStoredAcademicCredential,
  writeStoredAcademicCredential,
  type StoredAcademicCredential,
} from './academic-credential-storage'
import { invalidateSharedResourceGroup } from '../state/shared-resource'

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

const isAcademicCredential = (value: unknown): value is AcademicCredential => {
  if (!value || typeof value !== 'object') return false
  const credential = value as Partial<AcademicCredential>
  return (
    typeof credential.studentNo === 'string'
    && !!credential.studentNo.trim()
    && typeof credential.password === 'string'
    && !!credential.password
    && isAcademicEducationLevel(credential.educationLevel)
  )
}

const isStoredAcademicCredential = (
  value: unknown,
): value is StoredAcademicCredential => {
  if (!value || typeof value !== 'object') return false
  const stored = value as Partial<StoredAcademicCredential>
  return (
    stored.version === 1
    && typeof stored.platformUserId === 'number'
    && validUserId(stored.platformUserId)
    && isAcademicCredential(stored.credential)
  )
}

const restoreAcademicCredential = (platformUserId: number) => {
  const stored = readStoredAcademicCredential()
  if (!isStoredAcademicCredential(stored)) {
    if (stored) removeStoredAcademicCredential()
    return null
  }
  if (stored.platformUserId !== platformUserId) {
    removeStoredAcademicCredential()
    return null
  }

  const credential = {
    studentNo: stored.credential.studentNo.trim(),
    password: stored.credential.password,
    educationLevel: stored.credential.educationLevel,
  }
  credentialsByUser.set(platformUserId, credential)
  activeUserId = platformUserId
  return credential
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

  const normalizedCredential: AcademicCredential = {
    studentNo,
    password: credential.password,
    educationLevel: credential.educationLevel,
  }
  credentialsByUser.set(platformUserId, normalizedCredential)
  activeUserId = platformUserId
  writeStoredAcademicCredential({
    version: 1,
    platformUserId,
    credential: normalizedCredential,
  })
  invalidateSharedResourceGroup('academic', { clearData: false })
}

export const loadAcademicCredential = (platformUserId: number): AcademicCredential => {
  if (!validUserId(platformUserId)) throw new AcademicCredentialMissingError()

  if (activeUserId && activeUserId !== platformUserId) {
    clearRuntimeCredentials()
    removeStoredAcademicCredential()
    throw new AcademicCredentialMissingError()
  }

  const credential = credentialsByUser.get(platformUserId)
    || restoreAcademicCredential(platformUserId)
  if (!credential) throw new AcademicCredentialMissingError()

  activeUserId = platformUserId
  return { ...credential }
}

export const hasAcademicCredential = (platformUserId: number) => {
  try {
    loadAcademicCredential(platformUserId)
    return true
  } catch {
    return false
  }
}

export const clearAcademicCredential = (platformUserId?: number) => {
  invalidateSharedResourceGroup('academic', { clearData: false })
  if (!platformUserId) {
    clearRuntimeCredentials()
    removeStoredAcademicCredential()
    return
  }
  if (!validUserId(platformUserId)) return

  credentialsByUser.delete(platformUserId)
  if (activeUserId === platformUserId) activeUserId = 0
  const stored = readStoredAcademicCredential()
  if (
    !isStoredAcademicCredential(stored)
    || stored.platformUserId === platformUserId
  ) {
    removeStoredAcademicCredential()
  }
}
