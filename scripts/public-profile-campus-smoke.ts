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
const profileEntry = readFileSync(resolve(__dirname, '../src/pages/profile/index.tsx'), 'utf8')
const generatedSchema = readFileSync(resolve(__dirname, '../src/api/generated/schema.ts'), 'utf8')

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

assert.equal((publisher.match(/campus: selectedCampus/g) || []).length, 3)
assert.ok(publisher.includes('ROUTE_SHORTCUTS.map'))
assert.ok(publisher.includes('rememberRoutePair(form.pickupLocation, form.dropoffLocation)'))
assert.ok(publisher.includes('rememberRoutePair(form.origin, form.destination)'))
assert.ok(lifeList.includes('<CampusSelector value={campus} allowAll onChange={setCampus} />'))
assert.ok(profileEntry.includes('openPublicProfile(currentUser.user.id)'))
assert.ok(generatedSchema.includes('UserProfile: {'))
assert.ok(generatedSchema.includes('GetUserProfile: {'))
assert.equal((generatedSchema.match(/campus: string \| null;/g) || []).length >= 3, true)

process.stdout.write('public profile and campus smoke: ok\n')
