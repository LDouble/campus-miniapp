import Taro from '@tarojs/taro'
import { getAccessToken } from '../../api/auth'
import { lifeServicesRepository } from '../life-services/repository'
import {
  getReaderToken,
  type ReaderTokenStorage,
  type RecordPostView,
} from './post-view-utils'
import {
  createCommunityPostViewDispatcher,
  type CommunityViewCountListener,
} from './post-view-dispatcher'

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

const defaultDispatcher = createCommunityPostViewDispatcher({
  record: defaultRecordPostView,
  getReaderToken: () => getCommunityReaderToken(),
  // Access-token changes are the most reliable session boundary available to
  // this client; guests remain isolated by their reader token.
  getIdentity: (readerToken) => {
    const accessToken = getAccessToken()
    return accessToken ? `user:${accessToken}` : `guest:${readerToken}`
  },
})

/**
 * 列表有效曝光与详情阅读共用的静默上报入口。
 */
export const reportCommunityPostView = async (
  postId: number,
  options: {
    record?: RecordPostView
    storage?: ReaderTokenStorage
  } = {},
) => {
  if (!options.record && !options.storage) return defaultDispatcher.report(postId)
  const storage = options.storage || taroReaderTokenStorage
  const dispatcher = createCommunityPostViewDispatcher({
    record: options.record || defaultRecordPostView,
    getReaderToken: () => getCommunityReaderToken(storage),
    getIdentity: (readerToken) => {
      const accessToken = getAccessToken()
      return accessToken ? `user:${accessToken}` : `guest:${readerToken}`
    },
  })
  return dispatcher.report(postId)
}

export const subscribeCommunityViewCount = (
  postId: number,
  listener: CommunityViewCountListener,
) => defaultDispatcher.subscribe(postId, listener)

export const getCommunityViewCount = (postId: number): number | undefined => (
  defaultDispatcher.getCount(postId)
)

/** 列表和详情 GET 返回的真实计数也进入同一缓存，防止旧快照覆盖更新后的值。 */
export const observeCommunityViewCount = (postId: number, count: number) => (
  defaultDispatcher.observeCount(postId, count)
)
