import { useEffect, useMemo, useState } from 'react'
import Taro, { useDidShow, useReachBottom, useRouter } from '@tarojs/taro'
import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import {
  completeMaterialUploadSession,
  createMaterialUploadSession,
  downloadAndOpenMaterial,
  listAllMaterialCourses,
  listAllMyCourseMaterials,
  listCourseMaterials,
  uploadMaterialFile,
  updateMyCourseMaterial,
  withdrawCourseMaterial,
} from '../../api/course-materials'
import { getCurrentUser } from '../../api/account'
import { createIdempotencyKey } from '../../api/client'
import type {
  CourseMaterialView,
  MaterialCourseView,
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
  materialKindLabels,
  materialKinds,
  MaterialKind,
  MaterialRouteContext,
  MaterialUploadBatch,
  MaterialUploadDraft,
} from '../../features/course-materials/types'
import {
  materialExtension,
  MAX_MATERIAL_FILES,
  MAX_MATERIAL_FILE_SIZE,
  isMaterialUploadSessionReusable,
  mimeTypes,
  resolveMaterialCourse,
  supportedMaterialExtensions,
  validateMaterialDrafts,
} from '../../features/course-materials/validation'
import './index.scss'

const icons = {
  search: require('../../assets/icons/search.svg'),
  materials: require('../../assets/icons/materials.svg'),
}
type Sheet = 'filter' | 'upload' | 'detail' | null
type ViewMode = 'browse' | 'mine'

const decodeRouteValue = (value?: string) => {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const formatFileSize = (size: number) => (
  size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`
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
const createUploadBatch = (): MaterialUploadBatch => ({
  createIdempotencyKey: createIdempotencyKey('material-upload-create'),
  completeIdempotencyKey: createIdempotencyKey('material-upload-complete'),
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
    action: router.params.action === 'upload' ? 'upload' : undefined,
    view: router.params.view === 'mine' ? 'mine' : undefined,
  }), [router.params])
  const [cachedCourseSuggestions] = useState(getRecentCourseSuggestions)
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebouncedValue(keyword, 300)
  const [course, setCourse] = useState(routeContext.courseName || '全部课程')
  const [kind, setKind] = useState<'all' | MaterialKind>('all')
  const [viewMode, setViewMode] = useState<ViewMode>(
    routeContext.view === 'mine' ? 'mine' : 'browse',
  )
  const [sheet, setSheet] = useState<Sheet>(
    routeContext.action === 'upload' ? 'upload' : null,
  )
  const [drafts, setDrafts] = useState<MaterialUploadDraft[]>([])
  const [uploadBatch, setUploadBatch] = useState<MaterialUploadBatch>(createUploadBatch)
  const [draftUserId, setDraftUserId] = useState(0)
  const [draftStorageReady, setDraftStorageReady] = useState(false)
  const [apiCourses, setApiCourses] = useState<MaterialCourseView[]>([])
  const [coursesLoaded, setCoursesLoaded] = useState(false)
  const [materials, setMaterials] = useState<CourseMaterialView[]>([])
  const [myMaterials, setMyMaterials] = useState<CourseMaterialView[]>([])
  const [activeMaterial, setActiveMaterial] = useState<CourseMaterialView | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCourse, setEditCourse] = useState('')
  const [editKind, setEditKind] = useState<MaterialKind>('other')
  const [loading, setLoading] = useState(false)
  const [materialsPage, setMaterialsPage] = useState(1)
  const [materialsTotal, setMaterialsTotal] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [batchCourse, setBatchCourse] = useState(routeContext.courseName || '')
  const [batchKind, setBatchKind] = useState<MaterialKind | ''>('')

  useEffect(() => {
    let active = true
    getCurrentUser()
      .then(async (current) => {
        const userId = current.user.id
        const restored = await materialDraftStorage.read(userId)
        if (!active) return
        setDraftUserId(userId)
        if (restored) {
          setDrafts(restored.drafts)
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
      version: 2,
      drafts,
      batch: uploadBatch,
    })
  }, [draftStorageReady, draftUserId, drafts, uploadBatch])
  useDidShow(() => {
    void listAllMyCourseMaterials().then(setMyMaterials).catch(() => {
      // 页面主体仍可使用，失败状态由空态和后续重试承接。
    })
  })
  useEffect(() => {
    listAllMaterialCourses()
      .then(setApiCourses)
      .catch(() => Taro.showToast({ title: '课程分类加载失败', icon: 'none' }))
      .finally(() => setCoursesLoaded(true))
  }, [])
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
    listCourseMaterials({
      courseId: selectedCourse?.id,
      materialType: kind === 'all' ? undefined : kind,
      keyword: debouncedKeyword,
      periodId: routeContext.periodId || undefined,
      page: 1,
      pageSize: 100,
    })
      .then((page) => {
        if (active) {
          setMaterials(page.items)
          setMaterialsPage(page.page)
          setMaterialsTotal(page.total)
        }
      })
      .catch(() => {
        if (active) Taro.showToast({ title: '资料加载失败，请稍后重试', icon: 'none' })
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
      periodId: routeContext.periodId || undefined,
      page: materialsPage + 1,
      pageSize: 100,
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

  const visibleDrafts = useMemo(() => drafts.filter((draft) => {
    const search = keyword.trim().toLowerCase()
    return (!search || `${draft.title}${draft.courseName}${draft.fileName}`.toLowerCase().includes(search))
      && (course === '全部课程' || draft.courseName === course)
      && (kind === 'all' || draft.kind === kind)
  }), [course, drafts, keyword, kind])
  const visibleMyMaterials = useMemo(() => myMaterials.filter((item) => {
    const search = keyword.trim().toLowerCase()
    const courseName = item.course?.name || item.candidate_course_name || ''
    return (!search || `${item.title}${courseName}${item.original_filename}`.toLowerCase().includes(search))
      && (course === '全部课程' || courseName === course)
      && (kind === 'all' || item.material_type === kind)
  }), [course, keyword, kind, myMaterials])
  const courseOptions = useMemo(() => {
    const names = [
      routeContext.courseName,
      ...apiCourses.map((item) => item.name),
      ...courseSuggestions.map((item) => item.name),
      ...drafts.map((item) => item.courseName),
    ].filter(Boolean) as string[]
    return ['全部课程', ...Array.from(new Set(names))]
  }, [apiCourses, courseSuggestions, drafts, routeContext.courseName])
  const filtersActive = course !== '全部课程' || kind !== 'all'

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
      const selected = result.tempFiles
        .filter((file) => (
          file.size > 0
          && file.size <= MAX_MATERIAL_FILE_SIZE
          && supportedMaterialExtensions.includes(
            materialExtension(file.name) as typeof supportedMaterialExtensions[number],
          )
        ))
        .slice(0, MAX_MATERIAL_FILES)
      if (selected.length < result.tempFiles.length) {
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
      const nextDrafts: MaterialUploadDraft[] = []
      let hasTemporaryFile = false
      try {
        for (let index = 0; index < selected.length; index += 1) {
          const file = selected[index]
          const persisted = await persistMaterialFile(file.path)
          if (!persisted.persistent) hasTemporaryFile = true
          const suggestedCourse = inferCourseSuggestion(file.name, courseSuggestions, fallback)
          const courseRecord = resolveMaterialCourse(apiCourses, {
            name: suggestedCourse?.name,
            courseCode: suggestedCourse?.courseCode || routeContext.courseCode,
          })
          nextDrafts.push({
            id: `material-draft-${Date.now()}-${index}`,
            filePath: persisted.filePath,
            persistentFile: persisted.persistent,
            fileName: file.name,
            fileSize: file.size,
            title: normalizeMaterialTitle(file.name) || file.name,
            kind: inferMaterialKind(file.name),
            courseName: courseRecord?.name || suggestedCourse?.name || '',
            courseId: courseRecord?.id,
            periodId: suggestedCourse?.periodId,
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
      setUploadBatch(createUploadBatch())
      setBatchCourse(fallback?.name || '')
      setBatchKind('')
      setSheet('upload')
      if (hasTemporaryFile) {
        Taro.showToast({ title: '存储空间不足，退出后需重新选择部分文件', icon: 'none' })
      }
    } catch (error) {
      if (error instanceof Error) {
        Taro.showToast({ title: error.message, icon: 'none' })
      }
    }
  }

  const resetDraftUpload = (draft: MaterialUploadDraft): MaterialUploadDraft => ({
    ...draft,
    status: draft.filePath ? 'draft' : 'needs_file',
    progress: 0,
    uploadTarget: undefined,
    materialId: undefined,
    errorMessage: draft.filePath ? undefined : draft.errorMessage,
  })
  const editDraft = (id: string, patch: Partial<MaterialUploadDraft>) => {
    if (uploading) return
    setDrafts((current) => current.map((draft) => (
      resetDraftUpload(draft.id === id ? { ...draft, ...patch } : draft)
    )))
    setUploadBatch(createUploadBatch())
  }
  const removeDraft = (id: string) => {
    if (uploading) return
    const removed = drafts.find((draft) => draft.id === id)
    if (removed) void removePersistedMaterialFiles([removed])
    setDrafts((current) => current.filter((draft) => draft.id !== id).map(resetDraftUpload))
    setUploadBatch(createUploadBatch())
  }
  const applyCourseToAll = () => {
    if (uploading) return
    const value = batchCourse.trim()
    if (!value) {
      Taro.showToast({ title: '请先填写课程名称', icon: 'none' })
      return
    }
    const resolved = resolveMaterialCourse(apiCourses, { name: value })
    setDrafts((current) => current.map((draft) => resetDraftUpload({
      ...draft,
      courseName: resolved?.name || value,
      courseId: resolved?.id,
      periodId: value === routeContext.courseName ? routeContext.periodId : undefined,
    })))
    setUploadBatch(createUploadBatch())
  }
  const applyKindToAll = (value: MaterialKind) => {
    if (uploading) return
    setBatchKind(value)
    setDrafts((current) => current.map((draft) => resetDraftUpload({
      ...draft,
      kind: value,
    })))
    setUploadBatch(createUploadBatch())
  }
  const submitDrafts = async () => {
    const validationError = validateMaterialDrafts(drafts)
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
          version: 2,
          drafts: nextDrafts,
          batch: nextBatch,
        })
      }
    }
    let workingDrafts = drafts.map((draft) => ({ ...draft }))
    let workingBatch = { ...uploadBatch }
    try {
      const sessionReusable = isMaterialUploadSessionReusable(
        workingBatch,
        workingDrafts,
      )
      if (workingBatch.sessionId && !sessionReusable) {
        workingDrafts = workingDrafts.map(resetDraftUpload)
        workingBatch = createUploadBatch()
      }
      const files = workingDrafts.map<MaterialUploadFileInput>((draft) => {
        const extension = materialExtension(draft.fileName)
        const mimeType = mimeTypes[extension]
        if (!mimeType) throw new Error(`${draft.fileName} 的文件类型暂不支持`)
        const courseRecord = resolveMaterialCourse(apiCourses, {
          id: draft.courseId,
          name: draft.courseName,
        })
        return {
          filename: draft.fileName,
          title: draft.title.trim(),
          material_type: draft.kind,
          mime_type: mimeType,
          size_bytes: draft.fileSize,
          course_id: courseRecord?.id,
          candidate_course_name: courseRecord ? undefined : draft.courseName.trim(),
          period_id: draft.periodId || undefined,
        }
      })
      if (!workingBatch.sessionId) {
        persistState(workingDrafts, workingBatch)
        const session = await createMaterialUploadSession(
          files,
          workingBatch.createIdempotencyKey,
        )
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
          materialId: session.uploads[index].material_id,
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
          const message = error instanceof Error ? error.message : '文件上传失败'
          workingDrafts[index] = {
            ...workingDrafts[index],
            status: 'failed',
            errorMessage: message,
          }
          persistState([...workingDrafts], workingBatch)
          throw error
        }
      }
      if (!workingBatch.sessionId || workingBatch.sessionVersion === undefined) {
        throw new Error('上传会话无效，请重新上传')
      }
      const completedFiles = workingDrafts.map((draft) => {
        if (!draft.materialId) throw new Error('上传任务无效，请重新上传')
        return { material_id: draft.materialId }
      })
      const completed = await completeMaterialUploadSession(
        workingBatch.sessionId,
        workingBatch.sessionVersion,
        completedFiles,
        workingBatch.completeIdempotencyKey,
      )
      await removePersistedMaterialFiles(workingDrafts)
      setDrafts([])
      setUploadBatch(createUploadBatch())
      materialDraftStorage.clear(draftUserId)
      setMyMaterials((current) => [
        ...(completed.materials || []),
        ...current.filter((item) => (
          !(completed.materials || []).some((created) => created.id === item.id)
        )),
      ])
      setViewMode('mine')
      setSheet(null)
      Taro.showToast({ title: '已提交安全检查', icon: 'success' })
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传失败，请重试'
      Taro.showToast({ title: message, icon: 'none' })
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
  const openMaterialDetail = (material: CourseMaterialView) => {
    setActiveMaterial(material)
    setEditTitle(material.title)
    setEditCourse(material.course?.name || material.candidate_course_name || '')
    setEditKind(material.material_type)
    setSheet('detail')
  }
  const saveRejectedMaterial = async () => {
    if (!activeMaterial || !editTitle.trim() || !editCourse.trim()) {
      Taro.showToast({ title: '请补全标题和课程', icon: 'none' })
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
  const closeSheet = () => {
    if (!uploading) setSheet(null)
  }

  return (
    <View className={`materials-page ${sheet ? 'materials-page--locked' : ''}`}>
      <CustomNavbar title='课程资料' subtitle='中国海洋大学' showBack />
      <View className='materials-page__content'>
        <View className='materials-view-tabs'>
          <View className={viewMode === 'browse' ? 'materials-view-tabs__active' : ''} onClick={() => setViewMode('browse')}>资料库</View>
          <View className={viewMode === 'mine' ? 'materials-view-tabs__active' : ''} onClick={() => setViewMode('mine')}>我的资料{drafts.length ? <Text>{drafts.length}</Text> : null}</View>
        </View>
        <View className='materials-search'>
          <Image src={icons.search} mode='aspectFit' />
          <Input value={keyword} onInput={(event) => setKeyword(event.detail.value)} confirmType='search' placeholder='搜索课程、资料名称或文件' placeholderClass='materials-search__placeholder' />
          {!!keyword && <Text onClick={() => setKeyword('')}>×</Text>}
        </View>
        <View className='materials-hero'>
          <View>
            <Text className='materials-hero__eyebrow'>{routeContext.courseName ? '已从课程进入' : '海大同学资料库'}</Text>
            <Text className='materials-hero__title'>{routeContext.courseName || '把好资料，传给下一位同学'}</Text>
            <Text className='materials-hero__copy'>{routeContext.courseName ? '课程已自动填写，选择文件即可分享' : '从微信聊天选择文件，标题和类型会自动补全'}</Text>
          </View>
          <Image src={icons.materials} mode='aspectFit' />
        </View>
        <View className='materials-actions'>
          <View className={`materials-filter-button ${filtersActive ? 'materials-filter-button--active' : ''}`} onClick={() => setSheet('filter')}><Text>筛选</Text>{filtersActive && <View />}</View>
          <ScrollView scrollX showScrollbar={false} className='materials-course-scroll'>
            <View className='materials-course-list'>{courseOptions.slice(0, 4).map((item) => <View key={item} className={`materials-course-chip ${course === item ? 'materials-course-chip--active' : ''}`} onClick={() => setCourse(item)}>{item}</View>)}</View>
          </ScrollView>
          <View className='materials-upload-button' onClick={openUpload}>分享资料</View>
        </View>

        {viewMode === 'browse' ? (
          <>
            <View className='materials-heading'><View><Text>课程资料</Text><Text>仅展示已审核发布的内容</Text></View><Text>{materials.length} 份</Text></View>
            {loading && !materials.length ? <View className='materials-empty'><View /><Text>正在加载资料</Text><Text>请稍候</Text></View> : <View className='materials-list'>
              {materials.map((item) => <View key={item.id} className='material-card' hoverClass='material-card--pressed' onClick={() => openMaterialDetail(item)}>
                <View className={`material-card__file material-card__file--${item.material_type}`}><Text>{materialKindLabels[item.material_type]}</Text></View>
                <View className='material-card__main'>
                  <Text className='material-card__title'>{item.title}</Text>
                  <Text className='material-card__course'>{item.course?.name || item.candidate_course_name || '课程待确认'} · {formatFileSize(item.size_bytes)}</Text>
                  <Text className='material-card__status'>{item.download_count} 次下载 · {item.original_filename}</Text>
                </View>
                <Text className='material-card__arrow'>›</Text>
              </View>)}
            </View>}
            {loading && !!materials.length && <Text className='materials-loading-more'>正在加载更多…</Text>}
            {!loading && !materials.length && <View className='materials-empty'><View /><Text>{unresolvedCourse ? '该课程尚未归入课程目录' : '没有找到相关资料'}</Text><Text>{unresolvedCourse ? '仍可直接分享，审核时会完成课程归类' : '试试更换课程、类型或关键词'}</Text></View>}
          </>
        ) : (
          <>
            <View className='materials-heading'><View><Text>我的上传</Text><Text>查看草稿、安全检查和审核进度</Text></View><Text>{visibleDrafts.length + visibleMyMaterials.length} 份</Text></View>
            <View className='materials-list'>
              {visibleDrafts.map((draft) => {
                const status = draftStatusMeta[draft.status]
                return (
                  <View key={draft.id} className='material-card'>
                    <View className={`material-card__file material-card__file--${draft.kind}`}><Text>{materialKindLabels[draft.kind]}</Text></View>
                    <View className='material-card__main'>
                      <Text className='material-card__title'>{draft.title}</Text>
                      <Text className='material-card__course'>{draft.courseName || '课程待确认'} · {formatFileSize(draft.fileSize)}</Text>
                      <Text className={`material-card__status material-card__status--${status.className}`}>{status.label}{draft.errorMessage ? ` · ${draft.errorMessage}` : ''}</Text>
                    </View>
                    <Text className='material-card__arrow' onClick={() => setSheet('upload')}>›</Text>
                  </View>
                )
              })}
              {visibleMyMaterials.map((item) => <View key={item.id} className='material-card' hoverClass='material-card--pressed' onClick={() => openMaterialDetail(item)}>
                <View className={`material-card__file material-card__file--${item.material_type}`}><Text>{materialKindLabels[item.material_type]}</Text></View>
                <View className='material-card__main'>
                  <Text className='material-card__title'>{item.title}</Text>
                  <Text className='material-card__course'>{item.course?.name || item.candidate_course_name || '课程待确认'} · {formatFileSize(item.size_bytes)}</Text>
                  <Text className={`material-card__status material-card__status--${item.status}`}>{materialStatusLabels[item.status]}{item.rejection_reason ? ` · ${item.rejection_reason}` : ''}</Text>
                </View>
                <Text className='material-card__arrow'>›</Text>
              </View>)}
            </View>
            {!visibleDrafts.length && !visibleMyMaterials.length && <View className='materials-empty'><View /><Text>还没有上传记录</Text><Text>从微信聊天选择一份资料开始分享</Text></View>}
          </>
        )}
      </View>

      {sheet && <View className='materials-overlay' onClick={closeSheet}>
        <View className={`materials-sheet materials-sheet--${sheet}`} onClick={(event) => event.stopPropagation()}>
          <View className='materials-sheet__handle' />
          <View className='materials-sheet__close' onClick={closeSheet}>×</View>
          {sheet === 'filter' && <View className='materials-sheet__body'>
            <Text className='materials-sheet__title'>筛选资料</Text>
            <Text className='materials-sheet__label'>课程</Text>
            <View className='materials-option-grid'>{courseOptions.map((item) => <View key={item} className={course === item ? 'materials-option--active' : ''} onClick={() => setCourse(item)}>{item}</View>)}</View>
            <Text className='materials-sheet__label'>资料类型</Text>
            <View className='materials-option-grid'>
              <View className={kind === 'all' ? 'materials-option--active' : ''} onClick={() => setKind('all')}>全部类型</View>
              {materialKinds.map((item) => <View key={item} className={kind === item ? 'materials-option--active' : ''} onClick={() => setKind(item)}>{materialKindLabels[item]}</View>)}
            </View>
            <View className='materials-primary' onClick={() => setSheet(null)}>查看资料</View>
            <View className='materials-secondary' onClick={() => { setCourse('全部课程'); setKind('all') }}>清除筛选</View>
          </View>}
          {sheet === 'upload' && <View className='materials-sheet__body'>
            <Text className='materials-sheet__title'>确认智能补全</Text>
            <Text className='materials-sheet__subtitle'>支持 PDF、Word、PPT，单次最多 5 个文件</Text>
            {!drafts.length ? (
              <View className='materials-file-empty' onClick={chooseFiles}><Text>从微信聊天选择文件</Text><Text>标题、类型和课程将自动识别</Text></View>
            ) : <>
              <View className='materials-batch'>
                <Text className='materials-sheet__label'>批量设置课程</Text>
                <View className='materials-batch__row'>
                  <Input disabled={uploading} value={batchCourse} onInput={(event) => setBatchCourse(event.detail.value)} className='materials-input' placeholder='可直接输入待确认课程' placeholderClass='materials-input__placeholder' />
                  <View onClick={applyCourseToAll}>应用全部</View>
                </View>
                <ScrollView scrollX showScrollbar={false}>
                  <View className='materials-inline-options'>{courseOptions.slice(1).map((item) => <View key={item} onClick={() => setBatchCourse(item)}>{item}</View>)}</View>
                </ScrollView>
                <Text className='materials-sheet__label'>批量设置类型</Text>
                <ScrollView scrollX showScrollbar={false}>
                  <View className='materials-inline-options'>{materialKinds.map((item) => <View key={item} className={batchKind === item ? 'materials-option--active' : ''} onClick={() => applyKindToAll(item)}>{materialKindLabels[item]}</View>)}</View>
                </ScrollView>
              </View>
              <View className='materials-draft-list'>
                {drafts.map((draft, index) => <View key={draft.id} className='materials-draft'>
                  <View className='materials-draft__heading'><Text>{index + 1}. {draft.fileName}</Text>{!uploading && <Text onClick={() => removeDraft(draft.id)}>移除</Text>}</View>
                  <Text className='materials-draft__meta'>{formatFileSize(draft.fileSize)}</Text>
                  <Text className='materials-sheet__label'>标题</Text>
                  <Input disabled={uploading} value={draft.title} onInput={(event) => editDraft(draft.id, { title: event.detail.value })} className='materials-input' placeholder='资料标题' />
                  <Text className='materials-sheet__label'>课程</Text>
                  <Input disabled={uploading} value={draft.courseName} onInput={(event) => editDraft(draft.id, { courseName: event.detail.value, courseId: undefined, periodId: undefined })} className='materials-input' placeholder='找不到课程也可直接输入' />
                  <Text className='materials-sheet__label'>类型</Text>
                  <ScrollView scrollX showScrollbar={false}>
                    <View className='materials-inline-options'>{materialKinds.map((item) => <View key={item} className={draft.kind === item ? 'materials-option--active' : ''} onClick={() => editDraft(draft.id, { kind: item })}>{materialKindLabels[item]}</View>)}</View>
                  </ScrollView>
                  {draft.status === 'uploading' && <View className='materials-progress'><View style={{ width: `${draft.progress}%` }} /></View>}
                  {draft.errorMessage && <Text className='materials-draft__error'>{draft.errorMessage}</Text>}
                </View>)}
              </View>
              {!uploading && <View className='materials-file-add' onClick={chooseFiles}>重新选择文件</View>}
              <View className={`materials-primary ${uploading ? 'materials-primary--disabled' : ''}`} onClick={submitDrafts}>{uploading ? '正在上传…' : drafts.some((draft) => draft.status === 'failed') ? '重试上传' : '上传并自动提交审核'}</View>
              <Text className='materials-upload-notice'>上传即表示确认资料不包含隐私、侵权或违规内容</Text>
            </>}
          </View>}
          {sheet === 'detail' && activeMaterial && <View className='materials-sheet__body'>
            <View className={`materials-detail-file material-card__file--${activeMaterial.material_type}`}>{materialKindLabels[activeMaterial.material_type]}</View>
            <Text className='materials-sheet__title'>{activeMaterial.title}</Text>
            <Text className='materials-sheet__subtitle'>{activeMaterial.course?.name || activeMaterial.candidate_course_name || '课程待确认'} · {materialStatusLabels[activeMaterial.status]}</Text>
            <View className='materials-detail-list'>
              <View><Text>文件名称</Text><Text>{activeMaterial.original_filename}</Text></View>
              <View><Text>文件大小</Text><Text>{formatFileSize(activeMaterial.size_bytes)}</Text></View>
              <View><Text>资料类型</Text><Text>{materialKindLabels[activeMaterial.material_type]}</Text></View>
              <View><Text>下载次数</Text><Text>{activeMaterial.download_count} 次</Text></View>
            </View>
            {activeMaterial.rejection_reason && <View className='materials-note'><Text>未通过原因</Text><Text>{activeMaterial.rejection_reason}</Text></View>}
            {activeMaterial.scan_message && <View className='materials-note'><Text>安全检查</Text><Text>{activeMaterial.scan_message}</Text></View>}
            {viewMode === 'mine' && activeMaterial.status === 'rejected' && <View className='materials-rejected-edit'>
              <Text className='materials-sheet__label'>修改标题</Text>
              <Input value={editTitle} onInput={(event) => setEditTitle(event.detail.value)} className='materials-input' />
              <Text className='materials-sheet__label'>修改课程</Text>
              <Input value={editCourse} onInput={(event) => setEditCourse(event.detail.value)} className='materials-input' placeholder='找不到课程也可直接输入' />
              <Text className='materials-sheet__label'>修改类型</Text>
              <ScrollView scrollX showScrollbar={false}>
                <View className='materials-inline-options'>{materialKinds.map((item) => <View key={item} className={editKind === item ? 'materials-option--active' : ''} onClick={() => setEditKind(item)}>{materialKindLabels[item]}</View>)}</View>
              </ScrollView>
              <View className='materials-primary' onClick={saveRejectedMaterial}>保存并重新提交</View>
            </View>}
            {activeMaterial.status === 'published' && <View className='materials-primary' onClick={() => downloadAndOpenMaterial(activeMaterial.id).catch(() => Taro.showToast({ title: '资料下载失败', icon: 'none' }))}>下载并打开</View>}
            {viewMode === 'mine' && ['scanning', 'pending_review', 'published', 'rejected'].includes(activeMaterial.status) && <View className='materials-secondary materials-secondary--danger' onClick={() => withdrawMaterial(activeMaterial)}>撤回资料</View>}
            {activeMaterial.status !== 'published' && <Text className='materials-upload-notice'>资料发布前不会向其他同学展示下载入口</Text>}
          </View>}
        </View>
      </View>}
    </View>
  )
}
