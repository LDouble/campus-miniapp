import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const {
  DEFAULT_MARKETPLACE_CATEGORIES,
  enabledMarketplaceCategories,
  normalizeMarketplaceCategories,
} = require('../src/features/runtime-config/marketplace-categories') as typeof import('../src/features/runtime-config/marketplace-categories')

assert.deepEqual(
  DEFAULT_MARKETPLACE_CATEGORIES.map(({ id, name, sort_order }) => ({ id, name, sort_order })),
  [
    { id: 'digital', name: '数码产品', sort_order: 10 },
    { id: 'books', name: '图书', sort_order: 20 },
    { id: 'course_material', name: '教材资料', sort_order: 30 },
    { id: 'daily_use', name: '生活用品', sort_order: 40 },
    { id: 'network_fee', name: '网费', sort_order: 50 },
    { id: 'clothing', name: '服饰鞋包', sort_order: 60 },
    { id: 'sports', name: '运动器材', sort_order: 70 },
    { id: 'general', name: '其他', sort_order: 100 },
  ],
)

assert.deepEqual(normalizeMarketplaceCategories([
  { id: 'sports', name: '运动器材', enabled: true, sort_order: 30 },
  { id: 'books', name: '图书', enabled: true, sort_order: 10 },
  { id: 'disabled', name: '已停用', enabled: false, sort_order: 20 },
  { id: 'not a slug', name: '无效', enabled: true, sort_order: 0 },
]), [
  { id: 'books', name: '图书', enabled: true, sort_order: 10 },
  { id: 'disabled', name: '已停用', enabled: false, sort_order: 20 },
  { id: 'sports', name: '运动器材', enabled: true, sort_order: 30 },
])
assert.deepEqual(
  enabledMarketplaceCategories(normalizeMarketplaceCategories([
    { id: 'books', name: '图书', enabled: true, sort_order: 20 },
    { id: 'hidden', name: '已停用', enabled: false, sort_order: 10 },
  ])).map((category) => category.id),
  ['books'],
)
assert.equal(
  normalizeMarketplaceCategories([{ id: 'bad', name: '', enabled: true, sort_order: 1 }])[0]?.id,
  'digital',
)
assert.deepEqual(
  normalizeMarketplaceCategories([
    { id: 'a', name: '单字符', enabled: true, sort_order: 1 },
    { id: `a${'_'.repeat(30)}a`, name: '最大长度', enabled: true, sort_order: 2 },
    { id: `a${'_'.repeat(31)}a`, name: '超过长度', enabled: true, sort_order: 3 },
    { id: '_leading', name: '前导下划线', enabled: true, sort_order: 4 },
    { id: 'trailing_', name: '尾随下划线', enabled: true, sort_order: 5 },
    { id: 'valid_slug_1', name: '合法', enabled: true, sort_order: 6 },
  ]),
  [
    { id: 'a', name: '单字符', enabled: true, sort_order: 1 },
    { id: `a${'_'.repeat(30)}a`, name: '最大长度', enabled: true, sort_order: 2 },
    { id: 'valid_slug_1', name: '合法', enabled: true, sort_order: 6 },
  ],
)

const filtersSource = readFileSync(
  resolve(__dirname, '../src/features/life-services/components/marketplace-filters.tsx'),
  'utf8',
)
const listSource = readFileSync(
  resolve(__dirname, '../src/features/life-services/list-panel.tsx'),
  'utf8',
)
const repositorySource = readFileSync(
  resolve(__dirname, '../src/features/life-services/repository.ts'),
  'utf8',
)
const runtimeConfigSource = readFileSync(
  resolve(__dirname, '../src/features/runtime-config/index.ts'),
  'utf8',
)

assert.ok(filtersSource.includes('商品分类'), '更多筛选必须展示分类单选区')
assert.ok(filtersSource.includes("ariaRole='radiogroup'"), '分类筛选必须保留单选无障碍语义')
assert.ok(filtersSource.includes('enabledCategories.map'), '分类选项必须由运行时配置生成')
const selectTypeSource = filtersSource.slice(
  filtersSource.indexOf('const selectType ='),
  filtersSource.indexOf('const applyCustom ='),
)
assert.ok(selectTypeSource.includes('...value'), '免费赠送切换必须保留分类筛选')
assert.doesNotMatch(selectTypeSource, /category:\s*undefined/u, '交易类型切换不得清空分类筛选')
assert.ok(listSource.includes('previousMarketplaceCategory'), '分类切换必须重置分页状态')
assert.ok(listSource.includes('category: undefined'), '已选分类必须可以单项清除')
assert.ok(repositorySource.includes('category: search.category'), '分类筛选必须传递给列表 API')
assert.ok(runtimeConfigSource.includes('marketplace_categories: DEFAULT_MARKETPLACE_CATEGORIES'), '运行时默认值必须包含分类目录')

process.stdout.write('marketplace category filter smoke: ok\n')
