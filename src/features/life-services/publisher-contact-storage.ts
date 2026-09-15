export type PublisherContactType = 'wechat' | 'phone' | 'qq'

export type PublisherContact = {
  contactType: PublisherContactType
  contact: string
}

type SyncStorage = {
  getStorageSync<T>(key: string): T
  setStorageSync<T>(key: string, value: T): void
  removeStorageSync(key: string): void
}

const STORAGE_KEY_PREFIX = 'campus.lifeServices.publisherContact.v1.'
const CONTACT_TYPES = new Set<PublisherContactType>(['wechat', 'phone', 'qq'])

const validUserId = (userId: number) => Number.isSafeInteger(userId) && userId > 0
const storageKey = (userId: number) => `${STORAGE_KEY_PREFIX}${userId}`

const normalizedContact = (value: unknown): PublisherContact | null => {
  if (!value || typeof value !== 'object') return null
  const stored = value as Partial<PublisherContact>
  const contact = typeof stored.contact === 'string' ? stored.contact.trim() : ''
  if (!CONTACT_TYPES.has(stored.contactType as PublisherContactType)) return null
  if (!contact || contact.includes('*') || contact.length > 128) return null
  return {
    contactType: stored.contactType as PublisherContactType,
    contact,
  }
}

export const publisherContactStorage = {
  read(storage: SyncStorage, userId: number): PublisherContact | null {
    if (!validUserId(userId)) return null
    try {
      return normalizedContact(storage.getStorageSync<unknown>(storageKey(userId)))
    } catch {
      return null
    }
  },

  write(storage: SyncStorage, userId: number, value: PublisherContact) {
    if (!validUserId(userId)) return false
    const contact = normalizedContact(value)
    if (!contact) return false
    try {
      storage.setStorageSync(storageKey(userId), contact)
      return true
    } catch {
      return false
    }
  },

  clear(storage: SyncStorage, userId: number) {
    if (!validUserId(userId)) return
    try {
      storage.removeStorageSync(storageKey(userId))
    } catch {
      // 本地偏好清理失败不影响主流程。
    }
  },
}

export const withRememberedPublisherContact = <T extends PublisherContact>(
  form: T,
  remembered: PublisherContact | null,
): T => {
  if (form.contact.trim() || !remembered) return form
  return {
    ...form,
    contactType: remembered.contactType,
    contact: remembered.contact,
  }
}
