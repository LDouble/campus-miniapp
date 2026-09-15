import { revealedContactValue } from './contact-reveal'

export type ParticipationContactResource = 'marketplace' | 'carpool' | 'errand'

export type ParticipationContact = {
  contactType: string
  contact: string
}

type SyncStorage = {
  getStorageSync<T>(key: string): T
  setStorageSync<T>(key: string, value: T): void
  removeStorageSync(key: string): void
}

type IdentityProvider = () => Promise<{ user_id: number }>

type ParticipationContactInput = {
  resourceType: ParticipationContactResource
  resourceId: number
  viewerRelation: string
  resourceStatus: string
  contactType?: string | null
  contact?: string | null
}

const STORAGE_KEY_PREFIX = 'campus.lifeServices.participationContact.v1.'
const PARTICIPANT_RELATIONS: Record<ParticipationContactResource, Set<string>> = {
  marketplace: new Set(['buyer', 'seller']),
  carpool: new Set(['participant']),
  errand: new Set(['runner']),
}
const CONTACT_VISIBLE_STATUSES: Record<ParticipationContactResource, Set<string>> = {
  marketplace: new Set(['published', 'reserved']),
  carpool: new Set(['open', 'full']),
  errand: new Set(['accepted', 'picked_up', 'delivered']),
}

const validId = (value: number) => Number.isSafeInteger(value) && value > 0
const storageKey = (
  userId: number,
  resourceType: ParticipationContactResource,
  resourceId: number,
) => `${STORAGE_KEY_PREFIX}${userId}.${resourceType}.${resourceId}`

const normalizedContact = (
  contactType?: string | null,
  contact?: string | null,
): ParticipationContact | null => {
  const value = revealedContactValue(contact)
  const type = String(contactType || '').trim()
  if (!value || value.length > 128 || type.length > 32) return null
  return {
    contactType: type || '联系方式',
    contact: value,
  }
}

const normalizedStoredContact = (value: unknown): ParticipationContact | null => {
  if (!value || typeof value !== 'object') return null
  const stored = value as Partial<ParticipationContact>
  return normalizedContact(stored.contactType, stored.contact)
}

export const hasParticipationContactAccess = (
  resourceType: ParticipationContactResource,
  viewerRelation: string,
  resourceStatus: string,
) => PARTICIPANT_RELATIONS[resourceType].has(viewerRelation)
  && CONTACT_VISIBLE_STATUSES[resourceType].has(resourceStatus)

export const participationContactStorage = {
  read(
    storage: SyncStorage,
    userId: number,
    resourceType: ParticipationContactResource,
    resourceId: number,
  ): ParticipationContact | null {
    if (!validId(userId) || !validId(resourceId)) return null
    try {
      return normalizedStoredContact(
        storage.getStorageSync<unknown>(storageKey(userId, resourceType, resourceId)),
      )
    } catch {
      return null
    }
  },

  write(
    storage: SyncStorage,
    userId: number,
    resourceType: ParticipationContactResource,
    resourceId: number,
    value: ParticipationContact,
  ) {
    if (!validId(userId) || !validId(resourceId)) return false
    const contact = normalizedStoredContact(value)
    if (!contact) return false
    try {
      storage.setStorageSync(storageKey(userId, resourceType, resourceId), contact)
      return true
    } catch {
      return false
    }
  },

  clear(
    storage: SyncStorage,
    userId: number,
    resourceType: ParticipationContactResource,
    resourceId: number,
  ) {
    if (!validId(userId) || !validId(resourceId)) return
    try {
      storage.removeStorageSync(storageKey(userId, resourceType, resourceId))
    } catch {
      // 本地缓存清理失败不影响详情页主流程。
    }
  },
}

export const restoreParticipationContact = async (
  storage: SyncStorage,
  getIdentity: IdentityProvider,
  input: ParticipationContactInput,
): Promise<ParticipationContact | null> => {
  const remoteContact = normalizedContact(input.contactType, input.contact)
  const hasAccess = hasParticipationContactAccess(
    input.resourceType,
    input.viewerRelation,
    input.resourceStatus,
  )

  if (!hasAccess) {
    try {
      const identity = await getIdentity()
      participationContactStorage.clear(
        storage,
        identity.user_id,
        input.resourceType,
        input.resourceId,
      )
    } catch {
      // 无法确认当前用户时不读取本地联系方式。
    }
    return null
  }

  if (remoteContact) {
    try {
      const identity = await getIdentity()
      participationContactStorage.write(
        storage,
        identity.user_id,
        input.resourceType,
        input.resourceId,
        remoteContact,
      )
    } catch {
      // 身份接口失败时仍可展示服务端本次返回的完整联系方式。
    }
    return remoteContact
  }

  try {
    const identity = await getIdentity()
    return participationContactStorage.read(
      storage,
      identity.user_id,
      input.resourceType,
      input.resourceId,
    )
  } catch {
    return null
  }
}

export const visibleParticipationContact = (
  contactType?: string | null,
  contact?: string | null,
  persistedContact?: ParticipationContact | null,
) => normalizedContact(contactType, contact) || persistedContact || null
