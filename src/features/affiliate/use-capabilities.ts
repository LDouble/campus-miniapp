import { useEffect, useState } from 'react'
import {
  getAffiliateCapabilitySnapshot,
  subscribeAffiliateCapabilities,
} from './capabilities'

/** useAffiliateCapabilities 让页面随共享 bootstrap 的开关变化重新渲染。 */
export const useAffiliateCapabilities = () => {
  const [snapshot, setSnapshot] = useState(getAffiliateCapabilitySnapshot)

  useEffect(() => subscribeAffiliateCapabilities(setSnapshot), [])

  return snapshot
}
