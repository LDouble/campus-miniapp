import Taro from '@tarojs/taro'
import type { AcademicCredential, AcademicIdentityMetadata } from './academic-credential'

export type StoredAcademicIdentity = {
  version: 1
  platformUserId: number
  identity: AcademicIdentityMetadata
}

export type StoredAcademicPassword = {
  version: 1
  platformUserId: number
  password: string
}

export type LegacyStoredAcademicCredential = {
  version: 1
  platformUserId: number
  credential: AcademicCredential
}

const IDENTITY_STORAGE_KEY = 'campus.academicIdentity.v1'
const PASSWORD_STORAGE_KEY = 'campus.academicCredentialPassword.v1'
const LEGACY_STORAGE_KEY = 'campus.academicCredential.v1'

const read = (key: string): unknown => {
  try {
    return Taro.getStorageSync<unknown>(key) || null
  } catch {
    return null
  }
}

export const readStoredAcademicIdentity = (): unknown => read(IDENTITY_STORAGE_KEY)

export const readStoredAcademicPassword = (): unknown => read(PASSWORD_STORAGE_KEY)

export const readLegacyStoredAcademicCredential = (): unknown => read(LEGACY_STORAGE_KEY)

export const writeStoredAcademicIdentity = (value: StoredAcademicIdentity) => {
  try {
    Taro.setStorageSync(IDENTITY_STORAGE_KEY, value)
  } catch {
    throw new Error('教务身份信息本机保存失败，请清理小程序存储空间后重试')
  }
}

export const writeStoredAcademicCredential = (
  identity: StoredAcademicIdentity,
  password: StoredAcademicPassword,
) => {
  try {
    Taro.setStorageSync(PASSWORD_STORAGE_KEY, password)
    Taro.setStorageSync(IDENTITY_STORAGE_KEY, identity)
    Taro.removeStorageSync(LEGACY_STORAGE_KEY)
  } catch {
    try { Taro.removeStorageSync(PASSWORD_STORAGE_KEY) } catch { /* 下次启动时仍按凭据缺失处理。 */ }
    throw new Error('教务凭据本机保存失败，请清理小程序存储空间后重试')
  }
}

export const removeStoredAcademicCredential = (platformUserId?: number) => {
  const identity = readStoredAcademicIdentity() as Partial<StoredAcademicIdentity> | null
  const storedPassword = readStoredAcademicPassword() as Partial<StoredAcademicPassword> | null
  const legacy = readLegacyStoredAcademicCredential() as Partial<LegacyStoredAcademicCredential> | null
  const shouldRemoveAll = platformUserId === undefined
  try {
    if (shouldRemoveAll || identity?.platformUserId === platformUserId) {
      Taro.removeStorageSync(IDENTITY_STORAGE_KEY)
    }
    if (shouldRemoveAll || storedPassword?.platformUserId === platformUserId) {
      Taro.removeStorageSync(PASSWORD_STORAGE_KEY)
    }
    if (shouldRemoveAll || legacy?.platformUserId === platformUserId) {
      Taro.removeStorageSync(LEGACY_STORAGE_KEY)
    }
  } catch {
    // 运行时凭据仍会被清理；存储异常不应阻断退出或注销流程。
  }
}
