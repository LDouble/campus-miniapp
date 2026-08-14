import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import type { MediaImageDraft } from '../../features/media/images'
import './index.scss'

export type MediaImageEditorProps = {
  images: MediaImageDraft[]
  maxCount: number
  onAdd: () => void
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (key: string) => void
  onRetry: (image: MediaImageDraft) => void
}

export default function MediaImageEditor({
  images,
  maxCount,
  onAdd,
  onMove,
  onRemove,
  onRetry,
}: MediaImageEditorProps) {
  const previewUrls = images.map((image) => image.previewUrl).filter(Boolean)
  return (
    <View className='media-image-editor'>
      <View className='media-image-editor__head'>
        <View>
          <Text>图片</Text>
          <Text>首图作为封面，可调整顺序</Text>
        </View>
        <Text>{images.length}/{maxCount}</Text>
      </View>
      <View className='media-image-editor__grid'>
        {images.map((image, index) => (
          <View key={image.key} className='media-image-editor__item'>
            <View
              className='media-image-editor__preview'
              ariaRole='button'
              ariaLabel={`预览第 ${index + 1} 张图片`}
              onClick={() => Taro.previewImage({ current: image.previewUrl, urls: previewUrls })}
            >
              <Image src={image.previewUrl} mode='aspectFill' />
              <Text className='media-image-editor__order'>{index + 1}</Text>
              {index === 0 && <Text className='media-image-editor__cover'>封面</Text>}
              {image.status === 'uploading' && (
                <View className='media-image-editor__progress'>
                  <View style={{ width: `${image.progress}%` }} />
                </View>
              )}
              {image.status === 'failed' && (
                <View className='media-image-editor__failed'>上传失败</View>
              )}
            </View>
            <View className='media-image-editor__actions'>
              <Text
                className={index === 0 ? 'is-disabled' : ''}
                onClick={() => onMove(index, -1)}
              >前移</Text>
              <Text
                className={index === images.length - 1 ? 'is-disabled' : ''}
                onClick={() => onMove(index, 1)}
              >后移</Text>
              {image.status === 'failed' && (
                <Text className='is-retry' onClick={() => onRetry(image)}>重试</Text>
              )}
              <Text className='is-danger' onClick={() => onRemove(image.key)}>删除</Text>
            </View>
            {image.status === 'uploading' && (
              <Text className='media-image-editor__message'>正在安全上传 {image.progress}%</Text>
            )}
            {image.status === 'failed' && (
              <Text className='media-image-editor__message media-image-editor__message--error'>
                {image.error || '网络异常，请重试'}
              </Text>
            )}
          </View>
        ))}
        {images.length < maxCount && (
          <View
            className='media-image-editor__add'
            ariaRole='button'
            ariaLabel={`添加图片，还可选择 ${maxCount - images.length} 张`}
            onClick={onAdd}
          >
            <Image src={require('../../assets/icons/plus.svg')} mode='aspectFit' />
            <Text>添加图片</Text>
            <Text>最多 {maxCount} 张</Text>
          </View>
        )}
      </View>
      <Text className='media-image-editor__hint'>支持 JPEG、PNG、WebP，选择后自动压缩</Text>
    </View>
  )
}
