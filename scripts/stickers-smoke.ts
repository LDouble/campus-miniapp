import { strict as assert } from 'node:assert'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  campusStickerDefinitions,
  deserializeStickerContent,
  editableStickerContent,
  insertStickerToken,
  parseStickerContent,
  plainStickerContent,
  serializeStickerContent,
  serializeStickerTokens,
  stickerIdsFromEditableContent,
} from '../src/features/stickers/content'

const ids = campusStickerDefinitions.map((sticker) => sticker.id)
const labels = campusStickerDefinitions.map((sticker) => sticker.label)
assert.equal(ids.length, 32)
assert.equal(new Set(ids).size, 32)
assert.equal(new Set(labels).size, labels.length, '可见标签必须唯一，才能稳定还原表情 ID')

const stickerIndexSource = readFileSync(resolve(__dirname, '../src/assets/stickers/index.ts'), 'utf8')
const assetIds = [...stickerIndexSource.matchAll(/id: '(sticker-\d{2})'/gu)].map((match) => match[1])
assert.deepEqual(assetIds, ids)

const stickerPickerSource = readFileSync(resolve(__dirname, '../src/components/sticker-picker/index.tsx'), 'utf8')
const stickerPickerStyleSource = readFileSync(resolve(__dirname, '../src/components/sticker-picker/index.scss'), 'utf8')
assert.ok(!stickerPickerSource.includes('selectedIds'))
assert.ok(!stickerPickerSource.includes('sticker-picker__item--selected'))
assert.ok(!stickerPickerStyleSource.includes('&--selected'))
assert.ok(stickerPickerSource.includes("require('../../assets/icons/smile.svg')"), '表情入口必须复用既有 smile 图标')
assert.ok(!stickerPickerSource.includes('>☺<'), '表情入口不得使用 Emoji 图标')

const publishSource = readFileSync(resolve(__dirname, '../src/pages/publish/index.tsx'), 'utf8')
const publishStyleSource = readFileSync(resolve(__dirname, '../src/pages/publish/index.scss'), 'utf8')
const commentsSource = readFileSync(resolve(__dirname, '../src/features/life-services/components/detail-comments.tsx'), 'utf8')
const commentsStyleSource = readFileSync(resolve(__dirname, '../src/features/life-services/components/detail-comments.scss'), 'utf8')
assert.match(publishSource, /if \(keyboardHeight > 0\) setStickerPickerOpen\(false\)/u)
assert.ok(publishSource.includes("require('../../assets/icons/smile.svg')"))
assert.ok(!publishSource.includes('<Text>☺</Text>'))
assert.match(publishStyleSource, /&__icon \{[\s\S]*?width: 38rpx;[\s\S]*?height: 38rpx;/u)
assert.ok(existsSync(resolve(__dirname, '../src/assets/icons/smile.svg')))
assert.match(commentsSource, /if \(height > 0\) \{[\s\S]*?setStickerPickerOpen\(false\)/u)
assert.match(commentsStyleSource, /business-detail-comment__sticker[^}]*width: 52rpx;[^}]*height: 52rpx;/u)

let stickerAssetBytes = 0

for (const id of ids) {
  const imagePath = resolve(__dirname, `../src/assets/stickers/${id}.png`)
  assert.ok(existsSync(imagePath), `${id} 图片资源缺失`)
  const image = readFileSync(imagePath)
  assert.deepEqual(image.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  assert.equal(image.readUInt32BE(16), 96, `${id} 宽度必须为 96px`)
  assert.equal(image.readUInt32BE(20), 96, `${id} 高度必须为 96px`)
  assert.ok(image.includes(Buffer.from('tRNS')) || [4, 6].includes(image[25]), `${id} 必须保留透明通道`)
  stickerAssetBytes += statSync(imagePath).size
}

assert.ok(stickerAssetBytes <= 200 * 1024, `表情资源总体积过大：${stickerAssetBytes} bytes`)

const mixed = serializeStickerContent('考试周加油 ', ['sticker-01', 'sticker-25'])
assert.equal(mixed, '考试周加油 [开心][考试崩溃]')
assert.deepEqual(deserializeStickerContent(mixed), {
  text: '考试周加油 [开心][考试崩溃]',
  stickerIds: ['sticker-01', 'sticker-25'],
})
assert.equal(plainStickerContent(mixed), '考试周加油 [开心][考试崩溃]')
assert.deepEqual(
  parseStickerContent(mixed).map((part) => part.type === 'text' ? part.text : part.sticker.id),
  ['考试周加油 ', 'sticker-01', 'sticker-25'],
)
assert.equal(serializeStickerContent('', ['sticker-03']), '[大哭]')
assert.equal(serializeStickerContent('普通文本', ['not-allowed']), '普通文本')

const editableMixed = '今天[开心]一起[大哭]复习'
const storedMixed = serializeStickerTokens(editableMixed)
assert.equal(
  storedMixed,
  editableMixed,
)
assert.equal(editableStickerContent(storedMixed), editableMixed)
assert.deepEqual(stickerIdsFromEditableContent(editableMixed), ['sticker-01', 'sticker-03'])
assert.equal(serializeStickerTokens('保留[普通标签]'), '保留[普通标签]')
assert.ok(!storedMixed.includes('campus-sticker:'), '新内容不得暴露内部表情协议前缀')

const legacyMixed = '旧内容[[campus-sticker:v1:sticker-01:开心]]和[[campus-sticker:v1:sticker-03:大哭]]'
assert.deepEqual(deserializeStickerContent(legacyMixed), {
  text: '旧内容[开心]和[大哭]',
  stickerIds: ['sticker-01', 'sticker-03'],
})
assert.deepEqual(
  parseStickerContent(legacyMixed).map((part) => part.type === 'text' ? part.text : part.sticker.id),
  ['旧内容', 'sticker-01', '和', 'sticker-03'],
)

assert.deepEqual(insertStickerToken('前后', 'sticker-03', 1), { text: '前[大哭]后', cursor: 5 })
assert.deepEqual(insertStickerToken('替换这里', 'sticker-01', 2, 4), { text: '替换[开心]', cursor: 6 })
assert.deepEqual(insertStickerToken('文本', 'not-allowed', 1), { text: '文本', cursor: 1 })

for (const [stored, fallback] of [
  ['[[campus-sticker:v1:sticker-99:未知]]', '[未知]'],
  ['[[campus-sticker:v1:sticker-01:伪造标签]]', '[开心]'],
  ['[[campus-sticker:v2:sticker-01:开心]]', '[开心]'],
  ['[[campus-sticker:v1:../../secret:开心]]', '[开心]'],
  ['[[campus-sticker:v1:sticker-99:含\n换行]]', '[表情]'],
] as const) {
  assert.deepEqual(deserializeStickerContent(stored), { text: fallback, stickerIds: [] })
  assert.equal(plainStickerContent(stored), fallback)
  assert.ok(!plainStickerContent(stored).includes('campus-sticker:'))
}

const incompleteMarker = '[[campus-sticker:v1:sticker-01:开心]'
assert.deepEqual(deserializeStickerContent(incompleteMarker), { text: incompleteMarker, stickerIds: [] })
assert.equal(plainStickerContent(incompleteMarker), incompleteMarker)

process.stdout.write('stickers smoke: ok\n')
