import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizeRouteValues } from '../src/features/life-services/route-history-values'

assert.deepEqual(
  normalizeRouteValues([' 崂山校区 ', '青岛北站', '崂山校区', '', '青岛站']),
  ['崂山校区', '青岛北站', '青岛站'],
)
assert.deepEqual(normalizeRouteValues(['A', 'a', 'B'], 2), ['A', 'B'])

const repository = readFileSync(resolve(__dirname, '../src/features/life-services/repository.ts'), 'utf8')
const profile = readFileSync(resolve(__dirname, '../src/pages/public-profile/index.tsx'), 'utf8')
const publisher = readFileSync(resolve(__dirname, '../src/pages/publish/index.tsx'), 'utf8')
const lifeList = readFileSync(resolve(__dirname, '../src/features/life-services/list-panel.tsx'), 'utf8')
const lifeTopFilters = readFileSync(resolve(
  __dirname,
  '../src/features/life-services/top-filters.tsx',
), 'utf8')
const carpoolFilters = readFileSync(resolve(
  __dirname,
  '../src/features/life-services/components/carpool-filters.tsx',
), 'utf8')
const campusSelector = readFileSync(resolve(
  __dirname,
  '../src/features/life-services/components/campus-selector.tsx',
), 'utf8')
const filterSheet = readFileSync(resolve(
  __dirname,
  '../src/features/life-services/components/filter-sheet.tsx',
), 'utf8')
const bottomSheet = readFileSync(resolve(
  __dirname,
  '../src/components/bottom-sheet.tsx',
), 'utf8')
const routeHistory = readFileSync(resolve(
  __dirname,
  '../src/features/life-services/route-history.ts',
), 'utf8')
const profileStyles = readFileSync(resolve(
  __dirname,
  '../src/pages/public-profile/index.scss',
), 'utf8')
const profileEntry = readFileSync(resolve(__dirname, '../src/pages/profile/index.tsx'), 'utf8')
const generatedSchema = readFileSync(resolve(__dirname, '../src/api/generated/schema.ts'), 'utf8')
const campusOptions = readFileSync(resolve(
  __dirname,
  '../src/features/life-services/campus.ts',
), 'utf8')

for (const path of [
  '/api/v1/users/${userId}/profile',
  '/api/v1/users/${userId}/campus-circle/posts',
  '/api/v1/users/${userId}/errands',
  '/api/v1/users/${userId}/marketplace/listings',
  '/api/v1/users/${userId}/carpool/trips',
]) {
  assert.ok(repository.includes(path), `个人主页仓储缺少 ${path}`)
}

assert.equal((repository.match(/campus: search\.campus/g) || []).length, 3)
assert.ok(profile.includes("useState<ProfileTab>('community')"))
assert.ok(profile.includes('tabs[activeTab].loaded'))
assert.ok(profile.includes('tabState.page + 1'))
assert.ok(profile.includes('profile.counts.community_posts'))
assert.ok(profile.includes('profile.counts.errands'))
assert.ok(profile.includes('profile.counts.marketplace_listings'))
assert.ok(profile.includes('profile.counts.carpool_trips'))
assert.ok(profile.includes("{ key: 'carpool', label: '找同行' }"))
assert.ok(profileStyles.includes("@use '../../styles/tokens' as token;"))
assert.ok(profileStyles.includes('background: token.$color-page;'))
assert.equal(profileStyles.includes('#f8f6f1'), false)

assert.equal((publisher.match(/campus: selectedCampus/g) || []).length, 3)
assert.ok(publisher.includes('ROUTE_SHORTCUTS.map'))
assert.ok(publisher.includes('rememberRoutePair(form.pickupLocation, form.dropoffLocation)'))
assert.ok(publisher.includes('rememberRoutePair(form.origin, form.destination)'))
for (const shortcut of [
  '崂山校区',
  '鱼山校区',
  '西海岸',
  '浮山校区',
  '机场',
  '青岛北',
  '青岛站',
]) {
  assert.ok(routeHistory.includes(`'${shortcut}'`), `常用地点缺少 ${shortcut}`)
}
assert.ok(carpoolFilters.includes("kind='origin'"))
assert.ok(carpoolFilters.includes("kind='destination'"))
assert.ok(carpoolFilters.includes('ROUTE_SHORTCUTS'))
assert.ok(carpoolFilters.includes('getRecentRouteValues(kind)'))
assert.ok(carpoolFilters.includes('rememberRoutePair(origin, destination)'))
assert.ok(carpoolFilters.includes("className='carpool-filter-toolbar life-service-filter-toolbar'"))
assert.ok(carpoolFilters.includes('customDateActive'))
assert.ok(carpoolFilters.includes('advancedFilterCount(value)'))
assert.ok(lifeTopFilters.includes('<CampusSelector'))
assert.ok(lifeTopFilters.includes('allowAll'))
assert.ok(lifeTopFilters.includes('onChange={onCampusChange}'))
assert.ok(lifeList.includes('campus: campus || undefined'))
assert.ok(lifeList.includes('onMarketFiltersChange({'))
assert.ok(campusSelector.includes("import BottomSheet from '../../../components/bottom-sheet'"))
assert.ok(campusSelector.includes("title='选择校区'"))
assert.ok(campusOptions.includes("'三亚校区'"), '校区筛选缺少三亚校区')
assert.ok(filterSheet.includes("import BottomSheet from '../../../components/bottom-sheet'"))
assert.ok(bottomSheet.includes("className='bottom-sheet-layer'"))
assert.ok(profileEntry.includes('openPublicProfile(currentUser.user.id)'))
assert.ok(generatedSchema.includes('UserProfile: {'))
assert.ok(generatedSchema.includes('GetUserProfile: {'))
assert.equal((generatedSchema.match(/campus: string \| null;/g) || []).length >= 3, true)

process.stdout.write('public profile and campus smoke: ok\n')
