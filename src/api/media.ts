import { apiRequest, createIdempotencyKey } from './client'
import type { components, operations } from './generated/schema'
import { uploadFileToObjectStorage } from './object-upload'
import type { MediaImageMimeType } from '../features/media/images'

export type MediaPurpose = components['schemas']['MediaPurpose']
export type MediaUploadTarget = components['schemas']['MediaUploadTarget']
export type MediaView = components['schemas']['MediaView']
type CreateMediaUploadBody = operations['CreateMediaUploadTarget']['requestBody']['content']['application/json']
type CompleteMediaBody = operations['CompleteMedia']['requestBody']['content']['application/json']

export const createMediaUploadTarget = (input: {
  purpose: MediaPurpose
  mimeType: MediaImageMimeType
  sizeBytes: number
}) => apiRequest<MediaUploadTarget>({
  path: '/api/v1/media/upload-target',
  method: 'POST',
  data: {
    purpose: input.purpose,
    mime_type: input.mimeType,
    size: input.sizeBytes,
  } satisfies CreateMediaUploadBody,
  idempotencyKey: createIdempotencyKey(`media:${input.purpose}:upload-target`),
})

export const completeMediaUpload = (
  target: Pick<MediaUploadTarget, 'media_id' | 'version'>,
) => apiRequest<MediaView>({
  path: `/api/v1/media/${target.media_id}/complete`,
  method: 'POST',
  data: { expected_version: target.version } satisfies CompleteMediaBody,
  idempotencyKey: createIdempotencyKey(`media:${target.media_id}:complete`),
})

export const getMedia = (mediaId: number) => apiRequest<MediaView>({
  path: `/api/v1/media/${mediaId}`,
})

export const submitPrivateMessageMediaReview = (mediaId: number) => apiRequest<MediaView>({
  path: `/api/v1/media/${mediaId}/submit-review`,
  method: 'POST',
})

export const uploadMediaImage = async (input: {
  purpose: MediaPurpose
  filePath: string
  mimeType: MediaImageMimeType
  sizeBytes: number
  onProgress?: (progress: number) => void
}) => {
  const target = await createMediaUploadTarget(input)
  await uploadFileToObjectStorage(target, input.filePath, input.onProgress)
  const media = await completeMediaUpload(target)
  if (media.status !== 'ready') throw new Error('图片仍在处理中，请重试')
  return media
}
