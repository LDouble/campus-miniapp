import { strict as assert } from 'node:assert'
import { resolve } from 'node:path'
import { compile } from 'sass'
import postcss from 'postcss'
import { parseDocument } from 'htmlparser2'
import { selectOne, is } from 'css-select'

const css = postcss.parse(compile(resolve(__dirname, '../src/pages/lottery/detail.scss'), { logger: { warn() {}, debug() {} } }).css)

// 模拟静态构建根标记：页面类与 campus-theme 位于同一个根节点；深色规则只在媒体查询场景采纳。
const rootFor = (theme: 'light' | 'dark') => selectOne('view', parseDocument(
  `<page><view class="campus-theme lottery-detail-page"></view></page>`,
).children)!
const matchingDeclarations = (theme: 'light' | 'dark', property: string) => {
  const declarations: string[] = []
  css.walkRules(rule => {
    if (rule.parent?.type === 'atrule') {
      if (rule.parent.name !== 'media') return
      const darkMedia = /prefers-color-scheme:\s*dark/u.test(rule.parent.params)
      const lightMedia = /prefers-color-scheme:\s*light/u.test(rule.parent.params)
      if ((darkMedia && theme !== 'dark') || (lightMedia && theme !== 'light') || (!darkMedia && !lightMedia)) return
    }
    if (!rule.selectors.some(selector => !selector.includes('::') && is(rootFor(theme), selector))) return
    rule.walkDecls(property, decl => { declarations.push(decl.value) })
  })
  return declarations
}

assert.deepEqual(matchingDeclarations('dark', '--campus-text-primary'), [], '深色根节点不得重设全局文字颜色或从浅色 page 继承')
assert.deepEqual(matchingDeclarations('dark', '--campus-border'), [], '深色根节点不得重设全局边框颜色')
assert.ok(matchingDeclarations('light', '--campus-text-primary')[0].includes('--ousea-lottery-ink'), '浅色视觉保持原样')
assert.ok(matchingDeclarations('dark', 'background').at(-1)?.includes('--campus-page'), '深色背景规则必须匹配页面根节点自身')

const card = selectOne('view', parseDocument('<view class="campus-theme"><view class="lottery-detail-hero"></view></view>').children)!
assert.equal(is(card, '.campus-theme .lottery-detail-page'), false, '祖先选择器不能匹配主题根节点')

console.log('lottery dark mode compiled selector smoke: ok')
