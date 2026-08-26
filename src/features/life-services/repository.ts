import { apiRequest, createIdempotencyKey } from '../../api/client'
import type { operations } from '../../api/generated/schema'
import type {
  CarpoolTripView,
  CampusCirclePostView,
  CampusCirclePostViewPage,
  CampusCircleHome,
  CampusCircleTopicPage,
  CampusCircleTopicView,
  CampusCircleSectionView,
  CarpoolTripViewPage,
  ErrandOptionalOrderResult,
  ErrandOrderResult,
  ErrandView,
  ErrandViewPage,
  HomeFeedPage,
  MarketplaceListingView,
  MarketplaceListingViewPage,
  MarketplaceTradeOrder,
  MentionCandidatePage,
  PublicUserProfile,
  ReactionResourceType,
  ReactionState,
  TradeOrderView,
  TradeOrderViewPage,
  CommentView,
  CommentViewPage,
  CommentThread,
} from '../../api/types'
import type { CampusName } from './campus'

type CreateErrandBody = operations['CreateErrand']['requestBody']['content']['application/json']
type UpdateErrandBody = operations['UpdateErrand']['requestBody']['content']['application/json']
type CreateMarketplaceBody = operations['CreateMarketplaceListing']['requestBody']['content']['application/json']
type UpdateMarketplaceBody = operations['UpdateMarketplaceListing']['requestBody']['content']['application/json']
type CreateCarpoolBody = operations['CreateCarpoolTrip']['requestBody']['content']['application/json']
type UpdateCarpoolBody = operations['UpdateCarpoolTrip']['requestBody']['content']['application/json']
type CreateCampusPostBody = operations['CreateCampusCirclePost']['requestBody']['content']['application/json']
type UpdateCampusPostBody = operations['UpdateCampusCirclePost']['requestBody']['content']['application/json']
type CreateCommentBody = operations['CreateComment']['requestBody']['content']['application/json']
type CreateContentReportBody = operations['CreateContentReport']['requestBody']['content']['application/json']

export type PagingQuery = {
  page?: number
  pageSize?: number
}

export type ErrandSearch = PagingQuery & {
  keyword?: string
  campus?: CampusName
}

export type MyErrandSearch = PagingQuery & {
  relation?: 'all' | 'published' | 'accepted'
  status?: 'open' | 'accepted' | 'picked_up' | 'delivered' | 'completed' | 'cancelled'
  reviewStatus?: 'draft' | 'pending_review' | 'approved' | 'rejected'
}

export type MarketplaceSearch = PagingQuery & {
  keyword?: string
  campus?: CampusName
  intent?: 'sell' | 'wanted'
  category?: 'general' | 'course_material'
  minPriceCents?: number
  maxPriceCents?: number
}

export type CarpoolSearch = PagingQuery & {
  keyword?: string
  campus?: CampusName
  origin?: string
  destination?: string
  departureDate?: string
  seatsNeeded?: number
}

export type MyCarpoolSearch = PagingQuery & {
  relation?: 'organized' | 'joined' | 'all'
  status?: string
  reviewStatus?: string
  keyword?: string
}

export type TradeOrderSearch = PagingQuery & {
  relation?: 'all' | 'buyer' | 'seller'
  orderType?: 'marketplace' | 'errand'
  tradeStatus?: 'confirmed' | 'completed' | 'cancelled' | 'expired'
  fulfillmentStatus?: 'not_started' | 'in_progress' | 'delivered'
}

export type CampusCircleSearch = PagingQuery & {
  keyword?: string
  sectionId?: number
  parentSectionId?: number
  topicId?: number
  sort?: NonNullable<operations['ListCampusCirclePosts']['parameters']['query']>['sort']
}

export type CampusCircleTopicSearch = PagingQuery & {
  kind?: 'topic' | 'campaign'
}

const versionAction = <T>(path: string, version: number, scope: string) => (
  apiRequest<T>({
    path,
    method: 'POST',
    idempotencyKey: createIdempotencyKey(scope),
    data: { expected_version: version },
  })
)

export const lifeServicesRepository = {
  searchMentionCandidates(keyword: string) {
    return apiRequest<MentionCandidatePage>({
      path: '/api/v1/users/mention-candidates',
      query: { keyword: keyword.trim(), limit: 10 },
    })
  },

  listHomeFeed(search: PagingQuery = {}) {
    return apiRequest<HomeFeedPage>({
      path: '/api/v1/home/feed',
      query: { page: search.page || 1, page_size: search.pageSize || 20 },
    })
  },

  getUserProfile(userId: number) {
    return apiRequest<PublicUserProfile>({ path: `/api/v1/users/${userId}/profile` })
  },

  listUserCampusCirclePosts(userId: number, search: PagingQuery = {}) {
    return apiRequest<CampusCirclePostViewPage>({
      path: `/api/v1/users/${userId}/campus-circle/posts`,
      query: { page: search.page || 1, page_size: search.pageSize || 20 },
    })
  },

  listUserErrands(userId: number, search: PagingQuery = {}) {
    return apiRequest<ErrandViewPage>({
      path: `/api/v1/users/${userId}/errands`,
      query: { page: search.page || 1, page_size: search.pageSize || 20 },
    })
  },

  listUserMarketplaceListings(userId: number, search: PagingQuery = {}) {
    return apiRequest<MarketplaceListingViewPage>({
      path: `/api/v1/users/${userId}/marketplace/listings`,
      query: { page: search.page || 1, page_size: search.pageSize || 20 },
    })
  },

  listUserCarpoolTrips(userId: number, search: PagingQuery = {}) {
    return apiRequest<CarpoolTripViewPage>({
      path: `/api/v1/users/${userId}/carpool/trips`,
      query: { page: search.page || 1, page_size: search.pageSize || 20 },
    })
  },

  createContentReport(input: CreateContentReportBody) {
    return apiRequest<operations['CreateContentReport']['responses'][201]['content']['application/json']['data']>({
      path: '/api/v1/content-reports',
      method: 'POST',
      idempotencyKey: createIdempotencyKey(
        `content-report:${input.resource_type}:${input.resource_id}`,
      ),
      data: input,
    })
  },

  listCampusCircleSections() {
    return apiRequest<{ items: CampusCircleSectionView[] }>({
      path: '/api/v1/campus-circle/sections',
    })
  },

  getCampusCircleHome() {
    return apiRequest<CampusCircleHome>({ path: '/api/v1/campus-circle/home' })
  },

  listCampusCircleTopics(search: CampusCircleTopicSearch = {}) {
    return apiRequest<CampusCircleTopicPage>({
      path: '/api/v1/campus-circle/topics',
      query: { kind: search.kind, page: search.page || 1, page_size: search.pageSize || 20 },
    })
  },

  getCampusCircleTopic(id: number) {
    return apiRequest<CampusCircleTopicView>({ path: `/api/v1/campus-circle/topics/${id}` })
  },

  listCampusCirclePosts(search: CampusCircleSearch = {}) {
    return apiRequest<CampusCirclePostViewPage>({
      path: '/api/v1/campus-circle/posts',
      query: {
        section_id: search.sectionId,
        parent_section_id: search.parentSectionId,
        keyword: search.keyword,
        topic_id: search.topicId,
        sort: search.sort,
        page: search.page || 1,
        page_size: search.pageSize || 20,
      },
    })
  },

  listMyCampusCirclePosts(search: CampusCircleSearch = {}) {
    return apiRequest<CampusCirclePostViewPage>({
      path: '/api/v1/campus-circle/posts/mine',
      query: {
        section_id: search.sectionId,
        keyword: search.keyword,
        page: search.page || 1,
        page_size: search.pageSize || 50,
      },
    })
  },

  getCampusCirclePost(id: number) {
    return apiRequest<CampusCirclePostView>({
      path: `/api/v1/campus-circle/posts/${id}`,
    })
  },

  createCampusCirclePost(input: CreateCampusPostBody) {
    return apiRequest<CampusCirclePostView>({
      path: '/api/v1/campus-circle/posts',
      method: 'POST',
      idempotencyKey: createIdempotencyKey('campus-circle:create'),
      data: input,
    })
  },

  updateCampusCirclePost(id: number, input: UpdateCampusPostBody) {
    return apiRequest<CampusCirclePostView>({
      path: `/api/v1/campus-circle/posts/${id}`,
      method: 'PATCH',
      idempotencyKey: createIdempotencyKey(`campus-circle:${id}:update`),
      data: input,
    })
  },

  withdrawCampusCirclePost(id: number, version: number) {
    return versionAction<CampusCirclePostView>(
      `/api/v1/campus-circle/posts/${id}/withdraw`,
      version,
      `campus-circle:${id}:withdraw`,
    )
  },

  likeCampusCirclePost(id: number) {
    return apiRequest<CampusCirclePostView>({
      path: `/api/v1/campus-circle/posts/${id}/like`,
      method: 'PUT',
    })
  },

  unlikeCampusCirclePost(id: number) {
    return apiRequest<CampusCirclePostView>({
      path: `/api/v1/campus-circle/posts/${id}/like`,
      method: 'DELETE',
    })
  },

  likeResource(id: number, resourceType: ReactionResourceType) {
    return apiRequest<ReactionState>({
      path: `/api/v1/likes/${id}`,
      method: 'PUT',
      query: { resource_type: resourceType },
    })
  },

  unlikeResource(id: number, resourceType: ReactionResourceType) {
    return apiRequest<ReactionState>({
      path: `/api/v1/likes/${id}`,
      method: 'DELETE',
      query: { resource_type: resourceType },
    })
  },

  listComments(
    targetType: CreateCommentBody['target_type'],
    targetId: number,
    search: PagingQuery = {},
  ) {
    return apiRequest<CommentViewPage>({
      path: '/api/v1/comments',
      query: {
        target_type: targetType,
        target_id: targetId,
        page: search.page || 1,
        page_size: search.pageSize || 50,
      },
    })
  },

  createComment(input: CreateCommentBody) {
    return apiRequest<CommentView>({
      path: '/api/v1/comments',
      method: 'POST',
      idempotencyKey: createIdempotencyKey(
        `comment:${input.target_type}:${input.target_id}:${input.parent_id ? `reply:${input.parent_id}` : 'create'}`,
      ),
      data: input,
    })
  },

  getCommentThread(id: number) {
    return apiRequest<CommentThread>({
      path: `/api/v1/comments/${id}/thread`,
    })
  },

  withdrawComment(id: number, version: number) {
    return versionAction<CommentView>(
      `/api/v1/comments/${id}/withdraw`,
      version,
      `comment:${id}:withdraw`,
    )
  },

  listErrands(search: ErrandSearch = {}) {
    return apiRequest<ErrandViewPage>({
      path: '/api/v1/errands',
      query: {
        keyword: search.keyword,
        campus: search.campus,
        page: search.page || 1,
        page_size: search.pageSize || 20,
      },
    })
  },

  listMyErrands(search: MyErrandSearch = {}) {
    return apiRequest<ErrandViewPage>({
      path: '/api/v1/errands/mine',
      query: {
        relation: search.relation || 'all',
        status: search.status,
        review_status: search.reviewStatus,
        page: search.page || 1,
        page_size: search.pageSize || 20,
      },
    })
  },

  getErrand(id: number) {
    return apiRequest<ErrandView>({ path: `/api/v1/errands/${id}` })
  },

  createErrand(input: CreateErrandBody) {
    return apiRequest<ErrandView>({
      path: '/api/v1/errands',
      method: 'POST',
      idempotencyKey: createIdempotencyKey('errand:create'),
      data: input,
    })
  },

  updateErrand(id: number, input: UpdateErrandBody) {
    return apiRequest<ErrandView>({
      path: `/api/v1/errands/${id}`,
      method: 'PATCH',
      idempotencyKey: createIdempotencyKey(`errand:${id}:update`),
      data: input,
    })
  },

  acceptErrand(id: number, version: number) {
    return versionAction<ErrandOrderResult>(
      `/api/v1/errands/${id}/accept`,
      version,
      `errand:${id}:accept`,
    )
  },

  pickupErrand(id: number, version: number) {
    return versionAction<ErrandView>(
      `/api/v1/errands/${id}/pickup`,
      version,
      `errand:${id}:pickup`,
    )
  },

  deliverErrand(id: number, version: number) {
    return versionAction<ErrandView>(
      `/api/v1/errands/${id}/deliver`,
      version,
      `errand:${id}:deliver`,
    )
  },

  completeErrand(id: number, version: number) {
    return versionAction<ErrandOrderResult>(
      `/api/v1/errands/${id}/complete`,
      version,
      `errand:${id}:complete`,
    )
  },

  cancelErrand(id: number, version: number) {
    return versionAction<ErrandOptionalOrderResult>(
      `/api/v1/errands/${id}/cancel`,
      version,
      `errand:${id}:cancel`,
    )
  },

  submitErrandReview(id: number, version: number) {
    return versionAction<ErrandView>(
      `/api/v1/errands/${id}/submit-review`,
      version,
      `errand:${id}:submit-review`,
    )
  },

  listMarketplace(search: MarketplaceSearch = {}) {
    return apiRequest<MarketplaceListingViewPage>({
      path: '/api/v1/marketplace/listings',
      query: {
        keyword: search.keyword,
        campus: search.campus,
        intent: search.intent,
        category: search.category,
        min_price_cents: search.minPriceCents,
        max_price_cents: search.maxPriceCents,
        page: search.page || 1,
        page_size: search.pageSize || 20,
      },
    })
  },

  listMyMarketplaceListings(search: PagingQuery = {}) {
    return apiRequest<MarketplaceListingViewPage>({
      path: '/api/v1/marketplace/listings/mine',
      query: {
        page: search.page || 1,
        page_size: search.pageSize || 50,
      },
    })
  },

  getMarketplaceListing(id: number) {
    return apiRequest<MarketplaceListingView>({
      path: `/api/v1/marketplace/listings/${id}`,
    })
  },

  createMarketplaceListing(input: CreateMarketplaceBody) {
    return apiRequest<MarketplaceListingView>({
      path: '/api/v1/marketplace/listings',
      method: 'POST',
      idempotencyKey: createIdempotencyKey('marketplace:create'),
      data: input,
    })
  },

  updateMarketplaceListing(id: number, input: UpdateMarketplaceBody) {
    return apiRequest<MarketplaceListingView>({
      path: `/api/v1/marketplace/listings/${id}`,
      method: 'PATCH',
      idempotencyKey: createIdempotencyKey(`marketplace:${id}:update`),
      data: input,
    })
  },

  submitMarketplaceListing(id: number, version: number) {
    return versionAction<{ updated: boolean }>(
      `/api/v1/marketplace/listings/${id}/submit`,
      version,
      `marketplace:${id}:submit`,
    )
  },

  withdrawMarketplaceListing(id: number, version: number) {
    return versionAction<{ updated: boolean }>(
      `/api/v1/marketplace/listings/${id}/withdraw`,
      version,
      `marketplace:${id}:withdraw`,
    )
  },

  respondMarketplaceListing(id: number) {
    return apiRequest<MarketplaceTradeOrder>({
      path: '/api/v1/marketplace/orders',
      method: 'POST',
      idempotencyKey: createIdempotencyKey(`marketplace:${id}:respond`),
      data: { listing_id: id },
    })
  },

  listCarpool(search: CarpoolSearch = {}) {
    return apiRequest<CarpoolTripViewPage>({
      path: '/api/v1/carpool/trips',
      query: {
        keyword: search.keyword,
        campus: search.campus,
        origin: search.origin,
        destination: search.destination,
        departure_date: search.departureDate,
        seats_needed: search.seatsNeeded,
        page: search.page || 1,
        page_size: search.pageSize || 20,
      },
    })
  },

  listMyCarpoolTrips(search: MyCarpoolSearch = {}) {
    return apiRequest<CarpoolTripViewPage>({
      path: '/api/v1/carpool/trips/mine',
      query: {
        relation: search.relation || 'all',
        status: search.status,
        review_status: search.reviewStatus,
        keyword: search.keyword,
        page: search.page || 1,
        page_size: search.pageSize || 20,
      },
    })
  },

  getCarpoolTrip(id: number) {
    return apiRequest<CarpoolTripView>({
      path: `/api/v1/carpool/trips/${id}`,
    })
  },

  createCarpoolTrip(input: CreateCarpoolBody) {
    return apiRequest<CarpoolTripView>({
      path: '/api/v1/carpool/trips',
      method: 'POST',
      idempotencyKey: createIdempotencyKey('carpool:create'),
      data: input,
    })
  },

  updateCarpoolTrip(id: number, input: UpdateCarpoolBody) {
    return apiRequest<CarpoolTripView>({
      path: `/api/v1/carpool/trips/${id}`,
      method: 'PATCH',
      idempotencyKey: createIdempotencyKey(`carpool:${id}:update`),
      data: input,
    })
  },

  joinCarpoolTrip(id: number, version: number) {
    return versionAction<CarpoolTripView>(
      `/api/v1/carpool/trips/${id}/join`,
      version,
      `carpool:${id}:join`,
    )
  },

  leaveCarpoolTrip(id: number, version: number) {
    return versionAction<CarpoolTripView>(
      `/api/v1/carpool/trips/${id}/leave`,
      version,
      `carpool:${id}:leave`,
    )
  },

  cancelCarpoolTrip(id: number, version: number) {
    return versionAction<CarpoolTripView>(
      `/api/v1/carpool/trips/${id}/cancel`,
      version,
      `carpool:${id}:cancel`,
    )
  },

  submitCarpoolReview(id: number, version: number) {
    return versionAction<CarpoolTripView>(
      `/api/v1/carpool/trips/${id}/submit-review`,
      version,
      `carpool:${id}:submit-review`,
    )
  },

  listMyTradeOrders(search: TradeOrderSearch = {}) {
    return apiRequest<TradeOrderViewPage>({
      path: '/api/v1/orders',
      query: {
        relation: search.relation || 'all',
        order_type: search.orderType,
        trade_status: search.tradeStatus,
        fulfillment_status: search.fulfillmentStatus,
        page: search.page || 1,
        page_size: search.pageSize || 20,
      },
    })
  },

  getMyTradeOrder(id: number) {
    return apiRequest<TradeOrderView>({ path: `/api/v1/orders/${id}` })
  },

  cancelTradeOrder(id: number, version: number) {
    return versionAction<TradeOrderView>(
      `/api/v1/orders/${id}/cancel`,
      version,
      `order:${id}:cancel`,
    )
  },

  completeTradeOrder(id: number, version: number) {
    return versionAction<TradeOrderView>(
      `/api/v1/orders/${id}/complete`,
      version,
      `order:${id}:complete`,
    )
  },
}

export type {
  CreateCampusPostBody,
  CreateCarpoolBody,
  CreateErrandBody,
  CreateMarketplaceBody,
  CreateCommentBody,
  UpdateCarpoolBody,
  UpdateCampusPostBody,
  UpdateErrandBody,
  UpdateMarketplaceBody,
}
