import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { KeyboardSafeInput, KeyboardSafeTextarea } from '../../components/keyboard-safe-input'
import { createCatSighting, submitCat } from '../../api/cat-atlas'
import { isApiError } from '../../api/client'
import { uploadMediaImage } from '../../api/media'
import { DEFAULT_MEDIA_IMAGE_QUALITY, mediaImageValidationError, type MediaImageDraft } from '../../features/media/images'
import { chooseMediaImages } from '../../features/media/selection'
import './catalog-report.scss'

const areas = ['一食堂', '图书馆', '宿舍区', '小树林', '教学楼', '其他']
const actions = ['睡觉', '干饭', '散步', '发呆', '营业中']

export default function CatReportPage() {
  const { params } = useRouter()
  const isNew = params.mode === 'new'
  const [area, setArea] = useState(areas[0])
  const [action, setAction] = useState(actions[0])
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [images, setImages] = useState<MediaImageDraft[]>([])
  const [submitting, setSubmitting] = useState(false)
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
    try { const result = await Taro.showActionSheet({ itemList: areas }); if (typeof result.tapIndex === 'number') setArea(areas[result.tapIndex]) } catch { /* 用户取消 */ }
  }
  const submit = async () => {
    if (isNew && !images.length) { await Taro.showToast({ title: '请上传一张猫咪照片', icon: 'none' }); return }
    const imageError = mediaImageValidationError(images, 1)
    if (imageError) { await Taro.showToast({ title: imageError, icon: 'none' }); return }
    setSubmitting(true)
    try {
      const mediaId = images[0]?.mediaId
      if (isNew) await submitCat({ proposed_name: name.trim() || undefined, area, description: note.trim() || undefined, photo_media_id: mediaId! })
      else await createCatSighting(params.id || '', { area, activity: action, note: note.trim() || undefined, photo_media_id: mediaId })
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
      <View className='report-heading'><Text>{isNew ? '发现了一只新猫？' : '我遇到橘座了！'}</Text><Text>{isNew ? '— 让更多同学认识它吧！ ✦' : '留下这次温柔的相遇吧～'}</Text></View>
      {isNew && <>
        <Text className='report-label'>上传照片 <Text>*</Text></Text>
        <View className='report-upload-row'>{renderPhoto()}<View className='report-photo report-photo--add' onClick={() => void chooseImages()}><Text>+</Text><Text>添加照片</Text></View></View>
        <Text className='report-label'>在哪里看到的？ <Text>*</Text></Text>
        <View className='report-picker' onClick={() => void chooseArea()}><View><Text>●</Text><Text>{area || '请选择地点'}</Text></View><Text>›</Text></View>
        <Text className='report-label'>大家怎么叫它？ <Text className='report-label__optional'>（可选）</Text></Text>
        <View className='report-input-wrap'><KeyboardSafeInput className='report-input' value={name} maxlength={32} placeholder='不知道也可以不填' onInput={(event) => setName(event.detail.value)} /></View>
      </>}
      {!isNew && <>
        <Text className='report-label'>在哪里遇到？</Text><View className='report-options'>{areas.map((item) => <Text key={item} className={area === item ? 'is-active' : ''} onClick={() => setArea(item)}>{item}</Text>)}</View>
        <Text className='report-label'>它在做什么？</Text><View className='report-options'>{actions.map((item) => <Text key={item} className={action === item ? 'is-active' : ''} onClick={() => setAction(item)}>{item}</Text>)}</View>
        <Text className='report-label'>上传照片 <Text className='report-label__optional'>（可选）</Text></Text><View className='report-upload-row'>{renderPhoto()}<View className='report-photo report-photo--add' onClick={() => void chooseImages()}><Text>+</Text><Text>添加照片</Text></View></View>
      </>}
      <Text className='report-label'>{isNew ? '它有什么特点？' : '想说点什么？'} <Text className='report-label__optional'>（可选）</Text></Text>
      <View className='report-textarea-wrap'><KeyboardSafeTextarea className='report-textarea' value={note} maxlength={200} placeholder={isNew ? '比如毛色、性格、外观特征、经常出现的地方…' : '分享一下你看到它吧～'} onInput={(event) => setNote(event.detail.value)} /><Text>{note.length}/200</Text></View>
    </View>
    <View className='report-footer'><Button className='report-submit' loading={submitting} disabled={submitting || images.some((item) => item.status === 'uploading')} onClick={() => void submit()}>{isNew ? '提交申请' : '发布目击记录'}</Button><Text>{isNew ? '我们会尽快审核，感谢你的发现！ ♡' : '让更多同学知道它刚刚在这里出现过 ♡'}</Text></View>
  </View>
}
