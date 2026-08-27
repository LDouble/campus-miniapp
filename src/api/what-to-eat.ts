import { apiRequest, createIdempotencyKey } from './client'
import type { components } from './generated/schema'

export type FoodListing = components['schemas']['FoodListingView']
export type FoodListingRatingResult = components['schemas']['FoodListingRatingResult']
export type FoodListingPage = components['schemas']['FoodListingPage']
export type FoodListingReview = components['schemas']['FoodListingReviewView']
export type FoodListingRatingInput = components['schemas']['FoodListingRatingInput']
export type FoodListingCommentInput = components['schemas']['FoodListingCommentInput']

export type FoodSubmission = components['schemas']['FoodListingSubmissionInput']
export type FoodListingDetail = FoodListing

export const listFoodListings = (campus: string, page = 1) => apiRequest<FoodListingPage>({
  path: '/api/v1/what-to-eat/listings',
  query: { campus, page, page_size: 20 },
})

export const pickRandomFood = (campus: string) => apiRequest<FoodListing>({
  path: '/api/v1/what-to-eat/random',
  query: { campus },
})

export const getFoodListing = (listingID: number): Promise<FoodListingDetail> => apiRequest<FoodListing>({
  path: `/api/v1/what-to-eat/listings/${listingID}`,
})

export const submitFoodListing = (input: FoodSubmission) => apiRequest<FoodListing>({
  path: '/api/v1/what-to-eat/listings',
  method: 'POST',
  idempotencyKey: createIdempotencyKey('what-to-eat:submission'),
  data: input,
})

export const rateFoodListing = (listingID: number, input: FoodListingRatingInput) => apiRequest<FoodListingRatingResult>({
  path: `/api/v1/what-to-eat/listings/${listingID}/rating`,
  method: 'PUT',
  idempotencyKey: createIdempotencyKey(`what-to-eat:rating:${listingID}`),
  data: input,
})

export const upsertFoodListingComment = (listingID: number, input: FoodListingCommentInput) => apiRequest<FoodListing>({
  path: `/api/v1/what-to-eat/listings/${listingID}/comment`,
  method: 'PUT',
  idempotencyKey: createIdempotencyKey(`what-to-eat:comment:${listingID}`),
  data: input,
})
