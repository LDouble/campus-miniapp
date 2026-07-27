import { useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { Input, Text, View } from '@tarojs/components'
import AcademicHeader from '../components/academic-header'
import { calculateGradeSummary, getGradeDisplay, getGradePoint, getGradeScore, gradeLevelScores } from '../calculations'
import { academicRepository } from '../repository'
import { academicStorage } from '../storage'
import {
  AcademicPreferences,
  GradeRecord,
  GradeLevel,
  GradeSimulation,
} from '../types'
import {
  deriveGradePeriods,
  getGradePeriodLabel,
} from '../utils'
import '../index.scss'

const DEFAULT_PERIOD_ID = '2025-2026-2'
const ALL_PERIOD_ID = 'all'
const defaultPreferences: AcademicPreferences = {
  section: 'grades',
  schedulePeriodId: DEFAULT_PERIOD_ID,
  gradePeriodId: ALL_PERIOD_ID,
  examPeriodId: DEFAULT_PERIOD_ID,
  week: 6,
  selectedWeekday: 1,
  scheduleView: 'week',
}

type GradeSheet = 'period' | 'grade-edit' | null

const formatGradePoint = (score?: number) => (
  score === undefined ? '—' : getGradePoint(score).toFixed(1)
)

export default function GradesPage() {
  const [preferences, setPreferences] = useState<AcademicPreferences>({
    ...defaultPreferences,
    ...academicStorage.getPreferences(defaultPreferences),
    section: 'grades',
  })
  const [allGrades, setAllGrades] = useState<GradeRecord[]>([])
  const [simulations, setSimulations] = useState<Record<string, GradeSimulation>>(
    academicStorage.getGradeSimulations(),
  )
  const [loading, setLoading] = useState(true)
  const [simulationMode, setSimulationMode] = useState(false)
  const [sheet, setSheet] = useState<GradeSheet>(null)
  const [editingGrade, setEditingGrade] = useState<GradeRecord | null>(null)
  const [gradeScore, setGradeScore] = useState('')
  const [gradeCredit, setGradeCredit] = useState('')
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('优秀')

  const periods = useMemo(() => deriveGradePeriods(allGrades), [allGrades])
  const grades = useMemo(() => (
    preferences.gradePeriodId === ALL_PERIOD_ID
      ? allGrades
      : allGrades.filter((grade) => grade.periodId === preferences.gradePeriodId)
  ), [allGrades, preferences.gradePeriodId])
  const gradeGroups = useMemo(() => {
    if (preferences.gradePeriodId !== ALL_PERIOD_ID) {
      return [{ id: preferences.gradePeriodId, label: '', records: grades }]
    }
    const grouped = new Map<string, GradeRecord[]>()
    allGrades.forEach((grade) => {
      const periodId = grade.periodId.trim()
      const key = periodId || '__unknown__'
      grouped.set(key, [...(grouped.get(key) || []), grade])
    })
    return [...grouped.entries()].map(([id, records]) => ({
      id,
      label: id === '__unknown__'
        ? '未识别学期'
        : periods.find((period) => period.id === id)?.label || id,
      records,
    }))
  }, [allGrades, grades, periods, preferences.gradePeriodId])
  const currentSimulation = simulations[preferences.gradePeriodId] || {
    selectedIds: grades.map((grade) => grade.id),
    overrides: {},
  }
  const originalSimulation = useMemo<GradeSimulation>(() => ({
    selectedIds: grades.map((grade) => grade.id),
    overrides: {},
  }), [grades])
  const displayedSimulation = simulationMode ? currentSimulation : originalSimulation
  const summary = useMemo(
    () => calculateGradeSummary(grades, displayedSimulation),
    [displayedSimulation, grades],
  )
  const allSelected = grades.length > 0
    && grades.every((grade) => currentSimulation.selectedIds.includes(grade.id))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    academicRepository.getGrades()
      .then((records) => {
        if (cancelled) return
        setAllGrades(records)
        setPreferences((current) => {
          if (
            current.gradePeriodId === ALL_PERIOD_ID
            || records.some((grade) => grade.periodId === current.gradePeriodId)
          ) return current
          return { ...current, gradePeriodId: ALL_PERIOD_ID }
        })
      })
      .catch(() => {
        if (!cancelled) Taro.showToast({ title: '成绩加载失败', icon: 'none' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (loading) return
    setSimulations((current) => current[preferences.gradePeriodId] ? current : {
      ...current,
      [preferences.gradePeriodId]: {
        selectedIds: grades.map((grade) => grade.id),
        overrides: {},
      },
    })
  }, [grades, loading, preferences.gradePeriodId])

  useEffect(() => academicStorage.setPreferences(preferences), [preferences])
  useEffect(() => academicStorage.setGradeSimulations(simulations), [simulations])

  const updatePreferences = (patch: Partial<AcademicPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch, section: 'grades' }))
  }

  const enterSimulation = () => {
    setSimulationMode(true)
    Taro.showToast({ title: '已进入模拟计算', icon: 'none' })
  }

  const exitSimulation = () => {
    setSimulationMode(false)
    Taro.showToast({ title: '已退出模拟计算', icon: 'none' })
  }

  const updateSimulation = (updater: (simulation: GradeSimulation) => GradeSimulation) => {
    setSimulations((current) => ({
      ...current,
      [preferences.gradePeriodId]: updater(current[preferences.gradePeriodId] || {
        selectedIds: grades.map((grade) => grade.id),
        overrides: {},
      }),
    }))
  }

  const toggleGrade = (gradeId: string) => {
    updateSimulation((simulation) => ({
      ...simulation,
      selectedIds: simulation.selectedIds.includes(gradeId)
        ? simulation.selectedIds.filter((id) => id !== gradeId)
        : [...simulation.selectedIds, gradeId],
    }))
  }

  const toggleAll = () => {
    updateSimulation((simulation) => ({
      ...simulation,
      selectedIds: allSelected ? [] : grades.map((grade) => grade.id),
    }))
  }

  const openEditor = (grade: GradeRecord) => {
    if (!simulationMode) return
    const override = currentSimulation.overrides[grade.id]
    const score = getGradeScore(grade, override)
    setEditingGrade(grade)
    setGradeScore(score === undefined ? '' : String(score))
    setGradeLevel(override?.gradeLevel || grade.gradeLevel || '优秀')
    setGradeCredit(String(override?.credit ?? grade.credit))
    setSheet('grade-edit')
  }

  const saveOverride = () => {
    if (!editingGrade) return
    const credit = Number(gradeCredit)
    const score = Number(gradeScore)
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      Taro.showToast({ title: '成绩请输入 0 至 100', icon: 'none' })
      return
    }
    if (!Number.isFinite(credit) || credit < 0.5 || credit > 20) {
      Taro.showToast({ title: '学分请输入 0.5 至 20', icon: 'none' })
      return
    }
    updateSimulation((simulation) => ({
      selectedIds: simulation.selectedIds.includes(editingGrade.id)
        ? simulation.selectedIds
        : [...simulation.selectedIds, editingGrade.id],
      overrides: {
        ...simulation.overrides,
        [editingGrade.id]: editingGrade.gradeType === 'level' ? { gradeLevel, score, credit } : { score, credit },
      },
    }))
    setSheet(null)
    Taro.showToast({ title: '模拟成绩已保存', icon: 'success' })
  }

  const resetSimulation = async () => {
    const result = await Taro.showModal({
      title: '恢复原始成绩',
      content: '将清除当前学期的模拟修改，并重新勾选全部课程。',
      confirmColor: '#4d9ead',
    })
    if (!result.confirm) return
    setSimulations((current) => ({
      ...current,
      [preferences.gradePeriodId]: {
        selectedIds: grades.map((grade) => grade.id),
        overrides: {},
      },
    }))
    Taro.showToast({ title: '已恢复原始数据', icon: 'success' })
  }

  const toolbar = (
    <View className='academic-toolbar academic-toolbar--simple'>
      <View className='academic-toolbar__period' onClick={() => setSheet('period')}>
        <Text className='academic-toolbar__label'>成绩范围</Text>
        <View>
          <Text>{preferences.gradePeriodId === ALL_PERIOD_ID ? '全部学期' : getGradePeriodLabel(periods, preferences.gradePeriodId)}</Text>
          <Text className='academic-toolbar__chevron'>⌄</Text>
        </View>
      </View>
      {simulationMode ? (
        <View className='academic-toolbar__mode-actions'>
          <View onClick={exitSimulation}>取消模拟</View>
          <View onClick={resetSimulation}>重置模拟</View>
        </View>
      ) : (
        <View className='academic-toolbar__reset academic-toolbar__reset--simulate' onClick={enterSimulation}>模拟计算</View>
      )}
    </View>
  )

  const renderSheet = () => {
    if (!sheet) return null
    return (
      <View className='academic-overlay' onClick={() => setSheet(null)}>
        <View className={`academic-sheet academic-sheet--${sheet}`} onClick={(event) => event.stopPropagation()}>
          <View className='academic-sheet__handle' />
          <View className='academic-sheet__close' onClick={() => setSheet(null)}>×</View>
          {sheet === 'period' && (
            <View className='academic-sheet__body'>
              <Text className='academic-sheet__title'>选择成绩学期</Text>
              <Text className='academic-sheet__subtitle'>全部成绩已加载，切换学期不会重复请求教务系统</Text>
              <View className='period-options'>
                <View
                  className={`period-options__item ${preferences.gradePeriodId === ALL_PERIOD_ID ? 'period-options__item--active' : ''}`}
                  onClick={() => {
                    updatePreferences({ gradePeriodId: ALL_PERIOD_ID })
                    setSheet(null)
                  }}
                >
                  <View>
                    <Text>全部学期</Text>
                    <Text>汇总查看所有已发布课程成绩</Text>
                  </View>
                  <View className='period-options__check'>
                    {preferences.gradePeriodId === ALL_PERIOD_ID ? '✓' : ''}
                  </View>
                </View>
                {periods.map((period) => (
                  <View
                    key={period.id}
                    className={`period-options__item ${preferences.gradePeriodId === period.id ? 'period-options__item--active' : ''}`}
                    onClick={() => {
                      updatePreferences({ gradePeriodId: period.id })
                      setSheet(null)
                    }}
                  >
                    <View>
                      <Text>{period.label}</Text>
                      <Text>{allGrades.filter((grade) => grade.periodId === period.id).length} 门课程</Text>
                    </View>
                    <View className='period-options__check'>
                      {preferences.gradePeriodId === period.id ? '✓' : ''}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
          {sheet === 'grade-edit' && editingGrade && (
            <View className='academic-sheet__body'>
              <Text className='academic-sheet__title'>模拟成绩计算</Text>
              <Text className='academic-sheet__subtitle'>{editingGrade.courseName}</Text>
              <View className='grade-original'>
                <View><Text>原始成绩</Text><Text>{getGradeDisplay(editingGrade)}</Text></View>
                {editingGrade.gradeType === 'level' && (
                  <View>
                    <Text>默认折算</Text>
                    <Text>
                      {getGradeScore(editingGrade) === undefined
                        ? '不参与计算'
                        : `${getGradeScore(editingGrade)} 分`}
                    </Text>
                  </View>
                )}
                <View><Text>原始学分</Text><Text>{editingGrade.credit}</Text></View>
                <View>
                  <Text>原始绩点</Text>
                  <Text>{formatGradePoint(getGradeScore(editingGrade))}</Text>
                </View>
              </View>
              {editingGrade.gradeType === 'level' ? (
                <>
                  <View className='academic-field'>
                    <Text className='academic-field__label'>模拟等级</Text>
                    <View className='grade-level-options'>
                      {(Object.keys(gradeLevelScores) as GradeLevel[]).map((level) => (
                        <View
                          key={level}
                          className={gradeLevel === level ? 'grade-level-options__item--active' : ''}
                          onClick={() => setGradeLevel(level)}
                        >
                          {level}
                        </View>
                      ))}
                    </View>
                  </View>
                  <View className='academic-field'>
                    <Text className='academic-field__label'>折算百分制（参与加权平均）</Text>
                    <Input
                      type='digit'
                      value={gradeScore}
                      placeholder='例如：优秀折算为 95'
                      onInput={(event) => setGradeScore(event.detail.value)}
                    />
                  </View>
                </>
              ) : (
                <View className='academic-field'>
                  <Text className='academic-field__label'>模拟成绩（0–100）</Text>
                  <Input
                    type='digit'
                    value={gradeScore}
                    placeholder='请输入模拟成绩'
                    onInput={(event) => setGradeScore(event.detail.value)}
                  />
                </View>
              )}
              <View className='academic-field'>
                <Text className='academic-field__label'>模拟学分（0.5–20）</Text>
                <Input
                  type='digit'
                  value={gradeCredit}
                  placeholder='请输入模拟学分'
                  onInput={(event) => setGradeCredit(event.detail.value)}
                />
              </View>
              <View className='academic-tip'>模拟数据仅用于个人计算，不会修改教务系统中的原始成绩。</View>
              <View className='academic-button academic-button--full' onClick={saveOverride}>保存并参与计算</View>
            </View>
          )}
        </View>
      </View>
    )
  }

  return (
    <View className={`academic-page academic-page--grades ${sheet ? 'academic-page--locked' : ''}`}>
      <View className='academic-page__glow academic-page__glow--one' />
      <AcademicHeader title='成绩查询' toolbar={toolbar} />
      <View className='academic-content'>
        {loading ? (
          <View className='academic-state'>
            <View className='academic-state__loader' />
            <Text>正在整理成绩…</Text>
          </View>
        ) : (
          <>
            <View className={`grade-summary ${simulationMode ? 'grade-summary--simulation' : 'grade-summary--original'}`}>
              <View className='grade-summary__lead'>
                <Text className='grade-summary__eyebrow'>{simulationMode ? '模拟计算结果' : '原始成绩统计'}</Text>
                <Text className='grade-summary__score'>{summary.weightedScore.toFixed(2)}</Text>
                <Text className='grade-summary__caption'>学分加权平均分</Text>
              </View>
              <View className='grade-summary__stats'>
                <View><Text>{summary.gpa.toFixed(2)}</Text><Text>平均 GPA</Text></View>
                <View><Text>{summary.credits.toFixed(1)}</Text><Text>已选学分</Text></View>
                <View><Text>{summary.selectedCount}</Text><Text>门课程</Text></View>
              </View>
            </View>
            {simulationMode ? (
              <>
                <View className='grade-simulation-tip'>
                  <Text>模拟模式</Text>
                  <Text>可勾选课程参与计算，点击课程修改成绩或学分。</Text>
                </View>
                <View className='grade-list-heading'>
                  <View
                    className={`academic-check ${allSelected ? 'academic-check--active' : ''}`}
                    onClick={toggleAll}
                  >
                    <View className='academic-check__box'>{allSelected ? '✓' : ''}</View>
                    <Text>{allSelected ? '取消全选' : '全选课程'}</Text>
                  </View>
                  <Text>点击课程修改</Text>
                </View>
              </>
            ) : (
              <View className='grade-list-heading grade-list-heading--original'>
                <Text>课程成绩</Text>
                <Text>点击“模拟计算”可自定义试算</Text>
              </View>
            )}
            <View className='grade-list'>
              {gradeGroups.map((group) => (
                <View key={group.id} className='grade-period-group'>
                  {preferences.gradePeriodId === ALL_PERIOD_ID && (
                    <View className='grade-period-group__heading'>
                      <Text>{group.label}</Text>
                      <Text>{group.records.length} 门课程</Text>
                    </View>
                  )}
                  {group.records.map((grade) => {
                    const selected = displayedSimulation.selectedIds.includes(grade.id)
                    const override = simulationMode ? currentSimulation.overrides[grade.id] : undefined
                    const score = getGradeScore(grade, override)
                    const credit = override?.credit ?? grade.credit
                    return (
                      <View
                        key={grade.id}
                        className={`grade-card ${simulationMode ? 'grade-card--simulation' : 'grade-card--original'} ${selected ? 'grade-card--selected' : ''}`}
                        hoverClass={simulationMode ? 'grade-card--pressed' : ''}
                        onClick={() => simulationMode && openEditor(grade)}
                      >
                        {simulationMode && (
                          <View
                            className={`academic-check__box ${selected ? 'academic-check__box--active' : ''}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleGrade(grade.id)
                            }}
                          >
                            {selected ? '✓' : ''}
                          </View>
                        )}
                        <View className='grade-card__main'>
                          <View className='grade-card__title-line'>
                            <Text className='grade-card__name'>{grade.courseName}</Text>
                            {override && <Text className='grade-card__changed'>已模拟</Text>}
                          </View>
                          <Text className='grade-card__meta'>
                            {grade.courseType} · {grade.gradeType === 'level' ? '等级制 · ' : ''}{credit} 学分
                          </Text>
                          {grade.gradeType === 'level' && score !== undefined && (
                            <Text className='grade-card__converted'>折算 {score} 分参与加权平均</Text>
                          )}
                          {grade.gradeType === 'level' && score === undefined && (
                            <Text className='grade-card__converted'>文字成绩仅展示，不参与加权平均</Text>
                          )}
                          {override && <Text className='grade-card__original'>原始：{getGradeDisplay(grade)} · {grade.credit} 学分</Text>}
                        </View>
                        <View className='grade-card__result'>
                          <Text>{getGradeDisplay(grade, override)}</Text>
                          <Text>绩点 {formatGradePoint(score)}</Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              ))}
            </View>
            {!grades.length && (
              <View className='academic-empty'>
                <Text className='academic-empty__title'>
                  {preferences.gradePeriodId === ALL_PERIOD_ID ? '暂无成绩' : '该学期暂无成绩'}
                </Text>
                <Text className='academic-empty__copy'>成绩发布后会第一时间显示在这里</Text>
              </View>
            )}
          </>
        )}
      </View>
      {renderSheet()}
    </View>
  )
}
