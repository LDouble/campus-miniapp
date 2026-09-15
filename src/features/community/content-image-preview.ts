import Taro from '@tarojs/taro'

const MAX_CACHED_PREVIEW_IMAGES = 64
const localImagePaths = new Map<string, string>()
const pendingImagePaths = new Map<string, Promise<unknown>>()

const rememberLocalPath = (url: string, path: string) => {
  localImagePaths.delete(url)
  localImagePaths.set(url, path)
  if (localImagePaths.size <= MAX_CACHED_PREVIEW_IMAGES) return
  const oldestUrl = localImagePaths.keys().next().value
  if (oldestUrl) localImagePaths.delete(oldestUrl)
}

const preloadContentImage = (url: string) => {
  if (!url || localImagePaths.has(url) || pendingImagePaths.has(url)) return

  const pending = Taro.getImageInfo({ src: url })
    .then((result) => {
      const path = result.path?.trim()
      if (path) rememberLocalPath(url, path)
    })
    .catch(() => undefined)
    .finally(() => pendingImagePaths.delete(url))

  pendingImagePaths.set(url, pending)
}

export const warmContentImagePreview = (urls: string[]) => {
  urls.forEach((url) => preloadContentImage(url))
}

export const previewContentImages = (current: string, urls: string[]) => {
  const normalizedUrls = urls.map((url) => url.trim()).filter(Boolean)
  const normalizedCurrent = current.trim()
  if (!normalizedCurrent || normalizedUrls.length === 0) return

  const previewUrls = normalizedUrls.map((url) => localImagePaths.get(url) || url)
  const currentIndex = normalizedUrls.indexOf(normalizedCurrent)
  const previewCurrent = currentIndex >= 0 ? previewUrls[currentIndex] : normalizedCurrent
  void Taro.previewImage({ current: previewCurrent, urls: previewUrls })
}
