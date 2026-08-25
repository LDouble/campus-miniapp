import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type {
  CarpoolTripView,
  ErrandView,
  MarketplaceListingView,
} from '../src/api/types'
import {
  businessDetailSnapshotTtl,
  consumeBusinessDetailSnapshot,
  saveBusinessDetailSnapshot,
} from '../src/features/life-services/business-detail-snapshot'

type DetailCase = {
  kind: 'marketplace' | 'errand' | 'carpool'
  sourcePath: string
  getter: string
}

const detailCases: DetailCase[] = [
  {
    kind: 'marketplace',
    sourcePath: '../src/pages/marketplace/detail.tsx',
    getter: 'getMarketplaceListing',
  },
  {
    kind: 'errand',
    sourcePath: '../src/pages/errands/detail.tsx',
    getter: 'getErrand',
  },
  {
    kind: 'carpool',
    sourcePath: '../src/pages/carpool/detail.tsx',
    getter: 'getCarpoolTrip',
  },
]

const marketplaceSnapshot = { id: 101 } as MarketplaceListingView
const errandSnapshot = { id: 101 } as ErrandView
saveBusinessDetailSnapshot('marketplace', marketplaceSnapshot, 1_000)
saveBusinessDetailSnapshot('errand', errandSnapshot, 1_000)
assert.equal(consumeBusinessDetailSnapshot('marketplace', 101, 1_001), marketplaceSnapshot)
assert.equal(consumeBusinessDetailSnapshot('marketplace', 101, 1_002), null)
assert.equal(
  consumeBusinessDetailSnapshot('errand', 101, 1_001),
  errandSnapshot,
  'same ids from different business types stay isolated',
)

saveBusinessDetailSnapshot('carpool', { id: 103 } as CarpoolTripView, 3_000)
assert.equal(
  consumeBusinessDetailSnapshot('carpool', 103, 3_000 + businessDetailSnapshotTtl),
  null,
  'expired snapshots never render',
)

for (const detail of detailCases) {
  const source = readFileSync(resolve(__dirname, detail.sourcePath), 'utf8')

  assert.match(source, /options\.snapshot === '1'/u, `${detail.kind}: only explicit snapshot routes consume a snapshot`)
  assert.match(
    source,
    new RegExp(`consumeBusinessDetailSnapshot\\('${detail.kind}', nextId\\)`, 'u'),
    `${detail.kind}: snapshot kind and id are consumed together`,
  )
  assert.match(
    source,
    /if \(snapshot\) \{[\s\S]*?setItem\(snapshot\)[\s\S]*?setPersistedContact\(null\)[\s\S]*?setLoading\(false\)[\s\S]*?void load\(nextId, true\)[\s\S]*?return/u,
    `${detail.kind}: a snapshot renders immediately and refreshes authoritative detail in the background`,
  )
  assert.doesNotMatch(
    source,
    /applyItem\(snapshot\)/u,
    `${detail.kind}: a non-authoritative snapshot never restores or clears persisted contact`,
  )
  assert.match(source, /void load\(nextId\)/u, `${detail.kind}: absent snapshots use the detail loader`)
  assert.match(
    source,
    new RegExp(`${detail.getter}\\(targetId\\)`, 'u'),
    `${detail.kind}: the detail loader requests the latest detail when needed`,
  )
  assert.match(
    source,
    /usePullDownRefresh\(\(\) => void load\(\)\)/u,
    `${detail.kind}: pull-to-refresh always reloads the detail`,
  )
  assert.match(
    source,
    /statusCode === 409\) await load\(\)/u,
    `${detail.kind}: conflicts reload the current detail`,
  )
}

for (const entry of [
  { kind: 'marketplace', sourcePath: '../src/features/life-services/components/marketplace-card.tsx' },
  { kind: 'errand', sourcePath: '../src/features/life-services/components/errand-card.tsx' },
  { kind: 'carpool', sourcePath: '../src/features/life-services/components/carpool-card.tsx' },
]) {
  const source = readFileSync(resolve(__dirname, entry.sourcePath), 'utf8')
  assert.match(source, new RegExp(`saveBusinessDetailSnapshot\\('${entry.kind}', item\\)`, 'u'))
  assert.match(source, /snapshot=1/u, `${entry.kind}: card navigation opts into snapshot consumption`)
}

const myServicesSource = readFileSync(resolve(__dirname, '../src/pages/my-services/index.tsx'), 'utf8')
const marketplaceDetailSource = readFileSync(resolve(__dirname, '../src/pages/marketplace/detail.tsx'), 'utf8')
assert.match(
  marketplaceDetailSource,
  /\{item\.image_urls\.length > 0 && \([\s\S]*?<ContentImageGrid[\s\S]*?images=\{item\.image_urls\.map/u,
  'marketplace: only listings with real image URLs render the shared image grid',
)
assert.match(marketplaceDetailSource, /<ContentImageGrid[\s\S]*?preview/u)
assert.doesNotMatch(
  marketplaceDetailSource,
  /market-detail-gallery__empty/u,
  'marketplace: text-only listings never render a fake image card',
)
for (const kind of ['marketplace', 'errand', 'carpool']) {
  assert.match(myServicesSource, new RegExp(`saveBusinessDetailSnapshot\\('${kind}', item\\)`, 'u'))
}
const orderBranch = myServicesSource.match(/if \('order_no' in item\) \{([\s\S]*?)\} else if \('pickup_location'/u)?.[1] || ''
assert.doesNotMatch(
  orderBranch,
  /saveBusinessDetailSnapshot|snapshot=1/u,
  'order records never masquerade as full detail snapshots',
)

process.stdout.write('business detail navigation smoke: ok\n')
