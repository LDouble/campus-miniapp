import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pageSource = readFileSync(
  resolve(__dirname, '../src/pages/publish/index.tsx'),
  'utf8',
)
const styleSource = readFileSync(
  resolve(__dirname, '../src/pages/publish/index.scss'),
  'utf8',
)
const designSpecSource = readFileSync(
  resolve(__dirname, '../design-system/campus-miniapp/pages/publish.md'),
  'utf8',
)

assert.ok(pageSource.includes('publisher-type-panel'), '发布器必须有原生发布类型栏')
assert.ok(!pageSource.includes('草稿自动保存'), '类型栏不得展示无操作价值的草稿说明')
assert.ok(!pageSource.includes('publisher-type-panel__head'), '类型栏不得保留冗余标题行')
assert.ok(pageSource.includes('publisher-types'), '发布器必须有独立的业务类型切换')
assert.ok(!pageSource.includes('publisher-type__icon'), '发布类型不得使用宫格式图标导航')
assert.ok(!pageSource.includes('父模块'), '页面不得展示内部板块层级术语')
assert.ok(!pageSource.includes('子模块'), '页面不得展示内部板块层级术语')
assert.ok(!pageSource.includes('补充集合、行李或返程信息'), '同行发布不应展示无必要的补充说明编辑区')
assert.ok(!pageSource.includes('首图作为封面'), '二手发布不应重复解释图片封面规则')
assert.ok(pageSource.includes('publisher-topic-trigger'), '动态编辑工具栏必须保留话题入口')
assert.ok(pageSource.includes('publisher-topic-sheet'), '话题选择必须使用独立底部 Sheet')
assert.ok(pageSource.includes('communityTopicNames'), '未收录话题必须随当前草稿保存')
assert.match(pageSource, /topic_names:\s*normalizeTopicNames\(/u, '新增话题必须在发布时提交给服务端创建并关联')

for (const selector of [
  'publisher-content',
  'publisher-submit',
  'publisher-pickup-location',
  'publisher-dropoff-location',
  'publisher-reward-yuan',
  'publisher-price-yuan',
  'publisher-origin',
  'publisher-destination',
  'publisher-total-seats',
  'publisher-contact',
]) {
  assert.ok(pageSource.includes(selector), `发布器自动化选择器被移除：${selector}`)
}

assert.match(styleSource, /@use '\.\.\/\.\.\/styles\/tokens' as token;/u)
assert.match(styleSource, /\.publisher-type-panel\s*\{/u)
assert.match(styleSource, /\.publisher-route\s*\{/u)
assert.match(styleSource, /\.publisher-task-meta[\s\S]*?\.publisher-carpool-meta\s*\{/u)
assert.match(styleSource, /\.publisher-page--errands[\s\S]*?\.publisher-section--errands-details[\s\S]*?order:\s*1/u)
assert.match(styleSource, /\.publisher-market-intents[\s\S]*?\.publisher-market-intent--active[\s\S]*?background:\s*token\.\$color-marketplace/u)
assert.match(styleSource, /\.publisher-community-sections\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/u)
assert.match(styleSource, /\.publisher-community-section\s*\{[\s\S]*?border-radius:\s*token\.\$radius-sm/u)
assert.match(styleSource, /\.publisher-carpool-meta\s*\{/u)
assert.match(styleSource, /\.publisher-field--inline\s*\{/u)
assert.match(styleSource, /\.publisher-page--errands \.publisher-actions__submit/u)
assert.match(styleSource, /\.publisher-page--market \.publisher-actions__submit/u)
assert.match(styleSource, /\.publisher-page--carpool \.publisher-actions__submit/u)
assert.match(styleSource, /\.publisher-composer-tool\s*\{[\s\S]*?min-width:\s*token\.\$touch-target-min/u)
assert.match(styleSource, /\.publisher-topic-sheet\s*\{[\s\S]*?max-height:\s*76vh/u)
assert.match(styleSource, /\.publisher-topic-sheet\s*\{[\s\S]*?border-radius:\s*token\.\$ousea-radius-sheet/u)
assert.match(styleSource, /\.publisher-topic-result\s*\{[\s\S]*?min-height:\s*108rpx/u)
assert.match(styleSource, /&--keyboard\s*\{\s*display:\s*none;/u)
assert.match(styleSource, /env\(safe-area-inset-bottom\)/u)
assert.doesNotMatch(styleSource, /#[0-9a-f]{3,8}/iu, '发布器页面不得新增局部硬编码颜色')
assert.ok(designSpecSource.includes('微信原生内容编辑器式布局'), '缺少发布器页面级设计规范')
assert.ok(designSpecSource.includes('话题选择器'), '缺少话题选择器页面规范')

process.stdout.write('publisher ui smoke: ok\n')
