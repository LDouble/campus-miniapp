import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro, { useDidShow, useLoad, usePullDownRefresh, useShareAppMessage } from '@tarojs/taro'
import { Button, Picker, Text, View } from '@tarojs/components'
import { isApiError } from '../../../api/client'
import { login } from '../../../api/auth'
import { getCurrentIdentity } from '../../../api/account'
import {
  loadAcademicCredential,
  type AcademicEducationLevel,
} from '../../../api/academic-credential'
import { academicStorage } from '../storage'
import type { AcademicPeriod, AcademicPreferences } from '../types'
import {
  formatMonthDay,
  getAcademicWeekday,
  getCurrentTeachingWeek,
  getWeekDates,
  resolveDefaultPeriodId,
  resolveRetainedPeriodId,
  weekdays,
} from '../utils'
import { getCachedPageUserId, getPageCacheScope, subscribePageCacheScope } from '../../../state/page-cache'
import CustomNavbar from '../../../components/custom-navbar'
import { buildCampusShareMessage } from '../../../features/share'
import { openMiniappModule, loadMiniappRuntimeConfig, resolveMiniappModule } from '../../../features/runtime-config'
import { requestWechatSubscriptionForModule } from '../../../features/wechat-subscription'
import { directMessageChatUrl, directMessagesListUrl } from '../../../features/direct-messages/navigation'
import { privateMessagesRepository } from '../../../features/direct-messages/repository'
import { timetableBuddyRepository } from '../../../api/timetable-buddy'
import {
  timetableBuddyRelationLabel,
  timetableBuddyScopeLabel,
  isTimetableBuddyInvitationToken,
  type TimetableBuddyConnection,
  type TimetableBuddyInvitationPreview,
  type TimetableBuddyRelationType,
  type TimetableBuddyScheduleSide,
  type TimetableBuddyShareScope,
} from '../../../features/timetable-buddy/model'
import {
  syncTimetableBuddyCustomCoursesSerially,
  type TimetableBuddyCustomCourseUploadFlight,
} from '../../../features/timetable-buddy/custom-courses'
import {
  disconnectTimetableBuddyState,
  revokePendingTimetableBuddyInvitation,
} from '../../../features/timetable-buddy/invitation-state'
import { readTimetableBuddyCustomCoursesForSharing } from '../../../features/timetable-buddy/custom-courses-storage'
import { createTimetableBuddyStateCoordinator } from '../../../features/timetable-buddy/state-coordinator'
import { hasBusySlot, slotsForWeek } from '../../../features/timetable-buddy/availability'
import '../index.scss'
import './index.scss'

const PAGE_PATH = '/pages/academic/timetable-buddy/index'
const DEFAULT_PREFERENCES: AcademicPreferences = {
  section: 'schedule',
  schedulePeriodId: '',
  gradePeriodId: '',
  examPeriodId: '',
  week: 1,
  selectedWeekday: getAcademicWeekday(),
  scheduleView: 'week',
}
const RELATIONS: TimetableBuddyRelationType[] = ['friend', 'study_partner', 'cp', 'unspecified']
const SCOPES: TimetableBuddyShareScope[] = ['busy', 'details']
const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日']

const errorMessage = (error: unknown, fallback: string) => (
  isApiError(error) ? error.message : error instanceof Error ? error.message : fallback
)

const formatTimestamp = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const clampWeek = (week: number, period?: AcademicPeriod) => Math.min(
  Math.max(1, Number.isInteger(week) ? week : 1),
  Math.max(1, period?.weeks || 20),
)

const cachedAcademicContext = (userId: number) => {
  const cache = academicStorage.getScheduleCache(userId)
  const preferences = academicStorage.getPreferences(DEFAULT_PREFERENCES)
  const periods = cache?.periods || []
  const preferredPeriodId = resolveRetainedPeriodId(periods, preferences.schedulePeriodId)
  const period = periods.find((item) => item.id === preferredPeriodId)
  const week = clampWeek(period?.isCurrent ? getCurrentTeachingWeek(period) : preferences.week, period)
  return { periods, periodId: preferredPeriodId || resolveDefaultPeriodId(periods), week }
}

const currentEducationLevel = (userId: number): AcademicEducationLevel | null => {
  try {
    return loadAcademicCredential(userId).educationLevel
  } catch {
    return null
  }
}

const isSideScheduleReady = (side: TimetableBuddyScheduleSide) => (
  side.dataStatus === 'ready'
  && side.customCoursesReady
  && Boolean(side.syncedAt)
  && Boolean(side.customCoursesSyncedAt)
)

const sideReadinessMessage = (side: TimetableBuddyScheduleSide, owner: string) => {
  if (side.paused) return `${owner}已暂停分享，暂不展示其课表。`
  const isMe = owner === '你'
  const openOwnSchedule = isMe ? '请打开本人课表查询，之后回来刷新。' : '请提醒对方打开本人课表查询，之后再刷新。'
  if (side.dataStatus === 'identity_unavailable') return `${owner}的教务身份或所选学期不匹配，暂时无法读取该学期课表。`
  if (side.dataStatus === 'incomplete') return `${owner}的课表信息尚不完整；${isMe ? '请刷新本人课表后稍后重试。' : '请提醒对方刷新本人课表后稍后重试。'}`
  if (side.dataStatus === 'unavailable') return `${owner}还没有可用的官方课表，${openOwnSchedule}`
  if (!side.syncedAt) return `${owner}的官方课表暂不可用，空白节次不能当作有空。${openOwnSchedule}`
  if (!side.customCoursesReady || !side.customCoursesSyncedAt) {
    return `${owner}还没有保存本学期的自定义课程。${isMe ? '请先打开本人课表确认自定义课程，再回来刷新保存。' : '请提醒对方打开课表搭子页刷新。'}`
  }
  return ''
}

const readinessLabel = (side: TimetableBuddyScheduleSide | undefined, customSyncPending = false) => {
  if (!side) return '待加载'
  if (side.paused) return '已暂停'
  if (customSyncPending) return '待同步'
  if (side.dataStatus !== 'ready') return '待更新'
  if (!side.customCoursesReady || !side.customCoursesSyncedAt) return '待补充'
  if (!side.syncedAt) return '待更新'
  return '已就绪'
}

const customCoursesKey = (userId: number, connectionId: number, level: AcademicEducationLevel, periodId: string) => (
  `${userId}:${connectionId}:${level}:${periodId}`
)

const sectionRanges = (slots: Array<{ weekday: number; section: number }>) => {
  const sections = [...new Set(slots.map((slot) => slot.section))].sort((left, right) => left - right)
  const ranges: string[] = []
  for (let index = 0; index < sections.length;) {
    const start = sections[index]
    let end = start
    while (index + 1 < sections.length && sections[index + 1] === end + 1) {
      index += 1
      end = sections[index]
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`)
    index += 1
  }
  return ranges
}

const courseAt = (
  side: TimetableBuddyScheduleSide,
  weekday: number,
  section: number,
  week: number,
) => (side.courses || []).filter((course) => (
  course.weekday === weekday && course.sections.includes(section) && course.weeks.includes(week)
))

function TimetableBuddyPageContent({ userId, pageCacheScope }: { userId: number; pageCacheScope: string }) {
  const router = Taro.useRouter()
  const [inviteToken, setInviteToken] = useState(() => String(router.params.token || '').trim().slice(0, 128))
  const [invitationPreview, setInvitationPreview] = useState<TimetableBuddyInvitationPreview | null>(null)
  const [invitationError, setInvitationError] = useState('')
  const [connection, setConnection] = useState<TimetableBuddyConnection | null>(null)
  const [stateLoading, setStateLoading] = useState(true)
  const [stateError, setStateError] = useState('')
  const [relationType, setRelationType] = useState<TimetableBuddyRelationType>('friend')
  const [newShareScope, setNewShareScope] = useState<TimetableBuddyShareScope>('busy')
  const [pendingInvite, setPendingInvite] = useState<{
    token: string
    expiresAt: string
    relationType: TimetableBuddyRelationType
    shareScope: TimetableBuddyShareScope
  } | null>(null)
  const [invitationBusy, setInvitationBusy] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [periods, setPeriods] = useState<AcademicPeriod[]>(() => cachedAcademicContext(userId).periods)
  const [periodId, setPeriodId] = useState(() => cachedAcademicContext(userId).periodId)
  const [week, setWeek] = useState(() => cachedAcademicContext(userId).week)
  const [activeWeekday, setActiveWeekday] = useState(getAcademicWeekday())
  const [scheduleState, setScheduleState] = useState<{
    key: string
    value: Awaited<ReturnType<typeof timetableBuddyRepository.getSchedule>> | null
  } | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [openingChat, setOpeningChat] = useState(false)
  const [contactHint, setContactHint] = useState('')
  const [customSyncError, setCustomSyncError] = useState('')
  const [failedCustomSyncKey, setFailedCustomSyncKey] = useState('')
  const [educationLevel, setEducationLevel] = useState(() => currentEducationLevel(userId))
  const stateCoordinator = useRef(createTimetableBuddyStateCoordinator()).current
  const mountedRef = useRef(true)
  const [stateRefreshRevision, setStateRefreshRevision] = useState(0)
  const forceCustomRefreshRef = useRef(false)
  const scheduleRequest = useRef(0)
  const invitationBusyRef = useRef(false)
  const acceptingRef = useRef(false)
  const settingsBusyRef = useRef(false)
  const syncedCustomCoursesRef = useRef(new Map<string, string>())
  const customCoursesUploadRef = useRef(new Map<string, TimetableBuddyCustomCourseUploadFlight>())
  const shouldReloadAcademicContextRef = useRef(false)
  const openingChatRef = useRef(false)
  const isCurrentPage = useCallback(() => mountedRef.current && getPageCacheScope() === pageCacheScope, [pageCacheScope])
  const currentSyncScopeRef = useRef({
    userId,
    connectionId: connection?.id || 0,
    educationLevel,
    periodId,
  })
  currentSyncScopeRef.current = {
    userId,
    connectionId: connection?.id || 0,
    educationLevel,
    periodId,
  }
  const currentScheduleKey = `${connection?.id || 0}:${educationLevel || ''}:${periodId}:${week}`
  const schedule = scheduleState?.key === currentScheduleKey ? scheduleState.value : null
  const setSchedule = useCallback((value: Awaited<ReturnType<typeof timetableBuddyRepository.getSchedule>> | null) => {
    setScheduleState({ key: currentScheduleKey, value })
  }, [currentScheduleKey])

  useLoad((options) => {
    const token = String(options.token || '').trim().slice(0, 128)
    if (token) setInviteToken(token)
  })

  const requestStateRefresh = useCallback(() => {
    if (!isCurrentPage()) return
    stateCoordinator.invalidateReads()
    setStateRefreshRevision((revision) => revision + 1)
  }, [isCurrentPage, stateCoordinator])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stateCoordinator.invalidateReads()
      scheduleRequest.current += 1
    }
  }, [stateCoordinator])

  const beginRelationMutation = () => {
    if (!isCurrentPage()) return null
    const ticket = stateCoordinator.beginMutation()
    if (ticket === null) return null
    scheduleRequest.current += 1
    setScheduleLoading(false)
    setStateLoading(false)
    return ticket
  }

  const finishRelationMutation = (ticket: number) => {
    if (!stateCoordinator.finishMutation(ticket)) return
    scheduleRequest.current += 1
    requestStateRefresh()
  }

  const loadState = useCallback(async () => {
    const requestId = stateCoordinator.beginRead()
    if (requestId === null) return
    setStateLoading(true)
    setStateError('')
    setInvitationError('')
    try {
      await getCurrentIdentity()
      if (!isCurrentPage() || !stateCoordinator.isReadCurrent(requestId)) return
      const nextState = await timetableBuddyRepository.getState()
      if (!isCurrentPage() || !stateCoordinator.isReadCurrent(requestId)) return
      setConnection(nextState.connection)
      if (nextState.connection) setPendingInvite(null)
      if (inviteToken) {
        if (!isTimetableBuddyInvitationToken(inviteToken)) {
          setInvitationPreview(null)
          setInvitationError('邀请链接格式不正确，请让对方重新分享')
          return
        }
        try {
          const preview = await timetableBuddyRepository.previewInvitation(inviteToken)
          if (!isCurrentPage() || !stateCoordinator.isReadCurrent(requestId)) return
          setInvitationPreview(preview)
        } catch (error) {
          if (!isCurrentPage() || !stateCoordinator.isReadCurrent(requestId)) return
          setInvitationPreview(null)
          setInvitationError(errorMessage(error, '邀请链接已失效，请让对方重新分享'))
        }
      } else {
        setInvitationPreview(null)
      }
    } catch (error) {
      if (!isCurrentPage() || !stateCoordinator.isReadCurrent(requestId)) return
      setStateError(errorMessage(error, '暂时无法读取课表搭子状态，请重试'))
    } finally {
      if (isCurrentPage() && stateCoordinator.isReadCurrent(requestId)) {
        setStateLoading(false)
        Taro.stopPullDownRefresh()
      }
    }
  }, [inviteToken, isCurrentPage, stateCoordinator])

  useEffect(() => {
    void loadState()
    return () => { stateCoordinator.invalidateReads() }
  }, [loadState, stateCoordinator, stateRefreshRevision])

  const myMember = connection?.members.find((member) => member.userId === userId) || null
  const buddyMember = connection?.members.find((member) => member.userId !== userId)
    || connection?.members.find((member) => member !== myMember)
    || null
  const selectedPeriod = periods.find((period) => period.id === periodId)
  const selectedCustomCourseSignature = (() => {
    if (!periodId || userId <= 0) return ''
    try {
      return JSON.stringify(readTimetableBuddyCustomCoursesForSharing(userId, periodId))
    } catch {
      return 'invalid-custom-courses'
    }
  })()
  const selectedCustomCoursesKey = connection && educationLevel && periodId
    ? customCoursesKey(userId, connection.id, educationLevel, periodId)
    : ''
  const customCoursesPending = Boolean(selectedCustomCoursesKey)
    && syncedCustomCoursesRef.current.get(selectedCustomCoursesKey) !== selectedCustomCourseSignature
  const dates = useMemo(() => getWeekDates(selectedPeriod, week), [selectedPeriod, week])

  const uploadCurrentCustomCourses = useCallback(async (selectedPeriodId: string, force: boolean) => {
    if (!connection || !educationLevel || userId <= 0 || !isCurrentPage()) return
    const key = customCoursesKey(userId, connection.id, educationLevel, selectedPeriodId)
    const isScopeCurrent = () => {
      const current = currentSyncScopeRef.current
      return isCurrentPage()
        && current.userId === userId
        && current.connectionId === connection.id
        && current.educationLevel === educationLevel
        && current.periodId === selectedPeriodId
    }
    await syncTimetableBuddyCustomCoursesSerially({
      key,
      force,
      inFlight: customCoursesUploadRef.current,
      isCurrent: isScopeCurrent,
      read: () => {
        const courses = readTimetableBuddyCustomCoursesForSharing(userId, selectedPeriodId)
        return { signature: JSON.stringify(courses), value: courses }
      },
      getSyncedSignature: () => syncedCustomCoursesRef.current.get(key),
      upload: (courses) => timetableBuddyRepository.syncCustomCourses({
        educationLevel,
        periodId: selectedPeriodId,
        courses,
      }),
      recordSynced: (signature) => {
        syncedCustomCoursesRef.current.set(key, signature)
        setFailedCustomSyncKey((current) => current === key ? '' : current)
      },
    })
  }, [connection, educationLevel, isCurrentPage, userId])

  const loadBuddySchedule = useCallback(async (options: { syncCustom?: boolean; forceCustom?: boolean } = {}) => {
    if (!isCurrentPage()) return
    if (!connection || !periodId || !periods.some((period) => period.id === periodId)) {
      setSchedule(null)
      setScheduleError(periods.length ? '' : '先打开本人课表读取学期信息，再回来查看双人课表。')
      setScheduleLoading(false)
      return
    }
    const requestId = ++scheduleRequest.current
    setScheduleLoading(true)
    setScheduleError('')
    try {
      if (!educationLevel) throw new Error('请先绑定教务身份，再读取对应学期的双人课表')
      if (options.syncCustom) {
        setCustomSyncError('')
        try {
          await uploadCurrentCustomCourses(periodId, Boolean(options.forceCustom))
        } catch (error) {
          if (!isCurrentPage() || requestId !== scheduleRequest.current) return
          const currentKey = connection && educationLevel
            ? customCoursesKey(userId, connection.id, educationLevel, periodId)
            : ''
          setFailedCustomSyncKey(currentKey)
          setCustomSyncError(errorMessage(error, '本学期自定义课程补充同步失败'))
        }
      }
      if (!isCurrentPage() || requestId !== scheduleRequest.current) return
      const result = await timetableBuddyRepository.getSchedule({ educationLevel, periodId, week })
      if (!isCurrentPage() || requestId !== scheduleRequest.current) return
      setSchedule(result)
    } catch (error) {
      if (!isCurrentPage() || requestId !== scheduleRequest.current) return
      setSchedule(null)
      setScheduleError(errorMessage(error, '双人课表加载失败，请重试'))
      if (isApiError(error) && ['timetable_buddy_not_found', 'timetable_buddy_connection_changed'].includes(error.code)) {
        setStateLoading(true)
        requestStateRefresh()
      }
    } finally {
      if (isCurrentPage() && requestId === scheduleRequest.current) setScheduleLoading(false)
      Taro.stopPullDownRefresh()
    }
  }, [connection, educationLevel, isCurrentPage, periodId, periods, requestStateRefresh, setSchedule, uploadCurrentCustomCourses, userId, week])

  useEffect(() => {
    if (stateLoading || stateError) return
    const forceCustom = forceCustomRefreshRef.current
    forceCustomRefreshRef.current = false
    void loadBuddySchedule({ syncCustom: true, forceCustom })
    return () => { scheduleRequest.current += 1 }
  }, [loadBuddySchedule, stateError, stateLoading])

  usePullDownRefresh(() => {
    forceCustomRefreshRef.current = true
    setStateLoading(true)
    requestStateRefresh()
  })

  useDidShow(() => {
    setStateLoading(true)
    forceCustomRefreshRef.current = true
    setEducationLevel(currentEducationLevel(userId))
    if (shouldReloadAcademicContextRef.current) {
      shouldReloadAcademicContextRef.current = false
      const context = cachedAcademicContext(userId)
      setPeriods(context.periods)
      setPeriodId(context.periodId)
      setWeek(context.week)
    }
    requestStateRefresh()
  })

  useShareAppMessage(() => buildCampusShareMessage({
    title: `和我一起看${(pendingInvite?.relationType || relationType) === 'cp' ? '我们的课表' : '共同空闲时间'}`,
    fallbackTitle: '课表搭子邀请',
    path: PAGE_PATH,
    query: pendingInvite?.token ? { token: pendingInvite.token } : {},
  }))

  const createInvitation = async () => {
    if (invitationBusyRef.current) return
    const mutationTicket = beginRelationMutation()
    if (mutationTicket === null) return
    invitationBusyRef.current = true
    setInvitationBusy(true)
    try {
      const result = await timetableBuddyRepository.createInvitation({
        relationType,
        shareScope: newShareScope,
        expiresInHours: 24,
      })
      if (!isCurrentPage() || !stateCoordinator.isMutationCurrent(mutationTicket)) return
      setPendingInvite({ ...result, relationType, shareScope: newShareScope })
      Taro.showToast({ title: '邀请已准备好，点击微信分享发送', icon: 'none' })
    } catch (error) {
      if (!isCurrentPage() || !stateCoordinator.isMutationCurrent(mutationTicket)) return
      Taro.showToast({ title: errorMessage(error, '创建邀请失败，请稍后重试'), icon: 'none' })
    } finally {
      finishRelationMutation(mutationTicket)
      invitationBusyRef.current = false
      if (isCurrentPage()) setInvitationBusy(false)
    }
  }

  const changePendingInvite = async () => {
    if (!pendingInvite || settingsBusyRef.current) return
    const mutationTicket = beginRelationMutation()
    if (mutationTicket === null) return
    settingsBusyRef.current = true
    setSettingsBusy(true)
    try {
      const nextState = await revokePendingTimetableBuddyInvitation(
        { pendingInvite },
        (token) => timetableBuddyRepository.revokeInvitation(token),
      )
      if (!isCurrentPage() || !stateCoordinator.isMutationCurrent(mutationTicket)) return
      setPendingInvite(nextState.pendingInvite)
      Taro.showToast({ title: '旧邀请已撤销，可以修改关系或分享范围', icon: 'success' })
    } catch (error) {
      if (!isCurrentPage() || !stateCoordinator.isMutationCurrent(mutationTicket)) return
      Taro.showToast({ title: errorMessage(error, '撤销邀请失败，请稍后重试'), icon: 'none' })
    } finally {
      finishRelationMutation(mutationTicket)
      settingsBusyRef.current = false
      if (isCurrentPage()) setSettingsBusy(false)
    }
  }

  const acceptInvitation = async () => {
    if (!inviteToken || !isTimetableBuddyInvitationToken(inviteToken) || acceptingRef.current || !invitationPreview) return
    if (connection) {
      Taro.showToast({ title: '请先解除当前搭子关系，再接受新的邀请', icon: 'none' })
      return
    }
    const mutationTicket = beginRelationMutation()
    if (mutationTicket === null) return
    acceptingRef.current = true
    setAccepting(true)
    try {
      const result = await timetableBuddyRepository.acceptInvitation(inviteToken)
      if (!isCurrentPage() || !stateCoordinator.isMutationCurrent(mutationTicket)) return
      if (result.connection) {
        setConnection(result.connection)
        setInviteToken('')
        setInvitationPreview(null)
        setPendingInvite(null)
        setInvitationError('')
        Taro.showToast({ title: '已成为课表搭子', icon: 'success' })
      }
    } catch (error) {
      if (!isCurrentPage() || !stateCoordinator.isMutationCurrent(mutationTicket)) return
      setInvitationError(errorMessage(error, '暂时无法接受邀请，请重试'))
    } finally {
      finishRelationMutation(mutationTicket)
      acceptingRef.current = false
      if (isCurrentPage()) setAccepting(false)
    }
  }

  const updateSettings = async (next: { shareScope?: TimetableBuddyShareScope; paused?: boolean }) => {
    if (!connection || !myMember || settingsBusyRef.current) return
    const mutationTicket = beginRelationMutation()
    if (mutationTicket === null) return
    settingsBusyRef.current = true
    setSettingsBusy(true)
    try {
      const result = await timetableBuddyRepository.updateSettings({
        shareScope: next.shareScope ?? myMember.shareScope,
        paused: next.paused ?? myMember.paused,
        expectedConnectionId: connection.id,
      })
      if (!isCurrentPage() || !stateCoordinator.isMutationCurrent(mutationTicket)) return
      setConnection(result.connection)
      Taro.showToast({ title: '分享设置已更新', icon: 'success' })
    } catch (error) {
      if (!isCurrentPage() || !stateCoordinator.isMutationCurrent(mutationTicket)) return
      Taro.showToast({ title: errorMessage(error, '更新设置失败，请刷新后重试'), icon: 'none' })
    } finally {
      finishRelationMutation(mutationTicket)
      settingsBusyRef.current = false
      if (isCurrentPage()) setSettingsBusy(false)
    }
  }

  const disconnect = async () => {
    if (!connection || settingsBusyRef.current) return
    const mutationTicket = beginRelationMutation()
    if (mutationTicket === null) return
    settingsBusyRef.current = true
    try {
      const confirmation = await Taro.showModal({
        title: '解除课表搭子',
        content: `解除后，${buddyMember?.nickname || '对方'}将无法继续查看你的课表。`,
        confirmText: '解除关系',
        confirmColor: '#E5484D',
      })
      if (!confirmation.confirm || !isCurrentPage()) return
      setSettingsBusy(true)
      await timetableBuddyRepository.disconnect(connection.id)
      if (!isCurrentPage() || !stateCoordinator.isMutationCurrent(mutationTicket)) return
      const nextState = disconnectTimetableBuddyState({
        connection,
        schedule,
        inviteToken,
        invitationPreview,
        pendingInvite,
      })
      setConnection(nextState.connection)
      setInviteToken(nextState.inviteToken)
      setInvitationPreview(nextState.invitationPreview)
      setSchedule(nextState.schedule)
      setPendingInvite(nextState.pendingInvite)
      Taro.showToast({ title: '已解除课表搭子关系', icon: 'success' })
    } catch (error) {
      if (!isCurrentPage() || !stateCoordinator.isMutationCurrent(mutationTicket)) return
      Taro.showToast({ title: errorMessage(error, '解除失败，请刷新后重试'), icon: 'none' })
    } finally {
      finishRelationMutation(mutationTicket)
      settingsBusyRef.current = false
      if (isCurrentPage()) setSettingsBusy(false)
    }
  }

  const openAcademicPage = async (needsVerification = false) => {
    shouldReloadAcademicContextRef.current = !needsVerification
    try {
      await Taro.navigateTo({
        url: needsVerification
          ? '/pages/academic-verification/index?rebind=1'
          : '/pages/academic/schedule/index',
      })
    } catch (error) {
      shouldReloadAcademicContextRef.current = false
      if (isCurrentPage()) Taro.showToast({ title: '暂时无法打开本人课表，请重试', icon: 'none' })
    }
  }

  const openBuddyChat = async (kind: 'meal' | 'study') => {
    if (!buddyMember || openingChatRef.current) return
    openingChatRef.current = true
    setOpeningChat(true)
    try {
      const config = await loadMiniappRuntimeConfig()
      if (!isCurrentPage()) return
      const module = resolveMiniappModule(config, 'private_message')
      if (module.state !== 'enabled') {
        await openMiniappModule('private_message', directMessagesListUrl, { config })
        return
      }
      const subscriptionAlreadyRequested = requestWechatSubscriptionForModule('private_message', config)
      const conversation = await privateMessagesRepository.createConversation(buddyMember.userId, isCurrentPage)
      if (!isCurrentPage()) return
      const message = kind === 'meal' ? '今天有空一起吃饭吗？' : '找个共同空闲的时间一起自习吧？'
      const url = `${directMessageChatUrl(conversation.id)}&prefill=${encodeURIComponent(message)}&prefill_source=timetable-buddy`
      const opened = await openMiniappModule('private_message', url, { config, subscriptionAlreadyRequested })
      if (opened && isCurrentPage()) setContactHint('消息已预填，打开后请检查内容并手动发送。')
    } catch (error) {
      if (!isCurrentPage()) return
      Taro.showToast({ title: errorMessage(error, '暂时无法打开私信，请稍后重试'), icon: 'none' })
    } finally {
      openingChatRef.current = false
      if (isCurrentPage()) setOpeningChat(false)
    }
  }

  const customCoursesSyncPending = customCoursesPending || Boolean(
    selectedCustomCoursesKey && failedCustomSyncKey === selectedCustomCoursesKey,
  )
  const commonFreeSlots = scheduleLoading || customCoursesSyncPending ? null : schedule?.commonFreeSlots
  const commonByDay = useMemo(() => {
    const slots = commonFreeSlots
    if (!slots) return null
    return weekdays.map((label, index) => ({
      weekday: index + 1,
      label,
      ranges: sectionRanges(slots.filter((slot) => slot.weekday === index + 1)),
    }))
  }, [commonFreeSlots])

  const meScheduleReady = schedule ? isSideScheduleReady(schedule.me) && !customCoursesSyncPending : false
  const buddyScheduleReady = schedule ? isSideScheduleReady(schedule.buddy) : false
  const commonAvailabilityMessage = schedule
    ? [
      customCoursesSyncPending
        ? `你的自定义课程有更新还没保存到共享课表；当前显示的是 ${formatTimestamp(schedule.me.customCoursesSyncedAt) || '上次保存时'} 的内容。`
        : '',
      sideReadinessMessage(schedule.me, '你'),
      sideReadinessMessage(schedule.buddy, buddyMember?.nickname || '搭子'),
    ].filter(Boolean).join(' ')
    : ''
  const invitationOptionsDisabled = invitationBusy || Boolean(pendingInvite)
  const needsAcademicVerification = !educationLevel || schedule?.me.dataStatus === 'identity_unavailable'
  const shouldOpenOwnSchedule = !schedule || !meScheduleReady
  const dayDate = dates[activeWeekday - 1]
  const meSlots = schedule && meScheduleReady ? slotsForWeek(schedule.me, week) : []
  const buddySlots = schedule && buddyScheduleReady ? slotsForWeek(schedule.buddy, week) : []
  const relation = connection ? timetableBuddyRelationLabel(connection.relationType) : ''

  return (
    <View className='timetable-buddy-page'>
      <CustomNavbar title='我们的课表' showBack />
      <View className='timetable-buddy-page__content'>
        {stateLoading && (
          <View className='timetable-buddy-state'>
            <View className='timetable-buddy-state__loader' />
            <Text>正在读取课表搭子状态…</Text>
          </View>
        )}
        {!stateLoading && stateError && (
          <View className='timetable-buddy-state timetable-buddy-state--error'>
            <Text className='timetable-buddy-state__title'>暂时无法加载</Text>
            <Text className='timetable-buddy-state__copy'>{stateError}</Text>
            <View className='timetable-buddy-button timetable-buddy-button--secondary' onClick={() => void loadState()}>重新加载</View>
            <View className='timetable-buddy-text-action' onClick={() => {
              void login()
                .then(() => isCurrentPage() ? loadState() : undefined)
                .catch((error) => {
                  if (isCurrentPage()) Taro.showToast({ title: errorMessage(error, '登录失败，请稍后重试'), icon: 'none' })
                })
            }}
            >重新登录</View>
          </View>
        )}
        {!stateLoading && !stateError && connection && !myMember && (
          <View className='timetable-buddy-state timetable-buddy-state--error'>
            <Text className='timetable-buddy-state__title'>关系信息暂不可用</Text>
            <Text className='timetable-buddy-state__copy'>当前账号与这条课表搭子关系不匹配，请重新加载。</Text>
            <View className='timetable-buddy-button timetable-buddy-button--secondary' onClick={() => void loadState()}>重新加载</View>
          </View>
        )}
        {!stateLoading && !stateError && inviteToken && (
          <View className='timetable-buddy-card timetable-buddy-invitation'>
            <View className='timetable-buddy-section-heading'>
              <Text className='timetable-buddy-section-heading__title'>课表搭子邀请</Text>
              <Text className='timetable-buddy-section-heading__hint'>接受前不会展示任何课表</Text>
            </View>
            {invitationPreview ? (
              <>
                <View className='timetable-buddy-invitation__person'>
                  <View className='timetable-buddy-avatar'>{invitationPreview.creatorNickname.slice(0, 1) || '搭'}</View>
                  <View className='timetable-buddy-invitation__identity'>
                    <Text className='timetable-buddy-invitation__nickname'>{invitationPreview.creatorNickname}</Text>
                    <Text className='timetable-buddy-invitation__relation'>邀请你成为{timetableBuddyRelationLabel(invitationPreview.relationType)}</Text>
                  </View>
                </View>
                <Text className='timetable-buddy-muted'>有效期至 {formatTimestamp(invitationPreview.expiresAt) || invitationPreview.expiresAt}</Text>
                {connection && <Text className='timetable-buddy-inline-error'>你已有有效的课表搭子，请先解除当前关系后再接受邀请。</Text>}
                <View
                  className={`timetable-buddy-button ${connection ? 'timetable-buddy-button--disabled' : ''}`}
                  ariaRole='button'
                  ariaLabel='接受课表搭子邀请'
                  onClick={() => void acceptInvitation()}
                >{accepting ? '正在接受…' : connection ? '已有课表搭子' : '接受邀请'}</View>
              </>
            ) : (
              <View className='timetable-buddy-state timetable-buddy-state--compact'>
                <Text className='timetable-buddy-state__copy'>{invitationError || '正在核验邀请…'}</Text>
                {invitationError && <View className='timetable-buddy-text-action' onClick={() => void loadState()}>重新核验</View>}
              </View>
            )}
          </View>
        )}

        {!stateLoading && !stateError && !connection && !inviteToken && (
          <>
            <View className='timetable-buddy-hero'>
              <View className='timetable-buddy-hero__eyebrow'>TIMETABLE BUDDY</View>
              <Text className='timetable-buddy-hero__title'>找到你们都空的时间</Text>
              <Text className='timetable-buddy-hero__copy'>连接课表后，一起约饭、自习，或者看看什么时候能见面。</Text>
            </View>
            <View className='timetable-buddy-card'>
              <View className='timetable-buddy-section-heading'>
                <Text className='timetable-buddy-section-heading__title'>想和谁一起看课表？</Text>
                <Text className='timetable-buddy-section-heading__hint'>关系只用于展示</Text>
              </View>
              <View className='timetable-buddy-choice-grid'>
                {RELATIONS.map((value) => (
                  <View
                    key={value}
                    className={`timetable-buddy-choice ${relationType === value ? 'timetable-buddy-choice--active' : ''} ${invitationOptionsDisabled ? 'timetable-buddy-choice--disabled' : ''}`}
                    ariaRole='button'
                    ariaLabel={timetableBuddyRelationLabel(value)}
                    onClick={() => {
                      if (!pendingInvite && !invitationBusyRef.current) setRelationType(value)
                    }}
                  >
                    <Text>{timetableBuddyRelationLabel(value)}</Text>
                  </View>
                ))}
              </View>
              <View className='timetable-buddy-divider' />
              <View className='timetable-buddy-section-heading'>
                <Text className='timetable-buddy-section-heading__title'>分享哪些课表信息？</Text>
                <Text className='timetable-buddy-section-heading__hint'>接受后生效，可随时调整</Text>
              </View>
              <View className='timetable-buddy-scope-options'>
                {SCOPES.map((value) => (
                  <View
                    key={value}
                    className={`timetable-buddy-scope-option ${newShareScope === value ? 'timetable-buddy-scope-option--active' : ''} ${invitationOptionsDisabled ? 'timetable-buddy-scope-option--disabled' : ''}`}
                    ariaRole='button'
                    ariaLabel={timetableBuddyScopeLabel(value)}
                    onClick={() => {
                      if (!pendingInvite && !invitationBusyRef.current) setNewShareScope(value)
                    }}
                  >
                    <View className='timetable-buddy-scope-option__radio'>{newShareScope === value ? <View /> : null}</View>
                    <View>
                      <Text className='timetable-buddy-scope-option__title'>{timetableBuddyScopeLabel(value)}</Text>
                      <Text className='timetable-buddy-scope-option__copy'>
                        {value === 'busy' ? '对方只看到上课时段，不会看到课程信息' : '对方可以看到课程名和地点'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              {!pendingInvite ? (
                <View
                  className={`timetable-buddy-button ${invitationBusy ? 'timetable-buddy-button--loading' : ''}`}
                  ariaRole='button'
                  ariaLabel='生成课表搭子邀请'
                  onClick={() => void createInvitation()}
                >{invitationBusy ? '正在生成邀请…' : '生成邀请'}</View>
              ) : (
                <View className='timetable-buddy-created-invite'>
                  <Text className='timetable-buddy-created-invite__title'>邀请已准备好</Text>
                  <Text className='timetable-buddy-created-invite__copy'>链接仅可接受一次，有效期 24 小时。分享前不会公开你的课表。</Text>
                  <Text className='timetable-buddy-created-invite__copy'>邀请关系：{timetableBuddyRelationLabel(pendingInvite.relationType)} · 分享范围：{timetableBuddyScopeLabel(pendingInvite.shareScope)}</Text>
                  <Button
                    className='timetable-buddy-button timetable-buddy-share-button'
                    hoverClass='none'
                    openType='share'
                    disabled={settingsBusy}
                  >发送给一位好友</Button>
                  <Text className='timetable-buddy-muted'>邀请有效期至 {formatTimestamp(pendingInvite.expiresAt) || pendingInvite.expiresAt}</Text>
                  <View
                    className={`timetable-buddy-text-action ${settingsBusy ? 'timetable-buddy-text-action--disabled' : ''}`}
                    onClick={() => void changePendingInvite()}
                  >{settingsBusy ? '正在撤销旧邀请…' : '更改关系或分享范围'}</View>
                </View>
              )}
            </View>
          </>
        )}

        {!stateLoading && !stateError && connection && myMember && (
          <>
            <View className='timetable-buddy-connection-card'>
              <View className='timetable-buddy-connection-card__top'>
                <View>
                  <Text className='timetable-buddy-connection-card__eyebrow'>{relation || '课表搭子'}</Text>
                  <Text className='timetable-buddy-connection-card__title'>你和{buddyMember?.nickname || '搭子'}的时间</Text>
                </View>
                <View className='timetable-buddy-relation-badge'>{relation}</View>
              </View>
              <View className='timetable-buddy-member-legend'>
                <View className='timetable-buddy-member-legend__item'>
                  <View className='timetable-buddy-member-legend__dot timetable-buddy-member-legend__dot--me' />
                  <Text>我 · {readinessLabel(schedule?.me, customCoursesSyncPending)}</Text>
                </View>
                <View className='timetable-buddy-member-legend__item'>
                  <View className='timetable-buddy-member-legend__dot timetable-buddy-member-legend__dot--buddy' />
                  <Text>{buddyMember?.nickname || '搭子'} · {readinessLabel(schedule?.buddy)}</Text>
                </View>
              </View>
            </View>

            <View className='timetable-buddy-card timetable-buddy-common'>
              <View className='timetable-buddy-section-heading'>
                <Text className='timetable-buddy-section-heading__title'>本周共同空闲</Text>
                <Text className='timetable-buddy-section-heading__hint'>第 {week} 周 · 仅按课程节次计算</Text>
              </View>
              {!scheduleLoading && schedule && commonFreeSlots === null && (
                <View className='timetable-buddy-availability-state'>
                  <Text className='timetable-buddy-availability-state__title'>暂时无法计算共同空闲</Text>
                  <Text className='timetable-buddy-availability-state__copy'>
                    {commonAvailabilityMessage || '双方本学期课表准备好后，才能确认共同空闲。'}
                  </Text>
                  {shouldOpenOwnSchedule && (
                    <View
                      className='timetable-buddy-text-action'
                      ariaRole='button'
                      ariaLabel={needsAcademicVerification ? '绑定教务身份' : '打开本人课表'}
                      onClick={() => void openAcademicPage(needsAcademicVerification)}
                    >{needsAcademicVerification ? '检查教务身份' : '打开本人课表'}</View>
                  )}
                </View>
              )}
              {!scheduleLoading && schedule && commonByDay && commonFreeSlots !== null && (
                commonByDay.some((day) => day.ranges.length) ? (
                  <View className='timetable-buddy-common__days'>
                    {commonByDay.filter((day) => day.ranges.length).map((day) => (
                      <View key={day.weekday} className='timetable-buddy-common__day'>
                        <Text className='timetable-buddy-common__day-label'>{day.label}</Text>
                        <Text className='timetable-buddy-common__day-copy'>第 {day.ranges.map((range) => `${range} 节`).join('、')}有空</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className='timetable-buddy-availability-state'>
                    <Text className='timetable-buddy-availability-state__title'>本周没有共同空闲节次</Text>
                    <Text className='timetable-buddy-availability-state__copy'>可以切换周次，看看之后什么时候有空。</Text>
                  </View>
                )
              )}
              {scheduleLoading && <Text className='timetable-buddy-muted'>正在计算本周共同空闲…</Text>}
              {scheduleError && (
                <View className='timetable-buddy-inline-error'>
                  <Text>{scheduleError}</Text>
                  <View className='timetable-buddy-text-action' onClick={() => void loadBuddySchedule()}>重试</View>
                </View>
              )}
            </View>

            <View className='timetable-buddy-card timetable-buddy-week-card'>
              <View className='timetable-buddy-week-controls'>
                <View className='timetable-buddy-section-heading'>
                  <Text className='timetable-buddy-section-heading__title'>双人周课表</Text>
                  <Text className='timetable-buddy-section-heading__hint'>双方颜色与文字标识对应</Text>
                </View>
                <View className='timetable-buddy-week-controls__actions'>
                  <View
                    className={`timetable-buddy-week-controls__arrow ${week <= 1 ? 'timetable-buddy-week-controls__arrow--disabled' : ''}`}
                    ariaRole='button'
                    ariaLabel='上一周'
                    onClick={() => setWeek((value) => Math.max(1, value - 1))}
                  >‹</View>
                  <Text className='timetable-buddy-week-controls__week'>第 {week} 周</Text>
                  <View
                    className={`timetable-buddy-week-controls__arrow ${week >= (selectedPeriod?.weeks || 20) ? 'timetable-buddy-week-controls__arrow--disabled' : ''}`}
                    ariaRole='button'
                    ariaLabel='下一周'
                    onClick={() => setWeek((value) => Math.min(selectedPeriod?.weeks || 20, value + 1))}
                  >›</View>
                </View>
              </View>
              {periods.length > 0 ? (
                <Picker
                  mode='selector'
                  range={periods.map((period) => period.label)}
                  value={Math.max(0, periods.findIndex((period) => period.id === periodId))}
                  onChange={(event) => {
                    const nextPeriod = periods[Number(event.detail.value)]
                    if (!nextPeriod) return
                    setPeriodId(nextPeriod.id)
                    setWeek(clampWeek(nextPeriod.isCurrent ? getCurrentTeachingWeek(nextPeriod) : 1, nextPeriod))
                  }}
                >
                  <View className='timetable-buddy-period-picker'>
                    <Text>{selectedPeriod?.label || '选择学期'}</Text>
                    <Text className='timetable-buddy-period-picker__arrow'>⌄</Text>
                  </View>
                </Picker>
              ) : (
                <View className='timetable-buddy-period-empty'>
                  <Text>还没有可查看的学期信息。先打开本人课表，查询成功后再回来刷新。</Text>
                  <View className='timetable-buddy-text-action' onClick={() => void openAcademicPage()}>打开本人课表</View>
                </View>
              )}
              <View className='timetable-buddy-day-tabs'>
                {weekdays.map((label, index) => (
                  <View
                    key={label}
                    className={`timetable-buddy-day-tab ${activeWeekday === index + 1 ? 'timetable-buddy-day-tab--active' : ''}`}
                    ariaRole='button'
                    ariaLabel={`${label}${dates[index] ? `，${formatMonthDay(dates[index])}` : ''}`}
                    onClick={() => setActiveWeekday(index + 1)}
                  >
                    <Text>{DAY_NAMES[index]}</Text>
                    <Text>{dates[index] ? formatMonthDay(dates[index]) : ''}</Text>
                  </View>
                ))}
              </View>
              {dayDate && <Text className='timetable-buddy-day-date'>{weekdays[activeWeekday - 1]} · {formatMonthDay(dayDate)}</Text>}
              {scheduleLoading && <View className='timetable-buddy-timeline-state'>正在加载双方课表…</View>}
              {!scheduleLoading && scheduleError && <View className='timetable-buddy-timeline-state timetable-buddy-timeline-state--error'>{scheduleError}</View>}
              {!scheduleLoading && !scheduleError && schedule && (
                <View className='timetable-buddy-timeline'>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((section) => {
                    const myCourses = schedule.me.paused || !meScheduleReady ? [] : courseAt(schedule.me, activeWeekday, section, week)
                    const buddyCourses = schedule.buddy.paused || !buddyScheduleReady ? [] : courseAt(schedule.buddy, activeWeekday, section, week)
                    const meBusy = !schedule.me.paused && meScheduleReady && hasBusySlot(meSlots, activeWeekday, section)
                    const buddyBusy = !schedule.buddy.paused && buddyScheduleReady && hasBusySlot(buddySlots, activeWeekday, section)
                    const meUnknown = !schedule.me.paused && !meScheduleReady
                    const buddyUnknown = !schedule.buddy.paused && !buddyScheduleReady
                    const hasAny = myCourses.length || buddyCourses.length || meBusy || buddyBusy || meUnknown || buddyUnknown
                    const free = commonFreeSlots?.some((slot) => slot.weekday === activeWeekday && slot.section === section)
                    return (
                      <View key={section} className={`timetable-buddy-timeline__row ${free ? 'timetable-buddy-timeline__row--free' : ''}`}>
                        <View className='timetable-buddy-timeline__section'>
                          <Text>{section}</Text>
                          <Text>节</Text>
                        </View>
                        <View className='timetable-buddy-timeline__content'>
                          {myCourses.map((course, index) => (
                            <View key={`me-${course.name}-${index}`} className='timetable-buddy-course timetable-buddy-course--me'>
                              <Text className='timetable-buddy-course__owner'>我</Text>
                              <Text className='timetable-buddy-course__name'>{course.name}</Text>
                              {course.location && <Text className='timetable-buddy-course__location'>{course.location}</Text>}
                            </View>
                          ))}
                          {buddyCourses.map((course, index) => (
                            <View key={`buddy-${course.name}-${index}`} className='timetable-buddy-course timetable-buddy-course--buddy'>
                              <Text className='timetable-buddy-course__owner'>{buddyMember?.nickname || '搭子'}</Text>
                              <Text className='timetable-buddy-course__name'>{course.name}</Text>
                              {course.location && <Text className='timetable-buddy-course__location'>{course.location}</Text>}
                            </View>
                          ))}
                          {!myCourses.length && meBusy && <View className='timetable-buddy-busy timetable-buddy-busy--me'><Text>我</Text><Text>有课</Text></View>}
                          {!buddyCourses.length && buddyBusy && <View className='timetable-buddy-busy timetable-buddy-busy--buddy'><Text>{buddyMember?.nickname || '搭子'}</Text><Text>有课</Text></View>}
                          {meUnknown && <Text className='timetable-buddy-timeline__unknown'>我 · 未就绪</Text>}
                          {buddyUnknown && <Text className='timetable-buddy-timeline__unknown'>{buddyMember?.nickname || '搭子'} · 未就绪</Text>}
                          {!hasAny && <Text className='timetable-buddy-timeline__empty'>{free ? '共同空闲' : '—'}</Text>}
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>

            <View className='timetable-buddy-card timetable-buddy-sync-card'>
              <View className='timetable-buddy-section-heading'>
                <Text className='timetable-buddy-section-heading__title'>课表来源与更新</Text>
                <Text className='timetable-buddy-section-heading__hint'>{selectedPeriod?.label || '当前学期'}</Text>
              </View>
              <Text className='timetable-buddy-sync-card__copy'>官方课程来自你最近成功查询的课表。教务更新后，请打开本人课表刷新，再回来刷新这里；更新可能有短暂延迟。蹭课从已保存的个人课表读取。自定义课程保存在本机，进入或刷新本页时会自动保存到共享课表。</Text>
              <View className='timetable-buddy-sync-card__meta'>
                <Text>我的官方课表更新时间：{formatTimestamp(schedule?.me.syncedAt) || '暂无'} · {readinessLabel(schedule?.me, customCoursesSyncPending)}</Text>
                <Text>我的自定义课程保存时间：{customCoursesSyncPending ? `有更新未保存（上次 ${formatTimestamp(schedule?.me.customCoursesSyncedAt) || '暂无'}）` : schedule?.me.customCoursesReady ? formatTimestamp(schedule.me.customCoursesSyncedAt) || '已保存' : '尚未保存'}</Text>
                <Text>{buddyMember?.nickname || '搭子'}的官方课表更新时间：{formatTimestamp(schedule?.buddy.syncedAt) || '暂无'} · {readinessLabel(schedule?.buddy)}</Text>
                <Text>{buddyMember?.nickname || '搭子'}的自定义课程保存时间：{schedule?.buddy.customCoursesReady ? formatTimestamp(schedule.buddy.customCoursesSyncedAt) || '已保存' : '尚未保存'}</Text>
              </View>
              {periodId && selectedPeriod && educationLevel ? (
                <View
                  className={`timetable-buddy-button timetable-buddy-button--secondary ${scheduleLoading ? 'timetable-buddy-button--loading' : ''}`}
                  ariaRole='button'
                  ariaLabel='上传当前学期自定义课程并刷新双方课表'
                  onClick={() => void loadBuddySchedule({ syncCustom: true, forceCustom: true })}
                >{scheduleLoading ? '正在刷新课表…' : '刷新双方课表'}</View>
              ) : (
                <View className='timetable-buddy-text-action' onClick={() => void openAcademicPage(needsAcademicVerification)}>
                  {needsAcademicVerification ? '检查教务身份' : '打开本人课表读取学期'}
                </View>
              )}
              {shouldOpenOwnSchedule && (
                <View className='timetable-buddy-text-action' onClick={() => void openAcademicPage(needsAcademicVerification)}>
                  {needsAcademicVerification ? '检查教务身份' : '打开本人课表'}
                </View>
              )}
              {customSyncError && (
                <View className='timetable-buddy-sync-error'>
                  <Text>{customSyncError}</Text>
                  {periodId && educationLevel && <View className='timetable-buddy-text-action' onClick={() => void loadBuddySchedule({ syncCustom: true, forceCustom: true })}>重试保存自定义课程</View>}
                </View>
              )}
            </View>

            <View className='timetable-buddy-card timetable-buddy-settings'>
              <View className='timetable-buddy-section-heading'>
                <Text className='timetable-buddy-section-heading__title'>分享设置</Text>
                <Text className='timetable-buddy-section-heading__hint'>只影响你自己的课表</Text>
              </View>
              <View className='timetable-buddy-settings__scope-row'>
                <Text>对方可见</Text>
                <View className='timetable-buddy-settings__scope-options'>
                  {SCOPES.map((scope) => (
                    <View
                      key={scope}
                      className={`timetable-buddy-settings__scope ${myMember.shareScope === scope ? 'timetable-buddy-settings__scope--active' : ''}`}
                      ariaRole='button'
                      ariaLabel={`设置为${timetableBuddyScopeLabel(scope)}`}
                      onClick={() => void updateSettings({ shareScope: scope })}
                    >{timetableBuddyScopeLabel(scope)}</View>
                  ))}
                </View>
              </View>
              <View className='timetable-buddy-settings__pause-row'>
                <View>
                  <Text className='timetable-buddy-settings__pause-title'>{myMember.paused ? '已暂停分享' : '正在分享课表'}</Text>
                  <Text className='timetable-buddy-settings__pause-copy'>暂停后对方看不到你的课程，也不会计算共同空闲。</Text>
                </View>
                <View
                  className={`timetable-buddy-toggle ${myMember.paused ? 'timetable-buddy-toggle--paused' : ''} ${settingsBusy ? 'timetable-buddy-toggle--disabled' : ''}`}
                  ariaRole='button'
                  ariaLabel={myMember.paused ? '恢复课表分享' : '暂停课表分享'}
                  onClick={() => void updateSettings({ paused: !myMember.paused })}
                ><View /></View>
              </View>
              {contactHint && <Text className='timetable-buddy-contact-hint'>{contactHint}</Text>}
              <View className='timetable-buddy-contact-actions'>
                <View
                  className={`timetable-buddy-contact-action ${openingChat ? 'timetable-buddy-contact-action--disabled' : ''}`}
                  ariaRole='button'
                  ariaLabel='约饭并打开私信'
                  onClick={() => void openBuddyChat('meal')}
                >约饭</View>
                <View
                  className={`timetable-buddy-contact-action ${openingChat ? 'timetable-buddy-contact-action--disabled' : ''}`}
                  ariaRole='button'
                  ariaLabel='约自习并打开私信'
                  onClick={() => void openBuddyChat('study')}
                >一起自习</View>
              </View>
              <View
                className={`timetable-buddy-disconnect ${settingsBusy ? 'timetable-buddy-disconnect--disabled' : ''}`}
                ariaRole='button'
                ariaLabel='解除课表搭子关系'
                onClick={() => void disconnect()}
              >解除课表搭子</View>
            </View>
          </>
        )}
      </View>
    </View>
  )
}

export default function TimetableBuddyPage() {
  const [pageCacheScope, setPageCacheScope] = useState(getPageCacheScope)

  useEffect(() => subscribePageCacheScope(() => setPageCacheScope(getPageCacheScope())), [])

  return (
    <TimetableBuddyPageContent
      key={pageCacheScope}
      userId={getCachedPageUserId()}
      pageCacheScope={pageCacheScope}
    />
  )
}
