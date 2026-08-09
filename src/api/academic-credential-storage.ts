import Taro from '@tarojs/taro'
import type { AcademicCredential } from './academic-credential'

export type StoredAcademicCredential = {
  version: 1
  platformUserId: number
  credential: AcademicCredential
}

const STORAGE_KEY = 'campus.academicCredential.v1'

export const readStoredAcademicCredential = (): unknown => {
  try {
    return Taro.getStorageSync<unknown>(STORAGE_KEY) || null
  } catch {
    return null
  }
}

export const writeStoredAcademicCredential = (value: StoredAcademicCredential) => {
  try {
    Taro.setStorageSync(STORAGE_KEY, value)
  } catch {
    throw new Error('教务密码本机保存失败，请清理小程序存储空间后重试')
  }
}

export const removeStoredAcademicCredential = () => {
  try {
    Taro.removeStorageSync(STORAGE_KEY)
  } catch {
    // 运行时缓存仍会被清理；存储异常不应阻断退出或注销流程。
  }
}
