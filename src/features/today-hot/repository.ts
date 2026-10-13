import { apiRequest } from '../../api/client'
import type { operations } from '../../api/generated/schema'
import type { CampusCircleTodayHotCarousel, CampusCircleTodayHotPage } from '../../api/types'

export type TodayHotEntry = CampusCircleTodayHotCarousel['items'][number]
export type TodayHotHome = CampusCircleTodayHotCarousel
export type TodayHotPostPage = CampusCircleTodayHotPage
type ListTodayHotPostsQuery = NonNullable<operations['ListCampusCircleTodayHotPosts']['parameters']['query']>
type GetTodayHotQuery = NonNullable<operations['GetCampusCircleTodayHot']['parameters']['query']>

export const todayHotRepository = {
  getHome: (window?: number) => apiRequest<TodayHotHome>({
    path: '/api/v1/campus-circle/today-hot',
    query: { window } satisfies GetTodayHotQuery,
  }),
  listPosts: (input: { snapshotId?: number; cursor?: string | null; pageSize?: number; contextPostId?: number | null }) => {
    const query: ListTodayHotPostsQuery = {
      snapshot_id: input.snapshotId,
      cursor: input.cursor || undefined,
      page_size: input.pageSize || 20,
      context_post_id: input.contextPostId || undefined,
    }
    return apiRequest<TodayHotPostPage>({
    path: '/api/v1/campus-circle/today-hot/posts',
    query,
    })
  },
}
