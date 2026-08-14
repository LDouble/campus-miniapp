import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  MAX_MEDIA_IMAGE_BYTES,
  mediaImageMimeFromType,
  mediaImageValidationError,
  moveMediaImage,
  serverMediaImageDraft,
  validateMediaImage,
} from '../src/features/media/images'

assert.equal(mediaImageMimeFromType('JPG'), 'image/jpeg')
assert.equal(mediaImageMimeFromType('webp'), null)
assert.equal(mediaImageMimeFromType('gif'), null)
assert.match(validateMediaImage({ mimeType: 'image/gif', sizeBytes: 100 }), /仅支持/)
assert.match(validateMediaImage({ mimeType: 'image/webp', sizeBytes: 100 }), /仅支持/)
assert.match(validateMediaImage({
  mimeType: 'image/png',
  sizeBytes: MAX_MEDIA_IMAGE_BYTES + 1,
}), /5 MiB/)

const images = ['one', 'two', 'three'].map((url) => serverMediaImageDraft({ url }))
assert.deepEqual(moveMediaImage(images, 1, -1).map((item) => item.legacyUrl), [
  'two',
  'one',
  'three',
])
assert.deepEqual(moveMediaImage(images, 0, -1), images)
assert.equal(mediaImageValidationError(images), '')
const persistedMedia = serverMediaImageDraft({ url: 'signed-preview', mediaId: 42 })
assert.equal(persistedMedia.mediaId, 42)
assert.equal(persistedMedia.legacyUrl, '')
assert.match(mediaImageValidationError([
  { ...images[0], status: 'failed', error: 'timeout' },
]), /重试或删除/)
assert.match(mediaImageValidationError([
  { ...images[0], status: 'uploading', progress: 25 },
]), /上传/)
assert.match(mediaImageValidationError([
  images[0],
  persistedMedia,
]), /不能混用/)

const mediaApiSource = readFileSync(resolve(__dirname, '../src/api/media.ts'), 'utf8')
assert.ok(mediaApiSource.includes("path: '/api/v1/media/upload-target'"))
assert.ok(mediaApiSource.includes('uploadFileToObjectStorage(target'))
assert.ok(mediaApiSource.includes('expected_version: target.version'))
assert.ok(mediaApiSource.includes("media.status !== 'ready'"))

const publishSource = readFileSync(resolve(__dirname, '../src/pages/publish/index.tsx'), 'utf8')
assert.ok(publishSource.includes('<MediaImageEditor'))
assert.ok(publishSource.includes('media_ids: form.images.flatMap'))
assert.ok(publishSource.includes('image_urls: form.images.flatMap'))
assert.ok(publishSource.includes("purpose = section === 'market' ? 'marketplace' : 'community'"))
assert.ok(publishSource.includes("LEGACY_DRAFT_KEY = 'lifePublisher.drafts.v3'"))
assert.ok(publishSource.includes('Taro.removeStorageSync(LEGACY_DRAFT_KEY)'))
assert.ok(publishSource.includes("title: '替换原图片'"))

const profileSource = readFileSync(resolve(__dirname, '../src/pages/profile/index.tsx'), 'utf8')
assert.ok(profileSource.includes('cropSquare: true'))
assert.ok(profileSource.includes("purpose: 'avatar'"))
assert.ok(profileSource.includes('updateCurrentAvatar(mediaId)'))
const accountSource = readFileSync(resolve(__dirname, '../src/api/account.ts'), 'utf8')
assert.ok(accountSource.includes('avatar_media_id: mediaId'))

process.stdout.write('media images semantic smoke: ok\n')
