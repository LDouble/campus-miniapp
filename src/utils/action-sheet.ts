import Taro from '@tarojs/taro'

const isActionSheetCancel = (error: unknown) => {
  const errMsg = (error as { errMsg?: unknown } | null)?.errMsg
  return typeof errMsg === 'string' && errMsg.toLowerCase().includes('cancel')
}

export const showActionSheetSelection = async (itemList: string[]) => {
  try {
    const result = await Taro.showActionSheet({ itemList })
    return typeof result.tapIndex === 'number' ? result.tapIndex : null
  } catch (error) {
    if (!isActionSheetCancel(error)) {
      Taro.showToast({ title: '操作菜单打开失败，请稍后重试', icon: 'none' })
    }
    return null
  }
}
