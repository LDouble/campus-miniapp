import { apiRequest, createIdempotencyKey } from './client'
import type { components } from './generated/schema'

export type FoodListing = components['schemas']['FoodListingView']
export type FoodListingRatingResult = components['schemas']['FoodListingRatingResult']
export type FoodListingPage = components['schemas']['FoodListingPage']

export type FoodSubmission = components['schemas']['FoodListingSubmissionInput']

// Keep the detail-only review shape at this boundary until the backend's
// image_media_ids contract is generated into this worktree. The generated
// schema must remain untouched in the meantime.
export type FoodListingReview = {
  score: number
  comment?: string | null
  image_urls: string[]
  created_at: string
}

export type FoodListingDetail = FoodListing & {
  reviews: FoodListingReview[]
}

export const listFoodListings = (campus: string, page = 1) => apiRequest<FoodListingPage>({
  path: '/api/v1/what-to-eat/listings',
  query: { campus, page, page_size: 20 },
})

export const pickRandomFood = (campus: string) => apiRequest<FoodListing>({
  path: '/api/v1/what-to-eat/random',
  query: { campus },
})

export const getFoodListing = async (listingID: number): Promise<FoodListingDetail> => {
  const listing = await apiRequest<FoodListing & { reviews?: FoodListingReview[] }>({
    path: `/api/v1/what-to-eat/listings/${listingID}`,
  })
  return { ...listing, reviews: listing.reviews || [] }
}

export const submitFoodListing = (input: FoodSubmission) => apiRequest<FoodListing>({
  path: '/api/v1/what-to-eat/listings',
  method: 'POST',
  idempotencyKey: createIdempotencyKey('what-to-eat:submission'),
  data: input,
})

export const rateFoodListing = (listingID: number, score: number) => apiRequest<FoodListingRatingResult>({
  path: `/api/v1/what-to-eat/listings/${listingID}/rating`,
  method: 'PUT',
  idempotencyKey: createIdempotencyKey(`what-to-eat:rating:${listingID}`),
  data: { score },
})
