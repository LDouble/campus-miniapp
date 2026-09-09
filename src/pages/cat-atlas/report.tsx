import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { KeyboardSafeInput, KeyboardSafeTextarea } from '../../components/keyboard-safe-input'
import { createCatSighting, submitCat } from '../../api/cat-atlas'
import { isApiError } from '../../api/client'
import { uploadMediaImage } from '../../api/media'
import { DEFAULT_MEDIA_IMAGE_QUALITY, mediaImageValidationError, type MediaImageDraft } from '../../features/media/images'
import { chooseMediaImages } from '../../features/media/selection'
import './catalog-report.scss'

const areas = ['一食堂', '图书馆', '宿舍区', '小树林', '教学楼', '其他']
const campuses = ['崂山校区', '鱼山校区', '西海岸校区']
const actions = ['睡觉', '干饭', '散步', '发呆', '营业中']

export default function CatReportPage() {
  const { params } = useRouter()
  const isNew = params.mode === 'new'
  const catID = params.id || ''
  const catName = params.name ? decodeURIComponent(params.name) : '它'
  const [area, setArea] = useState(isNew ? areas[0] : '')
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'located' | 'manual' | 'failed'>(isNew ? 'manual' : 'idle')
  const [campus, setCampus] = useState(campuses[0])
  const [action, setAction] = useState(actions[0])
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [images, setImages] = useState<MediaImageDraft[]>([])
  const [submitting, setSubmitting] = useState(false)
  const locateCurrentPosition = useCallback(async (showError = true) => {
    if (isNew) return
    setLocationStatus('locating')
    try {
      await Taro.getLocation({ type: 'gcj02', isHighAccuracy: true, highAccuracyExpireTime: 5000 })
      setArea('当前位置')
      setLocationStatus('located')
    } catch {
      setLocationStatus('failed')
      if (showError) await Taro.showToast({ title: '定位失败，请手动选择地点', icon: 'none' })
    }
  }, [isNew])
  useEffect(() => {
    if (!isNew) void locateCurrentPosition(false)
  }, [isNew, locateCurrentPosition])
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
        setArea(areas[result.tapIndex])
        setLocationStatus('manual')
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
      await Taro.showToast({ title: isNew ? '已提交审核' : '打卡成功', icon: 'success' }); setTimeout(() => Taro.navigateBack(), 700)
    } catch (submitError) { await Taro.showToast({ title: isApiError(submitError) ? submitError.message : '提交失败，请稍后重试', icon: 'none' }) }
    finally { setSubmitting(false) }
  }
  const image = images[0]
  const renderPhoto = () => image && <View className='report-photo'>
    <Image src={image.previewUrl} mode='aspectFill' onClick={() => Taro.previewImage({ current: image.previewUrl, urls: [image.previewUrl] })} />
    <View className='report-photo__delete' onClick={() => setImages([])}><Text>×</Text></View>
    {image.status === 'uploading' && <View className='report-photo__state'><Text>上传 {image.progress}%</Text><View><View style={{ width: `${image.progress}%` }} /></View></View>}
    {image.status === 'failed' && <View className='report-photo__state report-photo__state--failed' onClick={() => void uploadImage(image)}><Text>上传失败</Text><Text>点击重试</Text></View>}
  </View>
  return <View className={`report-page ${isNew ? 'report-page--new' : 'report-page--sighting'}`}>
    <View className='report-nav'><Text onClick={() => Taro.navigateBack()}>×</Text><Text>{isNew ? '' : '我遇到它了'}</Text><View /></View>
    <View className='report-page__content'>
      <View className='report-heading'>
        <View className='report-heading__eyebrow'><Text>{isNew ? '新猫档案' : '相遇记录'}</Text><Text>OUC · CAT ATLAS</Text></View>
        <Text className='report-heading__title'>{isNew ? '发现了一只新猫？' : `我遇到${catName}了！`}</Text>
        <Text className='report-heading__subtitle'>{isNew ? '让更多同学认识这位校园邻居吧' : '把这次温柔的相遇，留在它的档案里'}</Text>
        <View className='report-heading__meta'><Text>{isNew ? '一张照片 · 一段新的校园记忆' : `${catName} · 校园目击`}</Text><Text>{isNew ? 'NEW' : 'NOTE'}</Text></View>
      </View>
      {isNew && <>
        <Text className='report-label'>上传照片 <Text>*</Text></Text>
        <View className='report-upload-caption'><Text>拍下最能认出它的样子</Text><Text>必填 · JPG / PNG</Text></View>
        <View className='report-upload-row'>{renderPhoto()}<View className='report-photo report-photo--add' onClick={() => void chooseImages()}><Text>+</Text><Text>添加照片</Text></View></View>
        <Text className='report-label'>在哪里看到的？ <Text>*</Text></Text>
        <View className='report-options'>{campuses.map((item) => <Text key={item} className={campus === item ? 'is-active' : ''} onClick={() => setCampus(item)}>{item}</Text>)}</View>
        <View className='report-picker' onClick={() => void chooseArea()}><View><Text>●</Text><Text>{area || '请选择地点'}</Text></View><Text>›</Text></View>
        <Text className='report-label'>大家怎么叫它？ <Text className='report-label__optional'>（可选）</Text></Text>
        <View className='report-input-wrap'><KeyboardSafeInput className='report-input' value={name} maxlength={32} placeholder='不知道也可以不填' onInput={(event) => setName(event.detail.value)} /></View>
      </>}
      {!isNew && <>
        <Text className='report-label'>在哪里遇到？</Text>
        <View className='report-location-primary' onClick={() => void locateCurrentPosition(true)}>
          <View className='report-location-primary__main'>
            <Text className='report-location-primary__icon'>⌖</Text>
            <View><Text>{locationStatus === 'located' ? '当前位置' : area || '尚未选择地点'}</Text><Text>{locationStatus === 'locating' ? '正在获取当前位置…' : locationStatus === 'failed' ? '定位失败，可手动选择' : locationStatus === 'manual' ? '已手动选择，可点击重新定位' : '优先使用当前位置'}</Text></View>
          </View>
          <Text className='report-location-primary__action'>{locationStatus === 'locating' ? '定位中' : '重新定位'}</Text>
        </View>
        <Text className='report-location-fallback'>也可以直接选择校内区域</Text>
        <View className='report-options'>{areas.map((item) => <Text key={item} className={area === item ? 'is-active' : ''} onClick={() => { setArea(item); setLocationStatus('manual') }}>{item}</Text>)}</View>
        <Text className='report-label'>它在做什么？</Text><View className='report-options'>{actions.map((item) => <Text key={item} className={action === item ? 'is-active' : ''} onClick={() => setAction(item)}>{item}</Text>)}</View>
        <Text className='report-label'>上传照片 <Text className='report-label__optional'>（可选）</Text></Text>
        <View className='report-upload-caption'><Text>给这次相遇留一张现场照片</Text><Text>可选 · 记录此刻</Text></View>
        <View className='report-upload-row'>{renderPhoto()}<View className='report-photo report-photo--add' onClick={() => void chooseImages()}><Text>+</Text><Text>添加照片</Text></View></View>
      </>}
      <Text className='report-label'>{isNew ? '它有什么特点？' : '想说点什么？'} <Text className='report-label__optional'>（可选）</Text></Text>
      <View className='report-textarea-wrap'><KeyboardSafeTextarea className='report-textarea' value={note} maxlength={200} placeholder={isNew ? '比如毛色、性格、外观特征、经常出现的地方…' : '分享一下你看到它吧～'} onInput={(event) => setNote(event.detail.value)} /><Text>{note.length}/200</Text></View>
    </View>
    <View className='report-footer'><Button className='report-submit' hoverClass='none' loading={submitting} disabled={submitting || images.some((item) => item.status === 'uploading')} onClick={() => void submit()}>{isNew ? '提交申请' : '发布目击记录'}</Button><Text>{isNew ? '我们会尽快审核，感谢你的发现！ ♡' : '让更多同学知道它刚刚在这里出现过 ♡'}</Text></View>
  </View>
}
