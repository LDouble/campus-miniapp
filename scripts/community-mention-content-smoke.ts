import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildMentionContentSegments,
  expandMentionDeletion,
  insertMentionToken,
  removeMentionTokens,
} from '../src/features/mentions/content'

const mentionCandidate = { id: 7, nickname: '海风同学', avatar_url: null }

assert.deepEqual(
  insertMentionToken('前后', '海风同学', 1),
  { text: '前@海风同学 后', cursor: 7 },
)
assert.deepEqual(
  insertMentionToken('替换这里', '木棉同学', 1, 3),
  { text: '替@木棉同学 里', cursor: 7 },
)
assert.deepEqual(insertMentionToken('文本', '', 1), { text: '文本', cursor: 1 })
assert.deepEqual(
  expandMentionDeletion(
    '前 @海风同学 后',
    '前 @海风同学后',
    [mentionCandidate],
  ),
  { text: '前 后', cursor: 2, removedCandidateIds: [7] },
)
assert.deepEqual(
  expandMentionDeletion('前 @海风同学 ', '前 @海风同学', [mentionCandidate]),
  { text: '前 ', cursor: 2, removedCandidateIds: [7] },
)
assert.deepEqual(
  removeMentionTokens('前 @海风同学 后', '海风同学', 9),
  { text: '前 后', cursor: 3 },
)
assert.deepEqual(
  buildMentionContentSegments('前 @海风同学 后', [mentionCandidate]),
  [
    { type: 'text', text: '前 ' },
    { type: 'mention', text: '@海风同学', user_id: 7, nickname: '海风同学' },
    { type: 'text', text: ' 后' },
  ],
)

const componentSource = readFileSync(
  resolve(__dirname, '../src/components/mention-content/index.tsx'),
  'utf8',
)
const stickerComponentSource = readFileSync(
  resolve(__dirname, '../src/components/sticker-content/index.tsx'),
  'utf8',
)
assert.ok(componentSource.includes('content_segments') || componentSource.includes('segments'))
assert.ok(componentSource.includes('openPublicProfile'))
assert.ok(componentSource.includes('event.stopPropagation()'))
assert.ok(componentSource.includes('selectable'), '正文和提及内容必须支持长按选择')
assert.ok(stickerComponentSource.includes('selectable'), '贴纸文本内容必须支持长按选择')

const postSource = readFileSync(
  resolve(__dirname, '../src/features/community/post-card.tsx'),
  'utf8',
)
const commentSource = readFileSync(
  resolve(__dirname, '../src/features/life-services/components/detail-comments.tsx'),
  'utf8',
)
const publishSource = readFileSync(
  resolve(__dirname, '../src/pages/publish/index.tsx'),
  'utf8',
)
const pickerSource = readFileSync(
  resolve(__dirname, '../src/features/mentions/mention-picker.tsx'),
  'utf8',
)
assert.ok(postSource.includes('<MentionContent'))
assert.ok(commentSource.includes('<MentionContent'))
assert.ok(commentSource.includes('business-detail-composer__tool-row'))
assert.ok(commentSource.includes("requestWechatSubscriptionForModule('private_message')"))
assert.ok(!commentSource.includes('business-detail-composer__input-actions'))
assert.ok(commentSource.includes('expandMentionDeletion'))
assert.ok(publishSource.includes('expandMentionDeletion'))
assert.ok(!commentSource.includes('<MentionPickerSelection'))
assert.ok(pickerSource.includes('export function useMentionPicker'))
assert.ok(pickerSource.includes('export function MentionPickerOverlay'))
assert.ok(pickerSource.includes('export function MentionPickerSelection'))
assert.ok(commentSource.includes('<MentionPickerOverlay'))
assert.ok(commentSource.indexOf('<MentionPickerOverlay') < commentSource.indexOf('className={composerOpen'))
assert.ok(pickerSource.includes('onRemove?.(candidate)'))
assert.ok(pickerSource.includes('onClear?.(selected)'))
assert.ok(pickerSource.includes('focus={open}'))
assert.ok(commentSource.includes('focus={composerOpen && inputFocused && !mentionPickerOpen}'))
assert.ok(publishSource.includes('focus={contentInputFocused && !mentionPickerOpen}'))
assert.ok(!publishSource.includes('setMentionPickerOpen(true)\n                            void Taro.hideKeyboard()'))

process.stdout.write('community mention content smoke: ok\n')
