import Taro from '@tarojs/taro'

export const publicProfileUrl = (userId: number) => (
  `/pages/public-profile/index?id=${userId}`
)

export const openPublicProfile = (userId: number) => {
  if (!Number.isInteger(userId) || userId < 1) {
    Taro.showToast({ title: '用户信息暂不可用', icon: 'none' })
    return Promise.resolve()
  }
  return Taro.navigateTo({ url: publicProfileUrl(userId) })
}
