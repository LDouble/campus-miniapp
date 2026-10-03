import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Course } from '../src/pages/academic/types'
import { isTimetableBuddyInvitationToken } from '../src/features/timetable-buddy/model'
import { commonFreeSlotsForWeek, slotsForWeek } from '../src/features/timetable-buddy/availability'
import {
  buildTimetableBuddyCustomCourses,
  syncTimetableBuddyCustomCoursesSerially,
  type TimetableBuddyCustomCourseUploadFlight,
} from '../src/features/timetable-buddy/custom-courses'
import {
  disconnectTimetableBuddyState,
  revokePendingTimetableBuddyInvitation,
} from '../src/features/timetable-buddy/invitation-state'

assert.equal(isTimetableBuddyInvitationToken('a'.repeat(64)), true)
assert.equal(isTimetableBuddyInvitationToken('A'.repeat(64)), false)
assert.equal(isTimetableBuddyInvitationToken('a'.repeat(63)), false)
assert.equal(isTimetableBuddyInvitationToken(`${'a'.repeat(63)}g`), false)

const course: Course = {
  id: 'course-1',
  periodId: '2026-fall',
  name: '高等数学',
  teacher: '张老师',
  location: '教学楼 A101',
  weekday: 1,
  startSection: 2,
  endSection: 3,
  weeks: [1, 2],
  color: '#fff',
  source: 'official',
}

const currentCustomCourse = { ...course, source: 'custom' as const }
const previousTermCustomCourse = { ...currentCustomCourse, id: 'old-term', periodId: '2026-spring', name: '上学期自定义课' }
const auditedCourse = { ...course, id: 'audit-course', source: 'audit' as const, name: '蹭课课程' }
assert.deepEqual(buildTimetableBuddyCustomCourses([
  course,
  auditedCourse,
  previousTermCustomCourse,
  currentCustomCourse,
], '2026-fall'), [{
  name: '高等数学', weekday: 1, sections: [2, 3], weeks: [1, 2], location: '教学楼 A101',
}])
assert.deepEqual(buildTimetableBuddyCustomCourses([], '2026-fall'), [], '空自定义课程列表也必须明确上传')
assert.throws(
  () => buildTimetableBuddyCustomCourses([{ ...currentCustomCourse, name: ' ', weeks: [] }], '2026-fall'),
  /无效课程/u,
  '无法确认课程时段时必须拒绝同步，不能把有课误传为空课表',
)
assert.throws(
  () => buildTimetableBuddyCustomCourses([{ ...currentCustomCourse, weeks: [1, 31] }], '2026-fall'),
  /无效课程/u,
  '超出课表周次范围时必须拒绝同步，不能静默过滤非法周次',
)
assert.throws(
  () => buildTimetableBuddyCustomCourses([{ ...currentCustomCourse, startSection: 2, endSection: 13 }], '2026-fall'),
  /无效课程/u,
  '超出节次范围时必须拒绝同步，不能截断课程时段',
)
assert.throws(
  () => buildTimetableBuddyCustomCourses([{ ...currentCustomCourse, name: '课'.repeat(121) }], '2026-fall'),
  /无效课程/u,
  '课程名超过接口长度限制时必须拒绝同步',
)
assert.throws(
  () => buildTimetableBuddyCustomCourses([{ ...currentCustomCourse, location: '楼'.repeat(241) }], '2026-fall'),
  /过长的上课地点/u,
  '地点超过接口长度限制时必须拒绝同步',
)

const me = {
  nickname: '我', syncedAt: '2026-10-03T10:00:00+08:00', shareScope: 'details' as const, paused: false,
  dataStatus: 'ready' as const, customCoursesReady: true, customCoursesSyncedAt: '2026-10-03T10:01:00+08:00',
  courses: [{ name: '高等数学', weekday: 1, sections: [2, 3], weeks: [1] }],
}
const buddy = {
  nickname: '搭子', syncedAt: '2026-10-03T10:00:00+08:00', shareScope: 'busy' as const, paused: false,
  dataStatus: 'ready' as const, customCoursesReady: true, customCoursesSyncedAt: '2026-10-03T10:01:00+08:00',
  busySlots: [{ weekday: 1, section: 4, weeks: [1] }],
}
assert.deepEqual(slotsForWeek(me, 1).map((slot) => slot.section), [2, 3])
assert.deepEqual(commonFreeSlotsForWeek(me, buddy, 1)?.filter((slot) => slot.weekday === 1).map((slot) => slot.section), [1, 5, 6, 7, 8, 9, 10, 11, 12])
assert.equal(commonFreeSlotsForWeek(me, { ...buddy, paused: true }, 1), null)
assert.equal(commonFreeSlotsForWeek(me, { ...buddy, customCoursesReady: false, customCoursesSyncedAt: null }, 1), null)
assert.equal(commonFreeSlotsForWeek(me, { ...buddy, dataStatus: 'incomplete' }, 1), null)

const pageSource = readFileSync(join(__dirname, '../src/pages/academic/timetable-buddy/index.tsx'), 'utf8')
assert.doesNotMatch(pageSource, /listPersonalTimetableItems|academicRepository\.(getCourses|getPeriods)|timetable-buddy\/snapshot/u)
assert.match(pageSource, /syncCustomCourses/u)
const disconnectHandler = pageSource.match(/const disconnect = async \(\) => \{([\s\S]*?)\n  \}\n\n  const openAcademicPage/u)?.[1] || ''
assert.match(disconnectHandler, /const nextState = disconnectTimetableBuddyState/u, '解除成功后必须经过状态转换')
assert.match(disconnectHandler, /setConnection\(nextState\.connection\)/u, '解除成功后必须清除当前关系')
assert.doesNotMatch(
  disconnectHandler,
  /setInviteToken\(''\)|setInvitationPreview\(null\)/u,
  '解除关系后应保留待接受邀请及预览，让用户可直接接受新邀请',
)
assert.match(pageSource, /revokePendingTimetableBuddyInvitation/u, '修改邀请设置时必须执行服务端撤销动作')
assert.match(pageSource, /disconnectTimetableBuddyState/u, '解除关系必须通过保留传入邀请的状态转换')

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const runConcurrencySmoke = async () => {
  const incomingPreview = { creatorNickname: '邀请人', relationType: 'friend', expiresAt: 'later' }
  const stateAfterDisconnect = disconnectTimetableBuddyState({
    connection: { id: 7 },
    schedule: { week: 3 },
    inviteToken: 'a'.repeat(64),
    invitationPreview: incomingPreview,
    pendingInvite: { token: 'created-invite' },
  })
  assert.equal(stateAfterDisconnect.connection, null)
  assert.equal(stateAfterDisconnect.schedule, null)
  assert.equal(stateAfterDisconnect.inviteToken, 'a'.repeat(64), '解除关系后保留收到的邀请 token')
  assert.equal(stateAfterDisconnect.invitationPreview, incomingPreview, '解除关系后保留已核验的邀请预览')
  assert.equal(stateAfterDisconnect.pendingInvite, null, '解除关系时清除本人的旧创建邀请')

  const pendingInvite = { token: 'created-invite', relationType: 'cp' }
  const invitationSettingsState = { pendingInvite, relationType: 'cp', shareScope: 'busy' }
  const revocationCalls: string[] = []
  await assert.rejects(revokePendingTimetableBuddyInvitation(
    invitationSettingsState,
    async (token) => {
      revocationCalls.push(token)
      throw new Error('invite accepted concurrently')
    },
  ))
  assert.equal(invitationSettingsState.pendingInvite, pendingInvite, '撤销失败必须保留原邀请，不解锁设置')
  const unlockedSettingsState = await revokePendingTimetableBuddyInvitation(
    invitationSettingsState,
    async (token) => { revocationCalls.push(token) },
  )
  assert.equal(unlockedSettingsState.pendingInvite, null, '撤销成功才清除邀请并解锁设置')
  assert.equal(unlockedSettingsState.relationType, 'cp')
  assert.equal(unlockedSettingsState.shareScope, 'busy')
  assert.deepEqual(revocationCalls, ['created-invite', 'created-invite'])

  const firstUpload = deferred<void>()
  const inFlight = new Map<string, TimetableBuddyCustomCourseUploadFlight>()
  const synced = new Map<string, string>()
  const uploads: string[] = []
  let latestValue = 'courses-before-edit'
  const sync = (force = false) => syncTimetableBuddyCustomCoursesSerially({
    key: 'user:connection:undergraduate:2026-fall',
    force,
    inFlight,
    isCurrent: () => true,
    read: () => ({ signature: latestValue, value: latestValue }),
    getSyncedSignature: () => synced.get('user:connection:undergraduate:2026-fall'),
    upload: async (value) => {
      uploads.push(value)
      if (value === 'courses-before-edit') await firstUpload.promise
    },
    recordSynced: (signature) => synced.set('user:connection:undergraduate:2026-fall', signature),
  })

  const olderRefresh = sync()
  latestValue = 'courses-after-edit'
  const newerRefresh = sync()
  assert.deepEqual(uploads, ['courses-before-edit'], '同一学期的新请求应等待旧请求，不能并发写入')
  firstUpload.resolve()
  await Promise.all([olderRefresh, newerRefresh])
  assert.deepEqual(uploads, ['courses-before-edit', 'courses-after-edit'], '旧请求完成后必须重新读取并保存最新课程')
  assert.equal(synced.get('user:connection:undergraduate:2026-fall'), 'courses-after-edit')
}

void runConcurrencySmoke().then(() => {
  console.log('timetable buddy smoke: ok')
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
