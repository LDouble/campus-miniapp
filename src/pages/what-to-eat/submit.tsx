import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import MediaImageEditor from '../../components/media-image-editor'
import { KeyboardSafeInput, KeyboardSafeTextarea } from '../../components/keyboard-safe-input'
import { getMiniappRuntimeConfig, getSelectedCampus } from '../../features/runtime-config'
import { isApiError } from '../../api/client'
import { uploadMediaImage } from '../../api/media'
import { submitFoodListing } from '../../api/what-to-eat'
import {
  DEFAULT_MEDIA_IMAGE_QUALITY,
  MAX_PUBLISH_IMAGES,
  mediaImageValidationError,
  moveMediaImage,
} from '../../features/media/images'
import type { MediaImageDraft } from '../../features/media/images'
import { chooseMediaImages } from '../../features/media/selection'
import './submit.scss'

const imageIcon = require('../../assets/icons/image.svg')

const imageErrorMessage = (error: unknown) => (
  isApiError(error) ? error.message : error instanceof Error ? error.message : '图片上传失败，请重试'
)

export default function SubmitFoodListingPage() {
  const campus = getSelectedCampus(getMiniappRuntimeConfig())
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [tags, setTags] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<MediaImageDraft[]>([])
  const [saving, setSaving] = useState(false)

  const updateImage = (
    key: string,
    updater: (image: MediaImageDraft) => MediaImageDraft,
  ) => {
    setImages((current) => current.map((image) => image.key === key ? updater(image) : image))
  }

  const uploadImage = async (image: MediaImageDraft) => {
    if (!image.localPath) return
    updateImage(image.key, (current) => ({
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
        onProgress: (progress) => updateImage(image.key, (current) => ({
          ...current,
          status: 'uploading',
          progress,
        })),
      })
      updateImage(image.key, (current) => ({
        ...current,
        mediaId: uploaded.id,
        width: uploaded.width || current.width,
        height: uploaded.height || current.height,
        status: 'uploaded',
        progress: 100,
        error: '',
      }))
    } catch (error) {
      const message = imageErrorMessage(error)
      updateImage(image.key, (current) => ({
        ...current,
        status: 'failed',
        error: message,
      }))
      Taro.showToast({ title: message, icon: 'none' })
    }
  }

  const chooseImages = async () => {
    const available = MAX_PUBLISH_IMAGES - images.length
    if (available <= 0) {
      Taro.showToast({ title: `最多选择 ${MAX_PUBLISH_IMAGES} 张图片`, icon: 'none' })
      return
    }
    try {
      const selected = await chooseMediaImages({
        count: available,
        maxDimension: 1600,
        quality: DEFAULT_MEDIA_IMAGE_QUALITY,
      })
      if (!selected.length) return
      setImages((current) => [...current, ...selected].slice(0, MAX_PUBLISH_IMAGES))
      selected.forEach((image) => { void uploadImage(image) })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '图片选择失败，请重试',
        icon: 'none',
      })
    }
  }

  const save = async () => {
    if (!name.trim() || !category.trim() || !location.trim() || !description.trim()) {
      Taro.showToast({ title: '请补全名称、类别、位置和推荐理由', icon: 'none' })
      return
    }
    const imageError = mediaImageValidationError(images, MAX_PUBLISH_IMAGES)
    if (imageError) {
      Taro.showToast({ title: imageError, icon: 'none' })
      return
    }
    setSaving(true)
    try {
      const imageMediaIds = images.flatMap((image) => image.mediaId ? [image.mediaId] : [])
      await submitFoodListing({
        name: name.trim(),
        category: category.trim(),
        campus,
        location: location.trim(),
        tags: tags.split(/[，,]/).map((item) => item.trim()).filter(Boolean).slice(0, 5),
        description: description.trim(),
        random_enabled: true,
        ...(imageMediaIds.length ? { image_media_ids: imageMediaIds } : {}),
      })
      Taro.showToast({ title: '已提交，等待审核', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 900)
    } catch (error) {
      Taro.showToast({ title: isApiError(error) ? error.message : '提交失败，请稍后再试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='food-submit-page'>
      <CustomNavbar title='补充吃什么' subtitle={`${campus} · 提交后审核`} showBack />
      <View className='food-submit-page__content'>
        <Text className='food-submit-page__hint'>请补充真实、当前仍可消费的餐饮信息；审核通过后才会出现在公开清单。</Text>
        <View className='food-submit-form'>
          <Text>吃什么</Text>
          <KeyboardSafeInput value={name} maxlength={50} placeholder='如：招牌牛肉面' onInput={(event) => setName(event.detail.value)} />
          <Text>餐饮类别</Text>
          <KeyboardSafeInput value={category} maxlength={80} placeholder='如：面食、快餐或小吃' onInput={(event) => setCategory(event.detail.value)} />
          <Text>位置</Text>
          <KeyboardSafeInput value={location} maxlength={120} placeholder='如：崂山校区北区食堂二楼' onInput={(event) => setLocation(event.detail.value)} />
          <Text>标签（选填）</Text>
          <KeyboardSafeInput value={tags} maxlength={80} placeholder='如：面食，快餐，晚餐' onInput={(event) => setTags(event.detail.value)} />
          <Text>推荐理由</Text>
          <KeyboardSafeTextarea value={description} maxlength={300} placeholder='口味、排队情况或推荐搭配' autoHeight onInput={(event) => setDescription(event.detail.value)} />
        </View>
        <View className='food-submit-images'>
          {images.length === 0 && (
            <View className='food-submit-images__head'>
              <View>
                <Text>餐饮图片</Text>
                <Text>上传完成后随投稿提交，图片会经过内容审核</Text>
              </View>
              <Text>{images.length}/{MAX_PUBLISH_IMAGES}</Text>
            </View>
          )}
          {images.length === 0 && (
            <View
              className='food-submit-images__picker'
              ariaRole='button'
              ariaLabel='添加餐饮图片'
              onClick={() => void chooseImages()}
            >
              <Image className='food-submit-images__picker-icon' src={imageIcon} mode='aspectFit' ariaLabel='添加图片' />
              <Text>添加图片</Text>
              <Text>支持相册或拍摄，最多 9 张</Text>
            </View>
          )}
          <MediaImageEditor
            images={images}
            maxCount={MAX_PUBLISH_IMAGES}
            title='餐饮图片'
            hint='首图作为封面，点击预览'
            showCover
            onAdd={() => void chooseImages()}
            onMove={(index, direction) => setImages((current) => moveMediaImage(current, index, direction))}
            onRemove={(key) => setImages((current) => current.filter((image) => image.key !== key))}
            onRetry={(image) => void uploadImage(image)}
          />
        </View>
        <Text className='food-submit-images__notice'>图片上传完成后会以媒体 ID 提交，服务端按当前用户归属与用途校验。</Text>
        <Button className='food-submit-page__button' loading={saving} onClick={save}>提交审核</Button>
      </View>
    </View>
  )
}
