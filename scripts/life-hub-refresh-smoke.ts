import { strict as assert } from 'node:assert'
import {
  getLifeHubRefreshRevision,
  isLifeHubCacheReusable,
  isLifeHubSectionRefreshRequired,
  markLifeHubSectionDirty,
  markLifeHubSectionFresh,
  resetLifeHubRefreshPolicyForTests,
} from '../src/features/life-services/refresh-policy'

resetLifeHubRefreshPolicyForTests()

assert.equal(isLifeHubSectionRefreshRequired('community', 1_000), true)
markLifeHubSectionFresh('community', 1_000)
assert.equal(isLifeHubSectionRefreshRequired('community', 90_999), false)
assert.equal(isLifeHubSectionRefreshRequired('community', 91_000), true)

const communityRevision = getLifeHubRefreshRevision('community')
assert.equal(isLifeHubCacheReusable('community', communityRevision, 1_000, 90_999), true)
markLifeHubSectionDirty('community')
assert.equal(isLifeHubSectionRefreshRequired('community', 2_000), true)
assert.equal(isLifeHubCacheReusable('community', communityRevision, 1_000, 2_000), false)

markLifeHubSectionFresh('community', 2_000)
assert.equal(isLifeHubSectionRefreshRequired('community', 2_001), false)
assert.equal(isLifeHubSectionRefreshRequired('market', 2_001), true)

process.stdout.write('life hub refresh policy smoke: ok\n')
