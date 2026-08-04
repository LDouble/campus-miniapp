import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  MAX_CLUB_GALLERY_IMAGES,
  imageMimeFromType,
  moveGalleryImage,
  publicShareImage,
  validateClubDraft,
  validateClubImage,
} from '../src/features/clubs/model'
import type { ClubDraftForm, ClubImageDraft } from '../src/features/clubs/types'

assert.equal(imageMimeFromType('jpeg'), 'image/jpeg')
assert.equal(imageMimeFromType('WEBP'), 'image/webp')
assert.equal(imageMimeFromType('gif'), null)
assert.match(validateClubImage({ mimeType: 'image/gif', sizeBytes: 100 }), /仅支持/)
assert.match(validateClubImage({ mimeType: 'image/png', sizeBytes: 5 * 1024 * 1024 + 1 }), /5 MiB/)

const image = (mediaId: number): ClubImageDraft => ({
  key: `image-${mediaId}`,
  purpose: 'gallery',
  local_path: `wxfile://image-${mediaId}`,
  preview_url: `wxfile://image-${mediaId}`,
  mime_type: 'image/jpeg',
  size_bytes: 1024,
  width: 800,
  height: 600,
  media_id: mediaId,
  caption: '',
  sort_order: mediaId - 1,
  status: 'uploaded',
  progress: 100,
  error: '',
})

const moved = moveGalleryImage([image(1), image(2), image(3)], 1, -1)
assert.deepEqual(moved.map((item) => item.media_id), [2, 1, 3])
assert.deepEqual(moved.map((item) => item.sort_order), [0, 1, 2])

const draft: ClubDraftForm = {
  name: '海洋文化社',
  category_id: 1,
  short_name: '海文社',
  slogan: '从山海之间发现文化',
  summary: '我们关注海洋文化与校园生活，通过阅读、讲座和创作连接志同道合的同学。',
  description: '社团定期组织主题阅读、校园文化讲座与创作交流活动，欢迎对海洋、人文和校园故事感兴趣的同学关注我们的公开主页。',
  founded_year: 2020,
  supervising_unit: '校团委',
  logo_media_id: 1,
  cover_media_id: null,
  gallery: [{ media_id: 2, caption: '社团活动现场', sort_order: 0 }],
}

assert.equal(validateClubDraft(draft, [
  { ...image(1), purpose: 'logo' },
  image(2),
]), '')
assert.match(validateClubDraft({ ...draft, name: '社' }), /2–60/)
assert.match(validateClubDraft({
  ...draft,
  gallery: Array.from({ length: MAX_CLUB_GALLERY_IMAGES + 1 }, (_, index) => ({
    media_id: index + 1,
    caption: '',
    sort_order: index,
  })),
}), /最多上传 9 张/)
assert.equal(publicShareImage({
  cover: { media_id: 8, url: 'cover', width: 1, height: 1, caption: '', sort_order: 0 },
  gallery: [{ media_id: 9, url: 'gallery', width: 1, height: 1, caption: '', sort_order: 0 }],
  logo: { media_id: 7, url: 'logo', width: 1, height: 1, caption: '', sort_order: 0 },
}), 'cover')

for (const sourcePath of [
  resolve(__dirname, '../src/pages/clubs/edit.tsx'),
  resolve(__dirname, '../src/pages/clubs/mine.tsx'),
]) {
  const source = readFileSync(sourcePath, 'utf8')
  for (const match of source.matchAll(/(?:confirmText|cancelText):\s*'([^']*)'/g)) {
    assert.ok(
      Array.from(match[1]).length <= 4,
      `微信 showModal 按钮文案不能超过 4 个字符：${match[1]}`,
    )
  }
}

const clubsIndexSource = readFileSync(resolve(__dirname, '../src/pages/clubs/index.tsx'), 'utf8')
const clubsRepositorySource = readFileSync(resolve(__dirname, '../src/features/clubs/repository.ts'), 'utf8')
for (const stableSelector of [
  'club-view-card',
  'club-view-directory',
  'club-directory-index',
  'club-directory-section-',
  'club-directory-row-',
]) {
  assert.ok(clubsIndexSource.includes(stableSelector), `社团目录缺少稳定节点：${stableSelector}`)
}
assert.ok(clubsIndexSource.includes("viewMode === 'card'"), '社团广场应保留卡片视图')
assert.ok(clubsIndexSource.includes("viewMode === 'directory'"), '社团广场应提供目录视图')
assert.ok(clubsRepositorySource.includes("path: '/api/v1/clubs/directory'"), '社团目录应使用独立公开接口')

const clubDetailSource = readFileSync(resolve(__dirname, '../src/pages/clubs/detail.tsx'), 'utf8')
assert.ok(clubDetailSource.includes('getNavbarMetrics'), '大图预览顶部应使用真实状态栏与胶囊尺寸')
assert.ok(clubDetailSource.includes("id='club-viewer-close'"), '大图预览应提供稳定的关闭按钮节点')

process.stdout.write('clubs semantic smoke: ok\n')
