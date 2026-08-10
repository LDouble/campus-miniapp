import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type EvaluationCase = {
  intent?: unknown
  [key: string]: unknown
}

type EvaluationEntity = {
  type?: unknown
  content?: unknown
  source?: unknown
  [key: string]: unknown
}

type EvaluationDataset = {
  cases?: unknown
  entities?: unknown
  [key: string]: unknown
}

type McpConfig = {
  apis?: Array<{ name?: unknown }>
}

const projectRoot = resolve(__dirname, '..')
const dataset = JSON.parse(readFileSync(
  resolve(projectRoot, 'evaluation/campus-info.testcases.json'),
  'utf8',
)) as EvaluationDataset
const mcp = JSON.parse(readFileSync(
  resolve(projectRoot, 'src/ai-mode/skills/campus-info/mcp.json'),
  'utf8',
)) as McpConfig

assert.deepEqual(
  Object.keys(dataset).sort(),
  ['cases', 'entities'],
  '新版微信评测文件顶层只能包含 cases 和 entities',
)
assert.ok(Array.isArray(dataset.cases), 'cases 必须为数组')
assert.ok(Array.isArray(dataset.entities), 'entities 必须为数组')

const cases = dataset.cases as EvaluationCase[]
assert.ok(cases.length >= 50, '提审评测文件至少需要 50 条 Intent')
assert.ok(cases.length <= 100, '评测文件最多允许 100 条 Intent')

const intents = new Set<string>()
cases.forEach((item, index) => {
  assert.deepEqual(
    Object.keys(item),
    ['intent'],
    `cases[${index}] 只能包含 intent`,
  )
  assert.equal(typeof item.intent, 'string', `cases[${index}].intent 必须为字符串`)
  const intent = (item.intent as string).trim()
  assert.ok(intent, `cases[${index}].intent 不得为空`)
  assert.ok(!intents.has(intent), `Intent 不得重复：${intent}`)
  intents.add(intent)
})

const apiNames = new Set(
  (mcp.apis || [])
    .map((api) => api.name)
    .filter((name): name is string => typeof name === 'string' && !!name),
)
assert.deepEqual(
  [...apiNames].sort(),
  ['findEmptyClassrooms', 'queryShuttleSchedule', 'searchOfficialNotices'],
  'campus-info 原子接口集合发生变化时必须同步评测文件',
)

const coveredApis = new Set<string>()
const entityKeys = new Set<string>()
;(dataset.entities as EvaluationEntity[]).forEach((entity, index) => {
  assert.deepEqual(
    Object.keys(entity).sort(),
    ['content', 'source', 'type'],
    `entities[${index}] 只能包含 type、content 和 source`,
  )
  assert.ok(
    typeof entity.type === 'string' && /^[a-z]+$/.test(entity.type),
    `entities[${index}].type 必须为单个小写英文词`,
  )
  assert.ok(
    entity.content
      && typeof entity.content === 'object'
      && !Array.isArray(entity.content)
      && Object.keys(entity.content as object).length > 0,
    `entities[${index}].content 必须为非空对象`,
  )
  assert.ok(
    Array.isArray(entity.source) && entity.source.length > 0,
    `entities[${index}].source 必须为非空工具名数组`,
  )
  ;(entity.source as unknown[]).forEach((source, sourceIndex) => {
    assert.ok(
      typeof source === 'string' && apiNames.has(source),
      `entities[${index}].source[${sourceIndex}] 必须引用 mcp.json 中的原子接口`,
    )
    coveredApis.add(source as string)
  })
  const key = `${entity.type}:${JSON.stringify(entity.content)}`
  assert.ok(!entityKeys.has(key), `业务实体不得重复：${key}`)
  entityKeys.add(key)
})

assert.equal(
  coveredApis.size / apiNames.size,
  1,
  'entities.source 对原子接口的覆盖率必须为 100%',
)

const requirementScore = (intent: string) => {
  let score = 1
  if (/崂山校区|鱼山校区|西海岸校区/.test(intent)) score += 1
  if (/\d{4}-\d{2}-\d{2}/.test(intent)) score += 1
  if (/第\d+.*节/.test(intent)) score += 2
  if (/最近\d+天|所有时间范围/.test(intent)) score += 1
  if (/学校发布|本科生院|研究生院|学院部门/.test(intent)) score += 1
  if (/教学|培养|评奖|校园事务|就业/.test(intent)) score += 1
  if (/循环线|校际班车/.test(intent)) score += 1
  if (/告诉我|列出|概括|优先|按.*分组|按.*排序|没有.*就|有.*就/.test(intent)) score += 1
  return score
}

const complexCases = cases.filter((item) => (
  requirementScore(String(item.intent)) >= 4
))
assert.ok(
  complexCases.length / cases.length >= 0.3,
  `复杂 Intent 比例不足 30%：${complexCases.length}/${cases.length}`,
)

assert.ok(
  cases.filter((item) => String(item.intent).includes('通知')).length >= 15,
  '官方通知 Intent 覆盖不足',
)
assert.ok(
  cases.filter((item) => /校车|班车/.test(String(item.intent))).length >= 15,
  '校车 Intent 覆盖不足',
)
assert.ok(
  cases.filter((item) => /空教室|空闲的教室|可用的教室/.test(String(item.intent))).length >= 15,
  '空教室 Intent 覆盖不足',
)

process.stdout.write(
  `wechat ai evaluation dataset smoke: ok (${cases.length} intents, ${complexCases.length} complex)\n`,
)
