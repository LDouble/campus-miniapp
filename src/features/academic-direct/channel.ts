import Taro from '@tarojs/taro'

const ACADEMIC_QUERY_CHANNEL_KEY = 'campus.academic.queryChannel.v1'

export type AcademicQueryChannel = 'server' | 'direct'

export const isAcademicQueryChannel = (value: unknown): value is AcademicQueryChannel => (
  value === 'server' || value === 'direct'
)

export const getAcademicQueryChannel = (): AcademicQueryChannel => {
  const value = Taro.getStorageSync<unknown>(ACADEMIC_QUERY_CHANNEL_KEY)
  return isAcademicQueryChannel(value) ? value : 'server'
}

export const setAcademicQueryChannel = (channel: AcademicQueryChannel) => {
  Taro.setStorageSync(ACADEMIC_QUERY_CHANNEL_KEY, channel)
}

export const toggleAcademicQueryChannel = () => {
  const next = getAcademicQueryChannel() === 'server' ? 'direct' : 'server'
  setAcademicQueryChannel(next)
  return next
}
