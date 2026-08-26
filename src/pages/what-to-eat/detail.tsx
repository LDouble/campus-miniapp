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
  type FoodListing,
  type FoodListingReview,
} from '../../api/what-to-eat'
import { isApiError } from '../../api/client'
import {
  DEFAULT_MEDIA_IMAGE_QUALITY,
  MAX_PUBLISH_IMAGES,
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

const reviewImageDraftError = () => undefined

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
      if (selected.length) setReviewImages((current) => [...current, ...selected].slice(0, MAX_PUBLISH_IMAGES))
    } catch (nextError) {
      Taro.showToast({
        title: nextError instanceof Error ? nextError.message : '图片选择失败，请重试',
        icon: 'none',
      })
    }
  }

  const richReviewPendingContract = Boolean(reviewComment.trim()) || reviewImages.length > 0

  const submitReview = async () => {
    if (!item || !ratingScore || ratingSubmitting) {
      if (!ratingScore) Taro.showToast({ title: '请先选择评分', icon: 'none' })
      return
    }
    if (richReviewPendingContract) {
      Taro.showToast({ title: '图文评价待图片契约同步后开放', icon: 'none' })
      return
    }
    setRatingSubmitting(true)
    try {
      const updated = await rateFoodListing(item.id, ratingScore)
      setItem((current) => current ? {
        ...current,
        rating_average: updated.rating_average,
        rating_count: updated.rating_count,
        viewer_rating: updated.score,
      } : current)
      Taro.showToast({ title: '评分已提交', icon: 'success' })
    } catch (nextError) {
      Taro.showToast({ title: errorMessage(nextError), icon: 'none' })
    } finally {
      setRatingSubmitting(false)
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
              <Text>{reviews.length ? `${reviews.length} 条匿名评价` : '还没有评价'}</Text>
            </View>
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

          <View className='food-detail-review-composer'>
            <View className='food-detail-section-head food-detail-section-head--composer'>
              <View>
                <Text>写一条评价</Text>
                <Text>评分可以先提交；图文评价等待图片契约同步</Text>
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
            <KeyboardSafeTextarea
              className='food-detail-review-composer__textarea'
              value={reviewComment}
              maxlength={1000}
              placeholder='说说口味、分量或排队情况（图文评价待契约同步）'
              autoHeight
              onInput={(event) => setReviewComment(event.detail.value)}
            />
            {reviewImages.length === 0 && (
              <View
                className='food-detail-image-picker'
                ariaRole='button'
                ariaLabel='添加评价图片，仅本地预览'
                onClick={() => void chooseReviewImages()}
              >
                <Image src={imageIcon} mode='aspectFit' ariaLabel='添加图片' />
                <Text>添加图片</Text>
                <Text>当前仅本地预览</Text>
              </View>
            )}
            <MediaImageEditor
              images={reviewImages}
              maxCount={MAX_PUBLISH_IMAGES}
              title='评价图片'
              hint='点击预览；上传将在新契约同步后开放'
              showCover={false}
              onAdd={() => void chooseReviewImages()}
              onMove={(index, direction) => setReviewImages((current) => moveMediaImage(current, index, direction))}
              onRemove={(key) => setReviewImages((current) => current.filter((image) => image.key !== key))}
              onRetry={reviewImageDraftError}
            />
            <Button
              className='food-detail-review-composer__button'
              loading={ratingSubmitting}
              disabled={!ratingScore || ratingSubmitting}
              onClick={() => void submitReview()}
            >
              {richReviewPendingContract ? '等待图片契约同步' : '提交评分'}
            </Button>
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
        <Text className='food-detail-review-card__author'>匿名评价</Text>
        <Text className='food-detail-review-card__date'>{formatReviewDate(review.created_at)}</Text>
      </View>
      <Text className='food-detail-review-card__score'>{review.score} 分</Text>
      {review.comment ? <Text className='food-detail-review-card__comment'>{review.comment}</Text> : null}
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
