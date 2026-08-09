import { useEffect, useMemo, useRef, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Picker, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import {
  KeyboardSafeInput,
  KeyboardSafeTextarea,
  useKeyboardInset,
} from '../../components/keyboard-safe-input'
import { isApiError } from '../../api/client'
import type {
  CarpoolTripView,
  CampusCircleSectionView,
  CampusCircleTopicView,
  ErrandView,
  MarketplaceListingView,
} from '../../api/types'
import {
  consumeMarketplacePublishPrefill,
  type MarketplaceIntent,
  type MarketplaceSource,
} from '../../features/life-services/marketplace-prefill'
import { lifeServicesRepository } from '../../features/life-services/repository'
import { requestWechatSubscriptionForPublishSection } from '../../features/wechat-subscription'
import './index.scss'

type PublishSection = 'community' | 'errands' | 'market' | 'carpool'
type PublishMode = 'create' | 'edit' | 'resubmit'

type PublisherForm = {
  content: string
  marketIntent: MarketplaceIntent
  marketCategory: 'general' | 'course_material'
  courseName: string
  courseCode: string
  academicPeriodId: string
  academicPeriodLabel: string
  marketSource: MarketplaceSource
  pickupLocation: string
  dropoffLocation: string
  rewardYuan: string
  deadlineDate: string
  deadlineTime: string
  priceYuan: string
  origin: string
  destination: string
  departureDate: string
  departureTime: string
  totalSeats: string
  contactType: 'wechat' | 'phone' | 'qq'
  contact: string
  imageUrls: string[]
  communitySectionId: number
  communityTopicId: number
  version: number
}

const DRAFT_KEY = 'lifePublisher.drafts.v3'
const CONTACT_LABELS = ['微信', '手机号', 'QQ']
const CONTACT_VALUES: PublisherForm['contactType'][] = ['wechat', 'phone', 'qq']

const sectionOptions: Array<{
  key: PublishSection
  label: string
  title: string
}> = [
  { key: 'community', label: '动态', title: '分享校园动态' },
  { key: 'errands', label: '跑腿', title: '发布跑腿需求' },
  { key: 'market', label: '二手', title: '发布二手交易' },
  { key: 'carpool', label: '拼车', title: '发布拼车行程' },
]

const isSection = (value?: string): value is PublishSection => (
  sectionOptions.some((item) => item.key === value)
)

const tomorrow = () => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const emptyForm = (marketIntent: MarketplaceIntent = 'sell'): PublisherForm => ({
  content: '',
  marketIntent,
  marketCategory: 'general',
  courseName: '',
  courseCode: '',
  academicPeriodId: '',
  academicPeriodLabel: '',
  marketSource: 'manual',
  pickupLocation: '',
  dropoffLocation: '',
  rewardYuan: '',
  deadlineDate: tomorrow(),
  deadlineTime: '18:00',
  priceYuan: '',
  origin: '',
  destination: '',
  departureDate: tomorrow(),
  departureTime: '09:00',
  totalSeats: '2',
  contactType: 'wechat',
  contact: '',
  imageUrls: [],
  communitySectionId: 0,
  communityTopicId: 0,
  version: 0,
})

const flattenSections = (items: CampusCircleSectionView[]): CampusCircleSectionView[] => (
  items.flatMap((item) => [item, ...flattenSections(item.children || [])])
)

const storedDrafts = () => (
  Taro.getStorageSync<Partial<Record<string, PublisherForm>>>(DRAFT_KEY) || {}
)

const draftKey = (section: PublishSection, intent: MarketplaceIntent = 'sell') => (
  section === 'market' ? `${section}:${intent}` : section
)

const saveDraft = (section: PublishSection, form: PublisherForm) => {
  Taro.setStorageSync(DRAFT_KEY, {
    ...storedDrafts(),
    [draftKey(section, form.marketIntent)]: form,
  })
}

const clearDraft = (section: PublishSection, form: PublisherForm) => {
  const drafts = storedDrafts()
  delete drafts[draftKey(section, form.marketIntent)]
  if (Object.keys(drafts).length > 0) {
    Taro.setStorageSync(DRAFT_KEY, drafts)
  } else {
    Taro.removeStorageSync(DRAFT_KEY)
  }
}

const toCents = (value: string) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

const toIso = (date: string, time: string) => {
  const result = new Date(`${date}T${time}:00`)
  return Number.isNaN(result.getTime()) ? '' : result.toISOString()
}

const yuanValue = (cents: number) => {
  const value = cents / 100
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

const InputField = ({
  label,
  value,
  placeholder,
  maxlength = 100,
  type = 'text',
  suffix,
  inputId,
  onKeyboardVisibilityChange,
  onInput,
}: {
  label: string
  value: string
  placeholder: string
  maxlength?: number
  type?: 'text' | 'number' | 'digit'
  suffix?: string
  inputId?: string
  onKeyboardVisibilityChange: (height: number) => void
  onInput: (value: string) => void
}) => (
  <View className='publisher-field'>
    <Text className='publisher-field__label'>{label}</Text>
    <View className='publisher-input'>
      <KeyboardSafeInput
        id={inputId}
        value={value}
        type={type}
        maxlength={maxlength}
        placeholder={placeholder}
        placeholderClass='publisher-placeholder'
        onKeyboardVisibilityChange={onKeyboardVisibilityChange}
        onInput={(event) => onInput(event.detail.value)}
      />
      {suffix && <Text>{suffix}</Text>}
    </View>
  </View>
)

const SectionHeading = ({
  title,
}: {
  title: string
}) => (
  <View className='publisher-section__head'>
    <Text className='publisher-section__title'>{title}</Text>
  </View>
)

export default function PublishPage() {
  const [section, setSection] = useState<PublishSection>('community')
  const [mode, setMode] = useState<PublishMode>('create')
  const [resourceId, setResourceId] = useState(0)
  const [form, setForm] = useState<PublisherForm>(emptyForm)
  const [sections, setSections] = useState<CampusCircleSectionView[]>([])
  const [sectionsReady, setSectionsReady] = useState(false)
  const [topics, setTopics] = useState<CampusCircleTopicView[]>([])
  const [requestedCommunitySectionId, setRequestedCommunitySectionId] = useState(0)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const skipNextDraftSave = useRef(false)
  const {
    keyboardHeight,
    onKeyboardVisibilityChange,
  } = useKeyboardInset()
  const current = sectionOptions.find((item) => item.key === section) || sectionOptions[0]
  const hasDraftContent = useMemo(() => (
    [
      form.content,
      form.courseName,
      form.courseCode,
      form.pickupLocation,
      form.dropoffLocation,
      form.rewardYuan,
      form.priceYuan,
      form.origin,
      form.destination,
      form.contact,
    ].some((value) => value.trim().length > 0) || form.imageUrls.length > 0
  ), [form])

  const update = <K extends keyof PublisherForm>(key: K, value: PublisherForm[K]) => {
    setForm((draft) => ({ ...draft, [key]: value }))
  }

  const mapErrand = (item: ErrandView): PublisherForm => ({
    ...emptyForm(),
    content: item.description,
    pickupLocation: item.pickup_location,
    dropoffLocation: item.dropoff_location,
    rewardYuan: yuanValue(item.reward_cents),
    deadlineDate: item.deadline.slice(0, 10),
    deadlineTime: item.deadline.slice(11, 16),
    contactType: (item.contact_type || 'wechat') as PublisherForm['contactType'],
    contact: item.contact.includes('*') ? '' : item.contact,
    version: item.version,
  })

  const mapMarketplace = (item: MarketplaceListingView): PublisherForm => ({
    ...emptyForm(item.intent),
    content: item.description,
    marketIntent: item.intent,
    marketCategory: item.category,
    courseName: item.course_name || '',
    courseCode: item.course_code || '',
    academicPeriodId: item.academic_period_id || '',
    academicPeriodLabel: item.academic_period_label || '',
    marketSource: item.source,
    priceYuan: yuanValue(item.price_cents),
    contactType: (item.contact_type || 'wechat') as PublisherForm['contactType'],
    contact: item.contact.includes('*') ? '' : item.contact,
    imageUrls: [...item.image_urls],
    version: item.version,
  })

  const mapCarpool = (item: CarpoolTripView): PublisherForm => ({
    ...emptyForm(),
    content: item.description || '',
    origin: item.origin,
    destination: item.destination,
    departureDate: item.departure_at.slice(0, 10),
    departureTime: item.departure_at.slice(11, 16),
    totalSeats: String(item.total_seats),
    contactType: (item.contact_type || 'wechat') as PublisherForm['contactType'],
    contact: item.contact.includes('*') ? '' : item.contact,
    version: item.version,
  })

  const loadEdit = async (targetSection: PublishSection, id: number) => {
    setLoadingEdit(true)
    try {
      if (targetSection === 'errands') {
        setForm(mapErrand(await lifeServicesRepository.getErrand(id)))
      } else if (targetSection === 'market') {
        setForm(mapMarketplace(await lifeServicesRepository.getMarketplaceListing(id)))
      } else if (targetSection === 'carpool') {
        setForm(mapCarpool(await lifeServicesRepository.getCarpoolTrip(id)))
      } else {
        const post = await lifeServicesRepository.getCampusCirclePost(id)
        setForm({
          ...emptyForm(),
          content: post.content || '',
          imageUrls: post.images.map((image) => image.url),
          communitySectionId: post.section_id,
          communityTopicId: post.topic?.id || 0,
          version: post.version,
        })
      }
    } catch (error) {
      if (isApiError(error) && error.code === 'academic_verification_required') return
      Taro.showToast({
        title: isApiError(error) ? error.message : '原内容加载失败',
        icon: 'none',
      })
    } finally {
      setLoadingEdit(false)
    }
  }

  useLoad((options) => {
    const initialSection = isSection(options.section) ? options.section : 'community'
    const initialIntent: MarketplaceIntent = options.intent === 'wanted' ? 'wanted' : 'sell'
    const initialMode: PublishMode = options.mode === 'edit'
      ? 'edit'
      : options.mode === 'resubmit'
        ? 'resubmit'
        : 'create'
    const initialId = Number(options.id || 0)
    const initialCommunitySectionId = Number(options.community_section_id || 0)
    setSection(initialSection)
    setMode(initialMode)
    setResourceId(initialId)
    setRequestedCommunitySectionId(
      Number.isFinite(initialCommunitySectionId) && initialCommunitySectionId > 0
        ? initialCommunitySectionId
        : 0,
    )
    if (initialMode !== 'create' && initialId > 0) {
      void loadEdit(initialSection, initialId)
    } else {
      const initialForm = storedDrafts()[draftKey(initialSection, initialIntent)]
        || emptyForm(initialIntent)
      const prefill = initialSection === 'market' && options.course_prefill === '1'
        ? consumeMarketplacePublishPrefill()
        : null
      const nextForm = prefill ? {
        ...initialForm,
        marketIntent: prefill.intent,
        content: prefill.description,
        marketCategory: 'course_material' as const,
        courseName: prefill.courseName,
        courseCode: prefill.courseCode,
        academicPeriodId: prefill.academicPeriodId,
        academicPeriodLabel: prefill.academicPeriodLabel,
        marketSource: prefill.source,
      } : initialForm
      setForm(
        initialSection === 'community' && initialCommunitySectionId > 0
          ? { ...nextForm, communitySectionId: initialCommunitySectionId }
          : nextForm,
      )
    }
    void lifeServicesRepository.listCampusCircleSections()
      .then((result) => setSections(result.items))
      .catch(() => setSections([]))
      .finally(() => setSectionsReady(true))
    void lifeServicesRepository.listCampusCircleTopics({ pageSize: 50 })
      .then((result) => setTopics(result.items.filter((item) => item.status === 'active')))
      .catch(() => setTopics([]))
  })

  const communitySectionOptions = useMemo(
    () => flattenSections(sections).filter((item) => item.status === 'active'),
    [sections],
  )

  useEffect(() => {
    if (section !== 'community' || mode !== 'create' || !sectionsReady) return

    const requested = communitySectionOptions.find(
      (item) => item.id === requestedCommunitySectionId,
    )
    if (requested) {
      if (form.communitySectionId !== requested.id) {
        update('communitySectionId', requested.id)
      }
      setRequestedCommunitySectionId(0)
      return
    }
    if (communitySectionOptions.some((item) => item.id === form.communitySectionId)) return
    update('communitySectionId', communitySectionOptions[0]?.id || 0)
  }, [
    communitySectionOptions,
    form.communitySectionId,
    mode,
    requestedCommunitySectionId,
    section,
    sectionsReady,
  ])

  useEffect(() => {
    if (mode !== 'create' || loadingEdit) return
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false
      return
    }
    const timer = setTimeout(() => saveDraft(section, form), 350)
    return () => clearTimeout(timer)
  }, [form, loadingEdit, mode, section])

  const selectSection = (next: PublishSection) => {
    if (mode !== 'create' || next === section) return
    requestWechatSubscriptionForPublishSection(next)
    saveDraft(section, form)
    setSection(next)
    setForm(storedDrafts()[draftKey(next)] || emptyForm())
  }

  const selectMarketIntent = (intent: MarketplaceIntent) => {
    if (form.marketIntent === intent) return
    if (mode === 'create') {
      saveDraft(section, form)
      setForm(storedDrafts()[draftKey('market', intent)] || emptyForm(intent))
      return
    }
    update('marketIntent', intent)
  }

  const clearCurrentDraft = async () => {
    if (mode !== 'create' || !hasDraftContent) return
    const result = await Taro.showModal({
      title: '清空当前草稿',
      content: section === 'market'
        ? `将清空当前“${form.marketIntent === 'wanted' ? '求购' : '出售'}”草稿，其他发布草稿不受影响。`
        : '将清空当前发布草稿，其他类型的草稿不受影响。',
      confirmText: '清空',
      confirmColor: '#d87567',
    })
    if (!result.confirm) return
    skipNextDraftSave.current = true
    clearDraft(section, form)
    setForm(emptyForm(form.marketIntent))
    Taro.showToast({ title: '草稿已清空', icon: 'success' })
  }

  const removeCourseContext = () => {
    setForm((currentForm) => ({
      ...currentForm,
      marketCategory: 'general',
      courseName: '',
      courseCode: '',
      academicPeriodId: '',
      academicPeriodLabel: '',
      marketSource: 'manual',
    }))
  }

  const validationError = useMemo(() => {
    if (section === 'community') {
      if (!form.content.trim() && form.imageUrls.length === 0) return '请填写动态内容或添加图片'
      if (!sectionsReady) return '社区板块正在加载'
      if (!communitySectionOptions.some((item) => item.id === form.communitySectionId)) {
        return '请选择服务端启用的社区板块'
      }
      return ''
    }
    if (!form.content.trim() && section !== 'carpool') return '请补充详细说明'
    if (section === 'errands') {
      if (!form.pickupLocation.trim() || !form.dropoffLocation.trim()) return '请填写取件地和送达地'
      if (toCents(form.rewardYuan) <= 0) return '跑腿报酬必须大于 0 元'
      if (!toIso(form.deadlineDate, form.deadlineTime)) return '请选择有效截止时间'
    }
    if (section === 'market') {
      if (toCents(form.priceYuan) <= 0) {
        return form.marketIntent === 'wanted' ? '求购预算必须大于 0 元' : '商品价格必须大于 0 元'
      }
    }
    if (section === 'carpool') {
      if (!form.origin.trim() || !form.destination.trim()) return '请填写出发地和目的地'
      const seats = Number(form.totalSeats)
      if (!Number.isInteger(seats) || seats < 1 || seats > 20) return '座位数必须为 1–20'
      if (!toIso(form.departureDate, form.departureTime)) return '请选择有效出发时间'
    }
    if (!form.contact.trim()) return '请填写联系方式'
    return ''
  }, [communitySectionOptions, form, section, sectionsReady])

  const navigateAfterSubmit = async (id: number) => {
    clearDraft(section, form)
    Taro.showToast({ title: '已提交审核', icon: 'success' })
    await new Promise((resolve) => setTimeout(resolve, 450))
    if (section === 'errands') {
      await Taro.redirectTo({ url: `/pages/errands/detail?id=${id}` })
    } else if (section === 'market') {
      await Taro.redirectTo({ url: `/pages/marketplace/detail?id=${id}` })
    } else if (section === 'carpool') {
      await Taro.redirectTo({ url: `/pages/carpool/detail?id=${id}` })
    } else {
      Taro.setStorageSync('campus.lifeHub.section.v1', 'community')
      await Taro.switchTab({ url: '/pages/community/index' })
    }
  }

  const submit = async () => {
    if (validationError) {
      Taro.showToast({ title: validationError, icon: 'none' })
      return
    }
    if (submitting) return
    requestWechatSubscriptionForPublishSection(section)
    setSubmitting(true)
    try {
      let id = resourceId
      if (section === 'community') {
        const sectionId = form.communitySectionId
        if (!sectionId) throw new Error('服务端尚未提供可发布的社区板块')
        const input = {
          section_id: sectionId,
          content: form.content.trim() || undefined,
          image_urls: form.imageUrls,
          topic_id: form.communityTopicId || undefined,
        }
        if (mode === 'create') {
          id = (await lifeServicesRepository.createCampusCirclePost(input)).id
        } else {
          id = (await lifeServicesRepository.updateCampusCirclePost(resourceId, {
            ...input,
            expected_version: form.version,
          })).id
        }
      } else if (section === 'errands') {
        const input = {
          description: form.content.trim(),
          reward_cents: toCents(form.rewardYuan),
          pickup_location: form.pickupLocation.trim(),
          dropoff_location: form.dropoffLocation.trim(),
          deadline: toIso(form.deadlineDate, form.deadlineTime),
          contact_type: form.contactType,
          contact: form.contact.trim(),
        }
        if (mode === 'create') {
          id = (await lifeServicesRepository.createErrand(input)).id
        } else {
          const updated = await lifeServicesRepository.updateErrand(resourceId, {
            ...input,
            expected_version: form.version,
          })
          id = updated.id
          if (updated.available_actions.includes('submit_review')) {
            await lifeServicesRepository.submitErrandReview(updated.id, updated.version)
          }
        }
      } else if (section === 'market') {
        const input = {
          intent: form.marketIntent,
          description: form.content.trim(),
          price_cents: toCents(form.priceYuan),
          category: form.marketCategory,
          course_name: form.courseName.trim() || undefined,
          course_code: form.courseCode.trim() || undefined,
          academic_period_id: form.academicPeriodId.trim() || undefined,
          academic_period_label: form.academicPeriodLabel.trim() || undefined,
          source: form.marketSource,
          contact_type: form.contactType,
          contact: form.contact.trim(),
          image_urls: form.imageUrls,
        }
        if (mode === 'create') {
          const created = await lifeServicesRepository.createMarketplaceListing(input)
          id = created.id
          await lifeServicesRepository.submitMarketplaceListing(created.id, created.version)
        } else {
          const updated = await lifeServicesRepository.updateMarketplaceListing(resourceId, {
            ...input,
            expected_version: form.version,
          })
          id = updated.id
          if (updated.available_actions.includes('submit_review')) {
            await lifeServicesRepository.submitMarketplaceListing(updated.id, updated.version)
          }
        }
      } else {
        const input = {
          origin: form.origin.trim(),
          destination: form.destination.trim(),
          description: form.content.trim() || undefined,
          departure_at: toIso(form.departureDate, form.departureTime),
          total_seats: Number(form.totalSeats),
          contact_type: form.contactType,
          contact: form.contact.trim(),
        }
        if (mode === 'create') {
          id = (await lifeServicesRepository.createCarpoolTrip(input)).id
        } else {
          const updated = await lifeServicesRepository.updateCarpoolTrip(resourceId, {
            ...input,
            expected_version: form.version,
          })
          id = updated.id
          if (updated.available_actions.includes('submit_review')) {
            await lifeServicesRepository.submitCarpoolReview(updated.id, updated.version)
          }
        }
      }
      await navigateAfterSubmit(id)
    } catch (error) {
      if (isApiError(error) && error.code === 'academic_verification_required') return
      Taro.showToast({
        title: isApiError(error) ? error.message : error instanceof Error ? error.message : '提交失败，请重试',
        icon: 'none',
        duration: 2800,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const saveAndLeave = () => {
    saveDraft(section, form)
    Taro.showToast({ title: '草稿已保存', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 350)
  }

  return (
    <View className={`publisher-page publisher-page--${section}`}>
      <View className='publisher-page__orb publisher-page__orb--one' />
      <View className='publisher-page__orb publisher-page__orb--two' />
      <CustomNavbar
        title={mode === 'create' ? '发布' : '编辑发布'}
        showBack
      />
      <View
        className='publisher-page__content'
        style={keyboardHeight > 0
          ? `padding-bottom: calc(244rpx + env(safe-area-inset-bottom) + ${keyboardHeight}px)`
          : undefined}
      >
        <View className='publisher-types' ariaRole='tablist'>
          {sectionOptions.map((item) => (
            <View
              key={item.key}
              className={`publisher-type ${section === item.key ? 'publisher-type--active' : ''} ${mode !== 'create' ? 'publisher-type--locked' : ''}`}
              ariaRole='button'
              ariaLabel={`${mode !== 'create' ? '当前编辑类型' : '切换发布类型为'}${item.label}`}
              onClick={() => selectSection(item.key)}
            >
              <Text>{item.label}</Text>
            </View>
          ))}
        </View>

        <View className='publisher-intro'>
          <Text className='publisher-intro__title'>
            {section === 'market'
              ? form.marketIntent === 'wanted' ? '发布求购' : '出售闲置好物'
              : current.title}
          </Text>
          <View className='publisher-intro__meta'>
            <Text>{mode === 'create' ? '草稿自动保存' : `编辑 #${resourceId}`}</Text>
            {mode === 'create' && hasDraftContent && (
              <Text
                className='publisher-intro__clear'
                onClick={() => void clearCurrentDraft()}
              >
                清空草稿
              </Text>
            )}
          </View>
        </View>

        {loadingEdit ? (
          <View className='publisher-loading'>正在加载原内容</View>
        ) : (
          <>
            {section === 'market' && (
              <View className='publisher-section publisher-section--market-context'>
                <View className='publisher-market-intents'>
                  <View
                    className={form.marketIntent === 'sell' ? 'publisher-market-intent--active' : ''}
                    onClick={() => selectMarketIntent('sell')}
                  >
                    我要出售
                  </View>
                  <View
                    className={form.marketIntent === 'wanted' ? 'publisher-market-intent--active' : ''}
                    onClick={() => selectMarketIntent('wanted')}
                  >
                    我要求购
                  </View>
                </View>
                {(form.courseName || form.academicPeriodLabel) && (
                  <View className='publisher-course-context'>
                    <View className='publisher-course-context__copy'>
                      <Text>{form.courseName || '课程资料'}</Text>
                      <Text>{[form.courseCode, form.academicPeriodLabel].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <Text
                      className='publisher-course-context__remove'
                      onClick={removeCourseContext}
                    >
                      移除
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View className='publisher-section publisher-section--content'>
              <View className='publisher-field publisher-field--content'>
                <View className='publisher-textarea'>
                  <KeyboardSafeTextarea
                    id='publisher-content'
                    value={form.content}
                    maxlength={section === 'community' ? 5000 : 2000}
                    placeholder={section === 'market'
                      ? form.marketIntent === 'wanted'
                        ? '说明版本、预算和希望的交易地点'
                        : '描述成色、配件和使用情况'
                      : section === 'errands' ? '说明物品、时间要求和注意事项' : section === 'carpool' ? '补充集合、行李或返程信息（可选）' : '分享真实、友善的校园内容'}
                    placeholderClass='publisher-placeholder'
                    onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                    onInput={(event) => update('content', event.detail.value)}
                  />
                  <Text>{form.content.length}</Text>
                </View>
              </View>
            </View>

            {section === 'errands' && (
              <View className='publisher-section'>
                <SectionHeading title='任务信息' />
                <InputField inputId='publisher-pickup-location' label='取件地' value={form.pickupLocation} maxlength={100} placeholder='例如：北区快递站' onKeyboardVisibilityChange={onKeyboardVisibilityChange} onInput={(value) => update('pickupLocation', value)} />
                <InputField inputId='publisher-dropoff-location' label='送达地' value={form.dropoffLocation} maxlength={100} placeholder='例如：图书馆南门' onKeyboardVisibilityChange={onKeyboardVisibilityChange} onInput={(value) => update('dropoffLocation', value)} />
                <View className='publisher-field'>
                  <Text className='publisher-field__label'>截止时间</Text>
                  <View className='publisher-picker-row'>
                    <Picker mode='date' value={form.deadlineDate} onChange={(event) => update('deadlineDate', String(event.detail.value))}><View>{form.deadlineDate}</View></Picker>
                    <Picker mode='time' value={form.deadlineTime} onChange={(event) => update('deadlineTime', String(event.detail.value))}><View>{form.deadlineTime}</View></Picker>
                  </View>
                </View>
                <InputField inputId='publisher-reward-yuan' label='任务报酬' value={form.rewardYuan} type='digit' maxlength={8} placeholder='请输入报酬' suffix='元' onKeyboardVisibilityChange={onKeyboardVisibilityChange} onInput={(value) => update('rewardYuan', value)} />
              </View>
            )}

            {section === 'market' && (
              <View className='publisher-section'>
                <SectionHeading title='交易信息' />
                <InputField
                  inputId='publisher-price-yuan'
                  label={form.marketIntent === 'wanted' ? '求购预算' : '商品售价'}
                  value={form.priceYuan}
                  type='digit'
                  maxlength={10}
                  placeholder={form.marketIntent === 'wanted' ? '请输入预算' : '请输入售价'}
                  suffix='元'
                  onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                  onInput={(value) => update('priceYuan', value)}
                />
                {form.imageUrls.length > 0 && (
                  <View className='publisher-note publisher-note--compact'>
                    <Text>已保留 {form.imageUrls.length} 张原图片</Text>
                  </View>
                )}
              </View>
            )}

            {section === 'carpool' && (
              <View className='publisher-section'>
                <SectionHeading title='行程信息' />
                <InputField inputId='publisher-origin' label='出发地' value={form.origin} maxlength={100} placeholder='例如：海大崂山校区北门' onKeyboardVisibilityChange={onKeyboardVisibilityChange} onInput={(value) => update('origin', value)} />
                <InputField inputId='publisher-destination' label='目的地' value={form.destination} maxlength={100} placeholder='例如：青岛北站' onKeyboardVisibilityChange={onKeyboardVisibilityChange} onInput={(value) => update('destination', value)} />
                <View className='publisher-field'>
                  <Text className='publisher-field__label'>出发时间</Text>
                  <View className='publisher-picker-row'>
                    <Picker mode='date' value={form.departureDate} onChange={(event) => update('departureDate', String(event.detail.value))}><View>{form.departureDate}</View></Picker>
                    <Picker mode='time' value={form.departureTime} onChange={(event) => update('departureTime', String(event.detail.value))}><View>{form.departureTime}</View></Picker>
                  </View>
                </View>
                <InputField inputId='publisher-total-seats' label='可加入人数' value={form.totalSeats} type='number' maxlength={2} placeholder='1–20' suffix='人' onKeyboardVisibilityChange={onKeyboardVisibilityChange} onInput={(value) => update('totalSeats', value)} />
              </View>
            )}

            {section === 'community' && (
              <View className='publisher-section'>
                <SectionHeading title='发布板块' />
                {!sectionsReady && (
                  <View className='publisher-note publisher-note--compact'>
                    <Text>正在加载板块</Text>
                  </View>
                )}
                {sectionsReady && communitySectionOptions.length === 0 && (
                  <View className='publisher-note publisher-note--compact'>
                    <Text>暂无启用板块</Text>
                  </View>
                )}
                {communitySectionOptions.length > 0 && (
                  <View className='publisher-community-sections'>
                    {communitySectionOptions.map((item) => (
                      <View
                        id={`publisher-community-section-${item.id}`}
                        key={item.id}
                        className={`publisher-community-section ${
                          item.parent_id === null
                            ? 'publisher-community-section--root'
                            : 'publisher-community-section--child'
                        } ${
                          form.communitySectionId === item.id
                            ? 'publisher-community-section--active'
                            : ''
                        }`}
                        onClick={() => update('communitySectionId', item.id)}
                      >
                        <Text>{item.name}</Text>
                        <Text>{item.parent_id === null ? '父模块' : '子模块'}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {topics.length > 0 && (
                  <>
                    <SectionHeading title='关联话题（可选）' />
                    <View className='publisher-community-sections'>
                      <View className={`publisher-community-section ${form.communityTopicId === 0 ? 'publisher-community-section--active' : ''}`} onClick={() => update('communityTopicId', 0)}><Text>不关联话题</Text><Text>普通动态</Text></View>
                      {topics.map((item) => <View key={item.id} className={`publisher-community-section ${form.communityTopicId === item.id ? 'publisher-community-section--active' : ''}`} onClick={() => update('communityTopicId', item.id)}><Text>#{item.name}</Text><Text>{item.kind === 'campaign' ? '活动' : '话题'}</Text></View>)}
                    </View>
                  </>
                )}
              </View>
            )}

            {section !== 'community' && (
              <View className='publisher-section'>
                <SectionHeading title='联系方式' />
                <View className='publisher-field'>
                  <Text className='publisher-field__label'>联系方式</Text>
                  <View className='publisher-contact'>
                    <Picker
                      mode='selector'
                      range={CONTACT_LABELS}
                      value={Math.max(0, CONTACT_VALUES.indexOf(form.contactType))}
                      onChange={(event) => update('contactType', CONTACT_VALUES[Number(event.detail.value)] || 'wechat')}
                    >
                      <View>{CONTACT_LABELS[CONTACT_VALUES.indexOf(form.contactType)]}</View>
                    </Picker>
                    <KeyboardSafeInput
                      id='publisher-contact'
                      value={form.contact}
                      maxlength={128}
                      placeholder='仅在服务端授权后展示'
                      placeholderClass='publisher-placeholder'
                      onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                      onInput={(event) => update('contact', event.detail.value)}
                    />
                  </View>
                  <Text className='publisher-field__help'>仅交易相关用户可查看</Text>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {!loadingEdit && (
        <View className='publisher-actions'>
          <View className={`publisher-actions__status ${validationError ? '' : 'publisher-actions__status--ready'}`}>
            <View />
            <Text>{validationError ? `尚缺：${validationError}` : '内容完整，提交后进入审核'}</Text>
          </View>
          <View className='publisher-actions__buttons'>
            {mode === 'create' && (
              <View
                className='publisher-actions__draft'
                hoverClass='publisher-actions__button--pressed'
                onClick={saveAndLeave}
              >
                保存退出
              </View>
            )}
            <View
              id='publisher-submit'
              className={`publisher-actions__submit ${validationError ? 'publisher-actions__submit--disabled' : ''}`}
              hoverClass='publisher-actions__button--pressed'
              onClick={() => void submit()}
            >
              {submitting ? '正在提交' : mode === 'create' ? '提交审核' : '保存并提交'}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
