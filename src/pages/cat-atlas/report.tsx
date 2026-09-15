import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput, KeyboardSafeTextarea } from '../../components/keyboard-safe-input'
import { createCatSighting, submitCat } from '../../api/cat-atlas'
import { isApiError } from '../../api/client'
import { uploadMediaImage } from '../../api/media'
import { DEFAULT_MEDIA_IMAGE_QUALITY, mediaImageValidationError, type MediaImageDraft } from '../../features/media/images'
import { chooseMediaImages } from '../../features/media/selection'
import './report-journal.scss'

const areas = ['一食堂', '图书馆', '宿舍区', '小树林', '教学楼', '其他']
const campuses = ['崂山校区', '鱼山校区', '西海岸校区']
const actions = ['睡觉', '干饭', '散步', '发呆', '营业中']
const areaIds: Record<string, string> = { 一食堂: 'cat-area-canteen', 图书馆: 'cat-area-library', 宿舍区: 'cat-area-dormitory', 小树林: 'cat-area-grove', 教学楼: 'cat-area-teaching', 其他: 'cat-area-other' }
const locationIcon = require('../../assets/icons/location-warm.svg')
const plusIcon = require('../../assets/icons/plus.svg')
const closeIcon = require('../../assets/cat-atlas/figma/close.svg')

type LocationSnapshot = { name?: string; address?: string; latitude: number; longitude: number; accuracy?: number }

export default function CatReportPage() {
  const { params } = useRouter()
  const isNew = params.mode === 'new'
  const catID = params.id || ''
  const catName = params.name ? decodeURIComponent(params.name) : '它'
  const [area, setArea] = useState('')
  const [customArea, setCustomArea] = useState('')
  const [customAreaActive, setCustomAreaActive] = useState(false)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'located' | 'manual' | 'failed'>('idle')
  const [locationSnapshot, setLocationSnapshot] = useState<LocationSnapshot | null>(null)
  const [campus, setCampus] = useState(campuses[0])
  const [action, setAction] = useState(actions[0])
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [images, setImages] = useState<MediaImageDraft[]>([])
  const [submitting, setSubmitting] = useState(false)

  const locateCurrentPosition = useCallback(async (showError = true) => {
    if (locationStatus === 'locating') return
    const previousStatus = locationStatus
    const previousSnapshot = locationSnapshot
    setLocationStatus('locating')
    try {
      const result = await Taro.choosePoi({})
      const label = [result.name, result.address].filter(Boolean).join(' · ') || '当前位置'
      setCustomArea(''); setCustomAreaActive(false); setArea(label.slice(0, 160))
      setLocationSnapshot({ name: result.name, address: result.address, latitude: result.latitude, longitude: result.longitude })
      setLocationStatus('located')
    } catch (chooseError) {
      const message = chooseError && typeof chooseError === 'object' && 'errMsg' in chooseError ? String(chooseError.errMsg) : chooseError instanceof Error ? chooseError.message : ''
      if (/cancel/i.test(message)) { setLocationStatus(previousStatus); setLocationSnapshot(previousSnapshot); return }
      try {
        const result = await Taro.getLocation({ type: 'gcj02', isHighAccuracy: true, highAccuracyExpireTime: 5000 })
        setCustomArea(''); setCustomAreaActive(false); setArea('当前位置')
        setLocationSnapshot({ latitude: result.latitude, longitude: result.longitude, accuracy: result.accuracy })
        setLocationStatus('located')
      } catch {
        setLocationStatus(previousSnapshot ? previousStatus : 'failed'); setLocationSnapshot(previousSnapshot)
        if (showError) await Taro.showToast({ title: '定位失败，请手动选择地点', icon: 'none' })
      }
    }
  }, [locationSnapshot, locationStatus])

  const selectArea = (value: string) => {
    setLocationSnapshot(null); setLocationStatus('manual')
    if (value === '其他') { setArea(''); setCustomArea(''); setCustomAreaActive(true); return }
    setArea(value); setCustomArea(''); setCustomAreaActive(false)
  }
  const updateCustomArea = (value: string) => { setCustomArea(value); setArea(value.trim()); setLocationSnapshot(null); setLocationStatus('manual') }
  const updateImage = (key: string, updater: (image: MediaImageDraft) => MediaImageDraft) => setImages((current) => current.map((image) => image.key === key ? updater(image) : image))
  const uploadImage = async (image: MediaImageDraft) => {
    if (!image.localPath) return
    updateImage(image.key, (current) => ({ ...current, status: 'uploading', progress: 0, error: '' }))
    try {
      const media = await uploadMediaImage({ purpose: 'cat_atlas', filePath: image.localPath, mimeType: image.mimeType, sizeBytes: image.sizeBytes, onProgress: (progress) => updateImage(image.key, (current) => ({ ...current, progress })) })
      updateImage(image.key, (current) => ({ ...current, mediaId: media.id, status: 'uploaded', progress: 100, error: '' }))
    } catch (uploadError) {
      updateImage(image.key, (current) => ({ ...current, status: 'failed', error: isApiError(uploadError) ? uploadError.message : uploadError instanceof Error ? uploadError.message : '图片上传失败' }))
    }
  }
  const chooseImages = async () => {
    if (images.length >= 1) return
    try {
      const selected = await chooseMediaImages({ count: 1, maxDimension: 1600, quality: DEFAULT_MEDIA_IMAGE_QUALITY })
      if (selected.length) { setImages(selected); void uploadImage(selected[0]) }
    } catch (chooseError) { void Taro.showToast({ title: chooseError instanceof Error ? chooseError.message : '图片选择失败', icon: 'none' }) }
  }
  const submit = async () => {
    if (submitting) return
    if (!isNew && !catID) { await Taro.showToast({ title: '缺少猫咪信息，请返回图鉴重新进入', icon: 'none' }); return }
    if (!area) { await Taro.showToast({ title: '请先定位或选择遇见地点', icon: 'none' }); return }
    if (isNew && !images.length) { await Taro.showToast({ title: '请上传一张猫咪照片', icon: 'none' }); return }
    const imageError = mediaImageValidationError(images, 1)
    if (imageError) { await Taro.showToast({ title: imageError, icon: 'none' }); return }
    if (isNew && !images.some((item) => item.status === 'uploaded' && item.mediaId)) { await Taro.showToast({ title: '请先成功上传一张猫咪照片', icon: 'none' }); return }
    setSubmitting(true)
    try {
      const mediaId = images[0]?.mediaId
      if (isNew) await submitCat({ proposed_name: name.trim() || undefined, campus, area, description: note.trim() || undefined, photo_media_id: mediaId! })
      else await createCatSighting(catID, { area, activity: action, note: note.trim() || undefined, photo_media_id: mediaId })
      await Taro.showToast({ title: '审核通过后发布', icon: 'success' }); setTimeout(() => Taro.navigateBack(), 700)
    } catch (submitError) { await Taro.showToast({ title: isApiError(submitError) ? submitError.message : '提交失败，请稍后重试', icon: 'none' }) }
    finally { setSubmitting(false) }
  }

  const image = images[0]
  const locationTitle = locationStatus === 'located' ? locationSnapshot?.name || '当前位置' : locationStatus === 'locating' ? '正在定位…' : '选择当前位置'
  const locationDetail = locationStatus === 'located'
    ? locationSnapshot?.address || (locationSnapshot ? `纬度 ${locationSnapshot.latitude.toFixed(5)} · 经度 ${locationSnapshot.longitude.toFixed(5)}${locationSnapshot.accuracy ? ` · 约 ${Math.round(locationSnapshot.accuracy)} 米` : ''}` : '已选择当前位置')
    : area ? `已选：${area}` : '也可以直接选择下面的校园区域'
  const renderPhotoVisual = () => <View className={`cat-report__visual ${image ? 'is-filled' : ''}`}>
    {image ? <Image src={image.previewUrl} mode='aspectFill' onClick={() => Taro.previewImage({ current: image.previewUrl, urls: [image.previewUrl] })} /> : <View className='cat-report__visual-add' ariaRole='button' ariaLabel='添加照片' onClick={() => void chooseImages()}><Image src={plusIcon} mode='aspectFit' /><Text>{isNew ? '添加一张猫咪照片' : '添加现场照片'}</Text></View>}
    {image && <View className='cat-report__photo-delete' ariaRole='button' ariaLabel='删除照片' onClick={() => setImages([])}><Image src={closeIcon} mode='aspectFit' /></View>}
    {image?.status === 'uploading' && <View className='cat-report__photo-state'><Text>正在上传 {image.progress}%</Text><View><View style={{ width: `${image.progress}%` }} /></View></View>}
    {image?.status === 'failed' && <View className='cat-report__photo-state cat-report__photo-state--failed' ariaRole='button' onClick={() => void uploadImage(image)}><Text>上传没有成功</Text><Text>点此重试</Text></View>}
  </View>
  const renderLocationRow = () => <View className='cat-report__row cat-report__row--location'>
    <Text className='cat-report__row-label'>地点</Text>
    <View className='cat-report__location-trigger' ariaRole='button' onClick={() => void locateCurrentPosition(true)}><Image src={locationIcon} mode='aspectFit' /><View><Text>{locationTitle}</Text><Text>{locationDetail}</Text></View>{locationStatus !== 'locating' && <Text>定位</Text>}</View>
    <View className='cat-report__choice-grid'>{areas.map((item) => <Text id={areaIds[item]} key={item} className={(item === '其他' ? customAreaActive : area === item) ? 'is-active' : ''} onClick={() => selectArea(item)}>{item}</Text>)}</View>
    {customAreaActive && <View className='cat-report__input-shell cat-report__custom-area'><KeyboardSafeInput className='cat-report__input' value={customArea} maxlength={120} placeholder='例如：图书馆后门、宿舍楼下' onInput={(event) => updateCustomArea(event.detail.value)} /></View>}
  </View>

  return <View className={`cat-report-journal ${isNew ? 'cat-report-journal--new' : 'cat-report-journal--sighting'}`}>
    <CustomNavbar title={isNew ? '发现新猫' : '我遇到它了'} showBack onBack={() => { void Taro.navigateBack() }} />
    <View className='cat-report-journal__content'>
      <Text className='cat-report__intro'>{isNew ? '拍一张清楚的照片，帮它留下一份校园档案。' : `${catName}的相遇记录，留给下一位遇见它的同学。`}</Text>
      {renderPhotoVisual()}
      <Text className='cat-report__photo-hint'>{isNew ? '新猫需要一张清晰照片和发现地点' : '照片可选，地点和活动会记录到动态里'}</Text>
      <View className='cat-report__form-card'>
        {isNew && <View className='cat-report__row'><Text className='cat-report__row-label'>校区</Text><View className='cat-report__choice-grid cat-report__choice-grid--campus'>{campuses.map((item) => <Text key={item} className={campus === item ? 'is-active' : ''} onClick={() => setCampus(item)}>{item}</Text>)}</View></View>}
        {renderLocationRow()}
        {isNew ? <View className='cat-report__row'><Text className='cat-report__row-label'>名字 <Text>可选</Text></Text><View className='cat-report__input-shell'><KeyboardSafeInput className='cat-report__input' value={name} maxlength={32} placeholder='例如：大橘、图书馆小白' onInput={(event) => setName(event.detail.value)} /></View></View> : <View className='cat-report__row'><Text className='cat-report__row-label'>它在做什么</Text><View className='cat-report__choice-grid'>{actions.map((item) => <Text key={item} className={action === item ? 'is-active' : ''} onClick={() => setAction(item)}>{item}</Text>)}</View></View>}
        <View className='cat-report__row cat-report__row--last'><Text className='cat-report__row-label'>备注 <Text>可选</Text></Text><View className='cat-report__textarea-shell'><KeyboardSafeTextarea className='cat-report__textarea' value={note} maxlength={200} placeholder={isNew ? '毛色、性格、外观或常出现的地方' : '分享你看到的细节'} onInput={(event) => setNote(event.detail.value)} /><Text>{note.length}/200</Text></View></View>
      </View>
    </View>
    <View className='cat-report__footer'><Button className='cat-report__submit' hoverClass='none' loading={submitting} disabled={submitting || images.some((item) => item.status === 'uploading') || (isNew && !images.some((item) => item.status === 'uploaded' && item.mediaId))} onClick={() => void submit()}>{isNew ? '提交新猫' : '记录这次相遇'}</Button><Text>审核通过后，分享给下一位遇见它的同学</Text></View>
  </View>
}
