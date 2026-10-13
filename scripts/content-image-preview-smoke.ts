import { strict as assert } from 'node:assert'

const Module = require('node:module')
const originalLoad = Module._load
const imageInfoRequests: string[] = []
const previews: Array<{ current: string; urls: string[] }> = []
const taro = {
  getImageInfo: async ({ src }: { src: string }) => {
    imageInfoRequests.push(src)
    return { path: '/tmp/original.jpg' }
  },
  previewImage: (options: { current: string; urls: string[] }) => {
    previews.push(options)
    return Promise.resolve()
  },
}
Module._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === '@tarojs/taro') return { default: taro }
  if (request === '@tarojs/components') return { Image: 'Image', Text: 'Text', View: 'View' }
  if (request === 'react') return { useState: (initial: unknown) => [initial, () => undefined] }
  if (request === 'react/jsx-runtime') {
    const jsx = (type: unknown, props: unknown) => ({ type, props })
    return { jsx, jsxs: jsx }
  }
  return originalLoad.call(this, request, parent, isMain)
}
require.extensions['.scss'] = () => undefined

const ContentImageGrid = require('../src/features/community/components/content-image-grid').default
const original = 'https://cdn.example.com/original.jpg'
const thumbnail = 'https://cdn.example.com/thumbnail.jpg'
const tree = ContentImageGrid({ images: [{ id: 1, url: original, thumbnail_url: thumbnail }], preview: true })
const frame = tree.props.children[0]
const image = frame.props.children[0]
assert.equal(image.props.src, thumbnail, '列表必须显示缩略图')
image.props.onLoad({ detail: { width: 320, height: 240 } })
assert.deepEqual(imageInfoRequests, [], '缩略图展示后不得提前下载原图')
assert.deepEqual(previews, [], '展示图片不得自动打开预览')
frame.props.onClick()
assert.deepEqual(previews, [{ current: original, urls: [original] }], '点击后必须把原图交给微信预览')

const detail = ContentImageGrid({ images: [{ id: 1, url: original, thumbnail_url: thumbnail }], preview: true, preloadPreview: false })
detail.props.children[0].props.children[0].props.onLoad({ detail: { width: 320, height: 240 } })
assert.deepEqual(imageInfoRequests, [], '社区详情不得预取原图')
detail.props.children[0].props.onClick()
assert.deepEqual(previews[1], { current: original, urls: [original] }, '社区详情点击必须使用原图')

const legacy = ContentImageGrid({ images: [{ id: 2, url: original }], preview: true, preloadPreview: false })
assert.equal(legacy.props.children[0].props.children[0].props.src, original, '没有缩略图的历史响应仍可显示原图')
console.log('content image preview smoke: ok')
