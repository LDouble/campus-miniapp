import { useEffect, useMemo, useRef, useState } from 'react'
import Taro, { useDidHide, useDidShow, useReachBottom, useRouter } from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import {
  KeyboardSafeInput,
  KeyboardSafeTextarea,
  useKeyboardInset,
} from '../../components/keyboard-safe-input'
import {
  claimMaterialAdReward,
  completeMaterialUploadSession,
  createCourseMaterialFeedback,
  createMaterialAdRewardSession,
  createMaterialCloudShare,
  createMaterialUploadSession,
  getCourseMaterialCloudShare,
  getCurrentMaterialQuota,
  getMaterialDownload,
  getCourseMaterial,
  listMaterialCourses,
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
import { consumeCourseMaterialNavigationIntent } from '../../features/course-materials/navigation'
import MemberAdPopup from '../../features/member-ad-popup/popup'
import { preloadMemberAd } from '../../features/member-ad-popup/preload'
import { createAdRewardController, type AdRewardPhase } from '../../features/course-materials/ad-reward-controller'
import { getPageCacheScope, subscribePageCacheScope } from '../../state/page-cache'
import MaterialsPlazaView, {
  MaterialsPlazaHeader,
  type MaterialsPlazaCourse,
  type MaterialsPlazaFilter,
  type MaterialsPlazaItem,
  type MaterialsPlazaShortcut,
  type MaterialsPlazaUploadSource,
} from '../../features/materials-plaza/view'
import { createWeappZipArchive, removeZipArchive, zipArchiveExists } from '../../features/course-materials/zip-archive-weapp'
import { getSelectedTempFiles } from '../../utils/file-selection'
import { acquireCustomTabBarHidden, syncCustomTabBar } from '../../utils/tabbar'
import { showActionSheetSelection } from '../../utils/action-sheet'
import { enabledCampuses, getMiniappRuntimeConfig, getSelectedCampus, saveSelectedCampus } from '../../features/runtime-config'
import { useCampusShare } from '../../features/share'
import type {
  CourseMaterialView,
  MaterialCoursePage,
  MaterialCourseView,
  MaterialFeedbackCategory,
  MaterialFeedbackView,
  MaterialQuotaView,
  MaterialCloudShareView,
  MaterialUploadFileInput,
} from '../../api/types'
import {
  buildCourseSuggestions,
  inferCourseSuggestion,
  inferMaterialKind,
  normalizeMaterialTitle,
} from '../../features/course-materials/inference'
import {
  coursePickerSelectedIds,
  materialEducationLevelLabels,
  resolveCompleteMaterialCoursePage,
} from '../../features/course-materials/course-directory'
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

type CoursePickerTarget = 'upload' | 'filter' | 'edit'
type Sheet = 'filter' | 'upload' | 'upload-course' | 'detail' | 'feedback' | null
type ViewMode = 'browse' | 'mine' | 'feedbacks'

interface UploadCourseOption {
  id: number
  name: string
  courseCode: string
  educationLevel: string
  department?: string
  searchText: string
}

interface BrowseCourseOption extends UploadCourseOption {
  label: string
}

const materialSourceLabels: Record<
NonNullable<MaterialRouteContext['source']>,
string
> = {
  schedule: '从课表进入',
  grades: '从成绩进入',
  selection: '从选课结果进入',
  exams: '从考试安排进入',
  discussion: '从课堂讨论进入',
}
const plazaSourceFilters: MaterialsPlazaFilter[] = [
  { id: 'all', label: '全部来源' },
  { id: 'file', label: '文件资料' },
  { id: 'cloud_share', label: '网盘分享' },
]
const plazaTypeFilters: MaterialsPlazaFilter[] = [
  { id: 'all', label: '全部类型' },
  ...materialKinds.map((kind) => ({ id: kind, label: materialKindLabels[kind] })),
]
const plazaShortcuts: MaterialsPlazaShortcut[] = [
  { id: 'graduate', label: '考研升学', keyword: '考研', icon: require('../../assets/icons/material-category-graduate.svg') },
  { id: 'exam', label: '期末真题', keyword: '期末', materialType: 'exam', icon: require('../../assets/icons/material-category-exam.svg') },
  { id: 'course', label: '课程课件', keyword: '课件', materialType: 'slides', icon: require('../../assets/icons/material-category-course.svg') },
  { id: 'lab', label: '实验报告', keyword: '实验报告', icon: require('../../assets/icons/material-category-lab.svg') },
  { id: 'competition', label: '学术竞赛', keyword: '竞赛', icon: require('../../assets/icons/material-category-competition.svg') },
]

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

const parseCloudShareText = (value: string) => {
  const urlMatch = value.match(/https?:\/\/[^\s<>"']+/i)
  if (!urlMatch) return null
  const url = urlMatch[0].replace(/[，。；、)）\]}]+$/g, '')
  const codeFromText = value.match(/(?:提取码|访问码|密码|pwd|passcode)[\s:：=]*([a-z0-9]{2,24})/i)?.[1]
  const codeFromUrl = url.match(/[?&](?:pwd|passcode|code)=([^&#\s]+)/i)?.[1]
  return { url, code: codeFromText || codeFromUrl }
}

const materialCourses = (material: CourseMaterialView) => (
  material.courses?.length ? material.courses : material.course ? [material.course] : []
)

const materialCourseLabel = (material: CourseMaterialView, limit = 2) => {
  const courses = materialCourses(material)
  if (!courses.length) return material.candidate_course_name || '未关联课程'
  const names = courses.slice(0, limit).map((course) => course.name)
  return `${names.join('、')}${courses.length > limit ? ` +${courses.length - limit}` : ''}`
}

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
  courseIds: [],
  candidateCourseName: '',
  description: '',
})

const courseOptionFromRecord = (course: MaterialCourseView): BrowseCourseOption => ({
  id: course.id,
  name: course.name,
  courseCode: course.course_code,
  educationLevel: materialEducationLevelLabels[course.education_level],
  department: course.department || undefined,
  label: `${course.name} · ${course.course_code} · ${course.education_level}`,
  searchText: [
    course.name,
    course.course_code,
    ...(course.source_course_codes || []),
    course.education_level,
    course.department,
    ...(course.aliases || []),
  ].filter(Boolean).join(' ').toLowerCase(),
})

const mergeMaterialCourses = (
  current: MaterialCourseView[],
  next: MaterialCourseView[],
) => {
  const records = new Map(current.map((course) => [course.id, course]))
  next.forEach((course) => records.set(course.id, course))
  return [...records.values()]
}

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
  const routerRouteContext = useMemo<MaterialRouteContext>(() => ({
    courseName: decodeRouteValue(router.params.courseName),
    courseId: toPositiveInteger(router.params.courseId),
    courseCode: decodeRouteValue(router.params.courseCode),
    periodId: decodeRouteValue(router.params.periodId),
    periodLabel: decodeRouteValue(router.params.periodLabel),
    source: ['schedule', 'grades', 'selection', 'exams', 'discussion'].includes(router.params.source || '')
      ? router.params.source as MaterialRouteContext['source']
      : undefined,
    action: router.params.action === 'upload' ? 'upload' : undefined,
    view: router.params.view === 'mine' ? 'mine' : undefined,
    materialId: toPositiveInteger(router.params.material_id),
    sourceType: router.params.sourceType === 'file' || router.params.sourceType === 'cloud_share'
      ? router.params.sourceType
      : undefined,
    materialType: materialKinds.includes(router.params.materialType as MaterialKind)
      ? router.params.materialType as MaterialKind
      : undefined,
    keyword: decodeRouteValue(router.params.keyword),
  }), [router.params])
  const [navigationContext, setNavigationContext] = useState<MaterialRouteContext | null>(null)
  const routeContext = useMemo(() => navigationContext || routerRouteContext, [navigationContext, routerRouteContext])
  const { keyboardHeight, onKeyboardVisibilityChange } = useKeyboardInset()
  const [cachedCourseSuggestions] = useState(getRecentCourseSuggestions)
  const [keyword, setKeyword] = useState(routeContext.keyword || '')
  const debouncedKeyword = useDebouncedValue(keyword, 300)
  const [courseId, setCourseId] = useState<number | undefined>(routeContext.courseId)
  const [courseLabel, setCourseLabel] = useState(routeContext.courseName || '全部课程')
  const [kind, setKind] = useState<'all' | MaterialKind>(routeContext.materialType || 'all')
  const [sourceType, setSourceType] = useState<'all' | 'file' | 'cloud_share'>(routeContext.sourceType || 'all')
  const [viewMode, setViewMode] = useState<ViewMode>(
    routeContext.view === 'mine' ? 'mine' : 'browse',
  )
  useCampusShare(() => ({
    title: routeContext.courseName
      ? `${routeContext.courseName}｜海大课程资料`
      : '海大课程资料库',
    path: '/pages/materials/index',
    query: viewMode === 'browse'
      ? {
          courseName: routeContext.courseName,
          courseCode: routeContext.courseCode,
          periodId: routeContext.periodId,
          periodLabel: routeContext.periodLabel,
        }
      : undefined,
  }))
  const [sheet, setSheet] = useState<Sheet>(
    routeContext.action === 'upload' ? 'upload' : null,
  )
  const [uploadSource, setUploadSource] = useState<MaterialsPlazaUploadSource>('file')
  const [cloudShareText, setCloudShareText] = useState('')
  const [parsedCloudShare, setParsedCloudShare] = useState<{ url: string; code?: string } | null>(null)
  const [quota, setQuota] = useState<MaterialQuotaView | null>(null)
  const [quotaLoading, setQuotaLoading] = useState(true)
  const [campusName, setCampusName] = useState(() => getSelectedCampus(getMiniappRuntimeConfig()))
  const quotaRequestVersion = useRef(0)
  const [drafts, setDrafts] = useState<MaterialUploadDraft[]>([])
  const [metadata, setMetadata] = useState<MaterialUploadMetadata>(
    createUploadMetadata(routeContext),
  )
  const [uploadCourseQuery, setUploadCourseQuery] = useState('')
  const [coursePickerTarget, setCoursePickerTarget] = useState<CoursePickerTarget>('upload')
  const [coursePickerItems, setCoursePickerItems] = useState<MaterialCourseView[]>([])
  const [coursePickerPage, setCoursePickerPage] = useState(1)
  const [coursePickerTotal, setCoursePickerTotal] = useState(0)
  const [coursePickerLoading, setCoursePickerLoading] = useState(false)
  const coursePickerRequestGeneration = useRef(0)
  const [uploadBatch, setUploadBatch] = useState<MaterialUploadBatch>(createUploadBatch)
  const [draftUserId, setDraftUserId] = useState(0)
  const [draftStorageReady, setDraftStorageReady] = useState(false)
  const [apiCourses, setApiCourses] = useState<MaterialCourseView[]>([])
  const [coursesLoaded, setCoursesLoaded] = useState(false)
  const [routeCourseLookupReady, setRouteCourseLookupReady] = useState(!routeContext.courseName)
  const [routeMatchedCourse, setRouteMatchedCourse] = useState<MaterialCourseView | null>(null)
  const routeCoursePreselected = useRef(false)
  const uploadMetadataTouched = useRef(false)
  const [materials, setMaterials] = useState<CourseMaterialView[]>([])
  const [myMaterials, setMyMaterials] = useState<CourseMaterialView[]>([])
  const [myFeedbacks, setMyFeedbacks] = useState<MaterialFeedbackView[]>([])
  const [activeMaterial, setActiveMaterial] = useState<CourseMaterialView | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCourse, setEditCourse] = useState('')
  const [editCourseIds, setEditCourseIds] = useState<number[]>([])
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
  const choosingFilesRef = useRef(false)
  const [uploadPhase, setUploadPhase] = useState<'packing' | 'uploading' | 'publishing' | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const downloadAddressCache = useRef(new Map<string, { url: string; expiresAt: number }>())
  const cloudAddressCache = useRef(new Map<number, MaterialCloudShareView>())
  const addressRequestsRef = useRef(new Set<string>())
  const [adRewardPhase, setAdRewardPhase] = useState<AdRewardPhase>('idle')
  const [adRewardController] = useState(() => createAdRewardController<MaterialQuotaView>({
    create: () => createMaterialAdRewardSession(createIdempotencyKey('material-ad-reward-session')),
    claim: (session, key) => claimMaterialAdReward(session.id, session.session_token, key),
    createKey: () => createIdempotencyKey('material-ad-reward-claim'),
    scope: getPageCacheScope,
    change: setAdRewardPhase,
    success: (nextQuota) => {
      quotaRequestVersion.current += 1
      setQuota(nextQuota)
      setQuotaLoading(false)
      Taro.showToast({ title: '下载额度已增加', icon: 'success' })
    },
    error: (message) => { Taro.showToast({ title: message, icon: 'none' }) },
  }))
  useDidHide(() => {
    // 广告落地页会隐藏小程序，不能在这里清掉会话；内部离页仍取消领取。
    Taro.nextTick(() => {
      const pages = Taro.getCurrentPages()
      if (pages[pages.length - 1]?.route !== 'pages/materials/index') adRewardController.close()
    })
  })
  useEffect(() => {
    const onHide = () => adRewardController.background()
    const onShow = () => {
      const pages = Taro.getCurrentPages()
      if (pages[pages.length - 1]?.route !== 'pages/materials/index') {
        adRewardController.close()
        return
      }
      void adRewardController.foreground()
    }
    Taro.onAppHide(onHide)
    Taro.onAppShow(onShow)
    return () => { Taro.offAppHide(onHide); Taro.offAppShow(onShow) }
  }, [adRewardController])
  useEffect(() => {
    const unsubscribe = subscribePageCacheScope(() => adRewardController.close())
    return () => { unsubscribe(); adRewardController.dispose() }
  }, [adRewardController])
  useEffect(() => {
    if (adRewardPhase === 'visible' || adRewardPhase === 'claiming') return acquireCustomTabBarHidden()
  }, [adRewardPhase])

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
      version: 4,
      drafts,
      metadata,
      batch: uploadBatch,
    })
  }, [draftStorageReady, draftUserId, drafts, metadata, uploadBatch])

  useEffect(() => {
    if (!sheet) return undefined
    return acquireCustomTabBarHidden()
  }, [sheet])

  const refreshQuota = async (notifyFailure = false) => {
    const requestVersion = ++quotaRequestVersion.current
    setQuotaLoading(true)
    try {
      const nextQuota = await getCurrentMaterialQuota()
      if (requestVersion === quotaRequestVersion.current) setQuota(nextQuota)
    } catch {
      if (requestVersion === quotaRequestVersion.current) {
        setQuota(null)
        if (notifyFailure) Taro.showToast({ title: '额度暂时无法获取', icon: 'none' })
      }
    } finally {
      if (requestVersion === quotaRequestVersion.current) setQuotaLoading(false)
    }
  }

  useDidShow(() => {
    syncCustomTabBar('materials')
    setCampusName(getSelectedCampus(getMiniappRuntimeConfig()))
    const navigationIntent = consumeCourseMaterialNavigationIntent()
    if (navigationIntent) {
      routeCoursePreselected.current = false
      uploadMetadataTouched.current = false
      setNavigationContext(navigationIntent)
      setKeyword(navigationIntent.keyword || '')
      setCourseId(navigationIntent.courseId)
      setCourseLabel(navigationIntent.courseName || '全部课程')
      setKind(navigationIntent.materialType || 'all')
      setSourceType(navigationIntent.sourceType || 'all')
      setViewMode(navigationIntent.view === 'mine' ? 'mine' : 'browse')
      setSheet(navigationIntent.action === 'upload' ? 'upload' : null)
      if (navigationIntent.action === 'upload') setUploadSource('file')
    }
    void listAllMyCourseMaterials().then(setMyMaterials).catch(() => undefined)
    void listMyCourseMaterialFeedbacks().then((page) => setMyFeedbacks(page.items)).catch(() => undefined)
    void refreshQuota()
  })

  useEffect(() => {
    let active = true
    setRouteMatchedCourse(null)
    setRouteCourseLookupReady(!routeContext.courseName)
    const appendCourses = (items: MaterialCourseView[]) => {
      if (!active) return
      setApiCourses((current) => mergeMaterialCourses(current, items))
    }
    const load = async () => {
      try {
        const firstPage = await listMaterialCourses('', 1, 100)
        appendCourses(firstPage.items)
        if (!routeContext.courseName) return
        const findExact = (page: MaterialCoursePage, lookupKeyword: string) => (
          resolveCompleteMaterialCoursePage(page, {
            name: routeContext.courseName,
            courseCode: lookupKeyword === routeContext.courseCode ? routeContext.courseCode : undefined,
          })
        )
        let matched: MaterialCourseView | undefined
        let canFallbackToName = true
        if (routeContext.courseCode) {
          const byCode = await listMaterialCourses(routeContext.courseCode, 1, 100)
          appendCourses(byCode.items)
          canFallbackToName = byCode.total <= byCode.items.length
          if (canFallbackToName) {
            matched = findExact(byCode, routeContext.courseCode)
          }
        }
        if (!matched && canFallbackToName && routeContext.courseName) {
          const byName = await listMaterialCourses(routeContext.courseName, 1, 100)
          appendCourses(byName.items)
          if (byName.total <= byName.items.length) {
            matched = resolveCompleteMaterialCoursePage(byName, { name: routeContext.courseName })
          }
        }
        if (active && matched) {
          setCourseId(matched.id)
          setCourseLabel(courseOptionFromRecord(matched).label)
          setRouteMatchedCourse(matched)
        }
      } catch {
        if (active) Taro.showToast({ title: '课程分类加载失败', icon: 'none' })
      } finally {
        if (active) {
          setCoursesLoaded(true)
          setRouteCourseLookupReady(true)
        }
      }
    }
    void load()
    return () => { active = false }
  }, [routeContext.courseCode, routeContext.courseName])

  useEffect(() => {
    if (sheet !== 'upload-course') return
    const generation = coursePickerRequestGeneration.current
    const isCurrent = () => coursePickerRequestGeneration.current === generation
    setCoursePickerLoading(true)
    const timer = setTimeout(() => {
      void listMaterialCourses(uploadCourseQuery.trim(), 1, 100)
        .then((page) => {
          if (!isCurrent()) return
          setCoursePickerItems(page.items)
          setCoursePickerPage(page.page)
          setCoursePickerTotal(page.total)
          setApiCourses((current) => mergeMaterialCourses(current, page.items))
        })
        .catch(() => {
          if (isCurrent()) Taro.showToast({ title: '课程搜索失败，请重试', icon: 'none' })
        })
        .finally(() => {
          if (isCurrent()) setCoursePickerLoading(false)
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      if (isCurrent()) coursePickerRequestGeneration.current += 1
    }
  }, [sheet, uploadCourseQuery])

  useEffect(() => {
    if (
      routeCoursePreselected.current
      || !draftStorageReady
      || drafts.length
      || metadata.courseIds.length
      || !!metadata.candidateCourseName.trim()
      || uploadMetadataTouched.current
      || !coursesLoaded
      || !routeCourseLookupReady
      || !routeContext.courseName
      || !routeMatchedCourse
    ) return
    routeCoursePreselected.current = true
    setMetadata((current) => ({
      ...current,
      courseName: routeMatchedCourse.name,
      courseId: routeMatchedCourse.id,
      courseIds: [routeMatchedCourse.id],
      candidateCourseName: '',
    }))
  }, [coursesLoaded, draftStorageReady, drafts.length, metadata.candidateCourseName, metadata.courseIds.length, routeContext.courseName, routeCourseLookupReady, routeMatchedCourse])

  const openMaterialDetail = (material: CourseMaterialView) => {
    setApiCourses((current) => mergeMaterialCourses(current, materialCourses(material)))
    setActiveMaterial(material)
    setEditTitle(material.title)
    setEditCourse(materialCourseLabel(material))
    setEditCourseIds(materialCourses(material).map((item) => item.id))
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
    courseId ? apiCourses.find((item) => item.id === courseId) : undefined
  ), [apiCourses, courseId])
  useEffect(() => {
    if (viewMode !== 'browse' || !coursesLoaded) return
    let active = true
    setLoading(true)
    setMaterialsLoadFailed(false)
    listCourseMaterials({
      courseId,
      materialType: kind === 'all' ? undefined : kind,
      sourceType: sourceType === 'all' ? undefined : sourceType,
      keyword: debouncedKeyword,
      periodId: undefined,
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
    sourceType,
    materialsReloadKey,
    courseId,
    viewMode,
  ])

  useReachBottom(() => {
    if (
      viewMode !== 'browse'
      || loading
      || materials.length >= materialsTotal
    ) return
    setLoading(true)
    listCourseMaterials({
      courseId,
      materialType: kind === 'all' ? undefined : kind,
      sourceType: sourceType === 'all' ? undefined : sourceType,
      keyword: debouncedKeyword,
      periodId: undefined,
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
    const courseNames = materialCourses(item).map((itemCourse) => itemCourse.name).join(' ')
    const filenames = [
      ...(item.source_filenames || []),
      ...item.files.map((file) => file.original_filename),
    ].join('')
    return (!search || `${item.title}${courseNames}${item.candidate_course_name || ''}${filenames}`.toLowerCase().includes(search))
      && (!courseId || materialCourses(item).some((itemCourse) => itemCourse.id === courseId))
      && (kind === 'all' || item.material_type === kind)
  }), [courseId, keyword, kind, myMaterials])

  const courseOptions = useMemo(() => {
    const records = [...apiCourses]
    if (courseId && !records.some((item) => item.id === courseId) && selectedCourse) records.unshift(selectedCourse)
    return records.map(courseOptionFromRecord)
  }, [apiCourses, courseId, selectedCourse])
  const materialsPlazaItems = useMemo<MaterialsPlazaItem[]>(() => materials.map((material) => {
    const fileNames = material.source_filenames?.length
      ? material.source_filenames
      : material.files.map((file) => file.original_filename)
    const formats = Array.from(new Set(fileNames.map((filename) => materialExtension(filename).toUpperCase()).filter(Boolean)))
    const sizeBytes = material.files.reduce((total, file) => total + file.size_bytes, 0)
    const relatedCourses = materialCourses(material).map((course) => course.name)
    const courseName = relatedCourses.length
      ? relatedCourses.join('、')
      : material.candidate_course_name || undefined
    return {
      id: String(material.id),
      title: material.title,
      typeLabel: materialKindLabels[material.material_type],
      formatLabel: material.source_type === 'cloud_share'
        ? '网盘分享'
        : material.files.length === 1 && materialExtension(material.files[0].original_filename) === 'zip'
          ? 'ZIP'
          : formats.length > 1 ? '多格式' : formats[0] || '文件资料',
      sizeLabel: material.source_type !== 'cloud_share' && sizeBytes > 0
        ? formatFileSize(sizeBytes)
        : undefined,
      fileCount: fileNames.length || undefined,
      isCollection: material.files.length > 1
        || material.files.some((file) => materialExtension(file.original_filename) === 'zip'),
      courseName,
      createdAtLabel: material.created_at.slice(0, 10),
      downloadCountLabel: `${material.download_count} 次下载`,
      sourceLabel: material.source_type === 'cloud_share' ? '网盘资料' : '文件资料',
    }
  }), [materials])
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
  const uploadCourseCandidates = useMemo<UploadCourseOption[]>(() => (
    apiCourses.map(courseOptionFromRecord)
  ), [apiCourses])
  const uploadCourseOptions = useMemo(() => {
    return [...uploadCourseCandidates]
      .sort((left, right) => Number(metadata.courseIds.includes(right.id)) - Number(metadata.courseIds.includes(left.id)))
      .slice(0, 6)
  }, [
    metadata.courseIds,
    uploadCourseCandidates,
  ])
  const visibleUploadCourseOptions = useMemo(() => {
    return coursePickerItems.map(courseOptionFromRecord)
      .sort((left, right) => Number(metadata.courseIds.includes(right.id)) - Number(metadata.courseIds.includes(left.id)))
  }, [
    coursePickerItems,
    metadata.courseIds,
  ])
  const filtersActive = courseLabel !== '全部课程' || kind !== 'all'
  const sourceCourseActive = !!routeContext.courseName
    && !!courseId
  const sourceLabel = routeContext.source
    ? materialSourceLabels[routeContext.source]
    : '从课程进入'
  const heroCopy = sourceCourseActive
    ? routeContext.action === 'upload'
      ? '课程已自动带入，可继续关联其他课程'
      : '正在查看这门课程的全部资料'
    : '搜索和复制资料下载地址，也可以上传资料与同学分享'
  const selectBrowseCourse = (nextCourse?: UploadCourseOption) => {
    setCourseId(nextCourse?.id)
    setCourseLabel(nextCourse
      ? (`${nextCourse.name} · ${nextCourse.courseCode} · ${nextCourse.educationLevel}`)
      : '全部课程')
  }
  const invalidateUploadSession = () => {
    void removeZipArchive(uploadBatch.archive?.filePath)
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
    uploadMetadataTouched.current = true
    setMetadata((current) => ({ ...current, ...patch }))
    invalidateUploadSession()
  }
  const updateUploadCourseName = (courseName: string) => {
    updateMetadata({
      courseName,
      courseId: undefined,
      courseIds: [],
      candidateCourseName: courseName,
    })
  }
  const openCoursePicker = (target: CoursePickerTarget) => {
    coursePickerRequestGeneration.current += 1
    setCoursePickerTarget(target)
    setCoursePickerLoading(true)
    setCoursePickerItems([])
    setCoursePickerPage(1)
    setCoursePickerTotal(0)
    setUploadCourseQuery('')
    onKeyboardVisibilityChange(0)
    setSheet('upload-course')
  }
  const openUploadCoursePicker = () => {
    openCoursePicker('upload')
  }
  const openFilterCoursePicker = () => {
    openCoursePicker('filter')
  }
  const openEditCoursePicker = () => {
    openCoursePicker('edit')
  }
  const updateCoursePickerQuery = (value: string) => {
    coursePickerRequestGeneration.current += 1
    setCoursePickerLoading(true)
    setCoursePickerItems([])
    setCoursePickerPage(1)
    setCoursePickerTotal(0)
    setUploadCourseQuery(value)
  }
  const selectUploadCourseOption = (option: UploadCourseOption) => {
    if (coursePickerTarget === 'filter') {
      selectBrowseCourse(option)
      setSheet('filter')
      return
    }
    if (coursePickerTarget === 'edit') {
      if (!editCourseIds.includes(option.id) && editCourseIds.length >= 10) {
        Taro.showToast({ title: '最多关联 10 门课程', icon: 'none' })
        return
      }
      const next = editCourseIds.includes(option.id)
        ? editCourseIds.filter((id) => id !== option.id)
        : [...editCourseIds, option.id]
      setEditCourseIds(next)
      setEditCourse(next.length ? '' : editCourse)
      return
    }
    if (!metadata.courseIds.includes(option.id) && metadata.courseIds.length >= 10) {
      Taro.showToast({ title: '最多关联 10 门课程', icon: 'none' })
      return
    }
    updateMetadata({
      courseName: '',
      courseId: undefined,
      courseIds: metadata.courseIds.includes(option.id)
        ? metadata.courseIds.filter((id) => id !== option.id)
        : [...metadata.courseIds, option.id],
      candidateCourseName: '',
    })
  }

  const loadMoreCoursePicker = () => {
    if (coursePickerLoading || coursePickerItems.length >= coursePickerTotal) return
    const generation = coursePickerRequestGeneration.current
    const isCurrent = () => coursePickerRequestGeneration.current === generation
    setCoursePickerLoading(true)
    listMaterialCourses(uploadCourseQuery.trim(), coursePickerPage + 1, 100)
      .then((page) => {
        if (!isCurrent()) return
        setCoursePickerItems((current) => mergeMaterialCourses(current, page.items))
        setCoursePickerPage(page.page)
        setCoursePickerTotal(page.total)
        setApiCourses((current) => mergeMaterialCourses(current, page.items))
      })
      .catch(() => {
        if (isCurrent()) Taro.showToast({ title: '下一页课程加载失败', icon: 'none' })
      })
      .finally(() => {
        if (isCurrent()) setCoursePickerLoading(false)
      })
  }

  const chooseFiles = async () => {
    if (uploading || choosingFilesRef.current) return
    if (!draftStorageReady || !draftUserId) {
      Taro.showToast({ title: '账号信息加载中，请稍后重试', icon: 'none' })
      return
    }
    const remainingCount = MAX_MATERIAL_FILES - drafts.length
    if (remainingCount <= 0) {
      Taro.showToast({ title: `单次最多选择 ${MAX_MATERIAL_FILES} 个文件`, icon: 'none' })
      return
    }
    choosingFilesRef.current = true
    try {
      const result = await Taro.chooseMessageFile({
        count: remainingCount,
        type: 'file',
        extension: [...supportedMaterialExtensions],
      })
      const returnedFiles = getSelectedTempFiles(result)
      if (!returnedFiles.length) return
      const selected = selectSupportedMaterialFiles(returnedFiles, remainingCount)
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
        courseCode: firstSuggestion?.courseCode,
      })
      const nextDrafts: MaterialUploadDraft[] = []
      let hasTemporaryFile = false
      try {
        for (let index = 0; index < selected.length; index += 1) {
          const file = selected[index]
          const persisted = await persistMaterialFile(file.path)
          if (!persisted.persistent) hasTemporaryFile = true
          nextDrafts.push({
            id: `material-draft-${Date.now()}-${Math.random().toString(36).slice(2)}-${index}`,
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
      void removeZipArchive(uploadBatch.archive?.filePath)
      setDrafts((current) => [...current, ...nextDrafts])
      if (!drafts.length) {
        setMetadata({
          title: normalizeMaterialTitle(selected[0].name) || selected[0].name,
          kind: inferMaterialKind(selected[0].name),
          courseName: courseRecord?.name || firstSuggestion?.name || '',
          courseId: courseRecord?.id,
          courseIds: courseRecord?.id ? [courseRecord.id] : [],
          candidateCourseName: courseRecord ? '' : firstSuggestion?.name || '',
          description: '',
        })
      }
      setUploadSource('file')
      setCloudShareText('')
      setParsedCloudShare(null)
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
    } finally {
      choosingFilesRef.current = false
    }
  }

  const removeDraft = (id: string) => {
    if (uploading || choosingFilesRef.current) return
    const removed = drafts.find((draft) => draft.id === id)
    if (removed) void removePersistedMaterialFiles([removed])
    void removeZipArchive(uploadBatch.archive?.filePath)
    setDrafts((current) => current.filter((draft) => draft.id !== id).map((draft) => ({
      ...draft,
      status: draft.filePath ? 'draft' : 'needs_file',
      progress: 0,
      uploadTarget: undefined,
      fileId: undefined,
    })))
    setUploadBatch(createUploadBatch())
  }

  const clearDrafts = () => {
    if (uploading || choosingFilesRef.current) return
    void removePersistedMaterialFiles(drafts)
    void removeZipArchive(uploadBatch.archive?.filePath)
    setDrafts([])
    setUploadBatch(createUploadBatch())
  }

  const submitDrafts = async () => {
    if (choosingFilesRef.current) return
    const validationError = validateMaterialDrafts(drafts, metadata)
    if (validationError) {
      Taro.showToast({ title: validationError, icon: 'none' })
      return
    }
    if (uploading) return
    setUploading(true)
    setUploadPhase(drafts.length > 1 ? 'packing' : 'uploading')
    setUploadProgress(0)
    const persistState = (
      nextDrafts: MaterialUploadDraft[],
      nextBatch: MaterialUploadBatch,
    ) => {
      setDrafts(nextDrafts)
      setUploadBatch(nextBatch)
      if (draftUserId) {
        materialDraftStorage.write(draftUserId, {
          version: 4,
          drafts: nextDrafts,
          metadata,
          batch: nextBatch,
        })
      }
    }
    let workingDrafts = drafts.map((draft) => ({ ...draft }))
    let workingBatch = { ...uploadBatch }
    const isCollection = workingDrafts.length > 1
    try {
      if (isCollection && workingBatch.archive && !(await zipArchiveExists(workingBatch.archive.filePath))) {
        await removeZipArchive(workingBatch.archive.filePath)
        workingBatch = createUploadBatch()
      }
      if (isCollection && !workingBatch.archive) {
        const archive = await createWeappZipArchive(workingDrafts.map((draft) => ({
          name: draft.fileName,
          path: draft.filePath,
          size: draft.fileSize,
        })), ({ progress }) => {
          setUploadProgress(progress)
          setDrafts((current) => current.map((draft) => ({ ...draft, progress, status: 'uploading' })))
        })
        workingBatch = {
          ...workingBatch,
          archive: {
            filePath: archive.filePath,
            fileName: `${metadata.title.trim() || '资料合辑'}.zip`,
            fileSize: archive.size,
          },
        }
        persistState(workingDrafts, workingBatch)
      }
      const sessionValid = !!workingBatch.sessionId
        && workingBatch.sessionVersion !== undefined
        && !!workingBatch.sessionExpiresAt
        && new Date(workingBatch.sessionExpiresAt).getTime() > Date.now() + 5_000
      const reusable = isCollection
        ? sessionValid
          && !!workingBatch.archive?.uploadTarget
          && workingBatch.archive.fileId === workingBatch.archive.uploadTarget.file_id
        : isMaterialUploadSessionReusable(workingBatch, workingDrafts)
      if (workingBatch.sessionId && !reusable) {
        workingDrafts = workingDrafts.map((draft) => ({
          ...draft,
          status: draft.filePath ? 'draft' : 'needs_file',
          progress: 0,
          uploadTarget: undefined,
          fileId: undefined,
        }))
        workingBatch = isCollection && workingBatch.archive
          ? {
              ...createUploadBatch(),
              archive: {
                ...workingBatch.archive,
                uploadTarget: undefined,
                fileId: undefined,
                uploaded: false,
              },
            }
          : createUploadBatch()
      }
      const uploadObjects = isCollection
        ? [workingBatch.archive].filter((archive): archive is NonNullable<typeof workingBatch.archive> => !!archive)
        : workingDrafts
      const files = isCollection
        ? uploadObjects.map<MaterialUploadFileInput>((archive) => ({
            filename: archive.fileName,
            mime_type: 'application/zip' as MaterialUploadFileInput['mime_type'],
            size_bytes: archive.fileSize,
          }))
        : workingDrafts.map<MaterialUploadFileInput>((draft) => {
            const mimeType = mimeTypes[materialExtension(draft.fileName)]
            if (!mimeType) throw new Error(`${draft.fileName} 的文件类型暂不支持`)
            return {
              filename: draft.fileName,
              mime_type: mimeType,
              size_bytes: draft.fileSize,
            }
          })
      if (!workingBatch.sessionId) {
        const session = await createMaterialUploadSession({
          title: metadata.title.trim(),
          material_type: metadata.kind,
          course_ids: metadata.courseIds,
          course_id: metadata.courseIds[0],
          candidate_course_name: metadata.courseIds.length || !metadata.candidateCourseName.trim()
            ? undefined
            : metadata.candidateCourseName.trim(),
          description: metadata.description.trim() || undefined,
          files,
          source_filenames: isCollection ? workingDrafts.map((draft) => draft.fileName) : undefined,
        }, workingBatch.createIdempotencyKey)
        if (session.uploads.length !== files.length) {
          throw new Error('上传任务数量与所选文件不一致')
        }
        workingBatch = {
          ...workingBatch,
          sessionId: session.id,
          sessionVersion: session.version,
          sessionExpiresAt: session.expires_at,
        }
        if (isCollection && workingBatch.archive) {
          workingBatch = {
            ...workingBatch,
            archive: {
              ...workingBatch.archive,
              uploadTarget: session.uploads[0],
              fileId: session.uploads[0].file_id,
            },
          }
        } else {
          workingDrafts = workingDrafts.map((draft, index) => ({
            ...draft,
            uploadTarget: session.uploads[index],
            fileId: session.uploads[index].file_id,
          }))
        }
        persistState(workingDrafts, workingBatch)
      }
      setUploadPhase('uploading')
      if (isCollection) {
        const archive = workingBatch.archive
        if (!archive?.filePath || !archive.uploadTarget || !archive.fileId) {
          throw new Error('ZIP 上传凭证缺失，请重新上传')
        }
        if (!archive.uploaded) {
          try {
            await uploadMaterialFile(archive.uploadTarget, archive.filePath, (progress) => {
              setUploadProgress(progress)
              setDrafts((current) => current.map((draft) => ({
                ...draft,
                status: 'uploading',
                progress,
              })))
            })
            workingBatch = {
              ...workingBatch,
              archive: { ...archive, uploaded: true },
            }
            workingDrafts = workingDrafts.map((draft) => ({ ...draft, status: 'uploaded', progress: 100 }))
            persistState(workingDrafts, workingBatch)
          } catch (error) {
            workingDrafts = workingDrafts.map((draft) => ({
              ...draft,
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'ZIP 上传失败',
            }))
            persistState(workingDrafts, workingBatch)
            throw error
          }
        }
      } else {
        const draft = workingDrafts[0]
        if (draft.status !== 'uploaded') {
          if (!draft.uploadTarget) throw new Error('上传凭证缺失，请重新上传')
          workingDrafts[0] = { ...draft, status: 'uploading', progress: 0, errorMessage: undefined }
          persistState(workingDrafts, workingBatch)
          try {
            await uploadMaterialFile(draft.uploadTarget, draft.filePath, (progress) => {
              setUploadProgress(progress)
              setDrafts((current) => current.map((item) => (
                item.id === draft.id ? { ...item, status: 'uploading', progress } : item
              )))
            })
            workingDrafts[0] = { ...workingDrafts[0], status: 'uploaded', progress: 100 }
            persistState(workingDrafts, workingBatch)
          } catch (error) {
            workingDrafts[0] = {
              ...workingDrafts[0],
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : '文件上传失败',
            }
            persistState(workingDrafts, workingBatch)
            throw error
          }
        }
      }
      if (!workingBatch.sessionId || workingBatch.sessionVersion === undefined) {
        throw new Error('上传会话无效，请重新上传')
      }
      const completedFiles = isCollection
        ? workingBatch.archive?.fileId
          ? [{ file_id: workingBatch.archive.fileId }]
          : []
        : workingDrafts.map((draft) => {
            if (!draft.fileId) throw new Error('上传任务无效，请重新上传')
            return { file_id: draft.fileId }
          })
      if (!completedFiles.length) throw new Error('上传任务无效，请重新上传')
      setUploadPhase('publishing')
      console.info('[对象存储直传] 课程资料开始完成确认')
      const completed = await completeMaterialUploadSession(
        workingBatch.sessionId,
        workingBatch.sessionVersion,
        completedFiles,
        workingBatch.completeIdempotencyKey,
      )
      console.info('[对象存储直传] 课程资料完成确认成功')
      await removePersistedMaterialFiles(workingDrafts)
      await removeZipArchive(workingBatch.archive?.filePath)
      setDrafts([])
      setMetadata(createUploadMetadata(routeContext))
      setUploadBatch(createUploadBatch())
      quotaRequestVersion.current += 1
      setQuota((current) => current ? {
        ...current,
        remaining: Math.min(current.daily_limit, current.remaining + (completed.rewarded_downloads || 0)),
      } : current)
      void refreshQuota()
      materialDraftStorage.clear(draftUserId)
      setMyMaterials((current) => [
        completed.material,
        ...current.filter((item) => item.id !== completed.material.id),
      ])
      setViewMode('browse')
      setMaterialsReloadKey((current) => current + 1)
      setSheet(null)
      Taro.showToast({
        title: completed.rewarded_downloads
          ? `已发布，额度 +${completed.rewarded_downloads}`
          : '资料已发布',
        icon: 'success',
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '上传失败，请重试'
      setDrafts((current) => current.map((draft) => draft.status === 'uploading'
        ? { ...draft, status: 'failed', progress: 0, errorMessage }
        : draft))
      Taro.showToast({
        title: errorMessage,
        icon: 'none',
      })
    } finally {
      setUploading(false)
      setUploadPhase(null)
    }
  }

  const openUpload = () => {
    setUploadSource('file')
    setViewMode('browse')
    setSheet('upload')
  }

  const parseCloudShare = () => {
    const parsed = parseCloudShareText(cloudShareText)
    if (!parsed) {
      setParsedCloudShare(null)
      Taro.showToast({ title: '没有识别到有效的网盘链接', icon: 'none' })
      return
    }
    setParsedCloudShare(parsed)
    Taro.showToast({ title: parsed.code ? '已识别链接和提取码' : '已识别分享链接', icon: 'success' })
  }

  const submitCloudShare = async () => {
    if (uploading) return
    if (!parsedCloudShare) {
      Taro.showToast({ title: '请先解析网盘分享链接', icon: 'none' })
      return
    }
    if (!metadata.title.trim()) {
      Taro.showToast({ title: '请补全资料名称', icon: 'none' })
      return
    }
    setUploading(true)
    setUploadPhase('publishing')
    try {
      const material = await createMaterialCloudShare({
        title: metadata.title.trim(),
        material_type: metadata.kind,
        share_url: parsedCloudShare.url,
        share_code: parsedCloudShare.code,
        course_ids: metadata.courseIds,
        course_id: metadata.courseIds[0],
        candidate_course_name: metadata.courseIds.length || !metadata.candidateCourseName.trim()
          ? undefined
          : metadata.candidateCourseName.trim(),
        period_id: routeContext.periodId,
        description: metadata.description.trim() || undefined,
      }, createIdempotencyKey('material-cloud-share-create'))
      setMyMaterials((current) => [material, ...current.filter((item) => item.id !== material.id)])
      setMaterialsReloadKey((current) => current + 1)
      setCloudShareText('')
      setParsedCloudShare(null)
      setUploadSource('file')
      setViewMode('browse')
      setSheet(null)
      Taro.showToast({ title: '网盘资料已发布', icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '网盘资料发布失败，请重试',
        icon: 'none',
      })
    } finally {
      setUploading(false)
      setUploadPhase(null)
    }
  }

  const copyToClipboard = async (value: string, successTitle = '下载地址已复制') => {
    await Taro.setClipboardData({ data: value })
    Taro.showToast({ title: successTitle, icon: 'success' })
  }

  const copyMaterialDownloadAddress = async (material: CourseMaterialView, fileId?: number) => {
    const requestKey = material.source_type === 'cloud_share'
      ? `cloud:${material.id}`
      : `file:${material.id}:${fileId || material.files[0]?.id || 0}`
    if (addressRequestsRef.current.has(requestKey)) return
    addressRequestsRef.current.add(requestKey)
    try {
      if (material.source_type === 'cloud_share') {
        let share = cloudAddressCache.current.get(material.id)
        if (!share) {
          const authorizedShare = await getCourseMaterialCloudShare(material.id)
          share = authorizedShare
          cloudAddressCache.current.set(material.id, authorizedShare)
          quotaRequestVersion.current += 1
          setQuotaLoading(false)
          setQuota((current) => current ? { ...current, remaining: authorizedShare.remaining_downloads } : current)
        }
        await copyToClipboard(
          [share.share_url, share.share_code ? `提取码：${share.share_code}` : ''].filter(Boolean).join('\n'),
        )
        return
      }
      const file = fileId
        ? material.files.find((item) => item.id === fileId)
        : material.files.length === 1 ? material.files[0] : undefined
      if (!file) {
        Taro.showToast({ title: '请进入详情选择要复制的文件地址', icon: 'none' })
        return
      }
      const cacheKey = `${material.id}:${file.id}:${file.version}`
      let target = downloadAddressCache.current.get(cacheKey)
      if (!target || target.expiresAt <= Date.now() + 5_000) {
        const result = await getMaterialDownload(material.id, file.id)
        target = { url: result.url, expiresAt: new Date(result.expires_at).getTime() }
        downloadAddressCache.current.set(cacheKey, target)
        quotaRequestVersion.current += 1
        setQuotaLoading(false)
        setQuota((current) => current ? { ...current, remaining: result.remaining_downloads } : current)
      }
      await copyToClipboard(target.url)
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '获取下载地址失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      addressRequestsRef.current.delete(requestKey)
    }
  }

  const copyDownloadAddressForItem = (item: MaterialsPlazaItem) => {
    const material = materials.find((record) => String(record.id) === item.id)
    if (material) void copyMaterialDownloadAddress(material)
  }

  const startAdReward = async () => {
    if (!quota?.ad_reward_enabled || quota.ad_reward_count <= 0 || quota.ad_rewards_remaining <= 0) return
    preloadMemberAd()
    await adRewardController.open()
  }

  const saveRejectedMaterial = async () => {
    const courseIds = Array.from(new Set(editCourseIds))
    if (!activeMaterial || !editTitle.trim()) {
      Taro.showToast({ title: '请补全资料名称', icon: 'none' })
      return
    }
    if (courseIds.length > 10) {
      Taro.showToast({ title: '最多关联 10 门课程', icon: 'none' })
      return
    }
    try {
      const updated = await updateMyCourseMaterial(activeMaterial.id, {
        expected_version: activeMaterial.version,
        title: editTitle.trim(),
        material_type: editKind,
        course_ids: courseIds,
        course_id: courseIds[0],
        candidate_course_name: courseIds.length || !editCourse.trim() ? undefined : editCourse.trim(),
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
      content: '撤回后将停止展示和下载，确认继续吗？',
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
        coursePickerRequestGeneration.current += 1
        setUploadCourseQuery('')
        setSheet(coursePickerTarget === 'filter' ? 'filter' : coursePickerTarget === 'edit' ? 'detail' : 'upload')
        onKeyboardVisibilityChange(0)
        return
      }
      setSheet(null)
      onKeyboardVisibilityChange(0)
    }
  }

  const selectedUploadCourses: MaterialsPlazaCourse[] = apiCourses
    .filter((course) => metadata.courseIds.includes(course.id))
    .map((course) => ({ id: String(course.id), name: course.name }))
  const suggestedUploadCourses: MaterialsPlazaCourse[] = uploadCourseOptions
    .filter((course) => !metadata.courseIds.includes(course.id))
    .map((course) => ({ id: String(course.id), name: course.name }))
  const materialsPlazaUpload = {
    visible: sheet === 'upload',
    source: uploadSource,
    files: drafts.map((draft) => ({
      id: draft.id,
      name: draft.fileName,
      sizeLabel: formatFileSize(draft.fileSize),
      extensionLabel: materialExtension(draft.fileName).toUpperCase() || 'FILE',
      statusLabel: uploadPhase === 'packing'
        ? '打包中'
        : draftStatusMeta[draft.status].label,
      progress: uploadPhase === 'packing' || draft.status === 'uploading'
        ? uploadPhase === 'packing' ? uploadProgress : draft.progress
        : undefined,
    })),
    totalSizeLabel: drafts.length ? formatFileSize(drafts.reduce((total, draft) => total + draft.fileSize, 0)) : undefined,
    maxFileCount: MAX_MATERIAL_FILES,
    cloudLink: cloudShareText,
    parsedCloudLinkLabel: parsedCloudShare
      ? `已识别网盘链接${parsedCloudShare.code ? ' · 提取码已识别' : ''}`
      : undefined,
    title: metadata.title,
    typeOptions: plazaTypeFilters.filter((filter) => filter.id !== 'all'),
    selectedTypeId: metadata.kind,
    selectedCourses: selectedUploadCourses,
    suggestedCourses: suggestedUploadCourses,
    rewardCount: quota && quota.upload_rewards_remaining > 0 && quota.upload_reward_count > 0
      ? quota.upload_reward_count
      : undefined,
    canSubmit: !uploading && !!metadata.title.trim() && (
      uploadSource === 'file' ? drafts.length > 0 : !!parsedCloudShare
    ),
    submitting: uploading,
    submitLabel: uploadSource === 'cloud' ? '发布网盘资料' : drafts.some((draft) => draft.status === 'failed') ? '重试上传' : undefined,
    phaseLabel: uploadPhase === 'packing'
      ? `正在本地打包 ZIP（${uploadProgress}%）`
      : uploadPhase === 'uploading'
        ? `${drafts.length > 1 ? '正在上传 ZIP 合辑' : '正在上传文件'}（${uploadProgress}%）`
        : uploadPhase === 'publishing' ? '正在确认发布…' : undefined,
    onClose: closeSheet,
    onSourceChange: (source: MaterialsPlazaUploadSource) => {
      if (!uploading && !choosingFilesRef.current) setUploadSource(source)
    },
    onChooseFiles: () => void chooseFiles(),
    onRemoveFile: removeDraft,
    onClearFiles: clearDrafts,
    onCloudLinkChange: (value: string) => {
      setCloudShareText(value)
      setParsedCloudShare(null)
    },
    onParseCloudLink: parseCloudShare,
    onTitleChange: (value: string) => updateMetadata({ title: value }),
    onTypeSelect: (value: string) => updateMetadata({ kind: value as MaterialKind }),
    onCourseToggle: (value: string) => {
      const id = Number(value)
      if (!Number.isSafeInteger(id) || id <= 0) return
      const nextIds = metadata.courseIds.includes(id)
        ? metadata.courseIds.filter((courseIdValue) => courseIdValue !== id)
        : [...metadata.courseIds, id]
      if (nextIds.length > 10) {
        Taro.showToast({ title: '最多关联 10 门课程', icon: 'none' })
        return
      }
      updateMetadata({
        courseName: '',
        courseId: undefined,
        candidateCourseName: '',
        courseIds: nextIds,
      })
    },
    onOpenCourseSearch: openUploadCoursePicker,
    onSubmit: () => {
      if (uploadSource === 'cloud') void submitCloudShare()
      else void submitDrafts()
    },
  }

  const chooseCampus = async () => {
    const campuses = enabledCampuses(getMiniappRuntimeConfig())
    if (!campuses.length) return
    const index = await showActionSheetSelection(campuses)
    if (index === null || !campuses[index]) return
    try {
      saveSelectedCampus(campuses[index])
      setCampusName(campuses[index])
    } catch {
      Taro.showToast({ title: '校区保存失败，请重试', icon: 'none' })
    }
  }

  return (
    <View className={`materials-page ${viewMode === 'browse' ? 'materials-page--browse' : ''} ${sheet ? 'materials-page--locked' : ''}`}>
      {viewMode === 'browse'
        ? <CustomNavbar title='资料' barContent={<MaterialsPlazaHeader campusName={campusName} contextLabel={sourceCourseActive ? sourceLabel : undefined} onCampusSelect={() => void chooseCampus()} />} barContentClassName='materials-plaza-navbar-content' />
        : <CustomNavbar title='资料' />}
      {viewMode === 'browse' ? (
        <MaterialsPlazaView
          searchValue={keyword}
          onSearchChange={setKeyword}
          onSearch={() => setMaterialsReloadKey((current) => current + 1)}
          shortcuts={plazaShortcuts}
          onShortcutSelect={(shortcut) => {
            setKeyword(shortcut.keyword)
            setKind(materialKinds.includes(shortcut.materialType as MaterialKind)
              ? shortcut.materialType as MaterialKind
              : 'all')
          }}
          sourceFilters={plazaSourceFilters}
          selectedSourceFilterId={sourceType}
          onSourceFilterSelect={(value) => setSourceType(value as typeof sourceType)}
          filters={plazaTypeFilters}
          selectedFilterId={kind}
          onFilterSelect={(value) => setKind(value as typeof kind)}
          courseFilterLabel={courseId ? courseLabel : '全部课程'}
          onCourseFilterClick={() => setSheet('filter')}
          listTitle='全部试卷与资料'
          totalCountLabel={`共 ${materialsTotal} 份`}
          items={materialsPlazaItems}
          quota={quota ? {
            remaining: quota.remaining,
            total: quota.daily_limit,
            resetHint: `今日已用 ${quota.used} 次，额度每日刷新`,
            adEntryLabel: quota.ad_reward_enabled && quota.ad_reward_count > 0 && quota.ad_rewards_remaining > 0
              ? adRewardPhase === 'loading' || adRewardPhase === 'preparing' ? '广告加载中…' : '看广告领额度'
              : undefined,
            adEntryHint: quota.ad_rewards_remaining > 0 ? `今日还可领 ${quota.ad_rewards_remaining} 次` : undefined,
          } : undefined}
          quotaLoading={quotaLoading}
          loading={loading}
          errorMessage={materialsLoadFailed ? '资料暂时没有加载出来' : undefined}
          upload={materialsPlazaUpload}
          onOpenMine={() => setViewMode('mine')}
          onRewardEntry={() => void startAdReward()}
          onQuotaRetry={() => void refreshQuota(true)}
          onMaterialOpen={(item) => {
            const material = materials.find((record) => String(record.id) === item.id)
            if (material) openMaterialDetail(material)
          }}
          onCopyDownloadAddress={copyDownloadAddressForItem}
          onOpenUpload={() => {
            setUploadSource('file')
            setSheet('upload')
          }}
          onRetry={() => setMaterialsReloadKey((current) => current + 1)}
        />
      ) : (
      <View className='materials-page__content'>
        <View className='materials-view-tabs'>
          <View ariaRole='tab' ariaLabel='返回资料广场' onClick={() => setViewMode('browse')}>资料广场</View>
          <View className={viewMode === 'mine' ? 'materials-view-tabs__active' : ''} ariaRole='tab' ariaLabel='查看我的资料' onClick={() => setViewMode('mine')}>我的资料{drafts.length ? <Text>{drafts.length}</Text> : null}</View>
          <View className={viewMode === 'feedbacks' ? 'materials-view-tabs__active' : ''} ariaRole='tab' ariaLabel='查看我的反馈' onClick={() => setViewMode('feedbacks')}>我的反馈</View>
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
            <Text className='materials-hero__title'>{courseLabel === '全部课程' ? '把好资料，传给下一位同学' : courseLabel}</Text>
            <Text className='materials-hero__copy'>{heroCopy}</Text>
          </View>
          <Image src={icons.materials} mode='aspectFit' />
        </View>
        {viewMode !== 'feedbacks' && <View className='materials-actions'>
          <View className={`materials-filter-button ${filtersActive ? 'materials-filter-button--active' : ''}`} ariaRole='button' ariaLabel='筛选课程资料' onClick={() => setSheet('filter')}><Text>筛选</Text>{filtersActive && <View />}</View>
          <ScrollView scrollX showScrollbar={false} className='materials-course-scroll'>
            <View className='materials-course-list'>
              <View className={`materials-course-chip ${courseLabel === '全部课程' ? 'materials-course-chip--active' : ''}`} ariaRole='button' ariaLabel='筛选全部课程' onClick={() => selectBrowseCourse()}>全部课程</View>
              {courseOptions.slice(0, 3).map((item) => <View key={item.id} className={`materials-course-chip ${courseId === item.id ? 'materials-course-chip--active' : ''}`} ariaRole='button' ariaLabel={`筛选课程：${item.label}`} onClick={() => selectBrowseCourse(item)}>{item.label}</View>)}
            </View>
          </ScrollView>
          <View className='materials-upload-button' ariaRole='button' ariaLabel='分享课程资料' onClick={openUpload}>分享资料</View>
        </View>}

        {viewMode === 'mine' && <>
          <View className='materials-heading'><View><Text>我的上传</Text><Text>查看已发布资料和未完成草稿</Text></View><Text>{(drafts.length ? 1 : 0) + visibleMyMaterials.length} 份</Text></View>
          <View className='materials-list'>
            {!!drafts.length && <View className='material-card' onClick={() => { setViewMode('browse'); setSheet('upload') }}>
              <View className={`material-card__file material-card__file--${metadata.kind}`}><Text>{materialKindLabels[metadata.kind]}</Text></View>
              <View className='material-card__main'>
                <Text className='material-card__title'>{metadata.title || '未完成的资料'}</Text>
                <Text className='material-card__course'>{metadata.courseName || '课程待确认'} · {drafts.length} 个文件</Text>
                <Text className={`material-card__status material-card__status--${draftStatusMeta[drafts[0].status].className}`}>{draftStatusMeta[drafts[0].status].label}</Text>
              </View>
              <Text className='material-card__arrow'>›</Text>
            </View>}
            {visibleMyMaterials.map((item) => <View key={item.id} className='material-card' onClick={() => openMaterialDetail(item)}>
              <View className={`material-card__file material-card__file--${item.material_type}`}><Text>{materialKindLabels[item.material_type]}</Text></View>
              <View className='material-card__main'>
                <Text className='material-card__title'>{item.title}</Text>
                <Text className='material-card__course'>{materialCourseLabel(item)} · {item.files.length} 个文件</Text>
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
      )}

      {sheet && (sheet !== 'upload' || viewMode !== 'browse') && <View className='materials-overlay' onClick={closeSheet}>
        <View
          className={`materials-sheet materials-sheet--${sheet} ${sheet === 'upload' && drafts.length ? 'materials-sheet--upload-filled' : ''}`}
          style={keyboardHeight ? {
            bottom: `${keyboardHeight}px`,
            maxHeight: `calc(100vh - ${keyboardHeight}px - 92px)`,
          } : undefined}
          onClick={requestWechatSubscriptionAndStopPropagation}
        >
          <View className='materials-sheet__handle' />
          {sheet !== 'upload-course' && (
          <View className='materials-sheet__close' ariaRole='button' ariaLabel='关闭弹层' onClick={closeSheet}>×</View>
          )}

          {sheet === 'filter' && <View className='materials-sheet__body'>
            <Text className='materials-sheet__title'>筛选资料</Text>
            <Text className='materials-sheet__label'>课程</Text>
            <View className='materials-option-grid'>
              <View className={courseLabel === '全部课程' ? 'materials-option--active' : ''} onClick={() => selectBrowseCourse()}>全部课程</View>
              {courseOptions.slice(0, 8).map((item) => <View key={item.id} className={courseId === item.id ? 'materials-option--active' : ''} onClick={() => selectBrowseCourse(item)}>{item.label}</View>)}
            </View>
            <View className='materials-secondary' onClick={openFilterCoursePicker}>搜索全部课程</View>
            <Text className='materials-sheet__label'>资料类型</Text>
            <View className='materials-option-grid'>
              <View className={kind === 'all' ? 'materials-option--active' : ''} onClick={() => setKind('all')}>全部类型</View>
              {materialKinds.map((item) => <View key={item} className={kind === item ? 'materials-option--active' : ''} onClick={() => setKind(item)}>{materialKindLabels[item]}</View>)}
            </View>
            <View className='materials-primary' onClick={() => setSheet(null)}>查看资料</View>
            <View className='materials-secondary' onClick={() => { selectBrowseCourse(); setKind('all') }}>清除筛选</View>
          </View>}

          {sheet === 'upload' && <View className='materials-sheet__body materials-upload-sheet__body'>
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
                <Text className={coursesLoaded && !metadata.courseIds.length && metadata.courseName.trim()
                  ? 'materials-sheet__field-status materials-sheet__field-status--pending'
                  : 'materials-sheet__field-status'}
                >
                  {!metadata.courseName.trim()
                    ? '选填'
                    : !coursesLoaded
                      ? '正在匹配'
                      : metadata.courseIds.length
                        ? `已关联 ${metadata.courseIds.length} 门`
                        : '候选课程名'}
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
                      const selected = !!item.id && metadata.courseIds.includes(item.id)
                      return (
                        <View
                          key={`${item.id || 'candidate'}-${item.name}`}
                          className={`materials-course-picker__option ${selected ? 'materials-course-picker__option--active' : ''}`}
                          onClick={() => {
                            if (item.id && !selected && metadata.courseIds.length >= 10) {
                              Taro.showToast({ title: '最多关联 10 门课程', icon: 'none' })
                              return
                            }
                            updateMetadata({
                            courseName: '',
                            courseId: undefined,
                            courseIds: metadata.courseIds.includes(item.id)
                              ? metadata.courseIds.filter((id) => id !== item.id)
                              : [...metadata.courseIds, item.id],
                            candidateCourseName: '',
                            })
                          }}
                        >
                          <View>
                            <Text>{item.name}</Text>
                            <Text>{item.courseCode} · {item.educationLevel}</Text>
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
                {!!metadata.courseIds.length && <Text className='materials-course-picker__caption'>已选：{apiCourses.filter((item) => metadata.courseIds.includes(item.id)).map((item) => courseOptionFromRecord(item).label).join('、')}</Text>}
                <View
                  className='materials-course-picker__more'
                  onClick={openUploadCoursePicker}
                >
                  <Text>查看全部课程</Text>
                  <Text>搜索并添加 ›</Text>
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
            </>}
          </View>}

          {sheet === 'upload' && !!drafts.length && <View className='materials-upload-sheet__footer'>
            <View className={`materials-primary ${uploading ? 'materials-primary--disabled' : ''}`} onClick={submitDrafts}>{uploading ? '正在上传…' : drafts.some((draft) => draft.status === 'failed') ? '重试上传' : '上传并发布'}</View>
            <Text className='materials-upload-notice'>上传即表示确认资料不包含隐私、侵权或违规内容</Text>
          </View>}

          {sheet === 'upload-course' && (
            <View className='materials-sheet__body materials-course-browser'>
              <View className='materials-course-browser__back' onClick={closeSheet}>
                <Text>‹</Text>
                <Text>返回分享资料</Text>
              </View>
              <Text className='materials-sheet__title'>{coursePickerTarget === 'filter' ? '筛选课程' : coursePickerTarget === 'edit' ? '修改课程' : '选择课程'}</Text>
              <Text className='materials-sheet__subtitle'>支持课程名称、课程号和课程别名搜索</Text>
              <View className='materials-course-browser__search'>
                <Image src={icons.search} mode='aspectFit' />
                <KeyboardSafeInput
                  value={uploadCourseQuery}
                  onInput={(event) => updateCoursePickerQuery(event.detail.value)}
                  confirmType='search'
                  placeholder='搜索全部课程'
                  onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                />
                {!!uploadCourseQuery && (
                  <View onClick={() => updateCoursePickerQuery('')}>×</View>
                )}
              </View>
              <View className='materials-course-browser__summary'>
                <Text>{uploadCourseQuery.trim() ? '搜索结果' : '全部课程'}</Text>
                <Text>{coursePickerTotal} 门</Text>
              </View>
              <ScrollView
                scrollY
                showScrollbar={false}
                className='materials-course-browser__list'
                onScrollToLower={loadMoreCoursePicker}
              >
                {visibleUploadCourseOptions.map((item) => {
                  const selectedIds = coursePickerSelectedIds(
                    coursePickerTarget,
                    metadata.courseIds,
                    courseId,
                    editCourseIds,
                  )
                  const selected = selectedIds.includes(item.id)
                  return (
                    <View
                      key={`${item.id || 'candidate'}-${item.name}`}
                      className={`materials-course-browser__option ${selected ? 'materials-course-browser__option--active' : ''}`}
                      onClick={() => selectUploadCourseOption(item)}
                    >
                      <View>
                        <Text>{item.name}</Text>
                        <Text>{[item.courseCode, item.educationLevel, item.department].filter(Boolean).join(' · ')}</Text>
                      </View>
                      <Text>{selected ? '移除' : '添加'}</Text>
                    </View>
                  )
                })}
                {!visibleUploadCourseOptions.length && (
                  <View className='materials-course-browser__empty'>
                    <Text>没有找到匹配课程</Text>
                    <Text>返回后仍可直接输入课程名称</Text>
                  </View>
                )}
                {coursePickerLoading && <Text className='materials-loading-more'>正在加载课程…</Text>}
              </ScrollView>
            </View>
          )}

          {sheet === 'detail' && activeMaterial && <View className='materials-sheet__body'>
            <View className={`materials-detail-file material-card__file--${activeMaterial.material_type}`}>{materialKindLabels[activeMaterial.material_type]}</View>
            <Text className='materials-sheet__title'>{activeMaterial.title}</Text>
            <Text className='materials-sheet__subtitle'>{materialCourseLabel(activeMaterial, 999)} · {materialStatusLabels[activeMaterial.status]}</Text>
            {!!activeMaterial.description && <Text className='materials-detail-description'>{activeMaterial.description}</Text>}
            {activeMaterial.source_type === 'cloud_share' && (
              <View className='materials-detail-list'>
                <Text>网盘分享地址会在授权后复制到剪贴板。</Text>
                {activeMaterial.status === 'published' && (
                  <View className='materials-secondary' onClick={() => void copyMaterialDownloadAddress(activeMaterial)}>
                    复制网盘地址和提取码
                  </View>
                )}
              </View>
            )}
            {!!activeMaterial.files.length && <View className='materials-detail-list'>
              {activeMaterial.files.map((file, index) => <View key={file.id} className='materials-detail-file-row'>
                <View><Text>{index + 1}. {file.original_filename}</Text><Text>{formatFileSize(file.size_bytes)} · {file.download_count} 次下载</Text></View>
                {activeMaterial.status === 'published' && <Text onClick={() => void copyMaterialDownloadAddress(activeMaterial, file.id)}>复制地址</Text>}
              </View>)}
            </View>}
            {activeMaterial.rejection_reason && <View className='materials-note'><Text>未通过原因</Text><Text>{activeMaterial.rejection_reason}</Text></View>}
            {viewMode === 'mine' && activeMaterial.status === 'rejected' && <View className='materials-rejected-edit'>
              <Text className='materials-sheet__label'>修改资料名称</Text>
              <KeyboardSafeInput value={editTitle} onInput={(event) => setEditTitle(event.detail.value)} className='materials-input' onKeyboardVisibilityChange={onKeyboardVisibilityChange} />
              <Text className='materials-sheet__label'>修改课程</Text>
              {!editCourseIds.length && <KeyboardSafeInput value={editCourse} onInput={(event) => setEditCourse(event.detail.value)} className='materials-input' placeholder='找不到课程也可直接输入' onKeyboardVisibilityChange={onKeyboardVisibilityChange} />}
              {!!editCourseIds.length && <Text className='materials-upload-notice'>已关联：{apiCourses.filter((item) => editCourseIds.includes(item.id)).map((item) => courseOptionFromRecord(item).label).join('、')}</Text>}
              <View className='materials-secondary' onClick={openEditCoursePicker}>搜索并关联课程</View>
              {!!editCourseIds.length && <Text className='materials-secondary' onClick={() => { setEditCourseIds([]); setEditCourse('') }}>改为候选课程</Text>}
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
      {(adRewardPhase === 'preparing' || adRewardPhase === 'visible' || adRewardPhase === 'claiming') && (
        <MemberAdPopup
          visible={adRewardPhase === 'visible' || adRewardPhase === 'claiming'}
          rewardCount={quota?.ad_reward_count}
          claiming={adRewardPhase === 'claiming'}
          onReady={adRewardController.ready}
          onPresented={() => adRewardController.presented()}
          onClose={adRewardController.close}
          onError={adRewardController.fail}
          onAdTap={() => void adRewardController.tap()}
        />
      )}
    </View>
  )
}
