import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import type {
  AcademicCalendarEvent,
  AcademicEducationLevel,
} from '../../api/types'
import CustomNavbar from '../../components/custom-navbar'
import {
  CalendarLoadResult,
  getCachedAcademicCalendar,
  getCalendarEducationLevel,
  loadAcademicCalendar,
  saveCalendarEducationLevel,
} from '../../features/calendar/repository'
import {
  calendarDateKey,
  calendarEventsForTerm,
  formatCalendarRange,
  orderedAcademicCalendarTerms,
  resolveAcademicCalendarState,
  resolveAcademicCalendarTerm,
} from '../../features/calendar/utils'
import { useCampusShare } from '../../features/share'
import './index.scss'

type EventFilter = 'all' | 'exam' | 'holiday' | 'makeup'

const levelOptions: Array<[AcademicEducationLevel, string]> = [
  ['undergraduate', '本科生'],
  ['graduate', '研究生'],
]

const filterOptions: Array<[EventFilter, string]> = [
  ['all', '全部安排'],
  ['holiday', '放假'],
  ['exam', '考试'],
  ['makeup', '调课'],
]

const eventTypeText = (event: AcademicCalendarEvent) => ({
  exam: '考试',
  holiday: '放假',
  makeup: '调课 / 补课',
  other: '校园安排',
  registration: '报到 / 注册',
  teaching: '教学安排',
  term_start: '开学',
}[event.type])

const sourceMessage = (source: CalendarLoadResult['source']) => {
  if (source === 'cache') return '网络暂不可用，正在展示上次成功获取的校历'
  if (source === 'unavailable') return '暂时无法获取校历，下拉刷新后再试'
  return ''
}

const weekWindow = (current: number, total: number) => {
  if (total <= 0) return []
  const visible = Math.min(5, total)
  const start = Math.min(
    Math.max(1, current - 2),
    Math.max(1, total - visible + 1),
  )
  return Array.from({ length: visible }, (_, index) => start + index)
}

export default function CalendarPage() {
  const [level, setLevel] = useState(getCalendarEducationLevel)
  const [result, setResult] = useState<CalendarLoadResult>(() => (
    getCachedAcademicCalendar(level)
  ))
  const [loading, setLoading] = useState(!result.calendar)
  const [filter, setFilter] = useState<EventFilter>('all')
  const [selectedTermID, setSelectedTermID] = useState('')
  const forceLevelRefresh = useRef<AcademicEducationLevel | null>(null)

  const refresh = useCallback(async (options: { force?: boolean } = {}) => {
    setLoading(true)
    try {
      setResult(await loadAcademicCalendar(level, options))
    } finally {
      setLoading(false)
    }
  }, [level])

  useEffect(() => {
    setResult(getCachedAcademicCalendar(level))
    setSelectedTermID('')
    const force = forceLevelRefresh.current === level
    if (force) forceLevelRefresh.current = null
    void refresh({ force })
  }, [level, refresh])

  usePullDownRefresh(async () => {
    await refresh({ force: true })
    Taro.stopPullDownRefresh()
  })

  const automaticState = useMemo(
    () => resolveAcademicCalendarState(result.calendar),
    [result.calendar],
  )
  const terms = useMemo(
    () => orderedAcademicCalendarTerms(result.calendar),
    [result.calendar],
  )
  const activeTerm = useMemo(
    () => resolveAcademicCalendarTerm(result.calendar, selectedTermID),
    [result.calendar, selectedTermID],
  )
  useCampusShare(() => ({
    title: `${level === 'graduate' ? '研究生' : '本科生'}校历｜OUSea`,
    path: '/pages/calendar/index',
  }))
  const state = useMemo(() => (
    activeTerm && result.calendar
      ? resolveAcademicCalendarState({
          ...result.calendar,
          terms: [activeTerm],
        })
      : automaticState
  ), [activeTerm, automaticState, result.calendar])
  const browsingAnotherTerm = !!activeTerm
    && !!automaticState.term
    && activeTerm.id !== automaticState.term.id
  const weeks = state.kind === 'current' && !browsingAnotherTerm
    ? weekWindow(state.week, state.term.week_count)
    : []
  const events = useMemo(() => {
    const items = activeTerm
      ? calendarEventsForTerm(result.calendar, activeTerm.id)
      : result.calendar?.events || []
    return items.filter((event) => filter === 'all' || event.type === filter)
  }, [activeTerm, filter, result.calendar])
  const today = calendarDateKey()

  const chooseLevel = (next: AcademicEducationLevel) => {
    if (next === level) return
    saveCalendarEducationLevel(next)
    setFilter('all')
    setSelectedTermID('')
    forceLevelRefresh.current = next
    setLevel(next)
  }

  const chooseTerm = (termID: string) => {
    setSelectedTermID(termID)
    setFilter('all')
  }

  return (
    <View className='calendar-page'>
      <View className='calendar-page__orb calendar-page__orb--one' />
      <View className='calendar-page__orb calendar-page__orb--two' />
      <CustomNavbar title='校历' subtitle='教学周次与校园安排' showBack />

      <View className='calendar-page__content'>
        <View className='calendar-level-switch'>
          {levelOptions.map(([value, label]) => (
            <View
              key={value}
              className={level === value ? 'calendar-level-switch__active' : ''}
              role='button'
              ariaLabel={`切换至${label}校历`}
              onClick={() => chooseLevel(value)}
            >
              {label}
            </View>
          ))}
        </View>

        {terms.length > 1 && (
          <ScrollView
            className='calendar-term-switch'
            scrollX
            enhanced
            showScrollbar={false}
          >
            {terms.map((term) => (
              <View
                key={term.id}
                className={activeTerm?.id === term.id
                  ? 'calendar-term-switch__active'
                  : ''}
                role='button'
                ariaLabel={`查看${term.label}`}
                onClick={() => chooseTerm(term.id)}
              >
                <Text>{term.short_label}</Text>
                <Text>{automaticState.term?.id === term.id
                  ? '默认'
                  : term.start_date.slice(0, 4)}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View className={`calendar-hero calendar-hero--${state.kind}`}>
          <View className='calendar-hero__eyebrow'>
            <View />
            <Text>{activeTerm?.short_label || '公开校历'}</Text>
          </View>

          {browsingAnotherTerm && activeTerm && (
            <>
              <Text className='calendar-hero__title'>{activeTerm.short_label}</Text>
              <Text className='calendar-hero__subtitle'>
                {formatCalendarRange(activeTerm.start_date, activeTerm.end_date)}
              </Text>
              <View className='calendar-hero__footer'>
                <Text>{activeTerm.label}</Text>
                <Text>共 {activeTerm.week_count} 周</Text>
              </View>
            </>
          )}

          {!browsingAnotherTerm && state.kind === 'current' && (
            <>
              <Text className='calendar-hero__title'>第 {state.week} 周</Text>
              <Text className='calendar-hero__subtitle'>
                本学期共 {state.term.week_count} 周，按教学节奏稳稳向前
              </Text>
              <View className='calendar-progress'>
                <View
                  style={{
                    width: `${Math.max(
                      4,
                      Math.min(100, state.week / state.term.week_count * 100),
                    )}%`,
                  }}
                />
              </View>
              <View className='calendar-hero__footer'>
                <Text>{state.term.label}</Text>
                <Text>{state.term.end_date.slice(5).replace('-', '.')} 结束</Text>
              </View>
            </>
          )}

          {!browsingAnotherTerm && state.kind === 'upcoming' && (
            <>
              <Text className='calendar-hero__title'>享受假期吧</Text>
              <Text className='calendar-hero__subtitle'>
                距 {state.term.short_label} 开学还有 {state.daysUntilStart} 天
              </Text>
              <View className='calendar-hero__footer'>
                <Text>{state.term.label}</Text>
                <Text>{state.term.start_date.slice(5).replace('-', '.')} 开学</Text>
              </View>
            </>
          )}

          {!browsingAnotherTerm && state.kind === 'finished' && (
            <>
              <Text className='calendar-hero__title'>本学期顺利收官</Text>
              <Text className='calendar-hero__subtitle'>
                享受假期吧，新学期安排发布后会及时更新
              </Text>
              <View className='calendar-hero__footer'>
                <Text>{state.term.label}</Text>
                <Text>已结束</Text>
              </View>
            </>
          )}

          {!browsingAnotherTerm && state.kind === 'unavailable' && (
            <>
              <Text className='calendar-hero__title'>校历正在同步</Text>
              <Text className='calendar-hero__subtitle'>
                下拉刷新即可重新获取最新教学安排
              </Text>
            </>
          )}
        </View>

        {!loading && result.source !== 'network' && (
          <View className={`calendar-source calendar-source--${result.source}`}>
            <View />
            <Text>{sourceMessage(result.source)}</Text>
          </View>
        )}

        {weeks.length > 0 && (
          <View className='calendar-week-card'>
            <View className='calendar-section-heading'>
              <Text>教学进度</Text>
              <Text>{state.term?.week_count} 周</Text>
            </View>
            <View className='calendar-week-strip'>
              {weeks.map((week) => (
                <View
                  key={week}
                  className={state.kind === 'current' && week === state.week
                    ? 'calendar-week-strip__active'
                    : ''}
                >
                  <Text>{week}</Text>
                  <Text>{week === state.week ? '本周' : '周'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className='calendar-section-heading calendar-section-heading--events'>
          <View>
            <Text>重要安排</Text>
            <Text>{activeTerm?.short_label || '全部校历'}</Text>
          </View>
          <Text>{loading ? '同步中' : `${events.length} 条`}</Text>
        </View>

        <ScrollView
          className='calendar-filters'
          scrollX
          enhanced
          showScrollbar={false}
        >
          {filterOptions.map(([value, label]) => (
            <View
              key={value}
              className={filter === value ? 'calendar-filters__active' : ''}
              role='button'
              ariaLabel={`筛选${label}安排`}
              onClick={() => setFilter(value)}
            >
              {label}
            </View>
          ))}
        </ScrollView>

        {loading && !result.calendar && (
          <View className='calendar-loading'>
            {[0, 1, 2].map((item) => <View key={item} />)}
          </View>
        )}

        {!loading && events.length === 0 && (
          <View className='calendar-empty'>
            <View className='calendar-empty__mark'>
              <View />
              <View />
              <View />
            </View>
            <Text>暂时没有相关安排</Text>
            <Text>新的校历事件发布后会自动出现在这里</Text>
          </View>
        )}

        <View className='calendar-timeline'>
          {events.map((event) => {
            const finished = event.end_date < today
            return (
              <View
                key={event.id}
                className={[
                  'calendar-event',
                  `calendar-event--${event.type}`,
                  finished ? 'calendar-event--finished' : '',
                ].filter(Boolean).join(' ')}
              >
                <View className='calendar-event__rail'>
                  <View />
                  <View />
                </View>
                <View className='calendar-event__body'>
                  <View className='calendar-event__head'>
                    <Text>{formatCalendarRange(event.start_date, event.end_date)}</Text>
                    <Text>{eventTypeText(event)}</Text>
                  </View>
                  <Text className='calendar-event__title'>{event.title}</Text>
                  {event.description && (
                    <Text className='calendar-event__description'>
                      {event.description}
                    </Text>
                  )}
                  <Text className='calendar-event__campus'>
                    {Array.isArray(event.campuses) && event.campuses.length
                      ? event.campuses.join(' · ')
                      : '全部校区'}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

        <Text className='calendar-page__note'>
          校历信息以学校最新通知为准，临时调课请同时关注课程群与教务系统。
        </Text>
      </View>
    </View>
  )
}
