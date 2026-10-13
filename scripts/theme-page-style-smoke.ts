import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from 'sass'
import postcss, { type Root } from 'postcss'
import { parseDocument } from 'htmlparser2'
import { is, selectOne } from 'css-select'

type Theme = 'light' | 'dark'
type Probe = {
  name: string
  stylesheet: string
  rootClasses: string
  requiredDarkDeclarations: Array<{ property: string, value: string }>
}

const root = process.cwd()
const stylePath = (relativePath: string) => resolve(root, relativePath)
const compiled = new Map<string, Root>()

const cssFor = (stylesheet: string) => {
  const current = compiled.get(stylesheet)
  if (current) return current
  const css = postcss.parse(compile(stylePath(stylesheet), { logger: { warn() {}, debug() {} } }).css)
  compiled.set(stylesheet, css)
  return css
}

const rootFor = (theme: Theme, rootClasses: string) => selectOne('view', parseDocument(
  `<page><view class="campus-theme ${rootClasses}"></view></page>`,
).children)!

type Declaration = { selector: string, property: string, value: string }
const declarationsFor = (stylesheet: string, theme: Theme, rootClasses: string) => {
  const element = rootFor(theme, rootClasses)
  const declarations: Declaration[] = []
  cssFor(stylesheet).walkRules(rule => {
    const parent = rule.parent
    if (parent?.type === 'atrule') {
      if (parent.name !== 'media' || !/prefers-color-scheme:\s*dark/u.test(parent.params) || theme !== 'dark') return
    }
    for (const selector of rule.selectors || []) {
      if (selector.includes('::') || !is(element, selector)) continue
      rule.walkDecls(decl => declarations.push({ selector, property: decl.prop, value: decl.value }))
    }
  })
  return declarations
}

const probes: Probe[] = [
  {
    name: '吃什么详情',
    stylesheet: 'src/pages/what-to-eat/detail.scss',
    rootClasses: 'food-detail-page',
    requiredDarkDeclarations: [{ property: 'background', value: 'var(--campus-page' }],
  },
  {
    name: '课程目录',
    stylesheet: 'src/pages/academic/course-catalog/index.scss',
    rootClasses: 'course-catalog-page',
    requiredDarkDeclarations: [
      { property: 'background', value: 'var(--campus-page' },
      { property: '--course-accent', value: 'var(--campus-primary' },
    ],
  },
  {
    name: '课堂话题',
    stylesheet: 'src/pages/community/topic/index.scss',
    rootClasses: 'community-topic-page community-topic-page--class',
    requiredDarkDeclarations: [{ property: 'background', value: 'var(--campus-surface' }],
  },
  {
    name: '猫咪档案补充',
    stylesheet: 'src/pages/cat-atlas/atlas.scss',
    rootClasses: 'atlas-form-page cat-page cat-profile-suggestion-page',
    requiredDarkDeclarations: [
      { property: 'background', value: 'var(--campus-page' },
      { property: '--campus-cat-surface', value: 'var(--campus-surface)' },
    ],
  },
]

for (const probe of probes) {
  const darkDeclarations = declarationsFor(probe.stylesheet, 'dark', probe.rootClasses)
  const lightDeclarations = declarationsFor(probe.stylesheet, 'light', probe.rootClasses)

  assert.ok(
    lightDeclarations.some(({ property }) => property === 'background' || property === 'background-color'),
    `${probe.name} 浅色根节点必须保留可匹配的页面背景规则`,
  )
  assert.equal(
    lightDeclarations.some(({ selector }) => /prefers-color-scheme/u.test(selector)),
    false,
    `${probe.name} 浅色根节点不能命中暗色规则`,
  )

  for (const required of probe.requiredDarkDeclarations) {
    assert.ok(
      darkDeclarations.some(({ selector, property, value }) => (
        property === required.property
        && value.includes(required.value)
      )),
      `${probe.name} 暗色主题类与页面类位于同一根节点时，必须命中 ${required.property}: ${required.value}；` +
        `当前命中：${darkDeclarations.map(({ selector, property, value }) => `${selector} { ${property}: ${value} }`).join(' | ')}`,
    )
  }
}

const targetDeclarations = (stylesheet: string, markup: string, theme: Theme) => {
  const target = selectOne('[data-theme-probe="target"]', parseDocument(markup).children)
  assert.ok(target, `测试节点缺失：${stylesheet}`)
  const declarations: Declaration[] = []
  cssFor(stylesheet).walkRules(rule => {
    const parent = rule.parent
    if (parent?.type === 'atrule') {
      if (parent.name !== 'media' || !/prefers-color-scheme:\s*dark/u.test(parent.params) || theme !== 'dark') return
    }
    for (const selector of rule.selectors || []) {
      if (selector.includes('::') || !is(target, selector)) continue
      rule.walkDecls(decl => declarations.push({ selector, property: decl.prop, value: decl.value }))
    }
  })
  return declarations
}

const assertDarkChildBackground = (label: string, stylesheet: string, markup: string, values: string[]) => {
  for (const theme of ['light', 'dark'] as const) {
    const declarations = targetDeclarations(stylesheet, markup, theme)
    assert.ok(
      declarations.some(({ property, value }) => (
        property === 'background'
        && values.every(expected => value.includes(expected))
      )),
      `${label} 必须在 ${theme} 主题祖先下命中语义背景 ${values.join(' / ')}；` +
        `当前命中：${declarations.filter(({ property }) => property === 'background').map(({ selector, value }) => `${selector} { background: ${value} }`).join(' | ')}`,
    )
  }
}

const darkClubDetail = '<page><view class="campus-theme club-detail-page">'
const darkMyClubs = '<page><view class="campus-theme my-clubs-page">'
for (const [label, markup] of [
  ['社团详情骨架封面', `${darkClubDetail}<view data-theme-probe="target" class="club-detail-skeleton__cover" /></view></page>`],
  ['社团详情骨架卡片行', `${darkClubDetail}<view class="club-detail-skeleton__card"><view data-theme-probe="target" /></view></view></page>`],
  ['社团详情骨架区块', `${darkClubDetail}<view data-theme-probe="target" class="club-detail-skeleton__section" /></view></page>`],
] as const) {
  assertDarkChildBackground(label, 'src/pages/clubs/detail.scss', markup, ['var(--campus-border', 'var(--campus-surface-subtle'])
}
assertDarkChildBackground(
  '社团详情错误态图标',
  'src/pages/clubs/detail.scss',
  `${darkClubDetail}<view data-theme-probe="target" class="club-detail-state__icon" /></view></page>`,
  ['var(--campus-surface-primary'],
)
assertDarkChildBackground(
  '我的社团骨架行',
  'src/pages/clubs/mine.scss',
  `${darkMyClubs}<view class="my-club-card--skeleton"><view data-theme-probe="target" /></view></view></page>`,
  ['var(--campus-border', 'var(--campus-surface-subtle'],
)

// 系统主题仅由媒体查询决定；浅色场景不会采纳 dark media 规则，深色场景才会采纳。
const appStyle = readFileSync(stylePath('src/app.scss'), 'utf8')
assert.match(appStyle, /@media\s*\(prefers-color-scheme:\s*dark\)/u, 'app.scss 必须提供系统深色画布兜底')

console.log('theme page style compiled selector smoke: ok')
