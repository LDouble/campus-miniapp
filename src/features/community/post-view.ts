import Taro from '@tarojs/taro'
import { lifeServicesRepository } from '../life-services/repository'
import {
  getReaderToken,
  reportPostView,
  type ReaderTokenStorage,
  type RecordPostView,
} from './post-view-utils'

export { formatCommunityViewCount } from './post-view-utils'
export type { ReaderTokenStorage, RecordPostView } from './post-view-utils'

const COMMUNITY_READER_TOKEN_KEY = 'campus.community.readerToken.v1'

const taroReaderTokenStorage: ReaderTokenStorage = {
  get: () => Taro.getStorageSync(COMMUNITY_READER_TOKEN_KEY),
  set: (value) => Taro.setStorageSync(COMMUNITY_READER_TOKEN_KEY, value),
}

export const getCommunityReaderToken = (
  storage: ReaderTokenStorage = taroReaderTokenStorage,
) => {
  return getReaderToken(storage)
}

const defaultRecordPostView: RecordPostView = (postId, readerToken) => (
  lifeServicesRepository.recordCampusCirclePostView(postId, readerToken)
)

/**
 * 详情页静默上报一次阅读。临时网络或计数依赖失败时只重试一次，最终结果不向用户弹错。
 */
export const reportCommunityPostView = async (
  postId: number,
  options: {
    record?: RecordPostView
    storage?: ReaderTokenStorage
  } = {},
) => {
  const record = options.record || defaultRecordPostView
  return reportPostView(postId, record, options.storage || taroReaderTokenStorage)
}
