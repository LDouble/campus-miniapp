import { strict as assert } from 'node:assert'
import { createTimetableBuddyStateCoordinator } from '../src/features/timetable-buddy/state-coordinator'

const coordinator = createTimetableBuddyStateCoordinator()
const firstRead = coordinator.beginRead()!
const newerRead = coordinator.beginRead()!
assert.equal(coordinator.isReadCurrent(firstRead), false)
assert.equal(coordinator.isReadCurrent(newerRead), true)
const settings = coordinator.beginMutation()!
assert.equal(coordinator.isReadCurrent(newerRead), false, '操作开始立即使先前 GET 失效')
assert.equal(coordinator.beginRead(), null, '操作期间下拉不能发出读取旧状态的 GET')
assert.equal(coordinator.beginMutation(), null, '不同关系操作也必须串行')
assert.equal(coordinator.isMutationCurrent(settings), true)
assert.equal(coordinator.finishMutation(settings), true)
assert.equal(coordinator.isReadCurrent(newerRead), false, '操作结束也不能恢复旧 GET')
const confirmedRead = coordinator.beginRead()!
assert.equal(coordinator.isReadCurrent(confirmedRead), true)
const disconnect = coordinator.beginMutation()!
assert.equal(coordinator.finishMutation(settings), false, '迟到的 finally 不能释放另一个操作')
assert.equal(coordinator.isMutationCurrent(disconnect), true)
assert.equal(coordinator.finishMutation(disconnect), true)
const afterFailureOrCancel = coordinator.beginRead()!
assert.equal(coordinator.isReadCurrent(afterFailureOrCancel), true, '失败或取消释放操作后可重新确认权威状态')
coordinator.invalidateReads()
assert.equal(coordinator.isReadCurrent(afterFailureOrCancel), false, '页面失效拒绝迟到读取')
console.log('课表搭子关系状态协调回归通过')
