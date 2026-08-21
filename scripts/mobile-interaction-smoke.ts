import { strict as assert } from 'node:assert'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const sourceRoot = resolve(__dirname, '../src')

const collectTsxFiles = (directory: string): string[] => readdirSync(directory).flatMap((entry) => {
  const path = resolve(directory, entry)
  return statSync(path).isDirectory()
    ? collectTsxFiles(path)
    : path.endsWith('.tsx') ? [path] : []
})

for (const path of collectTsxFiles(sourceRoot)) {
  const source = readFileSync(path, 'utf8')
  assert.doesNotMatch(
    source,
    /hoverClass=(?!['"]none['"])|hoverStartTime=|hoverStayTime=|hoverStopPropagation/u,
    `${path} 仍包含移动端不需要的 hover 配置`,
  )
  for (const buttonTag of source.match(/<Button\b[\s\S]*?>/gu) || []) {
    assert.match(buttonTag, /hoverClass='none'/u, `${path} 的原生 Button 未关闭默认按压态`)
  }
}

const readSource = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')
const cardSource = readSource('../src/features/community/post-card.tsx')
const commentSheetSource = readSource('../src/features/community/comment-sheet.tsx')
const detailCommentsSource = readSource('../src/features/life-services/components/detail-comments.tsx')
const detailCommentsStyles = readSource('../src/features/life-services/components/detail-comments.scss')
const homeSource = readSource('../src/pages/index/index.tsx')
const homeAdapterSource = readSource('../src/features/home/feed-post-adapter.ts')

assert.match(cardSource, /onReplyComment\?:/u)
assert.match(cardSource, /onReplyComment\(post, comment\)/u)
assert.match(detailCommentsSource, /onClick=\{\(\) => onStartReply\(comment\)\}/u)
assert.match(detailCommentsSource, /assets\/community\/send\.svg/u)
assert.doesNotMatch(detailCommentsSource, /detail-send\.svg|publish--comment/u)
assert.match(detailCommentsSource, /className='business-detail-composer__input-actions'/u)
assert.match(detailCommentsStyles, /business-detail-composer__publish::before[\s\S]*?width: 56rpx;[\s\S]*?height: 56rpx;/u)
assert.match(detailCommentsStyles, /business-detail-composer__action::before[^{]*\{[^}]*height: 64rpx;/u)
assert.match(detailCommentsStyles, /business-detail-composer__input-actions[\s\S]*?margin-left: auto;[\s\S]*?justify-content: flex-end;/u)
assert.match(detailCommentsStyles, /business-detail-composer__sticker-trigger \{[\s\S]*?font-size: 32rpx;/u)
assert.match(detailCommentsSource, /onClick=\{!liking \? \(event\) => \{[\s\S]*?event\.stopPropagation\(\)[\s\S]*?onToggleLike\(comment\)/u)
assert.match(
  detailCommentsSource,
  /if \(initialReplyTarget\) \{[\s\S]*?setReplyTarget\(initialReplyTarget\)[\s\S]*?setReplyAnchorSelector/u,
)
assert.match(commentSheetSource, /initialReplyTarget=\{initialReplyTarget\}/u)
assert.match(commentSheetSource, /if \(mutation\.type === 'create'\)/u)
assert.match(homeSource, /item\.source_type === 'campus_circle_post'[\s\S]*?onToggleLike=/u)
assert.match(homeSource, /onToggleLike=\{item\.source_type === 'campus_circle_post'[\s\S]*?: undefined\}/u)
assert.match(homeSource, /homeCommentItem !== null && !homeCommentSubmitting/u)
assert.match(homeSource, /onSubmittingChange=\{setHomeCommentSubmitting\}/u)
assert.match(homeSource, /liked: item\.liked/u)
assert.match(homeAdapterSource, /liked: reaction\?\.liked \?\? item\.liked/u)
assert.match(homeAdapterSource, /liked_by_nicknames: reaction\?\.likedByNicknames \?\? item\.liked_by_nicknames/u)

process.stdout.write('mobile interaction smoke: ok\n')
