import type {
  ClubDraftForm,
  ClubEditorialView,
  ClubImage,
  ClubImageDraft,
} from './types'

export const MAX_CLUB_GALLERY_IMAGES = 9
export const MAX_CLUB_IMAGE_BYTES = 5 * 1024 * 1024
export const CLUB_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const clubStatusMeta = {
  draft: { label: '草稿', tone: 'draft', description: '资料尚未提交审核' },
  pending_review: { label: '审核中', tone: 'pending', description: '已提交，审核结果将通过消息通知' },
  approved: { label: '已通过', tone: 'approved', description: '当前版本已通过审核' },
  rejected: { label: '需修改', tone: 'rejected', description: '请根据审核说明修改后重新提交' },
  unpublished: { label: '未发布', tone: 'draft', description: '通过首次审核后将公开展示' },
  published: { label: '已发布', tone: 'approved', description: '社团主页已公开展示' },
  suspended: { label: '已下架', tone: 'rejected', description: '当前主页暂不可公开访问' },
} as const

export const imageMimeFromType = (type?: string) => {
  const normalized = String(type || '').toLowerCase()
  if (normalized === 'png') return 'image/png' as const
  if (normalized === 'webp') return 'image/webp' as const
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg' as const
  return null
}

export const validateClubImage = (input: {
  mimeType: string | null
  sizeBytes: number
}) => {
  if (!input.mimeType || !CLUB_IMAGE_MIME_TYPES.includes(
    input.mimeType as typeof CLUB_IMAGE_MIME_TYPES[number],
  )) return '仅支持 JPEG、PNG 或 WebP 图片'
  if (input.sizeBytes <= 0) return '图片文件无效，请重新选择'
  if (input.sizeBytes > MAX_CLUB_IMAGE_BYTES) return '单张图片不能超过 5 MiB'
  return ''
}

export const normalizeGalleryOrder = (
  images: ClubImageDraft[],
): ClubImageDraft[] => images.map((image, index) => ({
  ...image,
  sort_order: index,
}))

export const moveGalleryImage = (
  images: ClubImageDraft[],
  index: number,
  direction: -1 | 1,
) => {
  const target = index + direction
  if (index < 0 || index >= images.length || target < 0 || target >= images.length) {
    return normalizeGalleryOrder(images)
  }
  const next = [...images]
  const current = next[index]
  next[index] = next[target]
  next[target] = current
  return normalizeGalleryOrder(next)
}

const textLength = (value?: string | null) => String(value || '').trim().length

export const validateClubDraft = (
  input: ClubDraftForm,
  imageDrafts: ClubImageDraft[] = [],
) => {
  const nameLength = textLength(input.name)
  if (nameLength < 2 || nameLength > 60) return '社团名称需为 2–60 个字'
  if (!input.category_id) return '请选择社团分类'
  if (textLength(input.short_name) > 20) return '社团简称不能超过 20 个字'
  if (textLength(input.slogan) > 80) return '宣传口号不能超过 80 个字'
  const summaryLength = textLength(input.summary)
  if (summaryLength < 20 || summaryLength > 200) return '社团简介需为 20–200 个字'
  const descriptionLength = textLength(input.description)
  if (descriptionLength < 50 || descriptionLength > 5000) return '详细介绍需为 50–5000 个字'
  if (textLength(input.supervising_unit) > 100) return '指导或挂靠单位不能超过 100 个字'
  const currentYear = new Date().getFullYear()
  if (
    input.founded_year !== null
    && (input.founded_year < 1900 || input.founded_year > currentYear)
  ) return `成立年份需为 1900–${currentYear}`
  if (!input.logo_media_id) return '请先上传社团 Logo'
  if (input.gallery.length > MAX_CLUB_GALLERY_IMAGES) return '宣传图片最多上传 9 张'
  if (input.gallery.some((image) => textLength(image.caption) > 60)) {
    return '单张宣传图片说明不能超过 60 个字'
  }
  if (imageDrafts.some((image) => image.status === 'uploading')) return '图片仍在上传，请稍候'
  if (imageDrafts.some((image) => image.status === 'failed')) return '有图片上传失败，请重试或删除'
  if (imageDrafts.some((image) => image.status !== 'uploaded' || !image.media_id)) {
    return '请等待所有图片上传完成'
  }
  return ''
}

export const publicShareImage = (input: {
  cover: ClubImage | null
  gallery: ClubImage[]
  logo: ClubImage | null
}) => input.cover?.url || input.gallery[0]?.url || input.logo?.url || ''

export const activeRevision = (club: ClubEditorialView) => (
  club.working_revision || club.published_revision
)

export const editableClub = (club: ClubEditorialView) => (
  club.available_actions.includes('edit')
)
