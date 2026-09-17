import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getClassDiscussionContext,
  isClassDiscussionTopic,
  visibleClassDiscussionAnnouncement,
} from '../src/features/class-discussion/context'
import { classDiscussionTopicPublisherUrl } from '../src/features/class-discussion/topic'
import type { Course } from '../src/pages/academic/types'

const course = (patch: Partial<Course> = {}): Course => ({
  id: 'course-1',
  periodId: '2025-2026-2',
  classNum: ' 20250001 ',
  name: '大学英语',
  teacher: '张老师',
  location: '教室',
  weekday: 1,
  startSection: 1,
  endSection: 2,
  weeks: [1],
  color: 'aqua',
  source: 'official',
  ...patch,
})

assert.deepEqual(getClassDiscussionContext(course()), {
  classNum: '20250001',
  periodId: '2025-2026-2',
  courseName: '大学英语',
})
assert.equal(getClassDiscussionContext(course({ classNum: ' ' })), null)
assert.equal(getClassDiscussionContext(course({ periodId: ' ' })), null)
assert.equal(isClassDiscussionTopic({ slug: 'class-discussion-abc123' }), true)
assert.equal(isClassDiscussionTopic({ slug: 'campus-topic-abc123' }), false)
const classTopicWithAnnouncement = {
  slug: 'class-discussion-abc123',
  status: 'active',
  announcement: {
    title: '本周课堂安排',
    content: '请提前阅读材料。',
    published: true,
    published_at: '2026-09-18T10:00:00+08:00',
  },
} as Parameters<typeof visibleClassDiscussionAnnouncement>[0]
assert.equal(
  visibleClassDiscussionAnnouncement(classTopicWithAnnouncement)?.title,
  '本周课堂安排',
  '已发布课堂公告应显示',
)
assert.equal(
  visibleClassDiscussionAnnouncement({
    ...classTopicWithAnnouncement,
    announcement: { ...classTopicWithAnnouncement.announcement!, published: false },
  }),
  null,
  '撤回公告不应显示',
)
assert.equal(
  visibleClassDiscussionAnnouncement({ ...classTopicWithAnnouncement, slug: 'ordinary-topic' }),
  null,
  '普通话题不应显示课堂公告',
)
assert.equal(
  visibleClassDiscussionAnnouncement({ ...classTopicWithAnnouncement, status: 'archived' }),
  null,
  '归档课堂话题不应显示课堂公告',
)
assert.equal(
  classDiscussionTopicPublisherUrl(23),
  '/pages/publish/index?section=community&community_topic_id=23&class_discussion_topic_id=23',
)

const publisherSource = readFileSync(resolve(__dirname, '../src/pages/publish/index.tsx'), 'utf8')
const topicPageSource = readFileSync(resolve(__dirname, '../src/pages/community/topic/index.tsx'), 'utf8')
assert.match(publisherSource, /classDiscussionTopicId > 0[\s\S]*?communityTopicIds: \[classDiscussionTopicId\]/u)
assert.match(publisherSource, /communityTopicNames: lockedClassDiscussionTopicId > 0[\s\S]*?\[\]/u)
assert.match(publisherSource, /topic_names: classDiscussionTopicId > 0[\s\S]*?undefined/u)
assert.match(topicPageSource, /isClassDiscussionTopic\(topic\)[\s\S]*?classDiscussionTopicPublisherUrl/u)
assert.match(topicPageSource, /useDidShow\(\(\) => \{[\s\S]*?loadedRefreshRevision/u)
assert.match(topicPageSource, /community-topic-class-context[\s\S]*?topic\.description/u)
assert.match(topicPageSource, /else void refreshTopic\(id\)/u, '返回页面应单独刷新公告元数据')
assert.match(topicPageSource, /community-topic-announcement[\s\S]*?announcement\.content/u)
assert.match(topicPageSource, /error\.statusCode === 403 \|\| error\.statusCode === 404/u, '访问失效话题应识别为不可用')
assert.match(topicPageSource, /setTopic\(null\)[\s\S]*?setError\('课堂讨论已不可用'\)/u, '失效话题应清除旧内容并提示不可用')
assert.match(topicPageSource, /recordCampusCircleClassParticipation\(id\)/u, '首次进入课堂应登记参与人数')
assert.doesNotMatch(topicPageSource, /recordedClassParticipationTopicIdRef/u, '刷新话题后不应被永久登记标记阻断')
assert.match(topicPageSource, /classParticipationInFlightTopicIdRef\.current === id/u, '同一时刻的参与登记应去重')
assert.match(topicPageSource, /classParticipationPendingTopicIdRef\.current = id/u, '刷新遇到在途登记时应补一次最新请求')
assert.match(topicPageSource, /setClassParticipationRetryVersion/u, '在途请求结束后应重新登记最新课堂状态')
assert.match(topicPageSource, /已有 \{activeClassParticipation\.participant_count\} 人来过/u, '课堂页应展示参与人数')
assert.match(topicPageSource, /新帖子和公告提醒/u, '提醒开关应明确仅覆盖新帖子和公告')
assert.match(topicPageSource, /评论和回复仅通知对应同学/u, '提醒范围应说明评论和回复的定向通知规则')
assert.match(topicPageSource, /requestWechatSubscriptionForModuleWithResult\('community'\)/u, '课堂微信提醒应复用社区模块模板配置')
assert.match(topicPageSource, /activeClassParticipation\.notifications_enabled \? \(/u, '仅在开启群提醒时提供微信订阅操作')
assert.match(topicPageSource, /event\.stopPropagation\(\)/u, '课堂提醒交互不得冒泡触发全局订阅请求')
assert.match(topicPageSource, /未订阅微信提醒，站内提醒不受影响/u, '拒绝微信订阅不得改变站内提醒')
assert.match(topicPageSource, /当前没有可用的微信提醒模板/u, '未配置模板不得伪装订阅成功')
assert.match(topicPageSource, /result\.accepted && result\.registered/u, '课堂仅在微信授权和后端登记都成功后提示可接收')
assert.match(topicPageSource, /重新登记微信提醒/u, '后端登记失败应提供本地重试入口')
assert.match(topicPageSource, /classWechatRegistrationRetry\(\)/u, '重试登记不得重复申请微信订阅')
assert.match(topicPageSource, /updateCampusCircleClassNotifications/u, '提醒开关应调用个人偏好接口')
assert.match(topicPageSource, /classNotificationUpdatingRef\.current/u, '提醒开关应防连点')
assert.match(topicPageSource, /activeClassDiscussionTopicIdRef\.current !== id/u, '过期课堂参与响应不得覆盖当前状态')
assert.match(topicPageSource, /classParticipationRequestSequence\.current \+= 1/u, '课堂失效时应使在途参与请求失效')
assert.match(topicPageSource, /notificationRequestSequenceAtStart !== classNotificationRequestSequence\.current/u, '参与刷新应识别期间发生的提醒设置')
assert.match(topicPageSource, /notifications_enabled: notificationChangedWhileRecording/u, '参与刷新不得覆盖更新中的个人提醒偏好')
assert.match(topicPageSource, /useDidHide\(\(\) => \{[\s\S]*?classParticipationRequestSequence\.current \+= 1/u, '离开课堂页应使在途参与请求失效')

const repositorySource = readFileSync(resolve(__dirname, '../src/features/life-services/repository.ts'), 'utf8')
assert.match(repositorySource, /class-discussions\/\$\{id\}\/participation/u)
assert.match(repositorySource, /class-discussions\/\$\{id\}\/notifications/u)

console.log('class discussion smoke: ok')
