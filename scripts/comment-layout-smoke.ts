import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as ts from 'typescript'
import * as comments from '../src/features/community/comments'

// 执行真实回复渲染函数，检查原生节点结构，而非只匹配 CSS 文本。
const source = readFileSync(resolve(__dirname, '../src/features/life-services/components/detail-comments.tsx'), 'utf8')
const renderSource = source.slice(source.indexOf('const renderReplyTree ='), source.indexOf('type DetailCommentThreadProps'))
type Element = { type: unknown; props: Record<string, any>; children: any[] }
const createElement = (type: unknown, props: Record<string, any>, ...children: any[]): Element => ({ type, props: props || {}, children: children.flat(Infinity) })
const output = ts.transpileModule(renderSource + '\nreturn renderReplyTree', {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 },
}).outputText
const noop = () => undefined
const render = new Function('React', 'View', 'Text', 'Image', 'UserAvatar', 'MentionContent', 'CommentImage', 'icons', 'commentAuthorName', 'commentAuthorInitial', 'formatCommentDateTime', 'renderCommentMeta', 'openCommentAuthor', 'flattenCommentTree', output)(
  { createElement }, 'View', 'Text', 'Image', 'UserAvatar', 'MentionContent', 'CommentImage', { reply: 'reply' },
  (c: any) => c.author_nickname, () => '同', (s: string) => s, noop, noop,
  (comments as any).flattenCommentTree,
)
const reply = (id: number, parent_id: number) => ({
  id, parent_id, root_id: 1, author_id: id, author_nickname: `同学${id}`, reply_to_user_id: parent_id,
  content: '长回复 '.repeat(10), status: 'approved', created_at: '2026-09-21T00:00:00Z',
})
const tree = (count: number) => comments.buildCommentTree(1, Array.from({ length: count }, (_, i) => reply(i + 2, i + 1)))
let clicked = 0
const draw = (nodes: any[]) => render(nodes, new Map(), 1, 0, 0, 0, new Set(), 0, (c: any) => { clicked = c.id }, noop, noop)
const depth = (value: any): number => Array.isArray(value) ? Math.max(0, ...value.map(depth))
  : value && typeof value === 'object' && value.children ? 1 + depth(value.children) : 0
const short = draw(tree(2))
const long = draw(tree(80))
assert.equal(depth(long), depth(short), '连续互相回复不能让原生视图层级随评论数量增长')
assert.equal(long.length, 80, '所有二级回复必须同层展示且不丢失')
assert.deepEqual(long.map((node: Element) => node.props.key), Array.from({ length: 80 }, (_, i) => i + 2))
const walk = (value: any, found: Element[] = []): Element[] => {
  if (Array.isArray(value)) value.forEach((v) => walk(v, found))
  else if (value && value.children) { found.push(value); walk(value.children, found) }
  return found
}
const last = walk(long).find((node) => node.props.id === 'detail-comment-81')!
last.props.onClick()
assert.equal(clicked, 81, '平铺后回复目标仍是被点击评论')
const branched = draw(comments.buildCommentTree(1, [reply(4, 1), reply(3, 2), reply(2, 1), reply(5, 999)]))
assert.deepEqual(branched.map((node: Element) => node.props.key), [2, 3, 4, 5], '保持已有分支顺序及缺失父评论的可见性')
const siblings = draw(comments.buildCommentTree(1, Array.from({ length: 80 }, (_, i) => reply(i + 2, 1))))
assert.equal(siblings.length, 80)
assert.equal(depth(siblings), depth(long), '大量同级与连续回复采用相同的布局深度')
const cyclic = draw(comments.buildCommentTree(1, [reply(2, 3), reply(3, 2)]))
assert.deepEqual(cyclic.map((node: Element) => node.props.key), [2, 3], '异常循环关系不会丢回复或死循环')
console.log('comment layout smoke: ok')
