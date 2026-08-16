import { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import {
  buildCampusShareMessage,
  buildCampusShareTimelineMessage,
} from './message'
import type { CampusShareInput } from './message'

export {
  buildCampusShareMessage,
  buildCampusShareTimelineMessage,
  buildSharePath,
} from './message'
export type {
  CampusShareInput,
  CampusShareMessage,
  CampusShareTimelineMessage,
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
  useShareTimeline(() => buildCampusShareTimelineMessage(
    factory({ from: 'menu' }),
  ))
}
