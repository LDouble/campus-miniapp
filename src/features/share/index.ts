import { useShareAppMessage } from '@tarojs/taro'
import { buildCampusShareMessage } from './message'
import type { CampusShareInput } from './message'

export {
  buildCampusShareMessage,
  buildSharePath,
} from './message'
export type {
  CampusShareInput,
  CampusShareMessage,
} from './message'

export type CampusShareEvent = {
  from?: string
  target?: {
    dataset?: Record<string, string | number>
  }
}

export const useCampusShare = (
  factory: (event: CampusShareEvent) => CampusShareInput,
) => {
  useShareAppMessage((event) => buildCampusShareMessage(
    factory(event as CampusShareEvent),
  ))
}
