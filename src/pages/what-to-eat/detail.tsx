import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
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
import './detail.scss'

const imageIcon = require('../../assets/icons/image.svg')

const REVIEW_IMAGE_MAX_DIMENSION = 1280

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

export default function FoodDetailPage() {
  const { params } = useRouter()
  const campus = getSelectedCampus(getMiniappRuntimeConfig())
  const [item, setItem] = useState<FoodListing>()
  const [reviews, setReviews] = useState<FoodListingReview[]>([])
  const [error, setError] = useState('')
  const [ratingScore, setRatingScore] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewImages, setReviewImages] = useState<MediaImageDraft[]>([])
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [commentSubmitting, setCommentSubmitting] = useState(false)

  useEffect(() => {
    setError('')
    setItem(undefined)
    setReviews([])
    setRatingScore(0)
    setReviewComment('')
    setReviewImages([])
    void getFoodListing(Number(params.id)).then((nextItem) => {
      setItem(nextItem)
      setReviews(nextItem.reviews)
      setRatingScore(nextItem.viewer_rating || 0)
    }).catch((nextError) => setError(errorMessage(nextError)))
  }, [campus, params.id])

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

  const submitRating = async () => {
    if (!item || !ratingScore || ratingSubmitting) {
      if (!ratingScore) Taro.showToast({ title: '请先选择评分', icon: 'none' })
      return
    }
    setRatingSubmitting(true)
    try {
      const updated = await rateFoodListing(item.id, { score: ratingScore })
      setItem((current) => current ? {
        ...current,
        rating_average: updated.rating_average,
        rating_count: updated.rating_count,
        viewer_rating: updated.score,
      } : current)
      setRatingScore(updated.score)
      Taro.showToast({ title: '评分已更新', icon: 'success' })
    } catch (nextError) {
      Taro.showToast({ title: errorMessage(nextError), icon: 'none' })
    } finally {
      setRatingSubmitting(false)
    }
  }

  const submitComment = async () => {
    if (!item || commentSubmitting) return
    const comment = reviewComment.trim()
    if (!comment) {
      Taro.showToast({ title: '请输入留言内容', icon: 'none' })
      return
    }
    const imageError = mediaImageValidationError(reviewImages, MAX_PUBLISH_IMAGES)
    if (imageError) {
      Taro.showToast({ title: imageError, icon: 'none' })
      return
    }
    setCommentSubmitting(true)
    try {
      const imageMediaIds = reviewImages.flatMap((image) => image.mediaId ? [image.mediaId] : [])
      const updated = await upsertFoodListingComment(item.id, {
        comment,
        ...(imageMediaIds.length ? { image_media_ids: imageMediaIds } : {}),
      })
      setItem(updated)
      setReviews(updated.reviews)
      setRatingScore((current) => updated.viewer_rating ?? current)
      setReviewComment('')
      setReviewImages([])
      Taro.showToast({ title: '留言已保存', icon: 'success' })
    } catch (nextError) {
      Taro.showToast({ title: errorMessage(nextError), icon: 'none' })
    } finally {
      setCommentSubmitting(false)
    }
  }

  const listingImageUrls = item?.image_urls || []

  return (
    <View className='food-detail-page'>
      <CustomNavbar title='餐饮详情' subtitle={campus} showBack />
      {error ? (
        <View className='food-detail-state'>{error}</View>
      ) : item ? (
        <View className='food-detail-content'>
          <View className='food-detail-hero'>
            <View className='food-detail-hero__heading'>
              <View className='food-detail-hero__title-row'>
                <Text className='food-detail-hero__name'>{item.name}</Text>
                {item.promoted && <Text className='food-detail-hero__ad'>推广</Text>}
              </View>
              <Text className='food-detail-hero__merchant'>{item.category} · {item.location}</Text>
            </View>
            <Text className='food-detail-hero__campus'>{item.campus}</Text>
          </View>

          {listingImageUrls.length > 0 && (
            <View className='food-detail-gallery'>
              {listingImageUrls.map((imageUrl, index) => (
                <Image
                  key={`${imageUrl}-${index}`}
                  className='food-detail-gallery__image'
                  src={imageUrl}
                  mode='aspectFill'
                  ariaLabel={`${item.name}第 ${index + 1} 张图片`}
                  onClick={() => previewImages(listingImageUrls, imageUrl)}
                />
              ))}
            </View>
          )}

          <View className='food-detail-card'>
            <Text className='food-detail-card__label'>推荐理由</Text>
            <Text className='food-detail-card__body'>{item.description}</Text>
            <Text className='food-detail-card__label'>标签</Text>
            {item.tags.length > 0 ? (
              <View className='food-detail-tags'>
                {item.tags.map((tag) => <Text key={tag} className='food-detail-tag'>{tag}</Text>)}
              </View>
            ) : null}
            <View className='food-detail-rating-summary'>
              <View>
                <Text className='food-detail-card__label'>综合评分</Text>
                <Text className='food-detail-rating'>{item.rating_average.toFixed(1)} 分</Text>
              </View>
              <Text className='food-detail-rating-summary__count'>{item.rating_count} 人评</Text>
            </View>
          </View>

          <View className='food-detail-section-head'>
            <View>
              <Text>大家怎么说</Text>
              <Text>{reviews.length ? `${reviews.length} 条匿名留言` : '还没有留言'}</Text>
            </View>
          </View>
          {reviews.length > 0 ? (
            <View className='food-detail-reviews'>
              {reviews.map((review, index) => (
                <ReviewCard key={`${review.created_at}-${index}`} review={review} />
              ))}
            </View>
          ) : (
            <View className='food-detail-empty-review'>暂时没有留言，来留下第一条吧。</View>
          )}

          <View className='food-detail-review-composer'>
            <View className='food-detail-section-head food-detail-section-head--composer'>
              <View>
                <Text>评分</Text>
                <Text>评分独立保存，不会修改留言或图片</Text>
              </View>
            </View>
            <View className='food-detail-score-picker' ariaRole='radiogroup' ariaLabel='选择评分'>
              {[1, 2, 3, 4, 5].map((score) => (
                <View
                  key={score}
                  className={ratingScore === score
                    ? 'food-detail-score-picker__item food-detail-score-picker__item--active'
                    : 'food-detail-score-picker__item'}
                  ariaRole='radio'
                  ariaLabel={`${score} 分`}
                  onClick={() => setRatingScore(score)}
                >
                  <Text>{score} 分</Text>
                </View>
              ))}
            </View>
            <Button
              className='food-detail-review-composer__button'
              loading={ratingSubmitting}
              disabled={!ratingScore || ratingSubmitting}
              onClick={() => void submitRating()}
            >
              {item.viewer_rating ? '更新评分' : '提交评分'}
            </Button>
            <View className='food-detail-review-composer__section'>
              <View className='food-detail-section-head food-detail-section-head--composer'>
                <View>
                  <Text>留言和图片</Text>
                  <Text>留言独立保存，填写内容后再提交</Text>
                </View>
              </View>
              <KeyboardSafeTextarea
                className='food-detail-review-composer__textarea'
                value={reviewComment}
                maxlength={1000}
                placeholder='说说口味、分量或排队情况'
                autoHeight
                onInput={(event) => setReviewComment(event.detail.value)}
              />
              {reviewImages.length === 0 && (
                <View
                  className='food-detail-image-picker'
                  ariaRole='button'
                  ariaLabel='添加留言图片'
                  onClick={() => void chooseReviewImages()}
                >
                  <Image src={imageIcon} mode='aspectFit' ariaLabel='添加图片' />
                  <Text>添加图片</Text>
                  <Text>支持相册或拍摄，最多 9 张</Text>
                </View>
              )}
              <MediaImageEditor
                images={reviewImages}
                maxCount={MAX_PUBLISH_IMAGES}
                title='留言图片'
                hint='上传完成后保存留言，点击预览'
                showCover={false}
                onAdd={() => void chooseReviewImages()}
                onMove={(index, direction) => setReviewImages((current) => moveMediaImage(current, index, direction))}
                onRemove={(key) => setReviewImages((current) => current.filter((image) => image.key !== key))}
                onRetry={(image) => void uploadReviewImage(image)}
              />
              <Button
                className='food-detail-review-composer__button'
                loading={commentSubmitting}
                disabled={!reviewComment.trim() || commentSubmitting}
                onClick={() => void submitComment()}
              >
                保存留言
              </Button>
            </View>
          </View>
        </View>
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
        <Text className='food-detail-review-card__author'>匿名留言</Text>
        <Text className='food-detail-review-card__date'>{formatReviewDate(review.created_at)}</Text>
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
