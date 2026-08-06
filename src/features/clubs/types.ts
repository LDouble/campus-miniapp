import type { components, operations } from '../../api/generated/schema'

export type ClubRevisionStatus = components['schemas']['ClubRevisionStatus']
export type ClubVisibilityStatus = components['schemas']['ClubVisibilityStatus']
export type ClubAvailableAction = components['schemas']['ClubAvailableAction']
export type ClubCategory = components['schemas']['ClubCategory']
export type ClubImage = components['schemas']['ClubGalleryImage']
export type ClubSummary = components['schemas']['ClubSummary']
export type ClubDirectoryItem = components['schemas']['ClubDirectoryItem']
export type ClubDirectoryBucket = components['schemas']['ClubDirectoryBucket']
export type ClubDirectoryIndex = components['schemas']['ClubDirectoryIndex']
export type ClubDirectoryPage = components['schemas']['ClubDirectoryPage']
export type ClubDetail = components['schemas']['ClubDetail']
export type ClubRevision = components['schemas']['ClubRevisionView']
export type ClubEditorialView = components['schemas']['ClubEditorialView']
export type ClubPage = components['schemas']['ClubPage']
export type ClubEditorialPage = components['schemas']['ClubEditorialPage']
export type ClubCreateInput = operations['CreateClub']['requestBody']['content']['application/json']
export type ClubContentInput = components['schemas']['ClubContentInput']
export type ClubUpdateInput = operations['UpdateClubDraft']['requestBody']['content']['application/json']
export type ClubDraftContentInput = Omit<ClubUpdateInput, 'expected_version'>
export type ClubMediaPurpose = components['schemas']['ClubMediaUploadInput']['purpose']
export type ClubMediaUploadInput = operations['CreateClubMediaUploadTarget']['requestBody']['content']['application/json']
export type ClubMediaUploadTarget = components['schemas']['ClubUploadTarget']
export type ClubMediaComplete = components['schemas']['ClubMediaView']
export type CompleteClubMediaInput = operations['CompleteClubMedia']['requestBody']['content']['application/json']
export type SubmitClubReviewInput = operations['SubmitClubReview']['requestBody']['content']['application/json']

export type ClubDraftForm = Omit<ClubCreateInput,
  'cover_media_id' | 'founded_year' | 'short_name' | 'slogan' | 'supervising_unit'
> & {
  cover_media_id: number | null
  founded_year: number | null
  short_name: string
  slogan: string
  supervising_unit: string
}

export type ClubImageUploadStatus = 'ready' | 'uploading' | 'uploaded' | 'failed'

export type ClubImageDraft = {
  key: string
  purpose: ClubMediaPurpose
  local_path: string
  preview_url: string
  mime_type: ClubMediaUploadInput['mime_type']
  size_bytes: number
  width: number
  height: number
  media_id?: number
  caption: string
  sort_order: number
  status: ClubImageUploadStatus
  progress: number
  error: string
}
