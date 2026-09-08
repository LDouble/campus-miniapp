import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import MediaImageEditor from '../../components/media-image-editor'
import { KeyboardSafeInput, KeyboardSafeTextarea } from '../../components/keyboard-safe-input'
import { createCatSighting, submitCat } from '../../api/cat-atlas'
import { isApiError } from '../../api/client'
import { uploadMediaImage } from '../../api/media'
import { DEFAULT_MEDIA_IMAGE_QUALITY, mediaImageValidationError } from '../../features/media/images'
import type { MediaImageDraft } from '../../features/media/images'
import { chooseMediaImages } from '../../features/media/selection'
import './shared.scss'

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
    try { const selected = await chooseMediaImages({ count: 1, maxDimension: 1600, quality: DEFAULT_MEDIA_IMAGE_QUALITY }); if (selected.length) { setImages(selected); void uploadImage(selected[0]) } }
    catch (chooseError) { void Taro.showToast({ title: chooseError instanceof Error ? chooseError.message : '图片选择失败', icon: 'none' }) }
  }
  const submit = async () => {
    if (isNew && !images.length) {
      await Taro.showToast({ title: '请上传一张猫咪照片', icon: 'none' })
      return
    }
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
  return <View className='cat-page'><CustomNavbar title={isNew ? '发现了一只新猫？' : '我遇到它了'} showBack /><View className='cat-page__content'>
    <View className='cat-hero'><Text className='cat-hero__eyebrow'>{isNew ? '让更多同学认识它' : '留下这次温柔的相遇'}</Text><Text className='cat-hero__copy'>{isNew ? '投稿审核通过后，猫咪才会出现在公开图鉴。' : '公开展示只会使用区域级位置，不会暴露精确坐标。'}</Text></View>
    {isNew && <><Text className='cat-form-label'>大家怎么叫它？ <Text className='cat-muted'>（可选）</Text></Text><KeyboardSafeInput className='cat-input cat-input--single' value={name} maxlength={32} placeholder='不知道也可以不填' onInput={(event) => setName(event.detail.value)} /></>}
    <Text className='cat-form-label'>在哪里遇到？</Text><View className='cat-options'>{areas.map((item) => <Text key={item} className={`cat-option ${area === item ? 'cat-option--active' : ''}`} onClick={() => setArea(item)}>{item}</Text>)}</View>
    {!isNew && <><Text className='cat-form-label'>它在做什么？</Text><View className='cat-options'>{actions.map((item) => <Text key={item} className={`cat-option ${action === item ? 'cat-option--active' : ''}`} onClick={() => setAction(item)}>{item}</Text>)}</View></>}
    <Text className='cat-form-label'>上传照片 {isNew ? <Text className='cat-required'>*</Text> : <Text className='cat-muted'>（可选）</Text>}</Text>
    <MediaImageEditor images={images} maxCount={1} title='现场照片' hint={isNew ? '投稿必须上传清晰照片' : '可选，帮助其他同学认出它'} showCover={false} onAdd={() => void chooseImages()} onMove={() => undefined} onRemove={(key) => setImages((current) => current.filter((image) => image.key !== key))} onRetry={(image) => void uploadImage(image)} />
    {!images.length && <View className='cat-upload-empty' onClick={() => void chooseImages()}><Image src={require('../../assets/icons/image.svg')} mode='aspectFit' /><Text>从相册或相机添加照片</Text><Text>{isNew ? '清晰展示猫咪即可' : '不上传也能完成打卡'}</Text></View>}
    <Text className='cat-form-label'>{isNew ? '它有什么特点？' : '想说点什么？'} <Text className='cat-muted'>（可选）</Text></Text><KeyboardSafeTextarea className='cat-input' value={note} maxlength={200} placeholder={isNew ? '比如毛色、性格、常出没的地方…' : '分享一下你看到它吧～'} onInput={(event) => setNote(event.detail.value)} />
    <Button className='cat-primary-button' loading={submitting} disabled={submitting || images.some((image) => image.status === 'uploading')} onClick={() => void submit()}>{isNew ? '提交申请' : '发布目击记录'}</Button>
  </View></View>
}
