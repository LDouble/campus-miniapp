import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import MediaImageEditor from '../../components/media-image-editor'
import { KeyboardSafeInput, KeyboardSafeTextarea } from '../../components/keyboard-safe-input'
import {
  enabledCampuses,
  getMiniappRuntimeConfig,
  getSelectedCampus,
  saveSelectedCampus,
} from '../../features/runtime-config'
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
import {
  DEFAULT_FOOD_CATEGORIES,
  DEFAULT_FOOD_TAGS,
  FOOD_CATEGORY_MAX_LENGTH,
  getDefaultFoodLocations,
  loadFoodInputHistory,
  rememberFoodInputHistory,
  type FoodInputHistory,
} from '../../features/what-to-eat/input-history'
import { showActionSheetSelection } from '../../utils/action-sheet'
import './submit.scss'

const imageIcon = require('../../assets/icons/image.svg')

const parseTags = (value: string) => value
  .split(/[，,]/)
  .map((item) => item.trim())
  .filter(Boolean)
  .filter((item, index, items) => items.indexOf(item) === index)
  .slice(0, 5)

const parseCategories = (value: string) => value
  .split(/[，,、]/)
  .map((item) => item.trim())
  .filter(Boolean)
  .filter((item, index, items) => items.indexOf(item) === index)

const joinCategories = (items: string[]) => parseCategories(items.join('、')).join('、')
const categoryLength = (value: string) => Array.from(value).length

const imageErrorMessage = (error: unknown) => (
  isApiError(error) ? error.message : error instanceof Error ? error.message : '图片上传失败，请重试'
)

export default function SubmitFoodListingPage() {
  const runtimeConfig = getMiniappRuntimeConfig()
  const [campus, setCampus] = useState(() => getSelectedCampus(runtimeConfig))
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [tags, setTags] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<MediaImageDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [inputHistory, setInputHistory] = useState<FoodInputHistory>(() => loadFoodInputHistory(campus))
  const campusOptions = useMemo(() => enabledCampuses(runtimeConfig), [runtimeConfig])
  const defaultLocations = useMemo(() => getDefaultFoodLocations(campus), [campus])
  const recentCategories = useMemo(() => inputHistory.categories.filter((item) => !DEFAULT_FOOD_CATEGORIES.includes(item)), [inputHistory.categories])
  const recentLocations = useMemo(() => inputHistory.locations.filter((item) => !defaultLocations.includes(item)), [defaultLocations, inputHistory.locations])
  const recentTags = useMemo(() => inputHistory.tags.filter((item) => !DEFAULT_FOOD_TAGS.includes(item)), [inputHistory.tags])

  useEffect(() => {
    setInputHistory(loadFoodInputHistory(campus))
  }, [campus])

  const rememberInput = (input: Parameters<typeof rememberFoodInputHistory>[1]) => {
    setInputHistory(rememberFoodInputHistory(campus, input))
  }

  const updateTags = (nextTags: string[], remember = false) => {
    const normalized = nextTags.slice(0, 5)
    setTags(normalized.join('，'))
    if (remember && normalized.length) rememberInput({ tags: normalized })
  }

  const updateCategories = (nextCategories: string[], remember = false) => {
    const normalized = joinCategories(nextCategories)
    setCategory(normalized)
    if (remember && normalized) rememberInput({ categories: parseCategories(normalized) })
  }

  const toggleCategory = (item: string) => {
    const selected = parseCategories(category)
    if (selected.includes(item)) {
      updateCategories(selected.filter((current) => current !== item))
      return
    }
    const next = joinCategories([...selected, item])
    if (categoryLength(next) > FOOD_CATEGORY_MAX_LENGTH) {
      Taro.showToast({ title: `类别最多 ${FOOD_CATEGORY_MAX_LENGTH} 个字符`, icon: 'none' })
      return
    }
    updateCategories([...selected, item], true)
  }

  const toggleTag = (tag: string) => {
    const selected = parseTags(tags)
    if (selected.includes(tag)) {
      updateTags(selected.filter((item) => item !== tag))
      return
    }
    if (selected.length >= 5) {
      Taro.showToast({ title: '最多保留 5 个标签', icon: 'none' })
      return
    }
    updateTags([...selected, tag], true)
  }

  const chooseCampus = async () => {
    const tapIndex = await showActionSheetSelection(campusOptions)
    if (tapIndex === null) return
    const nextCampus = campusOptions[tapIndex]
    if (!nextCampus || nextCampus === campus) return
    saveSelectedCampus(nextCampus)
    setCampus(nextCampus)
  }

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
    const normalizedCategory = joinCategories(parseCategories(category))
    if (!name.trim() || !normalizedCategory || !location.trim() || !description.trim()) {
      Taro.showToast({ title: '请补全名称、类别、位置和推荐理由', icon: 'none' })
      return
    }
    if (categoryLength(normalizedCategory) > FOOD_CATEGORY_MAX_LENGTH) {
      Taro.showToast({ title: `类别最多 ${FOOD_CATEGORY_MAX_LENGTH} 个字符`, icon: 'none' })
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
        category: normalizedCategory,
        campus,
        location: location.trim(),
        tags: parseTags(tags),
        description: description.trim(),
        random_enabled: true,
        ...(imageMediaIds.length ? { image_media_ids: imageMediaIds } : {}),
      })
      rememberInput({
        categories: parseCategories(normalizedCategory),
        locations: [location],
        tags: parseTags(tags),
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
        <View className='food-submit-page__intro'>
          <View
            className='food-submit-page__campus'
            ariaRole='button'
            ariaLabel={`切换当前校区，当前为${campus}`}
            onClick={() => void chooseCampus()}
          >
            <Text>当前校区：{campus}</Text>
            <Text>切换</Text>
          </View>
          <Text className='food-submit-page__intro-title'>补充一家你常去的店</Text>
          <Text className='food-submit-page__intro-copy'>填写 4 项基本信息即可提交，审核通过后会出现在 {campus} 的餐饮清单。</Text>
        </View>
        <View className='food-submit-form'>
          <View className='food-submit-form__head'>
            <View>
              <Text className='food-submit-form__title'>基本信息</Text>
              <Text className='food-submit-form__hint'>标记“必填”的内容需要完成后提交</Text>
            </View>
          </View>
          <View className='food-submit-field'>
            <View className='food-submit-field__label'>
              <Text>餐饮名称</Text>
              <Text>必填</Text>
            </View>
            <KeyboardSafeInput value={name} maxlength={50} placeholder='如：一食堂牛肉面窗口' onInput={(event) => setName(event.detail.value)} />
          </View>
          <View className='food-submit-field'>
            <View className='food-submit-field__label'>
              <Text>餐饮类别</Text>
              <Text>必填 · 可多选</Text>
            </View>
            <KeyboardSafeInput value={category} maxlength={FOOD_CATEGORY_MAX_LENGTH} placeholder='如：面食、快餐（多个用顿号分隔）' onInput={(event) => setCategory(event.detail.value)} onBlur={() => updateCategories(parseCategories(category), true)} />
            <View className='food-submit-shortcuts' ariaLabel='餐饮类别快捷填写'>
              <Text className='food-submit-shortcuts__label'>常用</Text>
              <View className='food-submit-shortcuts__items'>
                {DEFAULT_FOOD_CATEGORIES.map((item) => {
                  const selected = parseCategories(category).includes(item)
                  return <View key={item} className={`food-submit-shortcuts__item ${selected ? 'food-submit-shortcuts__item--selected' : ''}`} ariaRole='button' ariaLabel={`${selected ? '取消' : '添加'}类别${item}`} onClick={() => toggleCategory(item)}>{item}</View>
                })}
              </View>
              {recentCategories.length > 0 && <>
                <Text className='food-submit-shortcuts__label'>最近使用</Text>
                <View className='food-submit-shortcuts__items'>
                  {recentCategories.map((item) => {
                    const selected = parseCategories(category).includes(item)
                    return <View key={item} className={`food-submit-shortcuts__item food-submit-shortcuts__item--recent ${selected ? 'food-submit-shortcuts__item--selected' : ''}`} ariaRole='button' ariaLabel={`${selected ? '取消' : '添加'}最近使用类别${item}`} onClick={() => toggleCategory(item)}>{item}</View>
                  })}
                </View>
              </>}
            </View>
            <Text className='food-submit-field__tip'>点击类别可添加或取消，多个类别会合并提交。</Text>
          </View>
          <View className='food-submit-field'>
            <View className='food-submit-field__label'>
              <Text>位置</Text>
              <Text>必填</Text>
            </View>
            <KeyboardSafeInput value={location} maxlength={120} placeholder='如：崂山校区北区食堂二楼' onInput={(event) => setLocation(event.detail.value)} onBlur={() => rememberInput({ locations: [location] })} />
            <View className='food-submit-shortcuts' ariaLabel='位置快捷填写'>
              <Text className='food-submit-shortcuts__label'>常用</Text>
              <View className='food-submit-shortcuts__items'>
                {defaultLocations.map((item) => (
                  <View key={item} className='food-submit-shortcuts__item' ariaRole='button' ariaLabel={`选择位置${item}`} onClick={() => { setLocation(item); rememberInput({ locations: [item] }) }}>{item}</View>
                ))}
              </View>
              {recentLocations.length > 0 && <>
                <Text className='food-submit-shortcuts__label'>最近使用</Text>
                <View className='food-submit-shortcuts__items'>
                  {recentLocations.map((item) => (
                    <View key={item} className='food-submit-shortcuts__item food-submit-shortcuts__item--recent' ariaRole='button' ariaLabel={`选择最近使用的位置${item}`} onClick={() => { setLocation(item); rememberInput({ locations: [item] }) }}>{item}</View>
                  ))}
                </View>
              </>}
            </View>
          </View>
          <View className='food-submit-field'>
            <View className='food-submit-field__label'>
              <Text>推荐理由</Text>
              <Text>必填</Text>
            </View>
            <KeyboardSafeTextarea value={description} maxlength={300} placeholder='写写口味、排队情况或推荐搭配' autoHeight onInput={(event) => setDescription(event.detail.value)} />
          </View>
        </View>
        <View className='food-submit-form food-submit-form--optional'>
          <View className='food-submit-form__head'>
            <View>
              <Text className='food-submit-form__title'>补充信息</Text>
              <Text className='food-submit-form__hint'>选填，不影响本次提交</Text>
            </View>
          </View>
          <View className='food-submit-field'>
            <View className='food-submit-field__label'>
              <Text>标签</Text>
              <Text>选填</Text>
            </View>
            <KeyboardSafeInput value={tags} maxlength={80} placeholder='如：面食，快餐，晚餐' onInput={(event) => setTags(event.detail.value)} onBlur={() => updateTags(parseTags(tags), true)} />
            <View className='food-submit-shortcuts' ariaLabel='标签快捷填写'>
              <Text className='food-submit-shortcuts__label'>常用</Text>
              <View className='food-submit-shortcuts__items'>
                {DEFAULT_FOOD_TAGS.map((item) => {
                  const selected = parseTags(tags).includes(item)
                  return <View key={item} className={`food-submit-shortcuts__item ${selected ? 'food-submit-shortcuts__item--selected' : ''}`} ariaRole='button' ariaLabel={`${selected ? '取消' : '添加'}标签${item}`} onClick={() => toggleTag(item)}>{item}</View>
                })}
              </View>
              {recentTags.length > 0 && <>
                <Text className='food-submit-shortcuts__label'>最近使用</Text>
                <View className='food-submit-shortcuts__items'>
                  {recentTags.map((item) => {
                    const selected = parseTags(tags).includes(item)
                    return <View key={item} className={`food-submit-shortcuts__item food-submit-shortcuts__item--recent ${selected ? 'food-submit-shortcuts__item--selected' : ''}`} ariaRole='button' ariaLabel={`${selected ? '取消' : '添加'}最近使用标签${item}`} onClick={() => toggleTag(item)}>{item}</View>
                  })}
                </View>
              </>}
            </View>
            <Text className='food-submit-field__tip'>点击标签即可添加或取消，最多保留 5 个标签。</Text>
          </View>
        </View>
        <View className='food-submit-images'>
          <View className='food-submit-images__head'>
            <View>
              <View className='food-submit-images__title-row'>
                <Text>餐饮图片</Text>
                <Text>选填</Text>
              </View>
              <Text>首图会作为封面，上传完成后随投稿一起审核</Text>
            </View>
            <Text>{images.length}/{MAX_PUBLISH_IMAGES}</Text>
          </View>
          {images.length === 0 && (
            <View
              className='food-submit-images__picker'
              ariaRole='button'
              ariaLabel='添加餐饮图片'
              onClick={() => void chooseImages()}
            >
              <Image className='food-submit-images__picker-icon' src={imageIcon} mode='aspectFit' ariaLabel='添加图片' />
              <Text>添加餐饮图片</Text>
              <Text>支持相册或拍摄，最多 {MAX_PUBLISH_IMAGES} 张</Text>
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
        <Text className='food-submit-images__notice'>提交后由平台审核；图片仅在上传完成后随本次投稿提交。</Text>
        <View className='food-submit-page__action'>
          <Button
            className='food-submit-page__button'
            hoverClass='none'
            loading={saving}
            disabled={saving}
            onClick={save}
          >
            提交审核
          </Button>
        </View>
      </View>
    </View>
  )
}
