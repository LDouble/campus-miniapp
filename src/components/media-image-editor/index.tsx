import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import type { MediaImageDraft } from '../../features/media/images'
import './index.scss'

export type MediaImageEditorProps = {
  images: MediaImageDraft[]
  maxCount: number
  title?: string
  hint?: string
  showCover?: boolean
  onAdd: () => void
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (key: string) => void
  onRetry: (image: MediaImageDraft) => void
}

export default function MediaImageEditor({
  images,
  maxCount,
  title = '图片',
  hint = '首图作为封面，点击预览',
  showCover = true,
  onAdd,
  onMove,
  onRemove,
  onRetry,
}: MediaImageEditorProps) {
  const previewUrls = images.map((image) => image.previewUrl).filter(Boolean)
  if (images.length === 0) return null

  return (
    <View className='media-image-editor'>
      <View className='media-image-editor__head'>
        <View>
          <Text>{title}</Text>
          <Text>{hint}</Text>
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
              {showCover && index === 0 && <Text className='media-image-editor__cover'>封面</Text>}
              <View
                className='media-image-editor__remove'
                ariaRole='button'
                ariaLabel={`删除第 ${index + 1} 张图片`}
                onClick={(event) => {
                  event.stopPropagation()
                  onRemove(image.key)
                }}
              ><Text>×</Text></View>
              {image.status === 'uploading' && (
                <View className='media-image-editor__uploading'>
                  <Text>上传中 {image.progress}%</Text>
                  <View className='media-image-editor__progress'>
                    <View style={{ width: `${image.progress}%` }} />
                  </View>
                </View>
              )}
              {image.status === 'failed' && (
                <View
                  className='media-image-editor__failed'
                  ariaRole='button'
                  ariaLabel={`第 ${index + 1} 张图片上传失败，点击重试`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onRetry(image)
                  }}
                ><Text>上传失败 · 重试</Text></View>
              )}
              {images.length > 1 && image.status !== 'uploading' && image.status !== 'failed' && (
                <View className='media-image-editor__actions'>
                  <View
                    className={index === 0 ? 'is-disabled' : ''}
                    ariaRole='button'
                    ariaLabel={`将第 ${index + 1} 张图片前移`}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (index > 0) onMove(index, -1)
                    }}
                  ><Text>‹</Text></View>
                  <Text>{index + 1}</Text>
                  <View
                    className={index === images.length - 1 ? 'is-disabled' : ''}
                    ariaRole='button'
                    ariaLabel={`将第 ${index + 1} 张图片后移`}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (index < images.length - 1) onMove(index, 1)
                    }}
                  ><Text>›</Text></View>
                </View>
              )}
            </View>
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
            <Text>添加</Text>
            <Text>还可选 {maxCount - images.length} 张</Text>
          </View>
        )}
      </View>
    </View>
  )
}
