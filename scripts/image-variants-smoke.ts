import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(__dirname, `../${path}`), 'utf8')

const variantImage = read('src/components/variant-image/index.tsx')
assert.match(variantImage, /thumbnailUrl/u, '通用图片组件必须接收缩略图地址')
assert.match(variantImage, /originalUrl/u, '通用图片组件必须保留原图地址')
assert.match(variantImage, /setThumbnailFailed\(true\)/u, '缩略图失败时必须回退原图')

const adapter = read('src/features/home/feed-post-adapter.ts')
assert.match(adapter, /thumbnail_url:/u, '首页 Feed 适配器不得丢弃缩略图字段')

const marketplaceCard = read('src/features/life-services/components/marketplace-card.tsx')
const marketplaceDetail = read('src/pages/marketplace/detail.tsx')
assert.match(marketplaceCard, /VariantImage/u, '跳蚤市场卡片必须使用缩略图组件')
assert.match(marketplaceDetail, /thumbnail_url/u, '跳蚤市场详情必须将缩略图传给图片网格')
assert.match(marketplaceDetail, /image_urls/u, '跳蚤市场详情预览必须保留原图数组')

const commentImage = read('src/features/community/components/comment-image.tsx')
assert.match(commentImage, /thumbnail_url/u, '评论图片必须接收缩略图')
assert.match(commentImage, /previewContentImages\(url, \[url\]\)/u, '评论预览必须使用原图')

const foodDetail = read('src/pages/what-to-eat/detail.tsx')
const foodCard = read('src/features/community/what-to-eat-feed-card.tsx')
assert.match(foodDetail, /thumbnail_urls/u, '餐饮详情和评价必须消费平行缩略图数组')
assert.match(foodCard, /thumbnail_urls/u, '餐饮卡片必须消费平行缩略图数组')

const catList = read('src/pages/cat-atlas/catalog-list.tsx')
const catDetail = read('src/pages/cat-atlas/detail.tsx')
assert.match(catList, /cover_thumbnail_url/u, '猫图鉴列表必须使用封面缩略图')
assert.match(catDetail, /photo_thumbnail_url/u, '猫图鉴详情必须使用相遇记录缩略图')

const clubDetail = read('src/pages/clubs/detail.tsx')
const messages = read('src/pages/direct-messages/chat.tsx')
assert.match(clubDetail, /thumbnail_url/u, '社团图集必须接收缩略图')
assert.match(messages, /thumbnail_url/u, '私信图片必须接收缩略图')

const activityPopup = read('src/features/activity-popup/popup.tsx')
assert.match(activityPopup, /VariantImage/u, '活动弹窗必须使用缩略图回退组件')
assert.match(activityPopup, /thumbnail_url/u, '活动弹窗必须接收缩略图字段')
assert.match(activityPopup, /onClick=\{onClick\}/u, '活动弹窗点击行为必须保持不变')

process.stdout.write('image variants semantic smoke: ok\n')
