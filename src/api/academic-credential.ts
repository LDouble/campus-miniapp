import {
  readLegacyStoredAcademicCredential,
  readStoredAcademicIdentity,
  readStoredAcademicPassword,
  removeStoredAcademicCredential,
  writeStoredAcademicCredential,
  writeStoredAcademicIdentity,
  type LegacyStoredAcademicCredential,
  type StoredAcademicIdentity,
  type StoredAcademicPassword,
} from './academic-credential-storage'
import { invalidateSharedResourceGroup } from '../state/shared-resource'

export type AcademicEducationLevel = 'undergraduate' | 'graduate'

export type AcademicIdentityMetadata = {
  studentNo: string
  educationLevel: AcademicEducationLevel
  /** 绑定身份的缓存作用域 token，不包含教务密码。 */
  identityScopeToken: string
}

export type AcademicCredential = AcademicIdentityMetadata & {
  password: string
}

export class AcademicCredentialMissingError extends Error {
  constructor() {
    super('请重新绑定教务账号')
    Object.setPrototypeOf(this, AcademicCredentialMissingError.prototype)
    this.name = 'AcademicCredentialMissingError'
  }
}

const identitiesByUser = new Map<number, AcademicIdentityMetadata>()
const passwordsByUser = new Map<number, string>()
let activeUserId = 0
// 凭据代际可阻止旧请求的失败响应清理之后刚绑定的新身份。
let credentialRevision = 0

export const getCredentialRevision = () => credentialRevision

const validUserId = (value: unknown): value is number => (
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
)

const generateIdentityScopeToken = (): string => {
  const now = Date.now().toString(36)
  const rand1 = Math.random().toString(36).slice(2)
  const rand2 = Math.random().toString(36).slice(2)
  return `${now}-${rand1}-${rand2}`
}

export const isAcademicEducationLevel = (
  value: unknown,
): value is AcademicEducationLevel => (
  value === 'undergraduate' || value === 'graduate'
)

const isIdentityMetadata = (value: unknown): value is AcademicIdentityMetadata => {
  if (!value || typeof value !== 'object') return false
  const identity = value as Partial<AcademicIdentityMetadata>
  return (
    typeof identity.studentNo === 'string'
    && !!identity.studentNo.trim()
    && isAcademicEducationLevel(identity.educationLevel)
  )
}

const normalizeIdentity = (value: AcademicIdentityMetadata): AcademicIdentityMetadata => ({
  studentNo: value.studentNo.trim(),
  educationLevel: value.educationLevel,
  identityScopeToken: value.identityScopeToken || generateIdentityScopeToken(),
})

const clearRuntimeCredentials = () => {
  identitiesByUser.clear()
  passwordsByUser.clear()
  activeUserId = 0
}

const storedIdentityForUser = (platformUserId: number): AcademicIdentityMetadata | null => {
  const stored = readStoredAcademicIdentity() as Partial<StoredAcademicIdentity> | null
  if (stored) {
    if (
      stored.version === 1
      && validUserId(stored.platformUserId)
      && isIdentityMetadata(stored.identity)
    ) {
      if (stored.platformUserId !== platformUserId) return null
      return normalizeIdentity(stored.identity)
    }
    removeStoredAcademicCredential()
    return null
  }

  // 旧版凭据记录只在原平台账号下迁移，账号切换时保留原记录。
  const legacy = readLegacyStoredAcademicCredential() as Partial<LegacyStoredAcademicCredential> | null
  if (legacy) {
    if (
      legacy.version === 1
      && validUserId(legacy.platformUserId)
      && isIdentityMetadata(legacy.credential)
      && typeof legacy.credential.password === 'string'
      && !!legacy.credential.password
    ) {
      if (legacy.platformUserId !== platformUserId) return null
      const identity = normalizeIdentity(legacy.credential)
      writeStoredAcademicIdentity({ version: 1, platformUserId, identity })
      return identity
    }
    removeStoredAcademicCredential()
  }
  return null
}

const storedPasswordForUser = (platformUserId: number): string | null => {
  const stored = readStoredAcademicPassword() as Partial<StoredAcademicPassword> | null
  if (
    stored?.version === 1
    && stored.platformUserId === platformUserId
    && validUserId(stored.platformUserId)
    && typeof stored.password === 'string'
    && !!stored.password
  ) return stored.password

  const legacy = readLegacyStoredAcademicCredential() as Partial<LegacyStoredAcademicCredential> | null
  if (
    legacy?.version === 1
    && legacy.platformUserId === platformUserId
    && validUserId(legacy.platformUserId)
    && typeof legacy.credential?.password === 'string'
    && !!legacy.credential.password
  ) return legacy.credential.password
  return null
}

export const loadAcademicIdentity = (platformUserId: number): AcademicIdentityMetadata => {
  if (!validUserId(platformUserId)) throw new AcademicCredentialMissingError()
  if (activeUserId && activeUserId !== platformUserId) {
    clearRuntimeCredentials()
    throw new AcademicCredentialMissingError()
  }
  const identity = identitiesByUser.get(platformUserId) || storedIdentityForUser(platformUserId)
  if (!identity) throw new AcademicCredentialMissingError()
  identitiesByUser.set(platformUserId, identity)
  activeUserId = platformUserId
  return { ...identity }
}

export const getActiveAcademicUserId = () => (
  activeUserId && identitiesByUser.has(activeUserId) ? activeUserId : 0
)

/** 保存通过教务验证的账号凭据，供本机后续查询使用。 */
export const saveAcademicCredential = (
  platformUserId: number,
  credential: Omit<AcademicCredential, 'identityScopeToken'> & { identityScopeToken?: string },
) => {
  if (!validUserId(platformUserId)) throw new Error('无法识别当前平台账号')
  if (!isIdentityMetadata(credential) || !credential.password) {
    throw new Error('教务账号、密码或学生类型无效')
  }
  if (!activeUserId || activeUserId === platformUserId) {
    let existingIdentity = identitiesByUser.get(platformUserId) || null
    if (!existingIdentity) {
      const storedIdentity = readStoredAcademicIdentity() as Partial<StoredAcademicIdentity> | null
      const legacy = readLegacyStoredAcademicCredential() as Partial<LegacyStoredAcademicCredential> | null
      if (storedIdentity?.platformUserId === platformUserId || (!storedIdentity && legacy?.platformUserId === platformUserId)) {
        existingIdentity = storedIdentityForUser(platformUserId)
      }
    }
    const existingPassword = passwordsByUser.get(platformUserId) || storedPasswordForUser(platformUserId)
    if (
      existingIdentity
      && existingPassword
      && existingIdentity.studentNo === credential.studentNo.trim()
      && existingIdentity.educationLevel === credential.educationLevel
      && existingPassword === credential.password
    ) {
      identitiesByUser.set(platformUserId, existingIdentity)
      passwordsByUser.set(platformUserId, existingPassword)
      activeUserId = platformUserId
      return
    }
  }
  if (activeUserId && activeUserId !== platformUserId) clearRuntimeCredentials()
  const normalizedIdentity = normalizeIdentity({ ...credential, identityScopeToken: '' })
  identitiesByUser.set(platformUserId, normalizedIdentity)
  passwordsByUser.set(platformUserId, credential.password)
  activeUserId = platformUserId
  writeStoredAcademicCredential(
    { version: 1, platformUserId, identity: normalizedIdentity },
    { version: 1, platformUserId, password: credential.password },
  )
  credentialRevision += 1
  invalidateSharedResourceGroup('academic', { clearData: false })
}

export const loadAcademicCredential = (platformUserId: number): AcademicCredential => {
  const identity = loadAcademicIdentity(platformUserId)
  const password = passwordsByUser.get(platformUserId) || storedPasswordForUser(platformUserId)
  if (!password) throw new AcademicCredentialMissingError()
  passwordsByUser.set(platformUserId, password)
  return { ...identity, password }
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
    credentialRevision += 1
    return
  }
  if (!validUserId(platformUserId)) return
  identitiesByUser.delete(platformUserId)
  passwordsByUser.delete(platformUserId)
  if (activeUserId === platformUserId) activeUserId = 0
  credentialRevision += 1
  removeStoredAcademicCredential(platformUserId)
}
