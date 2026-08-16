import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AVATAR_IMAGE_MAX_DIMENSION,
  AVATAR_IMAGE_QUALITY,
  MAX_MEDIA_IMAGE_BYTES,
  mediaImageMimeFromType,
  mediaImageValidationError,
  moveMediaImage,
  serverMediaImageDraft,
  scaledMediaImageDimensions,
  validateMediaImage,
} from '../src/features/media/images'

assert.equal(AVATAR_IMAGE_MAX_DIMENSION, 512)
assert.equal(AVATAR_IMAGE_QUALITY, 80)
assert.equal(scaledMediaImageDimensions({ width: 256, height: 256, maxDimension: 512 }), null)
assert.equal(scaledMediaImageDimensions({ width: 512, height: 512, maxDimension: 512 }), null)
assert.deepEqual(
  scaledMediaImageDimensions({ width: 2000, height: 2000, maxDimension: 512 }),
  { width: 512, height: 512 },
)
assert.deepEqual(
  scaledMediaImageDimensions({ width: 1024, height: 768, maxDimension: 512 }),
  { width: 512, height: 384 },
)

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

const publishSource = readFileSync(resolve(__dirname, '../src/packages/social/publish/index.tsx'), 'utf8')
assert.ok(publishSource.includes('<MediaImageEditor'))
assert.ok(publishSource.includes("form.images.length > 0 && ("))
assert.ok(publishSource.includes('form.images.length >= MAX_PUBLISH_IMAGES'))
assert.ok(publishSource.includes("require('../../../assets/icons/image.svg')"))
assert.ok(!publishSource.includes('<Text>▧</Text>'))
assert.ok(publishSource.includes('media_ids: form.images.flatMap'))
assert.ok(publishSource.includes('image_urls: form.images.flatMap'))
assert.ok(publishSource.includes("purpose = section === 'market' ? 'marketplace' : 'community'"))
assert.ok(publishSource.includes("LEGACY_DRAFT_KEY = 'lifePublisher.drafts.v3'"))
assert.ok(publishSource.includes('Taro.removeStorageSync(LEGACY_DRAFT_KEY)'))
assert.ok(publishSource.includes("title: '替换原图片'"))

const mediaEditorSource = readFileSync(resolve(__dirname, '../src/components/media-image-editor/index.tsx'), 'utf8')
assert.ok(mediaEditorSource.includes('if (images.length === 0) return null'))
assert.ok(mediaEditorSource.includes('images.length < maxCount'))
assert.ok(mediaEditorSource.includes('上传失败 · 重试'))
assert.ok(!mediaEditorSource.includes('WebP'))

const profileSource = readFileSync(resolve(__dirname, '../src/pages/profile/index.tsx'), 'utf8')
assert.ok(profileSource.includes('cropSquare: true'))
assert.ok(profileSource.includes('maxDimension: AVATAR_IMAGE_MAX_DIMENSION'))
assert.ok(profileSource.includes('quality: AVATAR_IMAGE_QUALITY'))
assert.ok(profileSource.includes("purpose: 'avatar'"))
assert.ok(profileSource.includes('updateCurrentAvatar(mediaId)'))
const accountSource = readFileSync(resolve(__dirname, '../src/api/account.ts'), 'utf8')
assert.ok(accountSource.includes('avatar_media_id: mediaId'))

const selectionSource = readFileSync(resolve(__dirname, '../src/features/media/selection.ts'), 'utf8')
assert.ok(selectionSource.includes('compressedWidth: dimensions.width'))
assert.ok(selectionSource.includes('compressedHeight: dimensions.height'))

const communityDetailSource = readFileSync(resolve(__dirname, '../src/packages/social/community/detail.tsx'), 'utf8')
const communityDetailStyleSource = readFileSync(resolve(__dirname, '../src/packages/social/community/detail.scss'), 'utf8')
assert.ok(communityDetailSource.includes("'community-detail-card__images community-detail-card__images--single'"))
assert.ok(communityDetailSource.includes("mode={post.images.length === 1 ? 'widthFix' : 'aspectFill'}"))
assert.match(communityDetailSource, /ariaLabel=\{image\.url \? `预览第 \$\{index \+ 1\} 张图片，共 \$\{post\.images\.length\} 张` : undefined\}/u)
assert.match(communityDetailSource, /Taro\.previewImage\(\{[\s\S]*?current,[\s\S]*?urls,/u)
assert.match(communityDetailStyleSource, /&__images \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/u)
assert.match(communityDetailStyleSource, /&__images \{[\s\S]*?&--single \{[\s\S]*?max-width: 560rpx;/u)
assert.match(communityDetailStyleSource, /&__image-frame \{[\s\S]*?height: 210rpx;/u)
assert.match(communityDetailStyleSource, /&__images--single \.community-detail-card__image-frame \{[\s\S]*?height: auto;/u)
assert.match(communityDetailStyleSource, /&__images--single \.community-detail-card__image-frame image \{[\s\S]*?height: auto;/u)
assert.match(communityDetailStyleSource, /&__image-reviewing \{[\s\S]*?min-height: 210rpx;/u)
assert.match(communityDetailStyleSource, /&__images--single \.community-detail-card__image-reviewing \{[\s\S]*?min-height: 320rpx;/u)
assert.match(communityDetailStyleSource, /&__images--single \.community-detail-card__image-reviewing--overlay \{[\s\S]*?min-height: 0;/u)

process.stdout.write('media images semantic smoke: ok\n')
