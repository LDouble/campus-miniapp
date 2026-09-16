import { createCommunityPostViewDispatcher } from './post-view-dispatcher'

export type ReaderTokenStorage = {
  get: () => unknown
  set: (value: string) => void
}

export type RecordPostView = (
  postId: number,
  readerToken: string,
) => Promise<{ counted: boolean; view_count: number }>

const READER_TOKEN_LENGTH = 32
const MIN_READER_TOKEN_LENGTH = 16
const MAX_READER_TOKEN_LENGTH = 128

// Some embedded runtimes can read requests but reject storage writes (for
// example, during a temporary storage quota error). Keep that visitor stable
// for the lifetime of the runtime so those reports still share a reader id.
let runtimeReaderToken: string | null = null

const isReaderToken = (value: unknown): value is string => (
  typeof value === 'string'
  && value.length >= MIN_READER_TOKEN_LENGTH
  && value.length <= MAX_READER_TOKEN_LENGTH
  && /^[\x21-\x7e]+$/u.test(value)
)

const createReaderToken = () => {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_'
  let token = ''
  for (let index = 0; index < READER_TOKEN_LENGTH; index += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return token
}

export const getReaderToken = (storage: ReaderTokenStorage) => {
  try {
    const stored = storage.get()
    if (isReaderToken(stored)) {
      runtimeReaderToken = stored
      return stored
    }
  } catch {
    // 读取失败时继续生成临时 token，阅读上报不应影响详情页展示。
  }

  const token = runtimeReaderToken || createReaderToken()
  runtimeReaderToken = token
  try {
    storage.set(token)
  } catch {
    runtimeReaderToken = runtimeReaderToken || token
    return runtimeReaderToken
  }
  return token
}

/**
 * 详情页静默上报一次阅读。临时网络或计数依赖失败时只重试一次，最终结果不向用户弹错。
 */
export const reportPostView = async (
  postId: number,
  record: RecordPostView,
  storage: ReaderTokenStorage,
) => {
  const dispatcher = createCommunityPostViewDispatcher({
    record,
    getReaderToken: () => getReaderToken(storage),
    getIdentity: (readerToken) => readerToken,
  })
  return dispatcher.report(postId)
}

export const formatCommunityViewCount = (value: number | null | undefined) => {
  const count = Number(value)
  if (!Number.isFinite(count) || count < 0) return '—'
  if (count < 10_000) return String(Math.floor(count))
  return `${(count / 10_000).toFixed(1)}万`
}
