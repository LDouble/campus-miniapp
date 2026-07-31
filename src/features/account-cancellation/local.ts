import Taro from '@tarojs/taro'
import { markAccountCancelled } from '../../api/auth'
import {
  materialDraftStorage,
  removePersistedMaterialFiles,
} from '../course-materials/storage'

export const clearCancelledAccountLocalData = async (userId: number) => {
  const drafts = await materialDraftStorage.read(userId)
  if (drafts) {
    await removePersistedMaterialFiles(drafts.drafts)
  }
  Taro.clearStorageSync()
  markAccountCancelled()
}
