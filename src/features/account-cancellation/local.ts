import Taro from '@tarojs/taro'
import { markAccountCancelled } from '../../api/auth'
import { clearAcademicCredential } from '../../api/academic-credential'
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
  clearAcademicCredential()
  markAccountCancelled()
}
