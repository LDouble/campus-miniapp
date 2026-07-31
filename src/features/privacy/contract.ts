import Taro from '@tarojs/taro'

export const openMiniProgramPrivacyContract = async () => {
  if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) {
    throw new Error('请在微信小程序中查看隐私保护指引')
  }
  await Taro.openPrivacyContract()
}
