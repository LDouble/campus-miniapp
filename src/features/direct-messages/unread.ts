import { createSharedResource } from '../../state/shared-resource'
import type { PrivateMessageUnreadCount } from '../../api/types'
import { isQualificationEdition } from '../app-edition'
import { getMiniappRuntimeConfig, resolveMiniappModule } from '../runtime-config'
import { syncPrivateMessageUnreadBadge } from '../../utils/tabbar'
import { privateMessagesRepository } from './repository'

const unreadResource = createSharedResource<PrivateMessageUnreadCount>({
  maxAgeMs: 45_000,
  group: 'session',
})

let unreadCount = 0
const listeners = new Set<(count: number) => void>()

const publish = (count: number) => {
  unreadCount = Math.max(0, Number(count) || 0)
  syncPrivateMessageUnreadBadge(unreadCount)
  listeners.forEach((listener) => listener(unreadCount))
  return unreadCount
}

export const privateMessageUnreadCount = () => unreadCount

export const subscribePrivateMessageUnreadCount = (listener: (count: number) => void) => {
  listeners.add(listener)
  listener(unreadCount)
  return () => {
    listeners.delete(listener)
  }
}

export const refreshPrivateMessageUnreadCount = async (force = false) => {
  if (
    isQualificationEdition
    || resolveMiniappModule(getMiniappRuntimeConfig(), 'private_message').state !== 'enabled'
  ) return publish(0)
  const result = await unreadResource.ensure(
    () => privateMessagesRepository.unreadCount(),
    { force },
  )
  return publish(result.count)
}

export const decrementPrivateMessageUnreadCount = (count: number) => (
  publish(unreadCount - Math.max(0, Number(count) || 0))
)
