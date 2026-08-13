import { useEffect, useMemo, useState } from 'react'
import Taro, { useDidShow, useReachBottom, useRouter } from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import {
  KeyboardSafeInput,
  KeyboardSafeTextarea,
  useKeyboardInset,
} from '../../components/keyboard-safe-input'
import {
  completeMaterialUploadSession,
  createCourseMaterialFeedback,
  createMaterialUploadSession,
  downloadAndOpenMaterial,
  getCourseMaterial,
  listAllMaterialCourses,
  listAllMyCourseMaterials,
  listCourseMaterials,
  listMyCourseMaterialFeedbacks,
  updateMyCourseMaterial,
  uploadMaterialFile,
  withdrawCourseMaterial,
} from '../../api/course-materials'
import { getCurrentIdentity } from '../../api/account'
import { createIdempotencyKey } from '../../api/client'
import { requestWechatSubscriptionAndStopPropagation } from '../../features/wechat-subscription'
import { getSelectedTempFiles } from '../../utils/file-selection'
import type {
  CourseMaterialView,
  MaterialCourseView,
  MaterialFeedbackCategory,
  MaterialFeedbackView,
  MaterialUploadFileInput,
} from '../../api/types'
import {
  buildCourseSuggestions,
  inferCourseSuggestion,
  inferMaterialKind,
  normalizeMaterialTitle,
} from '../../features/course-materials/inference'
import {
  getRecentCourseSuggestions,
  materialDraftStorage,
  persistMaterialFile,
  removePersistedMaterialFiles,
} from '../../features/course-materials/storage'
import {
  materialFeedbackCategories,
  materialFeedbackLabels,
  materialKindLabels,
  materialKinds,
  MaterialKind,
  MaterialRouteContext,
  MaterialUploadBatch,
  MaterialUploadDraft,
  MaterialUploadMetadata,
} from '../../features/course-materials/types'
import {
  isMaterialUploadSessionReusable,
  materialExtension,
  MAX_MATERIAL_FILES,
  mimeTypes,
  resolveMaterialCourse,
  selectSupportedMaterialFiles,
  supportedMaterialExtensions,
  validateMaterialDrafts,
} from '../../features/course-materials/validation'
import './index.scss'

const icons = {
  search: require('../../assets/icons/search.svg'),
  materials: require('../../assets/icons/materials.svg'),
}

type Sheet = 'filter' | 'upload' | 'upload-course' | 'detail' | 'feedback' | null
type ViewMode = 'browse' | 'mine' | 'feedbacks'

interface UploadCourseOption {
  id?: number
  name: string
  courseCode?: string
  department?: string
  periodId?: string
  searchText: string
}

const materialSourceLabels: Record<
NonNullable<MaterialRouteContext['source']>,
string
> = {
  schedule: '从课表进入',
  grades: '从成绩进入',
  selection: '从选课结果进入',
}

const decodeRouteValue = (value?: string) => {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const toPositiveInteger = (value?: string) => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

const formatFileSize = (size: number) => (
  size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`
)

const packageSize = (material: CourseMaterialView) => (
  material.files.reduce((total, file) => total + file.size_bytes, 0)
)

const draftStatusMeta = {
  draft: { label: '待上传', className: 'draft' },
  uploading: { label: '上传中', className: 'uploading' },
  uploaded: { label: '已上传', className: 'uploaded' },
  failed: { label: '上传失败', className: 'failed' },
  needs_file: { label: '需重新选择', className: 'failed' },
} as const

const materialStatusLabels: Record<CourseMaterialView['status'], string> = {
  uploading: '上传中',
  scanning: '安全检查中',
  pending_review: '等待审核',
  published: '已发布',
  rejected: '未通过',
  withdrawn: '已撤回',
  taken_down: '已下架',
  failed: '处理失败',
}

const feedbackStatusLabels: Record<MaterialFeedbackView['status'], string> = {
  pending: '待处理',
  resolved: '已处理',
  rejected: '未采纳',
}

const createUploadBatch = (): MaterialUploadBatch => ({
  createIdempotencyKey: createIdempotencyKey('material-upload-create'),
  completeIdempotencyKey: createIdempotencyKey('material-upload-complete'),
})

const createUploadMetadata = (
  routeContext: MaterialRouteContext,
): MaterialUploadMetadata => ({
  title: '',
  kind: 'other',
  courseName: routeContext.courseName || '',
  periodId: routeContext.periodId,
  description: '',
})

const useDebouncedValue = <T,>(value: T, delay: number) => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [delay, value])
  return debounced
}

export default function MaterialsPage() {
  const router = useRouter()
  const routeContext = useMemo<MaterialRouteContext>(() => ({
    courseName: decodeRouteValue(router.params.courseName),
    courseCode: decodeRouteValue(router.params.courseCode),
    periodId: decodeRouteValue(router.params.periodId),
    periodLabel: decodeRouteValue(router.params.periodLabel),
    source: ['schedule', 'grades', 'selection'].includes(router.params.source || '')
      ? router.params.source as MaterialRouteContext['source']
      : undefined,
    action: router.params.action === 'upload' ? 'upload' : undefined,
    view: router.params.view === 'mine' ? 'mine' : undefined,
    materialId: toPositiveInteger(router.params.material_id),
  }), [router.params])
  const { keyboardHeight, onKeyboardVisibilityChange } = useKeyboardInset()
  const [cachedCourseSuggestions] = useState(getRecentCourseSuggestions)
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebouncedValue(keyword, 300)
  const [course, setCourse] = useState(routeContext.courseName || '全部课程')
  const [kind, setKind] = useState<'all' | MaterialKind>('all')
  const [limitToSourcePeriod, setLimitToSourcePeriod] = useState(
    !!routeContext.periodId,
  )
  const [viewMode, setViewMode] = useState<ViewMode>(
    routeContext.view === 'mine' ? 'mine' : 'browse',
  )
  const [sheet, setSheet] = useState<Sheet>(
    routeContext.action === 'upload' ? 'upload' : null,
  )
  const [drafts, setDrafts] = useState<MaterialUploadDraft[]>([])
  const [metadata, setMetadata] = useState<MaterialUploadMetadata>(
    createUploadMetadata(routeContext),
  )
  const [uploadCourseQuery, setUploadCourseQuery] = useState('')
  const [uploadBatch, setUploadBatch] = useState<MaterialUploadBatch>(createUploadBatch)
  const [draftUserId, setDraftUserId] = useState(0)
  const [draftStorageReady, setDraftStorageReady] = useState(false)
  const [apiCourses, setApiCourses] = useState<MaterialCourseView[]>([])
  const [coursesLoaded, setCoursesLoaded] = useState(false)
  const [materials, setMaterials] = useState<CourseMaterialView[]>([])
  const [myMaterials, setMyMaterials] = useState<CourseMaterialView[]>([])
  const [myFeedbacks, setMyFeedbacks] = useState<MaterialFeedbackView[]>([])
  const [activeMaterial, setActiveMaterial] = useState<CourseMaterialView | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCourse, setEditCourse] = useState('')
  const [editKind, setEditKind] = useState<MaterialKind>('other')
  const [feedbackCategory, setFeedbackCategory] = useState<MaterialFeedbackCategory>('file_unavailable')
  const [feedbackFileId, setFeedbackFileId] = useState<number | undefined>()
  const [feedbackDescription, setFeedbackDescription] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [loading, setLoading] = useState(false)
  const [materialsLoadFailed, setMaterialsLoadFailed] = useState(false)
  const [materialsReloadKey, setMaterialsReloadKey] = useState(0)
  const [materialsPage, setMaterialsPage] = useState(1)
  const [materialsTotal, setMaterialsTotal] = useState(0)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    let active = true
    getCurrentIdentity()
      .then(async (current) => {
        const userId = current.user_id
        const restored = await materialDraftStorage.read(userId)
        if (!active) return
        setDraftUserId(userId)
        if (restored) {
          setDrafts(restored.drafts)
          setMetadata(restored.metadata)
          setUploadBatch(restored.batch)
        }
        setDraftStorageReady(true)
      })
      .catch(() => {
        if (active) setDraftStorageReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!draftStorageReady || !draftUserId) return
    if (!drafts.length) {
      materialDraftStorage.clear(draftUserId)
      return
    }
    materialDraftStorage.write(draftUserId, {
      version: 3,
      drafts,
      metadata,
      batch: uploadBatch,
    })
  }, [draftStorageReady, draftUserId, drafts, metadata, uploadBatch])

  useDidShow(() => {
    void listAllMyCourseMaterials().then(setMyMaterials).catch(() => undefined)
    void listMyCourseMaterialFeedbacks().then((page) => setMyFeedbacks(page.items)).catch(() => undefined)
  })

  useEffect(() => {
    listAllMaterialCourses()
      .then(setApiCourses)
      .catch(() => Taro.showToast({ title: '课程分类加载失败', icon: 'none' }))
      .finally(() => setCoursesLoaded(true))
  }, [])

  const openMaterialDetail = (material: CourseMaterialView) => {
    setActiveMaterial(material)
    setEditTitle(material.title)
    setEditCourse(material.course?.name || material.candidate_course_name || '')
    setEditKind(material.material_type)
    setSheet('detail')
  }

  useEffect(() => {
    if (!routeContext.materialId) return
    getCourseMaterial(routeContext.materialId)
      .then(openMaterialDetail)
      .catch(() => Taro.showToast({ title: '资料已不可用', icon: 'none' }))
  }, [routeContext.materialId])

  const courseSuggestions = useMemo(() => (
    buildCourseSuggestions(apiCourses, cachedCourseSuggestions)
  ), [apiCourses, cachedCourseSuggestions])
  const selectedCourse = useMemo(() => (
    course === '全部课程'
      ? undefined
      : resolveMaterialCourse(apiCourses, {
        name: course,
        courseCode: course === routeContext.courseName ? routeContext.courseCode : undefined,
      })
  ), [apiCourses, course, routeContext.courseCode, routeContext.courseName])
  const unresolvedCourse = coursesLoaded && course !== '全部课程' && !selectedCourse

  useEffect(() => {
    if (viewMode !== 'browse' || !coursesLoaded) return
    if (unresolvedCourse) {
      setMaterials([])
      setMaterialsPage(1)
      setMaterialsTotal(0)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setMaterialsLoadFailed(false)
    listCourseMaterials({
      courseId: selectedCourse?.id,
      materialType: kind === 'all' ? undefined : kind,
      keyword: debouncedKeyword,
      periodId: limitToSourcePeriod ? routeContext.periodId : undefined,
      page: 1,
      pageSize: 20,
    })
      .then((page) => {
        if (!active) return
        setMaterials(page.items)
        setMaterialsPage(page.page)
        setMaterialsTotal(page.total)
      })
      .catch(() => {
        if (!active) return
        setMaterialsLoadFailed(true)
        Taro.showToast({ title: '资料加载失败，请稍后重试', icon: 'none' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [
    coursesLoaded,
    debouncedKeyword,
    kind,
    limitToSourcePeriod,
    materialsReloadKey,
    routeContext.periodId,
    selectedCourse?.id,
    unresolvedCourse,
    viewMode,
  ])

  useReachBottom(() => {
    if (
      viewMode !== 'browse'
      || loading
      || unresolvedCourse
      || materials.length >= materialsTotal
    ) return
    setLoading(true)
    listCourseMaterials({
      courseId: selectedCourse?.id,
      materialType: kind === 'all' ? undefined : kind,
      keyword: debouncedKeyword,
      periodId: limitToSourcePeriod ? routeContext.periodId : undefined,
      page: materialsPage + 1,
      pageSize: 20,
    })
      .then((page) => {
        setMaterials((current) => [
          ...current,
          ...page.items.filter((item) => !current.some((record) => record.id === item.id)),
        ])
        setMaterialsPage(page.page)
        setMaterialsTotal(page.total)
      })
      .catch(() => Taro.showToast({ title: '下一页加载失败', icon: 'none' }))
      .finally(() => setLoading(false))
  })

  const visibleMyMaterials = useMemo(() => myMaterials.filter((item) => {
    const search = keyword.trim().toLowerCase()
    const courseName = item.course?.name || item.candidate_course_name || ''
    const filenames = item.files.map((file) => file.original_filename).join('')
    return (!search || `${item.title}${courseName}${filenames}`.toLowerCase().includes(search))
      && (course === '全部课程' || courseName === course)
      && (kind === 'all' || item.material_type === kind)
  }), [course, keyword, kind, myMaterials])

  const courseOptions = useMemo(() => {
    const names = [
      routeContext.courseName,
      ...apiCourses.map((item) => item.name),
      ...courseSuggestions.map((item) => item.name),
      metadata.courseName,
    ].filter(Boolean) as string[]
    return ['全部课程', ...Array.from(new Set(names))]
  }, [apiCourses, courseSuggestions, metadata.courseName, routeContext.courseName])
  const uploadCourseMatch = useMemo(() => resolveMaterialCourse(apiCourses, {
    id: metadata.courseId,
    name: metadata.courseName,
    courseCode: metadata.courseName === routeContext.courseName
      ? routeContext.courseCode
      : undefined,
  }), [
    apiCourses,
    metadata.courseId,
    metadata.courseName,
    routeContext.courseCode,
    routeContext.courseName,
  ])
  const uploadCourseCandidates = useMemo<UploadCourseOption[]>(() => {
    const seen = new Set<string>()
    return [
      ...(routeContext.courseName ? [{
        name: routeContext.courseName,
        courseCode: routeContext.courseCode,
        periodId: routeContext.periodId,
      }] : []),
      ...courseSuggestions,
    ].flatMap((suggestion) => {
      const record = resolveMaterialCourse(apiCourses, {
        name: suggestion.name,
        courseCode: suggestion.courseCode,
      })
      const name = record?.name || suggestion.name.trim()
      const key = name.toLowerCase()
      if (!name || seen.has(key)) return []
      seen.add(key)
      return [{
        id: record?.id,
        name,
        courseCode: record?.course_code || suggestion.courseCode,
        department: record?.department || undefined,
        periodId: name === routeContext.courseName
          ? routeContext.periodId
          : suggestion.periodId,
        searchText: [
          name,
          record?.course_code,
          record?.department,
          ...(record?.aliases || []),
        ].filter(Boolean).join(' ').toLowerCase(),
      }]
    })
  }, [
    apiCourses,
    courseSuggestions,
    routeContext.courseCode,
    routeContext.courseName,
    routeContext.periodId,
  ])
  const uploadCourseOptions = useMemo(() => {
    const courseKeyword = metadata.courseName.trim().toLowerCase()
    const visible = courseKeyword && !uploadCourseMatch
      ? uploadCourseCandidates.filter((item) => item.searchText.includes(courseKeyword))
      : uploadCourseCandidates
    const selectedId = uploadCourseMatch?.id
    const selectedName = uploadCourseMatch?.name || metadata.courseName.trim()
    const isSelected = (item: UploadCourseOption) => (
      selectedId ? item.id === selectedId : item.name === selectedName
    )
    return [...visible]
      .sort((left, right) => Number(isSelected(right)) - Number(isSelected(left)))
      .slice(0, 6)
  }, [
    metadata.courseName,
    uploadCourseCandidates,
    uploadCourseMatch,
  ])
  const visibleUploadCourseOptions = useMemo(() => {
    const courseKeyword = uploadCourseQuery.trim().toLowerCase()
    const visible = courseKeyword
      ? uploadCourseCandidates.filter((item) => item.searchText.includes(courseKeyword))
      : uploadCourseCandidates
    const selectedId = uploadCourseMatch?.id
    const selectedName = uploadCourseMatch?.name || metadata.courseName.trim()
    const isSelected = (item: UploadCourseOption) => (
      selectedId ? item.id === selectedId : item.name === selectedName
    )
    return [...visible]
      .sort((left, right) => Number(isSelected(right)) - Number(isSelected(left)))
  }, [
    metadata.courseName,
    uploadCourseCandidates,
    uploadCourseMatch,
    uploadCourseQuery,
  ])
  const filtersActive = course !== '全部课程' || kind !== 'all'
  const sourceCourseActive = !!routeContext.courseName
    && course === routeContext.courseName
  const sourceLabel = routeContext.source
    ? materialSourceLabels[routeContext.source]
    : '从课程进入'
  const sourcePeriodLabel = routeContext.periodLabel || '来源学期'
  const canExpandPeriod = !!routeContext.periodId
    && sourceCourseActive
    && limitToSourcePeriod
    && !materialsLoadFailed
    && !unresolvedCourse
  const heroCopy = sourceCourseActive
    ? routeContext.action === 'upload'
      ? '课程和学期已自动带入，选择文件即可分享'
      : limitToSourcePeriod
        ? `正在查看${sourcePeriodLabel}的已审核资料`
        : '正在查看这门课程的全部学期资料'
    : '一份资料可包含多个文件，审核通过后统一展示'
  const selectBrowseCourse = (nextCourse: string) => {
    setCourse(nextCourse)
    setLimitToSourcePeriod(
      !!routeContext.periodId && nextCourse === routeContext.courseName,
    )
  }
  const handleMaterialsEmptyClick = () => {
    if (materialsLoadFailed) {
      setMaterialsReloadKey((current) => current + 1)
      return
    }
    if (canExpandPeriod) {
      setLimitToSourcePeriod(false)
    }
  }

  const invalidateUploadSession = () => {
    setDrafts((current) => current.map((draft) => ({
      ...draft,
      status: draft.filePath ? 'draft' : 'needs_file',
      progress: 0,
      uploadTarget: undefined,
      fileId: undefined,
      errorMessage: draft.filePath ? undefined : draft.errorMessage,
    })))
    setUploadBatch(createUploadBatch())
  }

  const updateMetadata = (patch: Partial<MaterialUploadMetadata>) => {
    if (uploading) return
    setMetadata((current) => ({ ...current, ...patch }))
    invalidateUploadSession()
  }
  const updateUploadCourseName = (courseName: string) => {
    const record = resolveMaterialCourse(apiCourses, {
      name: courseName,
      courseCode: courseName === routeContext.courseName
        ? routeContext.courseCode
        : undefined,
    })
    updateMetadata({
      courseName,
      courseId: record?.id,
      periodId: record?.name === routeContext.courseName
        ? routeContext.periodId
        : undefined,
    })
  }
  const openUploadCoursePicker = () => {
    setUploadCourseQuery(uploadCourseMatch ? '' : metadata.courseName.trim())
    onKeyboardVisibilityChange(0)
    setSheet('upload-course')
  }
  const selectUploadCourseOption = (option: UploadCourseOption) => {
    updateMetadata({
      courseName: option.name,
      courseId: option.id,
      periodId: option.periodId,
    })
    setUploadCourseQuery('')
    onKeyboardVisibilityChange(0)
    setSheet('upload')
  }

  const chooseFiles = async () => {
    if (uploading) return
    if (!draftStorageReady || !draftUserId) {
      Taro.showToast({ title: '账号信息加载中，请稍后重试', icon: 'none' })
      return
    }
    try {
      const result = await Taro.chooseMessageFile({
        count: MAX_MATERIAL_FILES,
        type: 'file',
        extension: [...supportedMaterialExtensions],
      })
      const returnedFiles = getSelectedTempFiles(result)
      if (!returnedFiles.length) return
      const selected = selectSupportedMaterialFiles(returnedFiles)
      if (selected.length < returnedFiles.length) {
        Taro.showToast({ title: '已跳过格式不支持或超过 50MB 的文件', icon: 'none' })
      }
      if (!selected.length) return
      const fallback = routeContext.courseName
        ? {
          name: routeContext.courseName,
          courseCode: routeContext.courseCode,
          periodId: routeContext.periodId,
        }
        : undefined
      const firstSuggestion = inferCourseSuggestion(
        selected[0].name,
        courseSuggestions,
        fallback,
      )
      const courseRecord = resolveMaterialCourse(apiCourses, {
        name: firstSuggestion?.name,
        courseCode: firstSuggestion?.courseCode || routeContext.courseCode,
      })
      const nextDrafts: MaterialUploadDraft[] = []
      let hasTemporaryFile = false
      try {
        for (let index = 0; index < selected.length; index += 1) {
          const file = selected[index]
          const persisted = await persistMaterialFile(file.path)
          if (!persisted.persistent) hasTemporaryFile = true
          nextDrafts.push({
            id: `material-draft-${Date.now()}-${index}`,
            filePath: persisted.filePath,
            persistentFile: persisted.persistent,
            fileName: file.name,
            fileSize: file.size,
            status: 'draft',
            progress: 0,
          })
        }
      } catch (error) {
        await removePersistedMaterialFiles(nextDrafts)
        throw error
      }
      await removePersistedMaterialFiles(drafts)
      setDrafts(nextDrafts)
      setMetadata({
        title: normalizeMaterialTitle(selected[0].name) || selected[0].name,
        kind: inferMaterialKind(selected[0].name),
        courseName: courseRecord?.name || firstSuggestion?.name || '',
        courseId: courseRecord?.id,
        periodId: firstSuggestion?.periodId,
        description: '',
      })
      setUploadBatch(createUploadBatch())
      setSheet('upload')
      if (hasTemporaryFile) {
        Taro.showToast({ title: '存储空间不足，退出后需重新选择部分文件', icon: 'none' })
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'errMsg' in error
          ? String(error.errMsg)
          : ''
      if (/cancel/i.test(message)) return
      Taro.showToast({ title: '文件选择失败，请重试', icon: 'none' })
    }
  }

  const removeDraft = (id: string) => {
    if (uploading) return
    const removed = drafts.find((draft) => draft.id === id)
    if (removed) void removePersistedMaterialFiles([removed])
    setDrafts((current) => current.filter((draft) => draft.id !== id).map((draft) => ({
      ...draft,
      status: draft.filePath ? 'draft' : 'needs_file',
      progress: 0,
      uploadTarget: undefined,
      fileId: undefined,
    })))
    setUploadBatch(createUploadBatch())
  }

  const submitDrafts = async () => {
    const validationError = validateMaterialDrafts(drafts, metadata)
    if (validationError) {
      Taro.showToast({ title: validationError, icon: 'none' })
      return
    }
    if (uploading) return
    setUploading(true)
    const persistState = (
      nextDrafts: MaterialUploadDraft[],
      nextBatch: MaterialUploadBatch,
    ) => {
      setDrafts(nextDrafts)
      setUploadBatch(nextBatch)
      if (draftUserId) {
        materialDraftStorage.write(draftUserId, {
          version: 3,
          drafts: nextDrafts,
          metadata,
          batch: nextBatch,
        })
      }
    }
    let workingDrafts = drafts.map((draft) => ({ ...draft }))
    let workingBatch = { ...uploadBatch }
    try {
      const reusable = isMaterialUploadSessionReusable(workingBatch, workingDrafts)
      if (workingBatch.sessionId && !reusable) {
        workingDrafts = workingDrafts.map((draft) => ({
          ...draft,
          status: draft.filePath ? 'draft' : 'needs_file',
          progress: 0,
          uploadTarget: undefined,
          fileId: undefined,
        }))
        workingBatch = createUploadBatch()
      }
      const files = workingDrafts.map<MaterialUploadFileInput>((draft) => {
        const mimeType = mimeTypes[materialExtension(draft.fileName)]
        if (!mimeType) throw new Error(`${draft.fileName} 的文件类型暂不支持`)
        return {
          filename: draft.fileName,
          mime_type: mimeType,
          size_bytes: draft.fileSize,
        }
      })
      if (!workingBatch.sessionId) {
        const courseRecord = resolveMaterialCourse(apiCourses, {
          id: metadata.courseId,
          name: metadata.courseName,
        })
        const session = await createMaterialUploadSession({
          title: metadata.title.trim(),
          material_type: metadata.kind,
          course_id: courseRecord?.id,
          candidate_course_name: courseRecord ? undefined : metadata.courseName.trim(),
          period_id: metadata.periodId || undefined,
          description: metadata.description.trim() || undefined,
          files,
        }, workingBatch.createIdempotencyKey)
        if (session.uploads.length !== workingDrafts.length) {
          throw new Error('上传任务数量与所选文件不一致')
        }
        workingBatch = {
          ...workingBatch,
          sessionId: session.id,
          sessionVersion: session.version,
          sessionExpiresAt: session.expires_at,
        }
        workingDrafts = workingDrafts.map((draft, index) => ({
          ...draft,
          uploadTarget: session.uploads[index],
          fileId: session.uploads[index].file_id,
        }))
        persistState(workingDrafts, workingBatch)
      }
      for (let index = 0; index < workingDrafts.length; index += 1) {
        const draft = workingDrafts[index]
        if (draft.status === 'uploaded') continue
        if (!draft.uploadTarget) throw new Error('上传凭证缺失，请重新上传')
        workingDrafts[index] = {
          ...draft,
          status: 'uploading',
          progress: 0,
          errorMessage: undefined,
        }
        persistState([...workingDrafts], workingBatch)
        try {
          await uploadMaterialFile(draft.uploadTarget, draft.filePath, (progress) => {
            setDrafts((current) => current.map((item) => (
              item.id === draft.id ? { ...item, status: 'uploading', progress } : item
            )))
          })
          workingDrafts[index] = {
            ...workingDrafts[index],
            status: 'uploaded',
            progress: 100,
          }
          persistState([...workingDrafts], workingBatch)
        } catch (error) {
          workingDrafts[index] = {
            ...workingDrafts[index],
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : '文件上传失败',
          }
          persistState([...workingDrafts], workingBatch)
          throw error
        }
      }
      if (!workingBatch.sessionId || workingBatch.sessionVersion === undefined) {
        throw new Error('上传会话无效，请重新上传')
      }
      const completedFiles = workingDrafts.map((draft) => {
        if (!draft.fileId) throw new Error('上传任务无效，请重新上传')
        return { file_id: draft.fileId }
      })
      console.info('[COS直传] 课程资料开始完成确认')
      const completed = await completeMaterialUploadSession(
        workingBatch.sessionId,
        workingBatch.sessionVersion,
        completedFiles,
        workingBatch.completeIdempotencyKey,
      )
      console.info('[COS直传] 课程资料完成确认成功')
      await removePersistedMaterialFiles(workingDrafts)
      setDrafts([])
      setMetadata(createUploadMetadata(routeContext))
      setUploadBatch(createUploadBatch())
      materialDraftStorage.clear(draftUserId)
      setMyMaterials((current) => [
        completed.material,
        ...current.filter((item) => item.id !== completed.material.id),
      ])
      setViewMode('mine')
      setSheet(null)
      Taro.showToast({ title: '已提交安全检查', icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '上传失败，请重试',
        icon: 'none',
      })
    } finally {
      setUploading(false)
    }
  }

  const openUpload = () => {
    if (drafts.length) {
      setSheet('upload')
      return
    }
    void chooseFiles()
  }

  const saveRejectedMaterial = async () => {
    if (!activeMaterial || !editTitle.trim() || !editCourse.trim()) {
      Taro.showToast({ title: '请补全资料名称和课程', icon: 'none' })
      return
    }
    const courseRecord = resolveMaterialCourse(apiCourses, { name: editCourse.trim() })
    try {
      const updated = await updateMyCourseMaterial(activeMaterial.id, {
        expected_version: activeMaterial.version,
        title: editTitle.trim(),
        material_type: editKind,
        course_id: courseRecord?.id,
        candidate_course_name: courseRecord ? undefined : editCourse.trim(),
        period_id: activeMaterial.period_id || undefined,
        description: activeMaterial.description || undefined,
      })
      setMyMaterials((current) => current.map((item) => (
        item.id === updated.id ? updated : item
      )))
      setActiveMaterial(updated)
      Taro.showToast({ title: '修改已提交', icon: 'success' })
    } catch {
      Taro.showToast({ title: '保存失败，请刷新后重试', icon: 'none' })
    }
  }

  const withdrawMaterial = async (material: CourseMaterialView) => {
    const result = await Taro.showModal({
      title: '撤回资料',
      content: '撤回后将停止展示和审核，确认继续吗？',
      confirmColor: '#b76d5c',
    })
    if (!result.confirm) return
    try {
      await withdrawCourseMaterial(material.id, material.version)
      setMyMaterials((current) => current.map((item) => (
        item.id === material.id ? { ...item, status: 'withdrawn' } : item
      )))
      setActiveMaterial({ ...material, status: 'withdrawn' })
      Taro.showToast({ title: '资料已撤回', icon: 'success' })
    } catch {
      Taro.showToast({ title: '撤回失败，请刷新后重试', icon: 'none' })
    }
  }

  const openFeedback = () => {
    setFeedbackCategory('file_unavailable')
    setFeedbackFileId(activeMaterial?.files.length === 1 ? activeMaterial.files[0].id : undefined)
    setFeedbackDescription('')
    setSheet('feedback')
  }

  const submitFeedback = async () => {
    if (!activeMaterial || submittingFeedback) return
    if (feedbackCategory === 'other' && !feedbackDescription.trim()) {
      Taro.showToast({ title: '请简单说明遇到的问题', icon: 'none' })
      return
    }
    setSubmittingFeedback(true)
    try {
      const created = await createCourseMaterialFeedback(activeMaterial.id, {
        file_id: feedbackFileId,
        category: feedbackCategory,
        description: feedbackDescription.trim() || undefined,
      })
      setMyFeedbacks((current) => [created, ...current])
      setSheet('detail')
      Taro.showToast({ title: '反馈已提交', icon: 'success' })
    } catch {
      Taro.showToast({ title: '反馈提交失败，请稍后重试', icon: 'none' })
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const closeSheet = () => {
    if (!uploading && !submittingFeedback) {
      if (sheet === 'upload-course') {
        setUploadCourseQuery('')
        setSheet('upload')
        onKeyboardVisibilityChange(0)
        return
      }
      setSheet(null)
      onKeyboardVisibilityChange(0)
    }
  }

  return (
    <View className={`materials-page ${sheet ? 'materials-page--locked' : ''}`}>
      <CustomNavbar title='课程资料' subtitle='中国海洋大学' showBack />
      <View className='materials-page__content'>
        <View className='materials-view-tabs'>
          <View className={viewMode === 'browse' ? 'materials-view-tabs__active' : ''} onClick={() => setViewMode('browse')}>资料库</View>
          <View className={viewMode === 'mine' ? 'materials-view-tabs__active' : ''} onClick={() => setViewMode('mine')}>我的资料{drafts.length ? <Text>{drafts.length}</Text> : null}</View>
          <View className={viewMode === 'feedbacks' ? 'materials-view-tabs__active' : ''} onClick={() => setViewMode('feedbacks')}>我的反馈</View>
        </View>
        {viewMode !== 'feedbacks' && <View className='materials-search'>
          <Image src={icons.search} mode='aspectFit' />
          <KeyboardSafeInput
            value={keyword}
            onInput={(event) => setKeyword(event.detail.value)}
            confirmType='search'
            placeholder='搜索课程、资料名称或文件'
            placeholderClass='materials-search__placeholder'
            onKeyboardVisibilityChange={onKeyboardVisibilityChange}
          />
          {!!keyword && <Text onClick={() => setKeyword('')}>×</Text>}
        </View>}
        <View className='materials-hero'>
          <View>
            <Text className='materials-hero__eyebrow'>{sourceCourseActive ? sourceLabel : '海大同学资料库'}</Text>
            <Text className='materials-hero__title'>{course === '全部课程' ? '把好资料，传给下一位同学' : course}</Text>
            <Text className='materials-hero__copy'>{heroCopy}</Text>
          </View>
          <Image src={icons.materials} mode='aspectFit' />
        </View>
        {viewMode === 'browse' && sourceCourseActive && routeContext.periodId && (
          <View className='materials-source-context'>
            <View>
              <Text>{limitToSourcePeriod ? sourcePeriodLabel : '全部学期'}</Text>
              <Text>{limitToSourcePeriod ? '优先保持来源页面的课程范围' : '课程不变，仅放宽学期范围'}</Text>
            </View>
            <Text onClick={() => setLimitToSourcePeriod((current) => !current)}>
              {limitToSourcePeriod ? '查看其他学期' : '只看来源学期'}
            </Text>
          </View>
        )}
        {viewMode !== 'feedbacks' && <View className='materials-actions'>
          <View className={`materials-filter-button ${filtersActive ? 'materials-filter-button--active' : ''}`} onClick={() => setSheet('filter')}><Text>筛选</Text>{filtersActive && <View />}</View>
          <ScrollView scrollX showScrollbar={false} className='materials-course-scroll'>
            <View className='materials-course-list'>{courseOptions.slice(0, 4).map((item) => <View key={item} className={`materials-course-chip ${course === item ? 'materials-course-chip--active' : ''}`} onClick={() => selectBrowseCourse(item)}>{item}</View>)}</View>
          </ScrollView>
          <View className='materials-upload-button' onClick={openUpload}>分享资料</View>
        </View>}

        {viewMode === 'browse' && <>
          <View className='materials-heading'><View><Text>课程资料</Text><Text>{limitToSourcePeriod && routeContext.periodId ? `${sourcePeriodLabel} · 仅展示已审核内容` : '全部学期 · 仅展示已审核内容'}</Text></View><Text>{materialsTotal} 份</Text></View>
          {loading && !materials.length ? <View className='materials-empty'><View /><Text>正在加载资料</Text><Text>请稍候</Text></View> : <View className='materials-list'>
            {materials.map((item) => <View key={item.id} className='material-card' hoverClass='material-card--pressed' onClick={() => openMaterialDetail(item)}>
              <View className={`material-card__file material-card__file--${item.material_type}`}><Text>{materialKindLabels[item.material_type]}</Text></View>
              <View className='material-card__main'>
                <Text className='material-card__title'>{item.title}</Text>
                <Text className='material-card__course'>{item.course?.name || item.candidate_course_name || '课程待确认'} · {item.files.length} 个文件</Text>
                <Text className='material-card__status'>{item.download_count} 次下载 · {formatFileSize(packageSize(item))}</Text>
              </View>
              <Text className='material-card__arrow'>›</Text>
            </View>)}
          </View>}
          {loading && !!materials.length && <Text className='materials-loading-more'>正在加载更多…</Text>}
          {!loading && !materials.length && <View
            className={`materials-empty ${materialsLoadFailed || canExpandPeriod ? 'materials-empty--action' : ''}`}
            onClick={handleMaterialsEmptyClick}
          >
            <View />
            <Text>{materialsLoadFailed ? '资料暂时没有加载出来' : unresolvedCourse ? '该课程尚未归入课程目录' : canExpandPeriod ? '这个学期还没有资料' : '没有找到相关资料'}</Text>
            <Text>
              {materialsLoadFailed ? '点击这里重新加载' : unresolvedCourse ? '仍可直接分享，审核时会完成课程归类' : canExpandPeriod ? '看看这门课的其他学期资料 ›' : '试试更换课程、类型或关键词'}
            </Text>
          </View>}
        </>}

        {viewMode === 'mine' && <>
          <View className='materials-heading'><View><Text>我的上传</Text><Text>查看草稿、安全检查和审核进度</Text></View><Text>{(drafts.length ? 1 : 0) + visibleMyMaterials.length} 份</Text></View>
          <View className='materials-list'>
            {!!drafts.length && <View className='material-card' onClick={() => setSheet('upload')}>
              <View className={`material-card__file material-card__file--${metadata.kind}`}><Text>{materialKindLabels[metadata.kind]}</Text></View>
              <View className='material-card__main'>
                <Text className='material-card__title'>{metadata.title || '未完成的资料'}</Text>
                <Text className='material-card__course'>{metadata.courseName || '课程待确认'} · {drafts.length} 个文件</Text>
                <Text className={`material-card__status material-card__status--${draftStatusMeta[drafts[0].status].className}`}>{draftStatusMeta[drafts[0].status].label}</Text>
              </View>
              <Text className='material-card__arrow'>›</Text>
            </View>}
            {visibleMyMaterials.map((item) => <View key={item.id} className='material-card' hoverClass='material-card--pressed' onClick={() => openMaterialDetail(item)}>
              <View className={`material-card__file material-card__file--${item.material_type}`}><Text>{materialKindLabels[item.material_type]}</Text></View>
              <View className='material-card__main'>
                <Text className='material-card__title'>{item.title}</Text>
                <Text className='material-card__course'>{item.course?.name || item.candidate_course_name || '课程待确认'} · {item.files.length} 个文件</Text>
                <Text className={`material-card__status material-card__status--${item.status}`}>{materialStatusLabels[item.status]}{item.rejection_reason ? ` · ${item.rejection_reason}` : ''}</Text>
              </View>
              <Text className='material-card__arrow'>›</Text>
            </View>)}
          </View>
          {!drafts.length && !visibleMyMaterials.length && <View className='materials-empty'><View /><Text>还没有上传记录</Text><Text>从微信聊天选择一份资料开始分享</Text></View>}
        </>}

        {viewMode === 'feedbacks' && <>
          <View className='materials-heading'><View><Text>我的反馈</Text><Text>处理结果会同步更新在这里</Text></View><Text>{myFeedbacks.length} 条</Text></View>
          <View className='materials-list'>
            {myFeedbacks.map((feedback) => <View key={feedback.id} className='material-card' onClick={() => feedback.material && openMaterialDetail(feedback.material)}>
              <View className='material-card__file material-card__file--other'><Text>反馈</Text></View>
              <View className='material-card__main'>
                <Text className='material-card__title'>{feedback.material?.title || `资料 #${feedback.material_id}`}</Text>
                <Text className='material-card__course'>{materialFeedbackLabels[feedback.category]} · {feedbackStatusLabels[feedback.status]}</Text>
                <Text className='material-card__status'>{feedback.resolution_note || feedback.description || '等待管理员处理'}</Text>
              </View>
              {feedback.material && <Text className='material-card__arrow'>›</Text>}
            </View>)}
          </View>
          {!myFeedbacks.length && <View className='materials-empty'><View /><Text>还没有反馈记录</Text><Text>发现资料有问题时，可以在详情中告诉我们</Text></View>}
        </>}
      </View>

      {sheet && <View className='materials-overlay' onClick={closeSheet}>
        <View
          className={`materials-sheet materials-sheet--${sheet}`}
          style={keyboardHeight ? {
            bottom: `${keyboardHeight}px`,
            maxHeight: `calc(100vh - ${keyboardHeight}px - 20px)`,
          } : undefined}
          onClick={requestWechatSubscriptionAndStopPropagation}
        >
          <View className='materials-sheet__handle' />
          {sheet !== 'upload-course' && (
            <View className='materials-sheet__close' onClick={closeSheet}>×</View>
          )}

          {sheet === 'filter' && <View className='materials-sheet__body'>
            <Text className='materials-sheet__title'>筛选资料</Text>
            <Text className='materials-sheet__label'>课程</Text>
            <View className='materials-option-grid'>{courseOptions.map((item) => <View key={item} className={course === item ? 'materials-option--active' : ''} onClick={() => selectBrowseCourse(item)}>{item}</View>)}</View>
            <Text className='materials-sheet__label'>资料类型</Text>
            <View className='materials-option-grid'>
              <View className={kind === 'all' ? 'materials-option--active' : ''} onClick={() => setKind('all')}>全部类型</View>
              {materialKinds.map((item) => <View key={item} className={kind === item ? 'materials-option--active' : ''} onClick={() => setKind(item)}>{materialKindLabels[item]}</View>)}
            </View>
            <View className='materials-primary' onClick={() => setSheet(null)}>查看资料</View>
            <View className='materials-secondary' onClick={() => { selectBrowseCourse('全部课程'); setKind('all') }}>清除筛选</View>
          </View>}

          {sheet === 'upload' && <View className='materials-sheet__body'>
            <Text className='materials-sheet__title'>分享课程资料</Text>
            <Text className='materials-sheet__subtitle'>一份资料最多包含 5 个 PDF、Word 或 PPT 文件</Text>
            {!drafts.length ? (
              <View className='materials-file-empty' onClick={chooseFiles}><Text>从微信聊天选择文件</Text><Text>资料名称、类型和课程会自动补全</Text></View>
            ) : <>
              <Text className='materials-sheet__label'>资料名称</Text>
              <KeyboardSafeInput
                disabled={uploading}
                value={metadata.title}
                onInput={(event) => updateMetadata({ title: event.detail.value })}
                className='materials-input'
                placeholder='例如：高数期末复习资料'
                onKeyboardVisibilityChange={onKeyboardVisibilityChange}
              />
              <View className='materials-sheet__field-heading'>
                <Text>课程</Text>
                <Text className={coursesLoaded && !uploadCourseMatch && metadata.courseName.trim()
                  ? 'materials-sheet__field-status materials-sheet__field-status--pending'
                  : 'materials-sheet__field-status'}
                >
                  {!metadata.courseName.trim()
                    ? '请选择'
                    : !coursesLoaded
                      ? '正在匹配'
                      : uploadCourseMatch
                        ? '已匹配课程库'
                        : '将由管理员归类'}
                </Text>
              </View>
              <View className='materials-course-picker'>
                <View className='materials-course-picker__input-row'>
                  <KeyboardSafeInput
                    disabled={uploading}
                    value={metadata.courseName}
                    onInput={(event) => updateUploadCourseName(event.detail.value)}
                    className='materials-input materials-course-picker__input'
                    placeholder='输入课程名称或课程号'
                    onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                  />
                  {!!metadata.courseName && !uploading && (
                    <View
                      className='materials-course-picker__clear'
                      onClick={() => updateUploadCourseName('')}
                    >
                      ×
                    </View>
                  )}
                </View>
                {!!uploadCourseOptions.length && (
                  <Text className='materials-course-picker__caption'>
                    {metadata.courseName.trim() && !uploadCourseMatch ? '匹配课程' : '常用课程'}
                  </Text>
                )}
                {!!uploadCourseOptions.length ? (
                  <View className='materials-course-picker__grid'>
                    {uploadCourseOptions.map((item) => {
                      const selected = item.id
                        ? item.id === uploadCourseMatch?.id
                        : item.name === metadata.courseName
                      return (
                        <View
                          key={`${item.id || 'candidate'}-${item.name}`}
                          className={`materials-course-picker__option ${selected ? 'materials-course-picker__option--active' : ''}`}
                          hoverClass='materials-course-picker__option--pressed'
                          onClick={() => updateMetadata({
                            courseName: item.name,
                            courseId: item.id,
                            periodId: item.periodId,
                          })}
                        >
                          <View>
                            <Text>{item.name}</Text>
                            <Text>{item.courseCode || '课程目录'}</Text>
                          </View>
                          {selected && <Text>已选</Text>}
                        </View>
                      )
                    })}
                  </View>
                ) : (
                  <Text className='materials-course-picker__empty'>
                    没有匹配课程，可直接使用输入的名称
                  </Text>
                )}
                <View
                  className='materials-course-picker__more'
                  onClick={openUploadCoursePicker}
                >
                  <Text>查看全部课程</Text>
                  <Text>{uploadCourseCandidates.length ? `${uploadCourseCandidates.length} 门 ›` : '›'}</Text>
                </View>
              </View>
              <Text className='materials-sheet__label'>资料类型</Text>
              <ScrollView scrollX showScrollbar={false}>
                <View className='materials-inline-options'>{materialKinds.map((item) => <View key={item} className={metadata.kind === item ? 'materials-option--active' : ''} onClick={() => updateMetadata({ kind: item })}>{materialKindLabels[item]}</View>)}</View>
              </ScrollView>
              <Text className='materials-sheet__label'>补充说明（选填）</Text>
              <KeyboardSafeTextarea
                disabled={uploading}
                value={metadata.description}
                onInput={(event) => updateMetadata({ description: event.detail.value })}
                className='materials-textarea'
                maxlength={500}
                placeholder='可补充资料范围、适用章节等'
                onKeyboardVisibilityChange={onKeyboardVisibilityChange}
              />
              <View className='materials-draft-list'>
                {drafts.map((draft, index) => <View key={draft.id} className='materials-draft'>
                  <View className='materials-draft__heading'><Text>{index + 1}. {draft.fileName}</Text>{!uploading && <Text onClick={() => removeDraft(draft.id)}>移除</Text>}</View>
                  <Text className='materials-draft__meta'>{formatFileSize(draft.fileSize)} · {draftStatusMeta[draft.status].label}</Text>
                  {draft.status === 'uploading' && <View className='materials-progress'><View style={{ width: `${draft.progress}%` }} /></View>}
                  {draft.errorMessage && <Text className='materials-draft__error'>{draft.errorMessage}</Text>}
                </View>)}
              </View>
              {!uploading && <View className='materials-file-add' onClick={chooseFiles}>重新选择文件</View>}
              <View className={`materials-primary ${uploading ? 'materials-primary--disabled' : ''}`} onClick={submitDrafts}>{uploading ? '正在上传…' : drafts.some((draft) => draft.status === 'failed') ? '重试上传' : '上传并提交审核'}</View>
              <Text className='materials-upload-notice'>上传即表示确认资料不包含隐私、侵权或违规内容</Text>
            </>}
          </View>}

          {sheet === 'upload-course' && (
            <View className='materials-sheet__body materials-course-browser'>
              <View className='materials-course-browser__back' onClick={closeSheet}>
                <Text>‹</Text>
                <Text>返回分享资料</Text>
              </View>
              <Text className='materials-sheet__title'>选择课程</Text>
              <Text className='materials-sheet__subtitle'>支持课程名称、课程号和课程别名搜索</Text>
              <View className='materials-course-browser__search'>
                <Image src={icons.search} mode='aspectFit' />
                <KeyboardSafeInput
                  value={uploadCourseQuery}
                  onInput={(event) => setUploadCourseQuery(event.detail.value)}
                  confirmType='search'
                  placeholder='搜索全部课程'
                  onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                />
                {!!uploadCourseQuery && (
                  <View onClick={() => setUploadCourseQuery('')}>×</View>
                )}
              </View>
              <View className='materials-course-browser__summary'>
                <Text>{uploadCourseQuery.trim() ? '搜索结果' : '全部课程'}</Text>
                <Text>{visibleUploadCourseOptions.length} 门</Text>
              </View>
              <ScrollView
                scrollY
                showScrollbar={false}
                className='materials-course-browser__list'
              >
                {visibleUploadCourseOptions.map((item) => {
                  const selected = item.id
                    ? item.id === uploadCourseMatch?.id
                    : item.name === metadata.courseName
                  return (
                    <View
                      key={`${item.id || 'candidate'}-${item.name}`}
                      className={`materials-course-browser__option ${selected ? 'materials-course-browser__option--active' : ''}`}
                      hoverClass='materials-course-browser__option--pressed'
                      onClick={() => selectUploadCourseOption(item)}
                    >
                      <View>
                        <Text>{item.name}</Text>
                        <Text>{[item.courseCode, item.department].filter(Boolean).join(' · ') || '课程目录'}</Text>
                      </View>
                      <Text>{selected ? '当前选择' : '选择'}</Text>
                    </View>
                  )
                })}
                {!visibleUploadCourseOptions.length && (
                  <View className='materials-course-browser__empty'>
                    <Text>没有找到匹配课程</Text>
                    <Text>返回后仍可直接输入课程名称</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {sheet === 'detail' && activeMaterial && <View className='materials-sheet__body'>
            <View className={`materials-detail-file material-card__file--${activeMaterial.material_type}`}>{materialKindLabels[activeMaterial.material_type]}</View>
            <Text className='materials-sheet__title'>{activeMaterial.title}</Text>
            <Text className='materials-sheet__subtitle'>{activeMaterial.course?.name || activeMaterial.candidate_course_name || '课程待确认'} · {materialStatusLabels[activeMaterial.status]}</Text>
            {!!activeMaterial.description && <Text className='materials-detail-description'>{activeMaterial.description}</Text>}
            <View className='materials-detail-list'>
              {activeMaterial.files.map((file, index) => <View key={file.id} className='materials-detail-file-row'>
                <View><Text>{index + 1}. {file.original_filename}</Text><Text>{formatFileSize(file.size_bytes)} · {file.download_count} 次下载</Text></View>
                {activeMaterial.status === 'published' && <Text onClick={() => downloadAndOpenMaterial(activeMaterial.id, file.id).catch(() => Taro.showToast({ title: '资料下载失败', icon: 'none' }))}>打开</Text>}
              </View>)}
            </View>
            {activeMaterial.rejection_reason && <View className='materials-note'><Text>未通过原因</Text><Text>{activeMaterial.rejection_reason}</Text></View>}
            {viewMode === 'mine' && activeMaterial.status === 'rejected' && <View className='materials-rejected-edit'>
              <Text className='materials-sheet__label'>修改资料名称</Text>
              <KeyboardSafeInput value={editTitle} onInput={(event) => setEditTitle(event.detail.value)} className='materials-input' onKeyboardVisibilityChange={onKeyboardVisibilityChange} />
              <Text className='materials-sheet__label'>修改课程</Text>
              <KeyboardSafeInput value={editCourse} onInput={(event) => setEditCourse(event.detail.value)} className='materials-input' placeholder='找不到课程也可直接输入' onKeyboardVisibilityChange={onKeyboardVisibilityChange} />
              <Text className='materials-sheet__label'>修改类型</Text>
              <ScrollView scrollX showScrollbar={false}>
                <View className='materials-inline-options'>{materialKinds.map((item) => <View key={item} className={editKind === item ? 'materials-option--active' : ''} onClick={() => setEditKind(item)}>{materialKindLabels[item]}</View>)}</View>
              </ScrollView>
              <View className='materials-primary' onClick={saveRejectedMaterial}>保存并重新提交</View>
            </View>}
            {activeMaterial.status === 'published' && <View className='materials-secondary' onClick={openFeedback}>资料有问题</View>}
            {viewMode === 'mine' && ['scanning', 'pending_review', 'published', 'rejected'].includes(activeMaterial.status) && <View className='materials-secondary materials-secondary--danger' onClick={() => withdrawMaterial(activeMaterial)}>撤回资料</View>}
            {activeMaterial.status !== 'published' && <Text className='materials-upload-notice'>资料发布前不会向其他同学展示下载入口</Text>}
          </View>}

          {sheet === 'feedback' && activeMaterial && <View className='materials-sheet__body'>
            <Text className='materials-sheet__title'>资料有问题</Text>
            <Text className='materials-sheet__subtitle'>{activeMaterial.title}</Text>
            <Text className='materials-sheet__label'>问题类型</Text>
            <View className='materials-option-grid'>
              {materialFeedbackCategories.map((item) => <View key={item} className={feedbackCategory === item ? 'materials-option--active' : ''} onClick={() => setFeedbackCategory(item)}>{materialFeedbackLabels[item]}</View>)}
            </View>
            {activeMaterial.files.length > 1 && <>
              <Text className='materials-sheet__label'>涉及文件（选填）</Text>
              <View className='materials-feedback-files'>
                <View className={!feedbackFileId ? 'materials-option--active' : ''} onClick={() => setFeedbackFileId(undefined)}>整份资料</View>
                {activeMaterial.files.map((file) => <View key={file.id} className={feedbackFileId === file.id ? 'materials-option--active' : ''} onClick={() => setFeedbackFileId(file.id)}>{file.original_filename}</View>)}
              </View>
            </>}
            <Text className='materials-sheet__label'>补充说明{feedbackCategory === 'other' ? '' : '（选填）'}</Text>
            <KeyboardSafeTextarea
              value={feedbackDescription}
              onInput={(event) => setFeedbackDescription(event.detail.value)}
              className='materials-textarea'
              maxlength={500}
              placeholder='请描述具体问题，便于快速核实'
              onKeyboardVisibilityChange={onKeyboardVisibilityChange}
            />
            <View className={`materials-primary ${submittingFeedback ? 'materials-primary--disabled' : ''}`} onClick={submitFeedback}>{submittingFeedback ? '正在提交…' : '提交反馈'}</View>
            <View className='materials-secondary' onClick={() => setSheet('detail')}>返回资料详情</View>
          </View>}
        </View>
      </View>}
    </View>
  )
}
