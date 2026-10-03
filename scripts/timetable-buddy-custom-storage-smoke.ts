import { strict as assert } from 'node:assert'
import type { Course } from '../src/pages/academic/types'

const values = new Map<string, unknown>()
const readFailures = new Set<string>()
const writes: string[] = []
let storageInfoFailure = false
let writeFailure = false
const Module = require('node:module') as typeof import('node:module')
const taroMock = {
  getStorageInfoSync: () => {
    if (storageInfoFailure) throw new Error('storage info failed')
    return { keys: [...values.keys()], currentSize: 0, limitSize: 0 }
  },
  getStorageSync: (key: string) => {
    if (readFailures.has(key)) throw new Error(`storage read failed: ${key}`)
    return values.get(key)
  },
  setStorageSync: (key: string, value: unknown) => {
    writes.push(key)
    if (writeFailure) throw new Error('storage write failed')
    values.set(key, value)
  },
  showToast: () => undefined,
}

const originalLoad = Module._load
Module._load = function (request: string, parent: NodeModule | null, isMain: boolean) {
  if (request === '@tarojs/taro') return { default: taroMock, ...taroMock }
  return originalLoad.call(this, request, parent, isMain)
}

const { academicStorage, CustomCoursesShareReadError } = require('../src/pages/academic/storage') as {
  academicStorage: {
    getCustomCourses: (platformUserId?: number) => Course[]
    readCustomCoursesForSharing: (platformUserId: number) => (
      | { status: 'ready'; courses: Course[]; source: 'scoped' | 'legacy'; ownership: string }
      | { status: 'missing_scoped'; courses: []; source: 'none'; ownership: 'none' }
      | {
        status: 'legacy_unowned'
        courses: []
        source: 'legacy'
        ownership: 'unconfirmed'
        reason: 'owner_mismatch'
        legacyOwnerUserId: number
        ownerSource: 'owner_key' | 'credential'
      }
      | { status: 'legacy_unowned'; courses: []; source: 'legacy'; ownership: 'unconfirmed'; reason: 'owner_unknown' }
    ),
    loadCustomCoursesForSchedule: (platformUserId: number) => (
      | { status: 'ready'; courses: Course[] }
      | { status: 'blocked'; courses: Course[]; message: string }
    ),
  }
  CustomCoursesShareReadError: new (kind: string) => Error & { kind: string }
}
const {
  buildTimetableBuddyCustomCourses,
  syncTimetableBuddyCustomCoursesSerially,
} = require('../src/features/timetable-buddy/custom-courses') as {
  buildTimetableBuddyCustomCourses: (courses: Course[], periodId: string) => unknown[]
  syncTimetableBuddyCustomCoursesSerially: (input: {
    key: string
    force: boolean
    inFlight: Map<string, { signature: string; promise: Promise<void> }>
    isCurrent: () => boolean
    read: () => { signature: string; value: unknown[] }
    getSyncedSignature: () => string | undefined
    upload: (value: unknown[]) => Promise<unknown>
    recordSynced: (signature: string) => void
  }) => Promise<void>
}
const { readTimetableBuddyCustomCoursesForSharing } = require('../src/features/timetable-buddy/custom-courses-storage') as {
  readTimetableBuddyCustomCoursesForSharing: (userId: number, periodId: string) => unknown[]
}

const currentCourse: Course = {
  id: 'custom-current',
  periodId: '2026-fall',
  name: '自定义自习',
  teacher: '',
  location: '图书馆',
  weekday: 2,
  startSection: 3,
  endSection: 4,
  weeks: [1, 2],
  color: '#fff',
  source: 'custom',
}
const scopedKey = (userId: number) => `academic.customCourses.v2.${userId}`
const initialRemote = [{ name: '服务端原有自定义课程', weekday: 5, sections: [8], weeks: [3] }]

const verifyStrictProjectionScope = () => {
  assert.deepEqual(buildTimetableBuddyCustomCourses([currentCourse], '2026-fall'), [{
    name: '自定义自习', weekday: 2, sections: [3, 4], weeks: [1, 2], location: '图书馆',
  }])
  assert.deepEqual(buildTimetableBuddyCustomCourses([
    { ...currentCourse, source: 'official' },
    { ...currentCourse, source: 'audit' },
  ], '2026-fall'), [], '共享补充只能包含自定义课程，官方课和蹭课由后端归档')
  assert.throws(
    () => buildTimetableBuddyCustomCourses([
      { ...currentCourse, periodId: '2026-spring', weeks: [] },
    ], '2026-fall'),
    /无效课程/u,
    '学期外自定义记录也必须完整校验，不能被当前学期 filter 静默隐藏',
  )
}

const synchronize = async (userId: number) => {
  let remote = initialRemote
  let uploadCalls = 0
  let failure: unknown
  try {
    await syncTimetableBuddyCustomCoursesSerially({
      key: `user:${userId}:connection:5:period:2026-fall`,
      force: true,
      inFlight: new Map(),
      isCurrent: () => true,
      read: () => {
        const value = readTimetableBuddyCustomCoursesForSharing(userId, '2026-fall')
        return { signature: JSON.stringify(value), value }
      },
      getSyncedSignature: () => undefined,
      upload: async (value) => {
        uploadCalls += 1
        remote = value as typeof remote
      },
      recordSynced: () => undefined,
    })
  } catch (error) {
    failure = error
  }
  return { failure, remote, uploadCalls }
}

const verifyReadErrorsAndCorruptionBlockUploads = async () => {
  const userId = 73
  values.clear()
  readFailures.clear()
  values.set(scopedKey(userId), [currentCourse])
  readFailures.add(scopedKey(userId))
  const readFailure = await synchronize(userId)
  assert.ok(readFailure.failure instanceof CustomCoursesShareReadError)
  assert.equal((readFailure.failure as { kind: string }).kind, 'storage_read_failed')
  assert.equal(readFailure.uploadCalls, 0, 'storage read error must stop before uploading')
  assert.deepEqual(readFailure.remote, initialRemote, 'storage read error must preserve the remote snapshot')

  readFailures.clear()
  values.set(scopedKey(userId), [currentCourse, { ...currentCourse, id: 'partial', weekday: '周二' }])
  const rawPartialList = values.get(scopedKey(userId))
  assert.deepEqual(academicStorage.getCustomCourses(userId), [currentCourse], '兼容展示仍可过滤损坏行')
  assert.deepEqual(values.get(scopedKey(userId)), rawPartialList, '兼容展示不得把过滤后的部分列表写回本机')
  const partialRecord = await synchronize(userId)
  assert.ok(partialRecord.failure instanceof CustomCoursesShareReadError)
  assert.equal((partialRecord.failure as { kind: string }).kind, 'corrupt_scoped')
  assert.equal(partialRecord.uploadCalls, 0, 'corrupt current-period row must block a partial upload')
  assert.deepEqual(partialRecord.remote, initialRemote)

  values.set(scopedKey(userId), [{ ...currentCourse, periodId: '2026-spring', weeks: [] }])
  const corruptOtherPeriod = await synchronize(userId)
  assert.ok(corruptOtherPeriod.failure instanceof CustomCoursesShareReadError)
  assert.equal(corruptOtherPeriod.uploadCalls, 0, 'the account-level list is validated atomically across periods')
  assert.deepEqual(corruptOtherPeriod.remote, initialRemote)

  values.set(scopedKey(userId), [{ ...currentCourse, source: 'official' }])
  const unexpectedSource = await synchronize(userId)
  assert.ok(unexpectedSource.failure instanceof CustomCoursesShareReadError)
  assert.equal(unexpectedSource.uploadCalls, 0, 'non-custom rows in custom storage are corruption, never silently filtered')

  storageInfoFailure = true
  const infoFailure = await synchronize(userId)
  storageInfoFailure = false
  assert.ok(infoFailure.failure instanceof CustomCoursesShareReadError)
  assert.equal((infoFailure.failure as { kind: string }).kind, 'storage_read_failed')
  assert.equal(infoFailure.uploadCalls, 0)
}

const verifyMissingAndExplicitEmptyDiffer = async () => {
  const userId = 74
  values.clear()
  const missing = academicStorage.readCustomCoursesForSharing(userId)
  assert.deepEqual(missing, { status: 'missing_scoped', courses: [], source: 'none', ownership: 'none' })
  const missingSync = await synchronize(userId)
  assert.ok(missingSync.failure instanceof Error)
  assert.equal(missingSync.uploadCalls, 0, 'a missing key is not proof of a valid empty list')
  assert.deepEqual(missingSync.remote, initialRemote)

  values.set(scopedKey(userId), [])
  const empty = academicStorage.readCustomCoursesForSharing(userId)
  assert.deepEqual(empty, { status: 'ready', courses: [], source: 'scoped', ownership: 'scoped' })
  const emptySync = await synchronize(userId)
  assert.equal(emptySync.failure, undefined)
  assert.equal(emptySync.uploadCalls, 1, 'an explicitly stored empty list may clear the remote custom snapshot')
  assert.deepEqual(emptySync.remote, [])
}

const verifyScheduleInitializationStaysAccountScoped = () => {
  values.clear()
  writes.length = 0
  const first = academicStorage.loadCustomCoursesForSchedule(81)
  const second = academicStorage.loadCustomCoursesForSchedule(82)
  assert.deepEqual(first, { status: 'ready', courses: [] })
  assert.deepEqual(second, { status: 'ready', courses: [] })
  assert.deepEqual(academicStorage.readCustomCoursesForSharing(81), {
    status: 'ready', courses: [], source: 'scoped', ownership: 'scoped',
  })
  assert.deepEqual(academicStorage.readCustomCoursesForSharing(82), {
    status: 'ready', courses: [], source: 'scoped', ownership: 'scoped',
  })
  assert.deepEqual(writes, [scopedKey(81), scopedKey(82)], '每个账号只初始化自己的明确空列表')

  values.clear()
  writes.length = 0
  values.set('academic.customCourses.v1', [currentCourse])
  values.set('academic.customCourses.legacyOwner.v1', 81)
  const unrelatedAccount = academicStorage.loadCustomCoursesForSchedule(82)
  assert.deepEqual(unrelatedAccount, { status: 'ready', courses: [] })
  assert.deepEqual(values.get('academic.customCourses.v1'), [currentCourse], '新账号空列表不能覆盖旧版课程')
  assert.equal(values.get('academic.customCourses.legacyOwner.v1'), 81, '旧课程所有者归属必须保留')
  assert.deepEqual(academicStorage.readCustomCoursesForSharing(82), {
    status: 'ready', courses: [], source: 'scoped', ownership: 'scoped',
  })
  assert.equal(academicStorage.readCustomCoursesForSharing(81).status, 'ready')

  values.clear()
  writes.length = 0
  values.set('academic.customCourses.v1', [currentCourse])
  values.set('campus.academicCredential.v1', { version: 1, platformUserId: 81 })
  const knownCredentialOwner = academicStorage.loadCustomCoursesForSchedule(82)
  assert.deepEqual(knownCredentialOwner, { status: 'ready', courses: [] })
  assert.equal(values.get('academic.customCourses.legacyOwner.v1'), 81)
  assert.deepEqual(values.get(scopedKey(82)), [])
  assert.deepEqual(values.get('academic.customCourses.v1'), [currentCourse], '新账号空列表不得覆盖旧版原始数据')
  assert.deepEqual(academicStorage.readCustomCoursesForSharing(81), {
    status: 'ready', courses: [currentCourse], source: 'legacy', ownership: 'owner_key',
  })
}

const verifyLegacyUnknownAndWriteFailuresArePreserved = () => {
  values.clear()
  writes.length = 0
  values.set('academic.customCourses.v1', [currentCourse])
  const unknownOwner = academicStorage.loadCustomCoursesForSchedule(83)
  assert.equal(unknownOwner.status, 'blocked', '不能把归属未知的旧版数据当作当前账号空列表')
  assert.equal(values.has(scopedKey(83)), false)
  assert.deepEqual(values.get('academic.customCourses.v1'), [currentCourse])

  values.clear()
  writes.length = 0
  const malformedLegacy = [currentCourse, { ...currentCourse, id: 'partial-legacy', weeks: [] }]
  values.set('academic.customCourses.v1', malformedLegacy)
  values.set('campus.academicCredential.v1', { version: 1, platformUserId: 83 })
  writes.length = 0
  assert.throws(
    () => academicStorage.readCustomCoursesForSharing(83),
    (error: { kind?: string }) => error.kind === 'corrupt_legacy',
  )
  assert.deepEqual(academicStorage.getCustomCourses(83), [], '坏 legacy 不得作为可信空列表，也不得迁移')
  assert.deepEqual(values.get('academic.customCourses.v1'), malformedLegacy, '首页只读入口不能覆盖坏 legacy')
  assert.deepEqual(writes, [], '坏 legacy 的只读入口不能迁移 owner 或账号列表')
  const corruptLegacyLoad = academicStorage.loadCustomCoursesForSchedule(83)
  assert.equal(corruptLegacyLoad.status, 'blocked')
  assert.deepEqual(values.get('academic.customCourses.v1'), malformedLegacy)
  assert.equal(values.has('academic.customCourses.legacyOwner.v1'), false)
  assert.equal(values.has(scopedKey(83)), false, '坏 legacy 不得迁移为 filtered partial 或空列表')

  values.clear()
  writes.length = 0
  writeFailure = true
  const failedEmptySave = academicStorage.loadCustomCoursesForSchedule(84)
  writeFailure = false
  assert.equal(failedEmptySave.status, 'blocked', '初始化显式空列表失败时不能报告可编辑/可共享')
  assert.equal(values.has(scopedKey(84)), false)
  assert.deepEqual(writes, [scopedKey(84)])

  values.clear()
  writes.length = 0
  values.set('academic.customCourses.v1', [currentCourse])
  values.set('campus.academicCredential.v1', { version: 1, platformUserId: 85 })
  assert.deepEqual(academicStorage.getCustomCourses(85), [currentCourse], '首页可读取归属明确且完整的 legacy 课程')
  assert.deepEqual(writes, [], '首页读取完整 legacy 只展示，不承担迁移写入')
  assert.equal(values.has(scopedKey(85)), false)
  writeFailure = true
  const failedLegacyMigration = academicStorage.loadCustomCoursesForSchedule(85)
  writeFailure = false
  assert.equal(failedLegacyMigration.status, 'blocked')
  assert.equal(values.has(scopedKey(85)), false)
  assert.deepEqual(values.get('academic.customCourses.v1'), [currentCourse])
  assert.deepEqual(writes, ['academic.customCourses.legacyOwner.v1'])
}

const verifyLegacyOwnershipIsReadOnlyAndScoped = async () => {
  const userId = 75
  values.clear()
  writes.length = 0
  values.set('academic.customCourses.v1', [currentCourse])
  values.set('campus.academicCredential.v1', { version: 1, platformUserId: userId })
  assert.deepEqual(academicStorage.getCustomCourses(userId), [currentCourse], '首页读取有效 legacy 时仍保持可展示')
  assert.deepEqual(writes, [], '首页读取有效 legacy 不迁移、不标记 owner、不覆盖 scoped 列表')
  assert.equal(values.has(scopedKey(userId)), false)
  writeFailure = true
  const legacy = academicStorage.readCustomCoursesForSharing(userId)
  assert.deepEqual(legacy, {
    status: 'ready', courses: [currentCourse], source: 'legacy', ownership: 'credential',
  })
  assert.deepEqual(readTimetableBuddyCustomCoursesForSharing(userId, '2026-fall'), [{
    name: '自定义自习', weekday: 2, sections: [3, 4], weeks: [1, 2], location: '图书馆',
  }])
  const legacySync = await synchronize(userId)
  assert.equal(legacySync.uploadCalls, 1)
  assert.deepEqual(legacySync.remote, [{
    name: '自定义自习', weekday: 2, sections: [3, 4], weeks: [1, 2], location: '图书馆',
  }])
  assert.deepEqual(writes, [], 'strict sharing reads must not migrate or write owner/scoped keys')

  const otherUserRead = academicStorage.readCustomCoursesForSharing(userId + 1)
  assert.deepEqual(otherUserRead, {
    status: 'legacy_unowned',
    courses: [],
    source: 'legacy',
    ownership: 'unconfirmed',
    reason: 'owner_mismatch',
    legacyOwnerUserId: userId,
    ownerSource: 'credential',
  })
  const otherUserSync = await synchronize(userId + 1)
  assert.ok(otherUserSync.failure instanceof Error)
  assert.equal(otherUserSync.uploadCalls, 0, 'legacy data must not cross platform accounts')
  assert.deepEqual(otherUserSync.remote, initialRemote)

  values.set('academic.customCourses.legacyOwner.v1', userId)
  values.set('campus.academicCredential.v1', { version: 1, platformUserId: userId + 1 })
  const ownerKeyRead = academicStorage.readCustomCoursesForSharing(userId)
  assert.equal(ownerKeyRead.status, 'ready', 'a matching explicit legacy owner key confirms ownership')
  assert.equal(ownerKeyRead.ownership, 'owner_key')
  assert.deepEqual(writes, [], 'read-only legacy inspection does not migrate')
  writeFailure = false
  const migrated = academicStorage.loadCustomCoursesForSchedule(userId)
  assert.deepEqual(migrated, { status: 'ready', courses: [currentCourse] })
  assert.deepEqual(values.get(scopedKey(userId)), [currentCourse], '课表页只迁移完整且已确认归属的旧列表')
}

const run = async () => {
  verifyStrictProjectionScope()
  await verifyReadErrorsAndCorruptionBlockUploads()
  await verifyMissingAndExplicitEmptyDiffer()
  verifyScheduleInitializationStaysAccountScoped()
  verifyLegacyUnknownAndWriteFailuresArePreserved()
  await verifyLegacyOwnershipIsReadOnlyAndScoped()
}

void run().then(() => {
  console.log('timetable buddy custom storage smoke: ok')
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
