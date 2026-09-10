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
import './catalog-report.scss'
import './warm-theme.scss'

const areas = ['一食堂', '图书馆', '宿舍区', '小树林', '教学楼', '其他']
const campuses = ['崂山校区', '鱼山校区', '西海岸校区']
const actions = ['睡觉', '干饭', '散步', '发呆', '营业中']
const locationIcon = require('../../assets/icons/location-warm.svg')

type LocationSnapshot = { name?: string; address?: string; latitude: number; longitude: number; accuracy?: number }

export default function CatReportPage() {
  const { params } = useRouter()
  const isNew = params.mode === 'new'
  const catID = params.id || ''
  const catName = params.name ? decodeURIComponent(params.name) : '它'
  const [area, setArea] = useState(isNew ? areas[0] : '')
  const [customArea, setCustomArea] = useState('')
  const [customAreaActive, setCustomAreaActive] = useState(false)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'located' | 'manual' | 'failed'>(isNew ? 'manual' : 'idle')
  const [locationSnapshot, setLocationSnapshot] = useState<LocationSnapshot | null>(null)
  const [campus, setCampus] = useState(campuses[0])
  const [action, setAction] = useState(actions[0])
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [images, setImages] = useState<MediaImageDraft[]>([])
  const [submitting, setSubmitting] = useState(false)
  const locateCurrentPosition = useCallback(async (showError = true) => {
    if (isNew) return
    setLocationStatus('locating')
    setLocationSnapshot(null)
    try {
      const result = await Taro.choosePoi({})
      const label = [result.name, result.address].filter(Boolean).join(' · ') || '当前位置'
      setCustomArea('')
      setCustomAreaActive(false)
      setArea(label.slice(0, 160))
      setLocationSnapshot({ name: result.name, address: result.address, latitude: result.latitude, longitude: result.longitude })
      setLocationStatus('located')
    } catch (chooseError) {
      const errorMessage = chooseError && typeof chooseError === 'object' && 'errMsg' in chooseError
        ? String(chooseError.errMsg)
        : chooseError instanceof Error ? chooseError.message : ''
      if (/cancel/i.test(errorMessage)) {
        setLocationStatus('idle')
        return
      }
      try {
        const result = await Taro.getLocation({ type: 'gcj02', isHighAccuracy: true, highAccuracyExpireTime: 5000 })
        setCustomArea('')
        setCustomAreaActive(false)
        setArea('当前位置')
        setLocationSnapshot({ latitude: result.latitude, longitude: result.longitude, accuracy: result.accuracy })
        setLocationStatus('located')
      } catch {
        setLocationStatus('failed')
        if (showError) await Taro.showToast({ title: '定位失败，请手动选择地点', icon: 'none' })
      }
    }
  }, [isNew])
  const selectArea = (value: string) => {
    setLocationSnapshot(null)
    setLocationStatus('manual')
    if (value === '其他') {
      setArea('')
      setCustomArea('')
      setCustomAreaActive(true)
      return
    }
    setArea(value)
    setCustomArea('')
    setCustomAreaActive(false)
  }
  const updateCustomArea = (value: string) => {
    setCustomArea(value)
    setArea(value.trim())
    setLocationSnapshot(null)
    setLocationStatus('manual')
  }
  const updateImage = (key: string, updater: (image: MediaImageDraft) => MediaImageDraft) => setImages((current) => current.map((image) => image.key === key ? updater(image) : image))
  const uploadImage = async (image: MediaImageDraft) => {
    if (!image.localPath) return
    updateImage(image.key, (current) => ({ ...current, status: 'uploading', progress: 0, error: '' }))
    try {
      const media = await uploadMediaImage({ purpose: 'cat_atlas', filePath: image.localPath, mimeType: image.mimeType, sizeBytes: image.sizeBytes, onProgress: (progress) => updateImage(image.key, (current) => ({ ...current, progress })) })
      updateImage(image.key, (current) => ({ ...current, mediaId: media.id, status: 'uploaded', progress: 100, error: '' }))
    } catch (uploadError) { updateImage(image.key, (current) => ({ ...current, status: 'failed', error: isApiError(uploadError) ? uploadError.message : uploadError instanceof Error ? uploadError.message : '图片上传失败' })) }
  }
  const chooseImages = async () => {
    if (images.length >= 1) return
    try {
      const selected = await chooseMediaImages({ count: 1, maxDimension: 1600, quality: DEFAULT_MEDIA_IMAGE_QUALITY })
      if (selected.length) { setImages(selected); void uploadImage(selected[0]) }
    } catch (chooseError) { void Taro.showToast({ title: chooseError instanceof Error ? chooseError.message : '图片选择失败', icon: 'none' }) }
  }
  const chooseArea = async () => {
    try {
      const result = await Taro.showActionSheet({ itemList: areas })
      if (typeof result.tapIndex === 'number') {
        selectArea(areas[result.tapIndex])
      }
    } catch { /* 用户取消 */ }
  }
  const submit = async () => {
    if (!isNew && !catID) { await Taro.showToast({ title: '缺少猫咪信息，请返回图鉴重新进入', icon: 'none' }); return }
    if (!area) { await Taro.showToast({ title: '请先定位或选择遇见地点', icon: 'none' }); return }
    if (isNew && !images.length) { await Taro.showToast({ title: '请上传一张猫咪照片', icon: 'none' }); return }
    const imageError = mediaImageValidationError(images, 1)
    if (imageError) { await Taro.showToast({ title: imageError, icon: 'none' }); return }
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
  const locationTitle = locationStatus === 'located' ? locationSnapshot?.name || '当前位置' : customAreaActive ? customArea || '其他地点' : area || '尚未选择地点'
  const locationDetail = locationStatus === 'located' && locationSnapshot
    ? locationSnapshot.address || (locationSnapshot.accuracy ? `纬度 ${locationSnapshot.latitude.toFixed(5)} · 经度 ${locationSnapshot.longitude.toFixed(5)} · 约 ${Math.round(locationSnapshot.accuracy)}m` : '已获取位置')
    : locationStatus === 'locating' ? '正在获取当前位置…' : locationStatus === 'failed' ? '定位失败，可手动选择' : customAreaActive ? '请填写校内具体地点' : locationStatus === 'manual' ? '已手动选择，可点击重新定位' : '点击后选择当前位置'
  const locationAction = locationStatus === 'locating' ? '定位中…' : locationStatus === 'located' ? locationSnapshot?.name ? '重新选择' : '重新定位' : '使用当前位置'
  const renderCustomAreaInput = () => customAreaActive && <View className='report-custom-area'>
    <Text className='report-custom-area__hint'>请输入具体地点</Text>
    <View className='report-custom-area__input-wrap'>
      <KeyboardSafeInput className='report-custom-area__input' value={customArea} maxlength={120} placeholder='例如：图书馆后门、宿舍楼下' onInput={(event) => updateCustomArea(event.detail.value)} />
    </View>
  </View>
  const renderPhoto = () => image && <View className='report-photo'>
    <Image src={image.previewUrl} mode='aspectFill' onClick={() => Taro.previewImage({ current: image.previewUrl, urls: [image.previewUrl] })} />
    <View className='report-photo__delete' onClick={() => setImages([])}><Text>×</Text></View>
    {image.status === 'uploading' && <View className='report-photo__state'><Text>上传 {image.progress}%</Text><View><View style={{ width: `${image.progress}%` }} /></View></View>}
    {image.status === 'failed' && <View className='report-photo__state report-photo__state--failed' onClick={() => void uploadImage(image)}><Text>上传失败</Text><Text>点击重试</Text></View>}
  </View>
  return <View className={`report-page ${isNew ? 'report-page--new' : 'report-page--sighting'}`}>
    <CustomNavbar title={isNew ? '发现新猫' : '我遇到它了'} showBack onBack={() => { void Taro.navigateBack() }} />
      <View className='report-page__content'>
      <View className='report-heading'>
        <Text className='report-heading__eyebrow'>{isNew ? '新猫档案' : '相遇记录'}</Text>
        <Text className='report-heading__title'>{isNew ? '发现一只新猫' : `遇见 ${catName}`}</Text>
        <Text className='report-heading__subtitle'>{isNew ? '留下一张照片和它的特征，帮它建立第一份档案。' : '补充地点、状态或一张现场照片，让大家知道它此刻在哪里。'}</Text>
      </View>
      {isNew && <>
        <Text className='report-label'>上传照片 <Text>*</Text></Text>
        <View className='report-upload-caption'><Text>拍下最能认出它的样子</Text><Text>必填 · JPG / PNG</Text></View>
        <View className='report-upload-row'>{renderPhoto()}<View className='report-photo report-photo--add' onClick={() => void chooseImages()}><Text>+</Text><Text>添加照片</Text></View></View>
        <Text className='report-label'>在哪里看到的？ <Text>*</Text></Text>
        <View className='report-options'>{campuses.map((item) => <Text key={item} className={campus === item ? 'is-active' : ''} onClick={() => setCampus(item)}>{item}</Text>)}</View>
        <View className='report-picker' onClick={() => void chooseArea()}><View><Text>●</Text><Text>{customAreaActive ? area || '其他' : area || '请选择地点'}</Text></View><Text>›</Text></View>
        {renderCustomAreaInput()}
        <Text className='report-label'>大家怎么叫它？ <Text className='report-label__optional'>（可选）</Text></Text>
        <View className='report-input-wrap'><KeyboardSafeInput className='report-input' value={name} maxlength={32} placeholder='不知道也可以不填' onInput={(event) => setName(event.detail.value)} /></View>
      </>}
      {!isNew && <>
        <Text className='report-label'>在哪里遇到？</Text>
        <View className='report-location-primary' onClick={() => void locateCurrentPosition(true)}>
          <View className='report-location-primary__main'>
            <View className='report-location-primary__icon'><Image src={locationIcon} mode='aspectFit' /></View>
            <View className='report-location-primary__copy'><Text>{locationTitle}</Text><Text>{locationDetail}</Text></View>
          </View>
          <Text className='report-location-primary__action'>{locationAction}</Text>
        </View>
        <Text className='report-location-fallback'>也可以直接选择校内区域</Text>
        <View className='report-options'>{areas.map((item) => <Text key={item} className={(item === '其他' ? customAreaActive : area === item) ? 'is-active' : ''} onClick={() => selectArea(item)}>{item}</Text>)}</View>
        {renderCustomAreaInput()}
        <Text className='report-label'>它在做什么？</Text><View className='report-options'>{actions.map((item) => <Text key={item} className={action === item ? 'is-active' : ''} onClick={() => setAction(item)}>{item}</Text>)}</View>
        <Text className='report-label'>上传照片 <Text className='report-label__optional'>（可选）</Text></Text>
        <View className='report-upload-caption'><Text>给这次相遇留一张现场照片</Text><Text>可选 · 记录此刻</Text></View>
        <View className='report-upload-row'>{renderPhoto()}<View className='report-photo report-photo--add' onClick={() => void chooseImages()}><Text>+</Text><Text>添加照片</Text></View></View>
      </>}
      <Text className='report-label'>{isNew ? '它有什么特点？' : '想说点什么？'} <Text className='report-label__optional'>（可选）</Text></Text>
      <View className='report-textarea-wrap'><KeyboardSafeTextarea className='report-textarea' value={note} maxlength={200} placeholder={isNew ? '比如毛色、性格、外观特征、经常出现的地方…' : '分享一下你看到它吧～'} onInput={(event) => setNote(event.detail.value)} /><Text>{note.length}/200</Text></View>
    </View>
    <View className='report-footer'><Button className='report-submit' hoverClass='none' loading={submitting} disabled={submitting || images.some((item) => item.status === 'uploading')} onClick={() => void submit()}>{isNew ? '提交审核' : '提交目击记录'}</Button><Text>{isNew ? '微信审核通过后将自动收录，感谢你的发现！ ♡' : '微信审核通过后将自动发布给大家 ♡'}</Text></View>
  </View>
}
