import { apiRequest, createIdempotencyKey } from '../../api/client'
import { uploadFileToObjectStorage } from '../../api/object-upload'
import type { operations } from '../../api/generated/schema'
import type {
  ClubCategory,
  ClubDetail,
  ClubDirectory,
  ClubDraftContentInput,
  ClubCreateInput,
  ClubEditorialView,
  ClubMediaComplete,
  ClubMediaPurpose,
  ClubMediaUploadTarget,
  ClubPage,
  ClubEditorialPage,
  ClubMediaUploadInput,
  CompleteClubMediaInput,
  SubmitClubReviewInput,
} from './types'

type ListClubsQuery = NonNullable<operations['ListClubs']['parameters']['query']>
type ListClubDirectoryQuery = NonNullable<operations['ListClubDirectory']['parameters']['query']>

export const clubsRepository = {
  listCategories: () => apiRequest<ClubCategory[]>({
    path: '/api/v1/club-categories',
  }),

  listPublic: (query: {
    keyword?: string
    categoryId?: number
    page: number
    pageSize: number
  }) => apiRequest<ClubPage>({
    path: '/api/v1/clubs',
    query: {
      keyword: query.keyword,
      category_id: query.categoryId,
      page: query.page,
      page_size: query.pageSize,
    } satisfies ListClubsQuery,
  }),

  listDirectory: (query: {
    keyword?: string
    categoryId?: number
  }) => apiRequest<ClubDirectory>({
    path: '/api/v1/clubs/directory',
    query: {
      keyword: query.keyword,
      category_id: query.categoryId,
    } satisfies ListClubDirectoryQuery,
  }),

  getPublic: (clubId: number) => apiRequest<ClubDetail>({
    path: `/api/v1/clubs/${clubId}`,
  }),

  listMine: () => apiRequest<ClubEditorialPage>({
    path: '/api/v1/clubs/mine',
    query: { page: 1, page_size: 100 },
  }),

  getEditor: (clubId: number) => apiRequest<ClubEditorialView>({
    path: `/api/v1/clubs/${clubId}/editor`,
  }),

  create: (draft: ClubCreateInput) => apiRequest<ClubEditorialView>({
    path: '/api/v1/clubs',
    method: 'POST',
    data: draft,
    idempotencyKey: createIdempotencyKey('club-create'),
  }),

  updateDraft: (
    clubId: number,
    draft: ClubDraftContentInput,
    expectedVersion: number,
  ) => apiRequest<ClubEditorialView>({
    path: `/api/v1/clubs/${clubId}/draft`,
    method: 'PATCH',
    data: { ...draft, expected_version: expectedVersion } satisfies operations['UpdateClubDraft']['requestBody']['content']['application/json'],
    idempotencyKey: createIdempotencyKey(`club-${clubId}-draft`),
  }),

  submitReview: (clubId: number, expectedVersion: number) => (
    apiRequest<ClubEditorialView>({
      path: `/api/v1/clubs/${clubId}/submit-review`,
      method: 'POST',
      data: { expected_version: expectedVersion } satisfies SubmitClubReviewInput,
      idempotencyKey: createIdempotencyKey(`club-${clubId}-submit`),
    })
  ),

  uploadImage: async (input: {
    filePath: string
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
    sizeBytes: number
    width: number
    height: number
    purpose: ClubMediaPurpose
    onProgress?: (progress: number) => void
  }) => {
    const target = await apiRequest<ClubMediaUploadTarget>({
      path: '/api/v1/clubs/media/upload-target',
      method: 'POST',
      data: {
        mime_type: input.mimeType,
        size: input.sizeBytes,
        purpose: input.purpose,
      } satisfies ClubMediaUploadInput,
      idempotencyKey: createIdempotencyKey(`club-${input.purpose}-upload`),
    })
    await uploadFileToObjectStorage(target, input.filePath, input.onProgress)
    return apiRequest<ClubMediaComplete>({
      path: `/api/v1/clubs/media/${target.media_id}/complete`,
      method: 'POST',
      data: { expected_version: 1 } satisfies CompleteClubMediaInput,
      idempotencyKey: createIdempotencyKey(`club-media-${target.media_id}-complete`),
    })
  },
}
