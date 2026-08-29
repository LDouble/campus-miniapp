import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import BottomSheet from '../../components/bottom-sheet'
import CustomNavbar from '../../components/custom-navbar'
import MediaImageEditor from '../../components/media-image-editor'
import { KeyboardSafeTextarea } from '../../components/keyboard-safe-input'
import { getMiniappRuntimeConfig, getSelectedCampus } from '../../features/runtime-config'
import {
  getFoodListing,
  rateFoodListing,
  upsertFoodListingComment,
  type FoodListing,
  type FoodListingReview,
} from '../../api/what-to-eat'
import { isApiError } from '../../api/client'
import { uploadMediaImage } from '../../api/media'
import {
  DEFAULT_MEDIA_IMAGE_QUALITY,
  MAX_PUBLISH_IMAGES,
  mediaImageValidationError,
  moveMediaImage,
} from '../../features/media/images'
import type { MediaImageDraft } from '../../features/media/images'
import { chooseMediaImages } from '../../features/media/selection'
import { useCampusShare } from '../../features/share'
import StarRating from './star-rating'
import './detail.scss'

const imageIcon = require('../../assets/icons/image.svg')
const recommendIcon = require('../../assets/icons/recommend.svg')

const REVIEW_IMAGE_MAX_DIMENSION = 1280

const RATING_OPTIONS = [
  { label: '不满意', description: '这次体验还有待改进' },
  { label: '一般', description: '中规中矩，可以更好' },
  { label: '还不错', description: '味道和体验都还可以' },
  { label: '满意', description: '值得推荐给同学' },
  { label: '超赞', description: '下次还会再来' },
] as const

const errorMessage = (error: unknown) => (
  isApiError(error) ? error.message : '加载失败，请稍后再试'
)

const formatReviewDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const previewImages = (urls: string[], current: string) => {
  if (!current || !urls.length) return
  void Taro.previewImage({ current, urls })
}

const imageErrorMessage = (error: unknown) => (
  isApiError(error) ? error.message : error instanceof Error ? error.message : '图片上传失败，请重试'
)

const formatRatingValue = (value: number) => value > 0 ? value.toFixed(1) : '—'

export default function FoodDetailPage() {
  const { params } = useRouter()
  const campus = getSelectedCampus(getMiniappRuntimeConfig())
  const [item, setItem] = useState<FoodListing>()
  const [reviews, setReviews] = useState<FoodListingReview[]>([])
  const [error, setError] = useState('')
  const [ratingScore, setRatingScore] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewImages, setReviewImages] = useState<MediaImageDraft[]>([])
  const [reviewSheetVisible, setReviewSheetVisible] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const listingId = Number(params.id)
  const listingImageUrls = item?.image_urls || []
  const selectedRatingOption = ratingScore > 0 ? RATING_OPTIONS[ratingScore - 1] : undefined

  useCampusShare(() => ({
    title: item ? `${item.name}｜${item.campus}` : '校园餐饮详情',
    path: '/pages/what-to-eat/detail',
    query: { id: Number.isFinite(listingId) && listingId > 0 ? listingId : undefined },
    imageUrl: listingImageUrls[0],
  }))

  useEffect(() => {
    setError('')
    setItem(undefined)
    setReviews([])
    setRatingScore(0)
    setReviewComment('')
    setReviewImages([])
    setReviewSheetVisible(false)
    void getFoodListing(Number(params.id)).then((nextItem) => {
      setItem(nextItem)
      setReviews(nextItem.reviews)
      setRatingScore(nextItem.viewer_rating || 0)
    }).catch((nextError) => setError(errorMessage(nextError)))
  }, [campus, params.id])

  useEffect(() => {
    if (item && params.review === '1') setReviewSheetVisible(true)
  }, [item, params.review])

  const updateReviewImage = (
    key: string,
    updater: (image: MediaImageDraft) => MediaImageDraft,
  ) => {
    setReviewImages((current) => current.map((image) => image.key === key ? updater(image) : image))
  }

  const uploadReviewImage = async (image: MediaImageDraft) => {
    if (!image.localPath) return
    updateReviewImage(image.key, (current) => ({
      ...current,
      status: 'uploading',
      progress: 0,
      error: '',
    }))
    try {
      const uploaded = await uploadMediaImage({
        purpose: 'what_to_eat',
        filePath: image.localPath,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        onProgress: (progress) => updateReviewImage(image.key, (current) => ({
          ...current,
          status: 'uploading',
          progress,
        })),
      })
      updateReviewImage(image.key, (current) => ({
        ...current,
        mediaId: uploaded.id,
        width: uploaded.width || current.width,
        height: uploaded.height || current.height,
        status: 'uploaded',
        progress: 100,
        error: '',
      }))
    } catch (uploadError) {
      const message = imageErrorMessage(uploadError)
      updateReviewImage(image.key, (current) => ({
        ...current,
        status: 'failed',
        error: message,
      }))
      Taro.showToast({ title: message, icon: 'none' })
    }
  }

  const chooseReviewImages = async () => {
    const available = MAX_PUBLISH_IMAGES - reviewImages.length
    if (available <= 0) {
      Taro.showToast({ title: `评价图片最多 ${MAX_PUBLISH_IMAGES} 张`, icon: 'none' })
      return
    }
    try {
      const selected = await chooseMediaImages({
        count: available,
        maxDimension: REVIEW_IMAGE_MAX_DIMENSION,
        quality: DEFAULT_MEDIA_IMAGE_QUALITY,
      })
      if (!selected.length) return
      setReviewImages((current) => [...current, ...selected].slice(0, MAX_PUBLISH_IMAGES))
      selected.forEach((image) => { void uploadReviewImage(image) })
    } catch (nextError) {
      Taro.showToast({
        title: nextError instanceof Error ? nextError.message : '图片选择失败，请重试',
        icon: 'none',
      })
    }
  }

  const openReviewSheet = (nextRating?: number) => {
    if (nextRating) setRatingScore(nextRating)
    setReviewSheetVisible(true)
  }

  const closeReviewSheet = () => {
    if (reviewSubmitting) return
    setReviewSheetVisible(false)
  }

  const submitReview = async () => {
    if (!item || reviewSubmitting) return
    const comment = reviewComment.trim()
    if (!ratingScore && !comment) {
      Taro.showToast({ title: '请先评分或输入留言', icon: 'none' })
      return
    }
    if (reviewImages.length > 0 && !comment) {
      Taro.showToast({ title: '请先输入评价内容再上传图片', icon: 'none' })
      return
    }
    if (comment) {
      const imageError = mediaImageValidationError(reviewImages, MAX_PUBLISH_IMAGES)
      if (imageError) {
        Taro.showToast({ title: imageError, icon: 'none' })
        return
      }
    }
    setReviewSubmitting(true)
    try {
      let updatedItem = item
      if (ratingScore) {
        const updatedRating = await rateFoodListing(item.id, { score: ratingScore })
        updatedItem = {
          ...updatedItem,
          rating_average: updatedRating.rating_average,
          rating_count: updatedRating.rating_count,
          viewer_rating: updatedRating.score,
        }
        setItem(updatedItem)
        setRatingScore(updatedRating.score)
      }
      if (comment) {
        const imageMediaIds = reviewImages.flatMap((image) => image.mediaId ? [image.mediaId] : [])
        updatedItem = await upsertFoodListingComment(item.id, {
          comment,
          ...(imageMediaIds.length ? { image_media_ids: imageMediaIds } : {}),
        })
      }
      setItem(updatedItem)
      setReviews(updatedItem.reviews)
      setRatingScore((current) => updatedItem.viewer_rating ?? current)
      setReviewComment('')
      setReviewImages([])
      setReviewSheetVisible(false)
      Taro.showToast({
        title: ratingScore && comment ? '评价已提交' : ratingScore ? '评分已更新' : '留言已保存',
        icon: 'success',
      })
    } catch (nextError) {
      Taro.showToast({ title: errorMessage(nextError), icon: 'none' })
    } finally {
      setReviewSubmitting(false)
    }
  }

  return (
    <View className='food-detail-page'>
      <CustomNavbar
        title='餐饮详情'
        showBack
      />
      {error ? (
        <View className='food-detail-state'>{error}</View>
      ) : item ? (
        <>
          {listingImageUrls[0] && (
            <View className='food-detail-cover' ariaLabel={`${item.name}封面图片`}>
              <Image
                className='food-detail-cover__image'
                src={listingImageUrls[0]}
                mode='aspectFill'
                ariaLabel={`查看${item.name}封面图片`}
                onClick={() => previewImages(listingImageUrls, listingImageUrls[0])}
              />
              <View className='food-detail-cover__shade' />
              <View className='food-detail-cover__tags'>
                {item.promoted && <Text className='food-detail-cover__tag food-detail-cover__tag--promoted'>推广</Text>}
                {item.tags.slice(0, 2).map((tag) => <Text key={tag} className='food-detail-cover__tag'>{tag}</Text>)}
              </View>
              <View className='food-detail-cover__count'>
                <Image src={imageIcon} mode='aspectFit' ariaLabel='图片数量' />
                <Text>{listingImageUrls.length} 张图片</Text>
              </View>
            </View>
          )}
          <View className={`food-detail-content ${listingImageUrls[0] ? '' : 'food-detail-content--without-cover'}`}>
            <View className='food-detail-info'>
              <View className='food-detail-info__heading'>
                <Text className='food-detail-info__name'>{item.name}</Text>
                {item.category && <Text className='food-detail-info__category'>{item.category}</Text>}
              </View>
              <View
                className='food-detail-info__rating-row'
                ariaRole='button'
                ariaLabel={`点击星星评分，当前${formatRatingValue(item.rating_average)}分`}
                hoverClass='food-detail-info__rating-row--pressed'
                onClick={() => openReviewSheet()}
              >
                <Text className='food-detail-info__rating'>{formatRatingValue(item.rating_average)}</Text>
                <StarRating value={item.rating_average} size='sm' label='综合评分' />
                <Text className='food-detail-info__rating-count'>({item.rating_count || 0}条评价)</Text>
              </View>
            </View>

            {(item.tags.length > 0 || item.description) && (
              <View className='food-detail-card food-detail-card--recommendation'>
                <View className='food-detail-card__heading'>
                  <Image className='food-detail-card__heading-icon' src={recommendIcon} mode='aspectFit' ariaLabel='推荐理由' />
                  <Text>推荐理由</Text>
                </View>
                {item.tags.length > 0 && (
                  <View className='food-detail-tags'>
                    {item.tags.map((tag) => <Text key={tag} className='food-detail-tag'>{tag}</Text>)}
                  </View>
                )}
                {item.description && (
                  <View className='food-detail-reasons'>
                    <View className='food-detail-reason'>
                      <View className='food-detail-reason__dot' />
                      <Text className='food-detail-card__body'>{item.description}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            <View className='food-detail-review-section'>
              <View className='food-detail-section-head'>
                <View>
                  <Text>用户评价</Text>
                </View>
                <Text className='food-detail-section-head__more'>
                  {reviews.length > 0 ? `${reviews.length} 条留言` : '等待第一条'}
                </Text>
              </View>
              {reviews.length > 0 ? (
                <View className='food-detail-reviews'>
                  {reviews.map((review, index) => (
                    <ReviewCard key={`${review.created_at}-${index}`} review={review} />
                  ))}
                </View>
              ) : (
                <View className='food-detail-empty-review'>暂时没有评价，来留下第一条吧。</View>
              )}
            </View>
          </View>
          <View className='food-detail-comment-bar'>
            <View
              className='food-detail-comment-bar__trigger'
              ariaRole='button'
              ariaLabel='打开评价输入'
              hoverClass='food-detail-comment-bar__trigger--pressed'
              onClick={() => openReviewSheet()}
            >
              <Text>{reviewComment.trim() ? '继续编辑你的评价' : '写下你的真实体验'}</Text>
            </View>
          </View>
          <BottomSheet
            visible={reviewSheetVisible}
            title='写评价'
            expanded
            closeLabel='取消'
            onClose={closeReviewSheet}
            footer={(
              <View className='food-detail-review-sheet__footer'>
                <Button
                  className='food-detail-review-sheet__submit'
                  hoverClass='food-detail-review-sheet__submit--pressed'
                  loading={reviewSubmitting}
                  disabled={(!ratingScore && !reviewComment.trim()) || reviewSubmitting}
                  onClick={() => void submitReview()}
                >
                  提交评价
                </Button>
              </View>
            )}
          >
            <View className='food-detail-review-sheet__content'>
              <View className='food-detail-review-sheet__listing'>
                <Text className='food-detail-review-sheet__listing-label'>正在评价</Text>
                <Text className='food-detail-review-sheet__listing-name'>{item.name}</Text>
              </View>
              <View className='food-detail-review-sheet__rating' ariaLabel='选择本次餐饮评分'>
                <Text className='food-detail-review-sheet__rating-eyebrow'>这次体验怎么样？</Text>
                <View className='food-detail-review-sheet__rating-picker'>
                  <StarRating
                    value={ratingScore}
                    size='lg'
                    interactive
                    disabled={reviewSubmitting}
                    label='选择评分'
                    onChange={setRatingScore}
                  />
                </View>
                <Text className={`food-detail-review-sheet__rating-result ${selectedRatingOption ? 'food-detail-review-sheet__rating-result--active' : ''}`}>
                  {selectedRatingOption ? `${selectedRatingOption.label} · ${selectedRatingOption.description}` : '点击星星完成评分'}
                </Text>
              </View>
              <View className='food-detail-review-sheet__comment'>
                <View className='food-detail-review-sheet__field-head'>
                  <Text>说说你的体验</Text>
                  <Text>选填</Text>
                </View>
                <KeyboardSafeTextarea
                  id='food-detail-review-sheet-textarea'
                  className='food-detail-review-sheet__textarea'
                  value={reviewComment}
                  maxlength={1000}
                  placeholder='味道、分量、价格……都可以聊聊'
                  autoHeight
                  focus={false}
                  nativeAdjustPosition
                  keepVisibleOnKeyboard={false}
                  onInput={(event) => setReviewComment(event.detail.value)}
                />
                <View className='food-detail-review-sheet__toolbar'>
                  <View
                    className='food-detail-review-sheet__add-image'
                    ariaRole='button'
                    ariaLabel='添加评价图片'
                    hoverClass='food-detail-review-sheet__add-image--pressed'
                    onClick={() => void chooseReviewImages()}
                  >
                    <Image src={imageIcon} mode='aspectFit' ariaLabel='添加图片' />
                    <Text>添加图片</Text>
                  </View>
                  <Text className='food-detail-review-sheet__counter'>{reviewComment.length}/1000</Text>
                </View>
              </View>
              {reviewImages.length > 0 && (
                <MediaImageEditor
                  images={reviewImages}
                  maxCount={MAX_PUBLISH_IMAGES}
                  title='评价图片'
                  hint='上传完成后随评价提交'
                  showCover={false}
                  onAdd={() => void chooseReviewImages()}
                  onMove={(index, direction) => setReviewImages((current) => moveMediaImage(current, index, direction))}
                  onRemove={(key) => setReviewImages((current) => current.filter((image) => image.key !== key))}
                  onRetry={(image) => void uploadReviewImage(image)}
                />
              )}
            </View>
          </BottomSheet>
        </>
      ) : (
        <View className='food-detail-state'>加载中…</View>
      )}
    </View>
  )
}

function ReviewCard({ review }: { review: FoodListingReview }) {
  return (
    <View className='food-detail-review-card'>
      <View className='food-detail-review-card__head'>
        <View className='food-detail-review-card__author-info'>
          <View className='food-detail-review-card__avatar' ariaLabel='匿名用户头像'>
            <Text>匿</Text>
          </View>
          <View className='food-detail-review-card__author-copy'>
            <Text className='food-detail-review-card__author'>匿名同学</Text>
            <Text className='food-detail-review-card__date'>{formatReviewDate(review.created_at)}</Text>
          </View>
        </View>
      </View>
      <Text className='food-detail-review-card__comment'>{review.comment}</Text>
      {review.image_urls.length > 0 && (
        <View className='food-detail-review-card__images'>
          {review.image_urls.map((imageUrl, index) => (
            <Image
              key={`${imageUrl}-${index}`}
              src={imageUrl}
              mode='aspectFill'
              ariaLabel={`评价图片 ${index + 1}`}
              onClick={() => previewImages(review.image_urls, imageUrl)}
            />
          ))}
        </View>
      )}
    </View>
  )
}
