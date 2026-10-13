import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const api = readFileSync(
  resolve(__dirname, '../src/api/academic-ranking.ts'),
  'utf8',
)
const indexPage = readFileSync(
  resolve(__dirname, '../src/pages/academic/rankings/index.tsx'),
  'utf8',
)
const groupPage = readFileSync(
  resolve(__dirname, '../src/pages/academic/rankings/group.tsx'),
  'utf8',
)
const serviceCatalog = readFileSync(
  resolve(__dirname, '../src/features/service-shortcuts/catalog.ts'),
  'utf8',
)

const createdGroup = { id: 73, name: '测试排名组' }
const joinedGroup = { id: 91, name: '受邀排名组' }

for (const [operation, response] of [
  ['create', createdGroup],
  ['join', joinedGroup],
] as const) {
  assert.match(
    api,
    new RegExp(`export const ${operation === 'create' ? 'createAcademicRankingGroup' : 'joinAcademicRankingGroup'}[\\s\\S]*?apiRequest<AcademicRankingGroup>\\(`, 'u'),
    `${operation}: API typing must reflect the backend's flat Group response`,
  )
  const navigation = indexPage.match(
    new RegExp(`const group = await ${operation === 'create' ? 'createAcademicRankingGroup' : 'joinAcademicRankingGroup'}\\([\\s\\S]*?Taro\\.navigateTo\\(\\{ url: \`([^\`]+)\` \\}\\)`, 'u'),
  )
  assert.ok(navigation, `${operation}: success must navigate using the returned group`)
  assert.equal(
    navigation[1].replace('${group.id}', String(response.id)),
    `/pages/academic/rankings/group?id=${response.id}`,
    `${operation}: the flat response id must open the corresponding group`,
  )
}

const approvedStart = groupPage.indexOf("{group.membership_status === 'approved' && (")
const pendingStart = groupPage.indexOf("{group.membership_status === 'pending' && (")
assert.ok(approvedStart >= 0, 'grant controls must be conditional on approved membership')
assert.ok(pendingStart > approvedStart, 'pending status notice must follow the approved grant controls')
const approvedGrantBlock = groupPage.slice(approvedStart, pendingStart)
assert.match(approvedGrantBlock, /授权接收人/u)
assert.match(approvedGrantBlock, /putAcademicRankingGrant/u)

const pendingGrantNotice = groupPage.slice(pendingStart)
assert.match(pendingGrantNotice, /申请待审核/u, 'pending applicants need a clear authorization status')
assert.match(pendingGrantNotice, /组主确认后/u)
assert.match(serviceCatalog, /key: 'grade-ranking', name: '成绩排名', route: '\/pages\/academic\/rankings\/index'/u, '成绩排名必须能从新版服务目录打开')

process.stdout.write('academic ranking smoke: ok\n')
