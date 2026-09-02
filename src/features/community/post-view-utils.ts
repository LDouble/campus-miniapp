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
    if (isReaderToken(stored)) return stored
  } catch {
    // 读取失败时继续生成临时 token，阅读上报不应影响详情页展示。
  }

  const token = createReaderToken()
  try {
    storage.set(token)
  } catch {
    // 存储失败不阻塞本次上报；下次进入详情时会重新生成。
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
  if (!Number.isInteger(postId) || postId <= 0) return null

  const readerToken = getReaderToken(storage)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await record(postId, readerToken)
    } catch {
      // 详情页已经可以正常展示，阅读量属于弱一致元数据，失败时保持静默。
    }
  }
  return null
}

export const formatCommunityViewCount = (value: number | null | undefined) => {
  const count = Number(value)
  if (!Number.isFinite(count) || count < 0) return '—'
  if (count < 10_000) return String(Math.floor(count))
  return `${(count / 10_000).toFixed(1)}万`
}
