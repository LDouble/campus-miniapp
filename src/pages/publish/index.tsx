import { useEffect, useMemo, useRef, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Image, Picker, ScrollView, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import MediaImageEditor from '../../components/media-image-editor'
import {
  KeyboardSafeInput,
  KeyboardSafeTextarea,
  useKeyboardInset,
} from '../../components/keyboard-safe-input'
import StickerPicker from '../../components/sticker-picker'
import { isApiError } from '../../api/client'
import { uploadMediaImage } from '../../api/media'
import { getCurrentIdentity } from '../../api/account'
import type {
  CarpoolTripView,
  CampusCirclePostView,
  CampusCircleSectionView,
  CampusCircleTopicView,
  ErrandView,
  MentionCandidate,
  MarketplaceListingView,
} from '../../api/types'
import {
  consumeMarketplacePublishPrefill,
  type MarketplaceIntent,
  type MarketplaceSource,
} from '../../features/life-services/marketplace-prefill'
import { lifeServicesRepository } from '../../features/life-services/repository'
import MentionPicker from '../../features/mentions/mention-picker'
import {
  expandMentionDeletion,
  insertMentionToken,
  removeMentionTokens,
} from '../../features/mentions/content'
import { markLifeHubSectionDirty } from '../../features/life-services/refresh-policy'
import {
  publisherContactStorage,
  withRememberedPublisherContact,
  type PublisherContact,
} from '../../features/life-services/publisher-contact-storage'
import CampusSelector from '../../features/life-services/components/campus-selector'
import {
  isCampusName,
  preferredCampus,
  type CampusName,
} from '../../features/life-services/campus'
import {
  getRecentRouteValues,
  rememberRoutePair,
  ROUTE_SHORTCUTS,
  type RouteHistoryKind,
} from '../../features/life-services/route-history'
import {
  MAX_PUBLISH_IMAGES,
  mediaImageValidationError,
  moveMediaImage,
  serverMediaImageDraft,
} from '../../features/media/images'
import type { MediaImageDraft } from '../../features/media/images'
import { chooseMediaImages } from '../../features/media/selection'
import { requestWechatSubscriptionForPublishSection } from '../../features/wechat-subscription'
import {
  editableStickerContent,
  insertStickerToken,
  serializeStickerTokens,
  stickerTokenForId,
} from '../../features/stickers/content'
import {
  communityPostTopics,
  extractCommunityTopicNames,
} from '../../features/community/topic'
import {
  apiDateTimeCampusParts,
  campusDateTimeToISOString,
} from '../../utils/date-time'
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
  campus: CampusName | ''
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
  images: MediaImageDraft[]
  communitySectionId: number
  communityTopicId: number
  communityTopicIds: number[]
  // 选择器中新增、但尚未随帖子提交到服务端的话题名称。
  communityTopicNames: string[]
  mentionCandidates: MentionCandidate[]
  version: number
}

const DRAFT_KEY = 'lifePublisher.drafts.v4'
const LEGACY_DRAFT_KEY = 'lifePublisher.drafts.v3'
const CONTACT_LABELS = ['微信', '手机号', 'QQ']
const CONTACT_VALUES: PublisherForm['contactType'][] = ['wechat', 'phone', 'qq']

const sectionOptions: Array<{
  key: PublishSection
  label: string
}> = [
  { key: 'community', label: '动态' },
  { key: 'errands', label: '跑腿' },
  { key: 'market', label: '二手' },
  { key: 'carpool', label: '找同行' },
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
  campus: preferredCampus(),
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
  images: [],
  communitySectionId: 0,
  communityTopicId: 0,
  communityTopicIds: [],
  communityTopicNames: [],
  mentionCandidates: [],
  version: 0,
})

const flattenSections = (items: CampusCircleSectionView[]): CampusCircleSectionView[] => (
  items.flatMap((item) => [item, ...flattenSections(item.children || [])])
)

const restoreStickerContent = (content?: string | null) => (
  editableStickerContent(content || '')
)

const mentionCandidatesFromSegments = (
  segments?: CampusCirclePostView['content_segments'],
): MentionCandidate[] => {
  if (!segments) return []
  const seen = new Set<number>()
  return segments.flatMap((segment) => {
    if (segment.type !== 'mention' || !segment.user_id || !segment.nickname) return []
    if (seen.has(segment.user_id)) return []
    seen.add(segment.user_id)
    return [{ id: segment.user_id, nickname: segment.nickname, avatar_url: null }]
  })
}

type StoredPublisherForm = Partial<PublisherForm> & { stickerIds?: unknown }
type LegacyPublisherForm = Omit<PublisherForm, 'images'> & {
  imageUrls: string[]
  stickerIds?: unknown
}

const normalizeTopicIds = (value: unknown) => (
  Array.isArray(value)
    ? [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))].slice(0, 3)
    : []
)

const normalizeTopicName = (value: unknown) => (
  typeof value === 'string'
    ? value.trim().replace(/^#+/u, '').trim()
    : ''
)

const topicNameKey = (name: string) => normalizeTopicName(name).toLocaleLowerCase()

const normalizeTopicNames = (value: unknown) => {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const name = normalizeTopicName(item)
    const key = topicNameKey(name)
    if (!name || seen.has(key)) continue
    seen.add(key)
    result.push(name)
    if (result.length >= 3) break
  }
  return result
}

const isCreatableTopicName = (value: string) => (
  value.length > 0
    && value.length <= 64
    && /^[A-Za-z0-9_\u4e00-\u9fff]+$/u.test(value)
)

const restoreLegacyDraftContent = (content: unknown, stickerIds: unknown) => {
  const text = typeof content === 'string' ? content : ''
  const legacyIds = Array.isArray(stickerIds)
    ? stickerIds.filter((id): id is string => typeof id === 'string')
    : []
  const legacyTokens = legacyIds.length > 0
    ? legacyIds.map(stickerTokenForId).join('')
    : ''
  return restoreStickerContent(`${text}${legacyTokens}`)
}

const normalizeStoredDraft = (value: StoredPublisherForm): PublisherForm => {
  const { stickerIds, ...storedForm } = value
  const legacyPrimaryTopicId = Number(storedForm.communityTopicId || 0)
  const communityTopicIds = normalizeTopicIds(storedForm.communityTopicIds)
  const communityTopicNames = normalizeTopicNames(storedForm.communityTopicNames)
  if (communityTopicIds.length === 0 && legacyPrimaryTopicId > 0) {
    communityTopicIds.push(legacyPrimaryTopicId)
  }
  const primaryTopicId = communityTopicIds.includes(legacyPrimaryTopicId)
    ? legacyPrimaryTopicId
    : communityTopicIds[0] || 0
  return {
    ...emptyForm(storedForm.marketIntent),
    ...storedForm,
    communityTopicId: primaryTopicId,
    communityTopicIds,
    communityTopicNames,
    content: restoreLegacyDraftContent(storedForm.content, stickerIds),
  }
}

const storedDrafts = () => {
  const stored = Taro.getStorageSync<Partial<Record<string, StoredPublisherForm>>>(DRAFT_KEY) || {}
  if (Object.keys(stored).length > 0) {
    return Object.fromEntries(Object.entries(stored).map(([key, value]) => [
      key,
      value ? normalizeStoredDraft(value) : value,
    ])) as Partial<Record<string, PublisherForm>>
  }
  const legacy = Taro.getStorageSync<Partial<Record<string, LegacyPublisherForm>>>(
    LEGACY_DRAFT_KEY,
  ) || {}
  const migrated = Object.fromEntries(Object.entries(legacy).map(([key, value]) => {
    if (!value) return [key, value]
    const { imageUrls, stickerIds, ...form } = value
    const legacyPrimaryTopicId = Number(form.communityTopicId || 0)
    const communityTopicIds = normalizeTopicIds(form.communityTopicIds)
    const communityTopicNames = normalizeTopicNames(form.communityTopicNames)
    if (communityTopicIds.length === 0 && legacyPrimaryTopicId > 0) {
      communityTopicIds.push(legacyPrimaryTopicId)
    }
    return [key, {
      ...form,
      content: restoreLegacyDraftContent(form.content, stickerIds),
      campus: isCampusName(form.campus) ? form.campus : preferredCampus(),
      images: (imageUrls || []).map((url) => serverMediaImageDraft({ url })),
      communityTopicId: communityTopicIds.includes(legacyPrimaryTopicId)
        ? legacyPrimaryTopicId
        : communityTopicIds[0] || 0,
      communityTopicIds,
      communityTopicNames,
    } satisfies PublisherForm]
  })) as Partial<Record<string, PublisherForm>>
  if (Object.keys(migrated).length > 0) {
    Taro.setStorageSync(DRAFT_KEY, migrated)
    Taro.removeStorageSync(LEGACY_DRAFT_KEY)
  }
  return migrated
}

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

const toIso = campusDateTimeToISOString

const yuanValue = (cents: number) => {
  const value = cents / 100
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

const marketplaceImageDrafts = (item: MarketplaceListingView) => {
  const media = item.images
  if (media?.length) {
    return media.map((image) => serverMediaImageDraft({
      url: image.url,
      mediaId: image.media_id || undefined,
    }))
  }
  return item.image_urls.map((url) => serverMediaImageDraft({ url }))
}

const InputField = ({
  label,
  value,
  placeholder,
  maxlength = 100,
  type = 'text',
  suffix,
  inputId,
  className,
  onKeyboardVisibilityChange,
  onFocus,
  onInput,
}: {
  label: string
  value: string
  placeholder: string
  maxlength?: number
  type?: 'text' | 'number' | 'digit'
  suffix?: string
  inputId?: string
  className?: string
  onKeyboardVisibilityChange: (height: number) => void
  onFocus?: () => void
  onInput: (value: string) => void
}) => (
  <View className={`publisher-field ${className || ''}`}>
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
        onFocus={onFocus}
        onInput={(event) => onInput(event.detail.value)}
      />
      {suffix && <Text>{suffix}</Text>}
    </View>
  </View>
)

const RouteSuggestions = ({
  kind,
  value: currentValue,
  onSelect,
}: {
  kind: RouteHistoryKind
  value: string
  onSelect: (value: string) => void
}) => {
  const recent = getRecentRouteValues(kind).filter(
    (value) => !ROUTE_SHORTCUTS.some((shortcut) => shortcut === value),
  )
  return (
    <View className='publisher-route-suggestions'>
      <Text className='publisher-route-suggestions__label'>常用地点</Text>
      <View className='publisher-route-suggestions__items'>
        {ROUTE_SHORTCUTS.map((option) => (
          <View
            key={option}
            className={currentValue === option
              ? 'publisher-route-suggestion publisher-route-suggestion--active'
              : 'publisher-route-suggestion'}
            ariaRole='button'
            ariaLabel={`${currentValue === option ? '已选择，' : ''}选择常用地点${option}`}
            onClick={() => onSelect(option)}
          >
            {option}
          </View>
        ))}
      </View>
      {recent.length > 0 && (
        <>
          <Text className='publisher-route-suggestions__label'>最近使用</Text>
          <View className='publisher-route-suggestions__items publisher-route-suggestions__items--recent'>
            {recent.map((option) => (
              <View
                key={option}
                className={currentValue === option
                  ? 'publisher-route-suggestion publisher-route-suggestion--recent publisher-route-suggestion--active'
                  : 'publisher-route-suggestion publisher-route-suggestion--recent'}
                ariaRole='button'
                ariaLabel={`${currentValue === option ? '已选择，' : ''}选择最近使用地点${option}`}
                onClick={() => onSelect(option)}
              >
                {option}
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  )
}

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
  const [topicPickerOpen, setTopicPickerOpen] = useState(false)
  const [topicKeyword, setTopicKeyword] = useState('')
  const [topicSearchLoading, setTopicSearchLoading] = useState(false)
  const [topicSearchError, setTopicSearchError] = useState(false)
  const [requestedCommunitySectionId, setRequestedCommunitySectionId] = useState(0)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [restoringCreateDefaults, setRestoringCreateDefaults] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false)
  const [contentInputFocused, setContentInputFocused] = useState(false)
  const contentSelectionStartRef = useRef(0)
  const contentSelectionEndRef = useRef(0)
  const contentFocusRequestRef = useRef(0)
  const [activeRouteField, setActiveRouteField] = useState<keyof Pick<
    PublisherForm,
    'pickupLocation' | 'dropoffLocation' | 'origin' | 'destination'
  > | null>(null)
  const identityUserIdRef = useRef(0)
  const rememberedContactRef = useRef<PublisherContact | null>(null)
  const topicSearchRequestRef = useRef(0)
  const {
    keyboardHeight,
    onKeyboardVisibilityChange,
  } = useKeyboardInset()

  useEffect(() => {
    if (keyboardHeight > 0) setStickerPickerOpen(false)
  }, [keyboardHeight])

  const loadingForm = loadingEdit || restoringCreateDefaults
  const update = <K extends keyof PublisherForm>(key: K, value: PublisherForm[K]) => {
    setForm((draft) => ({ ...draft, [key]: value }))
  }

  const selectedTopicCount = form.communityTopicIds.length + form.communityTopicNames.length

  const changeTopicPickerOpen = (open: boolean) => {
    if (open) {
      contentFocusRequestRef.current += 1
      setContentInputFocused(false)
      setMentionPickerOpen(false)
      changeStickerPickerOpen(false)
      setTopicSearchError(false)
      setTopicPickerOpen(true)
      return
    }
    setTopicPickerOpen(false)
    setTopicKeyword('')
    setTopicSearchError(false)
    void Taro.hideKeyboard()
  }

  const toggleCommunityTopic = (topicId: number) => {
    if (!Number.isInteger(topicId) || topicId <= 0) return
    const selected = form.communityTopicIds.includes(topicId)
    if (!selected && selectedTopicCount >= 3) {
      Taro.showToast({ title: '最多关联 3 个话题', icon: 'none' })
      return
    }
    setForm((current) => {
      const nextTopicIds = selected
        ? current.communityTopicIds.filter((id) => id !== topicId)
        : [...current.communityTopicIds, topicId]
      const nextPrimaryTopicId = nextTopicIds.length === 0
        ? 0
        : selected && current.communityTopicId === topicId
          ? nextTopicIds[0]
          : nextTopicIds.includes(current.communityTopicId)
            ? current.communityTopicId
            : nextTopicIds[0]
      return {
        ...current,
        communityTopicId: nextPrimaryTopicId,
        communityTopicIds: nextTopicIds,
      }
    })
  }

  const addCommunityTopicName = () => {
    const name = normalizeTopicName(topicKeyword)
    if (!isCreatableTopicName(name)) {
      Taro.showToast({ title: '话题仅支持中文、字母、数字或下划线', icon: 'none' })
      return
    }
    const matched = topics.find((item) => topicNameKey(item.name) === topicNameKey(name))
    if (matched) {
      toggleCommunityTopic(matched.id)
      changeTopicPickerOpen(false)
      return
    }
    if (form.communityTopicNames.some((item) => topicNameKey(item) === topicNameKey(name))) return
    if (selectedTopicCount >= 3) {
      Taro.showToast({ title: '最多关联 3 个话题', icon: 'none' })
      return
    }
    setForm((current) => ({
      ...current,
      communityTopicNames: [...current.communityTopicNames, name],
    }))
    setTopicKeyword('')
    changeTopicPickerOpen(false)
  }

  const removeCommunityTopicName = (name: string) => {
    setForm((current) => ({
      ...current,
      communityTopicNames: current.communityTopicNames.filter(
        (item) => topicNameKey(item) !== topicNameKey(name),
      ),
    }))
  }

  const removeMentionFromContent = (candidate: MentionCandidate) => {
    const removed = removeMentionTokens(
      form.content,
      candidate.nickname,
      contentSelectionStartRef.current,
    )
    contentSelectionStartRef.current = removed.cursor
    contentSelectionEndRef.current = removed.cursor
    update('content', removed.text)
  }

  const clearMentionContent = (selected: MentionCandidate[]) => {
    let nextContent = form.content
    let cursor = contentSelectionStartRef.current
    selected.forEach((candidate) => {
      const removed = removeMentionTokens(nextContent, candidate.nickname, cursor)
      nextContent = removed.text
      cursor = removed.cursor
    })
    contentSelectionStartRef.current = cursor
    contentSelectionEndRef.current = cursor
    update('content', nextContent)
  }

  const changeMentionPickerOpen = (open: boolean) => {
    contentFocusRequestRef.current += 1
    setMentionPickerOpen(open)
    if (open) {
      setContentInputFocused(false)
      return
    }

    const requestId = contentFocusRequestRef.current
    setContentInputFocused(false)
    setTimeout(() => {
      if (contentFocusRequestRef.current !== requestId) return
      setContentInputFocused(true)
    }, 80)
  }

  const loadRememberedContact = async () => {
    try {
      const identity = await getCurrentIdentity()
      identityUserIdRef.current = identity.user_id
      const remembered = publisherContactStorage.read(Taro, identity.user_id)
      rememberedContactRef.current = remembered
      return remembered
    } catch {
      return null
    }
  }

  const rememberCurrentContact = async () => {
    if (section === 'community') return
    let userId = identityUserIdRef.current
    if (!userId) {
      try {
        const identity = await getCurrentIdentity()
        userId = identity.user_id
        identityUserIdRef.current = userId
      } catch {
        return
      }
    }
    const remembered = {
      contactType: form.contactType,
      contact: form.contact.trim(),
    }
    if (publisherContactStorage.write(Taro, userId, remembered)) {
      rememberedContactRef.current = remembered
    }
  }

  const mapErrand = (item: ErrandView): PublisherForm => {
    const deadline = apiDateTimeCampusParts(item.deadline)
    return {
      ...emptyForm(),
      campus: isCampusName(item.campus) ? item.campus : '',
      content: restoreStickerContent(item.description),
      pickupLocation: item.pickup_location,
      dropoffLocation: item.dropoff_location,
      rewardYuan: yuanValue(item.reward_cents),
      deadlineDate: deadline ? deadline.date : item.deadline.slice(0, 10),
      deadlineTime: deadline ? deadline.time : item.deadline.slice(11, 16),
      contactType: (item.contact_type || 'wechat') as PublisherForm['contactType'],
      contact: item.contact.includes('*') ? '' : item.contact,
      version: item.version,
    }
  }

  const mapMarketplace = (item: MarketplaceListingView): PublisherForm => {
    return {
      ...emptyForm(item.intent),
      campus: isCampusName(item.campus) ? item.campus : '',
      content: restoreStickerContent(item.description),
      marketIntent: item.intent,
      marketCategory: item.category as PublisherForm['marketCategory'],
      courseName: item.course_name || '',
      courseCode: item.course_code || '',
      academicPeriodId: item.academic_period_id || '',
      academicPeriodLabel: item.academic_period_label || '',
      marketSource: item.source as MarketplaceSource,
      priceYuan: yuanValue(item.price_cents),
      contactType: (item.contact_type || 'wechat') as PublisherForm['contactType'],
      contact: item.contact.includes('*') ? '' : item.contact,
      images: marketplaceImageDrafts(item),
      version: item.version,
    }
  }

  const mapCarpool = (item: CarpoolTripView): PublisherForm => {
    const departure = apiDateTimeCampusParts(item.departure_at)
    return {
      ...emptyForm(),
      campus: isCampusName(item.campus) ? item.campus : '',
      content: restoreStickerContent(item.description),
      origin: item.origin,
      destination: item.destination,
      departureDate: departure ? departure.date : item.departure_at.slice(0, 10),
      departureTime: departure ? departure.time : item.departure_at.slice(11, 16),
      totalSeats: String(item.total_seats),
      contactType: (item.contact_type || 'wechat') as PublisherForm['contactType'],
      contact: item.contact.includes('*') ? '' : item.contact,
      version: item.version,
    }
  }

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
        const postTopics = communityPostTopics(post)
        const postTopicIds = postTopics.map((topic) => topic.id).slice(0, 3)
        const primaryTopicId = post.primary_topic?.id || post.topic?.id || postTopicIds[0] || 0
        setForm({
          ...emptyForm(),
          content: restoreStickerContent(post.content),
          mentionCandidates: mentionCandidatesFromSegments(post.content_segments),
          images: post.images.map((image) => serverMediaImageDraft({
            url: image.url,
            mediaId: image.media_id || undefined,
          })),
          communitySectionId: post.section_id,
          communityTopicId: primaryTopicId,
          communityTopicIds: postTopicIds.length > 0 ? postTopicIds : primaryTopicId > 0 ? [primaryTopicId] : [],
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
    const initialCommunityTopicId = Number(options.community_topic_id || 0)
    setSection(initialSection)
    setMode(initialMode)
    setResourceId(initialId)
    setRequestedCommunitySectionId(
      Number.isFinite(initialCommunitySectionId) && initialCommunitySectionId > 0
        ? initialCommunitySectionId
        : 0,
    )
    if (initialMode !== 'create' && initialId > 0) {
      setRestoringCreateDefaults(false)
      void loadEdit(initialSection, initialId)
    } else {
      setRestoringCreateDefaults(true)
      void loadRememberedContact().then((remembered) => {
        const draft = storedDrafts()[draftKey(initialSection, initialIntent)]
          || emptyForm(initialIntent)
        const initialForm = initialSection === 'community'
          ? draft
          : withRememberedPublisherContact(draft, remembered)
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
        setForm(initialSection === 'community'
          ? {
            ...nextForm,
            communitySectionId: Number.isInteger(initialCommunitySectionId) && initialCommunitySectionId > 0
              ? initialCommunitySectionId
              : nextForm.communitySectionId,
            communityTopicId: Number.isInteger(initialCommunityTopicId) && initialCommunityTopicId > 0
              ? initialCommunityTopicId
              : nextForm.communityTopicId,
            communityTopicIds: Number.isInteger(initialCommunityTopicId) && initialCommunityTopicId > 0
              ? [initialCommunityTopicId]
              : nextForm.communityTopicIds,
          }
          : nextForm)
      }).finally(() => setRestoringCreateDefaults(false))
    }
    void lifeServicesRepository.listCampusCircleSections()
      .then((result) => setSections(result.items))
      .catch(() => setSections([]))
      .finally(() => setSectionsReady(true))
    void lifeServicesRepository.listCampusCircleTopics({ pageSize: 50 })
      .then((result) => setTopics(result.items.filter((item) => item.status === 'active')))
      .catch(() => setTopics([]))
  })

  const normalizedTopicKeyword = normalizeTopicName(topicKeyword)

  useEffect(() => {
    if (!topicPickerOpen) return
    const requestId = ++topicSearchRequestRef.current
    const keyword = normalizedTopicKeyword
    const timer = setTimeout(() => {
      setTopicSearchLoading(true)
      setTopicSearchError(false)
      void lifeServicesRepository.listCampusCircleTopics({
        keyword: keyword || undefined,
        pageSize: 50,
      })
        .then((result) => {
          if (requestId !== topicSearchRequestRef.current) return
          const activeTopics = result.items.filter((item) => item.status === 'active')
          setTopics((current) => {
            const selected = current.filter((item) => form.communityTopicIds.includes(item.id))
            const selectedIds = new Set(selected.map((item) => item.id))
            return [
              ...selected,
              ...activeTopics.filter((item) => !selectedIds.has(item.id)),
            ]
          })
        })
        .catch(() => {
          if (requestId === topicSearchRequestRef.current) setTopicSearchError(true)
        })
        .finally(() => {
          if (requestId === topicSearchRequestRef.current) setTopicSearchLoading(false)
        })
    }, keyword ? 220 : 0)
    return () => {
      clearTimeout(timer)
      if (requestId === topicSearchRequestRef.current) topicSearchRequestRef.current += 1
    }
  }, [form.communityTopicIds, normalizedTopicKeyword, topicPickerOpen])

  const communitySectionOptions = useMemo(
    () => flattenSections(sections).filter((item) => item.status === 'active'),
    [sections],
  )

  const filteredTopics = useMemo(() => {
    const keyword = normalizedTopicKeyword.toLocaleLowerCase()
    if (!keyword) return topics
    return topics.filter((topic) => topic.name.toLocaleLowerCase().includes(keyword))
  }, [normalizedTopicKeyword, topics])

  const topicNameExists = useMemo(() => (
    Boolean(normalizedTopicKeyword) && topics.some(
      (topic) => topicNameKey(topic.name) === topicNameKey(normalizedTopicKeyword),
    )
  ), [normalizedTopicKeyword, topics])

  const selectedTopicEntries = useMemo(() => {
    const selectedIds = form.communityTopicIds.map((id) => {
      const topic = topics.find((item) => item.id === id)
      return {
        id,
        key: `id:${id}`,
        name: topic?.name || '已选话题',
        pending: false,
      }
    })
    const pendingNames = form.communityTopicNames.map((name) => ({
      id: 0,
      key: `name:${topicNameKey(name)}`,
      name,
      pending: true,
    }))
    return [...selectedIds, ...pendingNames]
  }, [form.communityTopicIds, form.communityTopicNames, topics])

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
    if (mode !== 'create' || loadingEdit || restoringCreateDefaults) return
    const timer = setTimeout(() => saveDraft(section, form), 350)
    return () => clearTimeout(timer)
  }, [form, loadingEdit, mode, restoringCreateDefaults, section])

  const selectSection = (next: PublishSection) => {
    if (mode !== 'create' || next === section || restoringCreateDefaults) return
    if (form.images.some((image) => image.status === 'uploading')) {
      Taro.showToast({ title: '请等待图片上传完成', icon: 'none' })
      return
    }
    requestWechatSubscriptionForPublishSection(next)
    saveDraft(section, form)
    setSection(next)
    const nextForm = storedDrafts()[draftKey(next)] || emptyForm()
    setForm(next === 'community'
      ? nextForm
      : withRememberedPublisherContact(nextForm, rememberedContactRef.current))
  }

  const selectMarketIntent = (intent: MarketplaceIntent) => {
    if (form.marketIntent === intent) return
    if (form.images.some((image) => image.status === 'uploading')) {
      Taro.showToast({ title: '请等待图片上传完成', icon: 'none' })
      return
    }
    if (mode === 'create') {
      saveDraft(section, form)
      const nextForm = storedDrafts()[draftKey('market', intent)] || emptyForm(intent)
      setForm(withRememberedPublisherContact(nextForm, rememberedContactRef.current))
      return
    }
    update('marketIntent', intent)
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

  const updateImage = (
    key: string,
    updater: (image: MediaImageDraft) => MediaImageDraft,
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      images: currentForm.images.map((image) => image.key === key ? updater(image) : image),
    }))
  }

  const uploadImage = async (
    image: MediaImageDraft,
    purpose: 'community' | 'marketplace' = section === 'market' ? 'marketplace' : 'community',
  ) => {
    if (!image.localPath) {
      updateImage(image.key, (currentImage) => ({
        ...currentImage,
        status: 'failed',
        error: '本地临时图片已失效，请删除后重新选择',
      }))
      return
    }
    updateImage(image.key, (currentImage) => ({
      ...currentImage,
      status: 'uploading',
      progress: 0,
      error: '',
    }))
    try {
      const uploaded = await uploadMediaImage({
        purpose,
        filePath: image.localPath,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        onProgress: (progress) => updateImage(image.key, (currentImage) => ({
          ...currentImage,
          progress,
        })),
      })
      updateImage(image.key, (currentImage) => ({
        ...currentImage,
        mediaId: uploaded.id,
        width: uploaded.width || currentImage.width,
        height: uploaded.height || currentImage.height,
        status: 'uploaded',
        progress: 100,
        error: '',
      }))
    } catch (uploadError) {
      updateImage(image.key, (currentImage) => ({
        ...currentImage,
        status: 'failed',
        error: isApiError(uploadError)
          ? uploadError.message
          : uploadError instanceof Error ? uploadError.message : '图片上传失败',
      }))
    }
  }

  const chooseImages = async () => {
    const replacingLegacy = form.images.some((image) => Boolean(image.legacyUrl))
    if (replacingLegacy) {
      const result = await Taro.showModal({
        title: '替换原图片',
        content: '历史图片与新媒体不能混用。继续后将移除全部原图片，再选择新的图片。',
        confirmText: '替换',
        confirmColor: '#d87567',
      })
      if (!result.confirm) return
    }
    const existingImages = replacingLegacy ? [] : form.images
    const remaining = MAX_PUBLISH_IMAGES - existingImages.length
    if (remaining <= 0) {
      Taro.showToast({ title: '图片最多上传 9 张', icon: 'none' })
      return
    }
    const purpose = section === 'market' ? 'marketplace' : 'community'
    try {
      const selected = await chooseMediaImages({ count: remaining })
      if (!selected.length) return
      setForm((currentForm) => ({
        ...currentForm,
        images: replacingLegacy ? selected : [...currentForm.images, ...selected],
      }))
      selected.forEach((image) => void uploadImage(image, purpose))
    } catch (chooseError) {
      Taro.showToast({
        title: chooseError instanceof Error ? chooseError.message : '图片选择失败',
        icon: 'none',
      })
    }
  }

  const changeStickerPickerOpen = (open: boolean) => {
    setStickerPickerOpen(open)
    if (open) void Taro.hideKeyboard()
  }

  const contentMaxLength = section === 'community' ? 5000 : 2000
  const serializedContent = useMemo(
    () => serializeStickerTokens(form.content.trim()),
    [form.content],
  )
  const validationError = useMemo(() => {
    if (serializedContent.length > contentMaxLength) return `内容最多 ${contentMaxLength} 个字符`
    if (section === 'community') {
      if (!serializedContent && form.images.length === 0) return '请填写动态内容、表情或添加图片'
      if (!sectionsReady) return '社区板块正在加载'
      if (!communitySectionOptions.some((item) => item.id === form.communitySectionId)) {
        return '请选择服务端启用的社区板块'
      }
      return mediaImageValidationError(form.images)
    }
    if (!serializedContent && section !== 'carpool') return '请补充详细说明或添加表情'
    if (!form.campus) return '请选择业务所属校区'
    if (section === 'errands') {
      if (!form.pickupLocation.trim() || !form.dropoffLocation.trim()) return '请填写取件地和送达地'
      if (toCents(form.rewardYuan) <= 0) return '跑腿报酬必须大于 0 元'
      if (!toIso(form.deadlineDate, form.deadlineTime)) return '请选择有效截止时间'
    }
    if (section === 'market') {
      const imageError = mediaImageValidationError(form.images)
      if (imageError) return imageError
      if (toCents(form.priceYuan) <= 0) {
        return form.marketIntent === 'wanted' ? '求购预算必须大于 0 元' : '商品价格必须大于 0 元'
      }
    }
    if (section === 'carpool') {
      if (!form.origin.trim() || !form.destination.trim()) return '请填写出发地和目的地'
      const seats = Number(form.totalSeats)
      if (!Number.isInteger(seats) || seats < 1 || seats > 20) return '同行名额必须为 1–20 人'
      if (!toIso(form.departureDate, form.departureTime)) return '请选择有效出发时间'
    }
    if (!form.contact.trim()) return '请填写联系方式'
    return ''
  }, [communitySectionOptions, contentMaxLength, form, section, sectionsReady, serializedContent])

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
      await Taro.redirectTo({ url: `/pages/community/detail?id=${id}&mode=post` })
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
      const selectedCampus = isCampusName(form.campus) ? form.campus : preferredCampus()
      if (section === 'community') {
        const sectionId = form.communitySectionId
        if (!sectionId) throw new Error('服务端尚未提供可发布的社区板块')
        const input = {
          section_id: sectionId,
          content: serializedContent || undefined,
          media_ids: form.images.flatMap((image) => image.mediaId ? [image.mediaId] : []),
          image_urls: form.images.flatMap((image) => image.legacyUrl ? [image.legacyUrl] : []),
          mention_user_ids: form.mentionCandidates.map((candidate) => candidate.id),
          topic_id: form.communityTopicId || undefined,
          topic_ids: form.communityTopicIds.length > 0 ? form.communityTopicIds : undefined,
          primary_topic_id: form.communityTopicId || undefined,
          topic_names: normalizeTopicNames([
            ...form.communityTopicNames,
            ...extractCommunityTopicNames(form.content),
          ]),
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
          campus: selectedCampus,
          description: serializedContent,
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
          campus: selectedCampus,
          intent: form.marketIntent,
          description: serializedContent,
          price_cents: toCents(form.priceYuan),
          category: form.marketCategory,
          course_name: form.courseName.trim() || undefined,
          course_code: form.courseCode.trim() || undefined,
          academic_period_id: form.academicPeriodId.trim() || undefined,
          academic_period_label: form.academicPeriodLabel.trim() || undefined,
          source: form.marketSource,
          contact_type: form.contactType,
          contact: form.contact.trim(),
          media_ids: form.images.flatMap((image) => image.mediaId ? [image.mediaId] : []),
          image_urls: form.images.flatMap((image) => image.legacyUrl ? [image.legacyUrl] : []),
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
          campus: selectedCampus,
          origin: form.origin.trim(),
          destination: form.destination.trim(),
          description: serializedContent || undefined,
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
      if (section === 'errands') {
        rememberRoutePair(form.pickupLocation, form.dropoffLocation)
      } else if (section === 'carpool') {
        rememberRoutePair(form.origin, form.destination)
      }
      await rememberCurrentContact()
      markLifeHubSectionDirty(section)
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
    if (form.images.some((image) => image.status === 'uploading')) {
      Taro.showToast({ title: '请等待图片上传完成', icon: 'none' })
      return
    }
    saveDraft(section, form)
    Taro.showToast({ title: '草稿已保存', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 350)
  }

  const navbarTitle = section === 'market'
    ? form.marketIntent === 'wanted' ? '发布求购' : '出售闲置'
    : section === 'community' ? '发布动态'
      : section === 'errands' ? '发布跑腿'
        : '发布同行'
  return (
    <View className={`publisher-page publisher-page--${section}`}>
      <CustomNavbar
        title={navbarTitle}
        showBack
      />
      <View
        className='publisher-page__content'
        style={keyboardHeight > 0
          ? `padding-bottom: calc(196rpx + env(safe-area-inset-bottom) + ${keyboardHeight}px)`
          : undefined}
      >
        <View className='publisher-type-panel'>
          <View className='publisher-types' ariaRole='tablist'>
            {sectionOptions.map((item) => (
              <View
                key={item.key}
                className={`publisher-type ${section === item.key ? 'publisher-type--active' : ''} ${mode !== 'create' ? 'publisher-type--locked' : ''}`}
                ariaRole='button'
                ariaLabel={`${section === item.key ? '已选择，' : ''}${mode !== 'create' ? '当前编辑类型' : '切换发布类型为'}${item.label}`}
                onClick={() => selectSection(item.key)}
              >
                <Text>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {loadingForm ? (
          <View className='publisher-loading'>
            {loadingEdit ? '正在加载原内容' : '正在恢复发布信息'}
          </View>
        ) : (
          <View className='publisher-form'>
            {section === 'market' && (
              <View className='publisher-section publisher-section--market-context'>
                <View className='publisher-market-intents'>
                  <Text className='publisher-market-intents__label'>交易方式</Text>
                  <View className='publisher-market-intents__options'>
                    <View
                      className={form.marketIntent === 'sell' ? 'publisher-market-intent--active' : ''}
                      ariaRole='button'
                      ariaLabel={`${form.marketIntent === 'sell' ? '已选择，' : ''}出售`}
                      onClick={() => selectMarketIntent('sell')}
                    >
                      出售
                    </View>
                    <View
                      className={form.marketIntent === 'wanted' ? 'publisher-market-intent--active' : ''}
                      ariaRole='button'
                      ariaLabel={`${form.marketIntent === 'wanted' ? '已选择，' : ''}求购`}
                      onClick={() => selectMarketIntent('wanted')}
                    >
                      求购
                    </View>
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

            {section !== 'carpool' && <View className='publisher-section publisher-section--content'>
              <View className='publisher-field publisher-field--content'>
                <View className='publisher-textarea'>
                  <KeyboardSafeTextarea
                    id='publisher-content'
                    value={form.content}
                    focus={contentInputFocused && !mentionPickerOpen}
                    maxlength={contentMaxLength}
                    placeholder={section === 'market'
                      ? form.marketIntent === 'wanted'
                        ? '说明版本、预算和希望的交易地点'
                        : '描述成色、配件和使用情况'
                      : section === 'errands' ? '说明物品、时间要求和注意事项' : '分享真实、友善的校园内容'}
                    placeholderClass='publisher-placeholder'
                    onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                    onFocus={() => {
                      setContentInputFocused(true)
                      setStickerPickerOpen(false)
                    }}
                    onBlur={() => setContentInputFocused(false)}
                    onInput={(event) => {
                      const detail = event.detail as typeof event.detail & {
                        cursor?: number
                        selectionEnd?: number
                        selectionStart?: number
                      }
                      const cursor = Number.isFinite(detail.cursor)
                        ? Number(detail.cursor)
                        : detail.value.length
                      const selectionStart = Number.isFinite(detail.selectionStart)
                        ? Number(detail.selectionStart)
                        : cursor
                      const selectionEnd = Number.isFinite(detail.selectionEnd)
                        ? Number(detail.selectionEnd)
                        : cursor
                      const mentionDeletion = expandMentionDeletion(
                        form.content,
                        detail.value,
                        form.mentionCandidates,
                      )
                      if (mentionDeletion.cursor !== null) {
                        contentSelectionStartRef.current = mentionDeletion.cursor
                        contentSelectionEndRef.current = mentionDeletion.cursor
                      } else {
                        contentSelectionStartRef.current = Math.max(0, selectionStart)
                        contentSelectionEndRef.current = Math.max(
                          contentSelectionStartRef.current,
                          selectionEnd,
                        )
                      }
                      if (mentionDeletion.removedCandidateIds.length > 0) {
                        const removedIds = new Set(mentionDeletion.removedCandidateIds)
                        setForm((currentForm) => ({
                          ...currentForm,
                          content: mentionDeletion.text,
                          mentionCandidates: currentForm.mentionCandidates.filter(
                            (candidate) => !removedIds.has(candidate.id),
                          ),
                        }))
                      } else {
                        update('content', mentionDeletion.text)
                      }
                    }}
                    onSelectionChange={(event) => {
                      const detail = event.detail as {
                        selectionEnd?: number
                        selectionStart?: number
                      }
                      const selectionStart = Number(detail.selectionStart)
                      const selectionEnd = Number(detail.selectionEnd)
                      if (!Number.isFinite(selectionStart) || !Number.isFinite(selectionEnd)) return
                      contentSelectionStartRef.current = Math.max(0, selectionStart)
                      contentSelectionEndRef.current = Math.max(
                        contentSelectionStartRef.current,
                        selectionEnd,
                      )
                    }}
                  />
                  {section === 'community' && selectedTopicEntries.length > 0 && (
                    <View className='publisher-composer-topics' ariaLabel='已关联话题'>
                      {selectedTopicEntries.map((topic) => (
                        <View
                          key={topic.key}
                          className='publisher-composer-topic'
                          ariaRole='button'
                          ariaLabel={`移除话题${topic.name}`}
                          onClick={() => {
                            if (topic.pending) removeCommunityTopicName(topic.name)
                            else toggleCommunityTopic(topic.id)
                          }}
                        >
                          <Text>#{topic.name}</Text>
                          <Text>×</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <View className='publisher-composer-toolbar'>
                    <View className='publisher-composer-toolbar__tools'>
                      {section === 'community' && (
                        <View
                          id='publisher-topic-trigger'
                          className={topicPickerOpen
                            ? 'publisher-composer-tool publisher-composer-tool--active'
                            : 'publisher-composer-tool'}
                          ariaRole='button'
                          ariaLabel={topicPickerOpen ? '收起话题选择器' : '添加话题'}
                          onClick={() => changeTopicPickerOpen(!topicPickerOpen)}
                        >
                          <Image
                            className='publisher-composer-tool__icon publisher-composer-tool__icon--topic'
                            src={require('../../assets/community/topic.svg')}
                            mode='aspectFit'
                          />
                        </View>
                      )}
                      {section === 'community' && (
                        <View
                          className={mentionPickerOpen
                            ? 'publisher-composer-tool publisher-composer-tool--active'
                            : 'publisher-composer-tool'}
                          ariaRole='button'
                          ariaLabel='选择要提及的同学'
                          onClick={() => {
                            changeStickerPickerOpen(false)
                            changeMentionPickerOpen(true)
                          }}
                        >
                          <Image
                            className='publisher-composer-tool__icon'
                            src={require('../../assets/icons/mention.svg')}
                            mode='aspectFit'
                          />
                        </View>
                      )}
                      <View
                        className={stickerPickerOpen
                          ? 'publisher-composer-tool publisher-composer-tool--active'
                          : 'publisher-composer-tool'}
                        ariaRole='button'
                        ariaLabel={stickerPickerOpen ? '收起表情面板' : '选择表情'}
                        onClick={() => changeStickerPickerOpen(!stickerPickerOpen)}
                      >
                        <Image
                          className='publisher-composer-tool__icon'
                          src={require('../../assets/icons/smile.svg')}
                          mode='aspectFit'
                        />
                      </View>
                      {(section === 'community' || section === 'market') && (
                        <View
                          className={form.images.length >= MAX_PUBLISH_IMAGES
                            ? 'publisher-composer-tool publisher-composer-tool--disabled'
                            : 'publisher-composer-tool'}
                          ariaRole='button'
                          ariaLabel={form.images.length >= MAX_PUBLISH_IMAGES
                            ? `已达到 ${MAX_PUBLISH_IMAGES} 张图片上限`
                            : '选择图片'}
                          onClick={form.images.length >= MAX_PUBLISH_IMAGES
                            ? undefined
                            : () => void chooseImages()}
                        >
                          <Image
                            className='publisher-composer-tool__icon'
                            src={require('../../assets/icons/image.svg')}
                            mode='aspectFit'
                          />
                        </View>
                      )}
                    </View>
                    <Text>{form.content.length}/{contentMaxLength}</Text>
                  </View>
                </View>
                {section === 'community' && (
                  <MentionPicker
                    open={mentionPickerOpen}
                    selected={form.mentionCandidates}
                    onChange={(mentionCandidates) => update('mentionCandidates', mentionCandidates)}
                    onSelect={(candidate) => {
                      const inserted = insertMentionToken(
                        form.content,
                        candidate.nickname,
                        contentSelectionStartRef.current,
                        contentSelectionEndRef.current,
                      )
                      contentSelectionStartRef.current = inserted.cursor
                      contentSelectionEndRef.current = inserted.cursor
                      update('content', inserted.text)
                    }}
                    onRemove={removeMentionFromContent}
                    onClear={clearMentionContent}
                    onOpenChange={changeMentionPickerOpen}
                  />
                )}
                <StickerPicker
                  open={stickerPickerOpen}
                  onOpenChange={changeStickerPickerOpen}
                  onSelect={(sticker) => {
                    const inserted = insertStickerToken(
                      form.content,
                      sticker.id,
                      contentSelectionStartRef.current,
                      contentSelectionEndRef.current,
                    )
                    contentSelectionStartRef.current = inserted.cursor
                    contentSelectionEndRef.current = inserted.cursor
                    update('content', inserted.text)
                  }}
                  className='publisher-sticker-picker'
                />
              </View>
              {(section === 'community' || section === 'market') && form.images.length > 0 && (
                <MediaImageEditor
                  images={form.images}
                  maxCount={MAX_PUBLISH_IMAGES}
                  onAdd={() => void chooseImages()}
                  onMove={(index, direction) => update('images', moveMediaImage(form.images, index, direction))}
                  onRemove={(key) => update('images', form.images.filter((image) => image.key !== key))}
                  onRetry={(image) => void uploadImage(image)}
                />
              )}
            </View>}

            {section === 'errands' && (
              <View className='publisher-section publisher-section--details publisher-section--errands-details'>
                <SectionHeading title='任务信息' />
                <View className='publisher-route'>
                  <InputField className='publisher-route__field publisher-route__field--origin' inputId='publisher-pickup-location' label='取件地' value={form.pickupLocation} maxlength={100} placeholder='例如：北区快递站' onKeyboardVisibilityChange={onKeyboardVisibilityChange} onFocus={() => { setStickerPickerOpen(false); setActiveRouteField('pickupLocation') }} onInput={(value) => update('pickupLocation', value)} />
                  {activeRouteField === 'pickupLocation' && <RouteSuggestions kind='origin' value={form.pickupLocation} onSelect={(value) => { update('pickupLocation', value); setActiveRouteField(null) }} />}
                  <InputField className='publisher-route__field publisher-route__field--destination' inputId='publisher-dropoff-location' label='送达地' value={form.dropoffLocation} maxlength={100} placeholder='例如：图书馆南门' onKeyboardVisibilityChange={onKeyboardVisibilityChange} onFocus={() => { setStickerPickerOpen(false); setActiveRouteField('dropoffLocation') }} onInput={(value) => update('dropoffLocation', value)} />
                  {activeRouteField === 'dropoffLocation' && <RouteSuggestions kind='destination' value={form.dropoffLocation} onSelect={(value) => { update('dropoffLocation', value); setActiveRouteField(null) }} />}
                </View>
                <View className='publisher-task-meta'>
                  <View className='publisher-field publisher-field--inline'>
                    <Text className='publisher-field__label'>截止时间</Text>
                    <View className='publisher-picker-row'>
                      <Picker mode='date' value={form.deadlineDate} onChange={(event) => update('deadlineDate', String(event.detail.value))}><View>{form.deadlineDate}</View></Picker>
                      <Picker mode='time' value={form.deadlineTime} onChange={(event) => update('deadlineTime', String(event.detail.value))}><View>{form.deadlineTime}</View></Picker>
                    </View>
                  </View>
                  <InputField className='publisher-field--inline publisher-field--amount' inputId='publisher-reward-yuan' label='任务报酬' value={form.rewardYuan} type='digit' maxlength={8} placeholder='0.00' suffix='元' onKeyboardVisibilityChange={onKeyboardVisibilityChange} onFocus={() => setStickerPickerOpen(false)} onInput={(value) => update('rewardYuan', value)} />
                </View>
              </View>
            )}

            {section === 'market' && (
              <View className='publisher-section publisher-section--details publisher-section--market-details'>
                <InputField
                  className='publisher-field--inline publisher-field--amount publisher-field--price'
                  inputId='publisher-price-yuan'
                  label={form.marketIntent === 'wanted' ? '求购预算' : '商品售价'}
                  value={form.priceYuan}
                  type='digit'
                  maxlength={10}
                  placeholder='0.00'
                  suffix='元'
                  onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                  onFocus={() => setStickerPickerOpen(false)}
                  onInput={(value) => update('priceYuan', value)}
                />
              </View>
            )}

            {section === 'carpool' && (
              <View className='publisher-section publisher-section--details publisher-section--carpool-details'>
                <SectionHeading title='同行计划' />
                <View className='publisher-route'>
                  <InputField className='publisher-route__field publisher-route__field--origin' inputId='publisher-origin' label='出发地' value={form.origin} maxlength={100} placeholder='例如：海大崂山校区北门' onKeyboardVisibilityChange={onKeyboardVisibilityChange} onFocus={() => { setStickerPickerOpen(false); setActiveRouteField('origin') }} onInput={(value) => update('origin', value)} />
                  {activeRouteField === 'origin' && <RouteSuggestions kind='origin' value={form.origin} onSelect={(value) => { update('origin', value); setActiveRouteField(null) }} />}
                  <InputField className='publisher-route__field publisher-route__field--destination' inputId='publisher-destination' label='目的地' value={form.destination} maxlength={100} placeholder='例如：青岛北站' onKeyboardVisibilityChange={onKeyboardVisibilityChange} onFocus={() => { setStickerPickerOpen(false); setActiveRouteField('destination') }} onInput={(value) => update('destination', value)} />
                  {activeRouteField === 'destination' && <RouteSuggestions kind='destination' value={form.destination} onSelect={(value) => { update('destination', value); setActiveRouteField(null) }} />}
                </View>
                <View className='publisher-carpool-meta'>
                  <View className='publisher-field publisher-field--inline'>
                    <Text className='publisher-field__label'>出发时间</Text>
                    <View className='publisher-picker-row'>
                      <Picker mode='date' value={form.departureDate} onChange={(event) => update('departureDate', String(event.detail.value))}><View>{form.departureDate}</View></Picker>
                      <Picker mode='time' value={form.departureTime} onChange={(event) => update('departureTime', String(event.detail.value))}><View>{form.departureTime}</View></Picker>
                    </View>
                  </View>
                  <InputField className='publisher-field--inline publisher-field--seats' inputId='publisher-total-seats' label='同行名额' value={form.totalSeats} type='number' maxlength={2} placeholder='1–20' suffix='人' onKeyboardVisibilityChange={onKeyboardVisibilityChange} onFocus={() => setStickerPickerOpen(false)} onInput={(value) => update('totalSeats', value)} />
                </View>
              </View>
            )}

            {section === 'community' && (
              <View className='publisher-section publisher-section--community-details'>
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
                        ariaRole='button'
                        ariaLabel={`${form.communitySectionId === item.id ? '已选择，' : ''}发布到${item.name}`}
                        onClick={() => update('communitySectionId', item.id)}
                      >
                        <Text>{item.name}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {section !== 'community' && (
              <View className='publisher-section publisher-section--campus'>
                <SectionHeading title='发布范围' />
                <CampusSelector
                  value={form.campus}
                  onChange={(value) => update('campus', value)}
                />
              </View>
            )}

            {section !== 'community' && (
              <View className='publisher-section publisher-section--contact'>
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
                      onFocus={() => setStickerPickerOpen(false)}
                      onInput={(event) => update('contact', event.detail.value)}
                    />
                  </View>
                  <Text className='publisher-field__help'>仅交易相关用户可查看</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {section === 'community' && topicPickerOpen && (
        <View className='publisher-topic-overlay'>
          <View
            className='publisher-topic-overlay__mask'
            style={keyboardHeight > 0 ? `bottom: ${keyboardHeight}px;` : undefined}
            ariaRole='button'
            ariaLabel='关闭话题选择器'
            onClick={() => changeTopicPickerOpen(false)}
          />
          <View
            className='publisher-topic-sheet'
            style={keyboardHeight > 0
              ? `bottom: ${keyboardHeight}px; height: calc(100vh - ${keyboardHeight}px - 24rpx); max-height: calc(100vh - ${keyboardHeight}px - 24rpx);`
              : undefined}
            ariaRole='dialog'
            ariaLabel='添加话题'
          >
            <View className='publisher-topic-sheet__header'>
              <Text className='publisher-topic-sheet__title'>添加话题</Text>
              <View
                className='publisher-topic-sheet__cancel'
                ariaRole='button'
                ariaLabel='关闭话题选择器'
                onClick={() => changeTopicPickerOpen(false)}
              >
                取消
              </View>
            </View>

            <View className='publisher-topic-sheet__search'>
              <Text>#</Text>
              <KeyboardSafeInput
                id='publisher-topic-search'
                focus={topicPickerOpen}
                value={topicKeyword}
                maxlength={64}
                placeholder='搜索话题'
                placeholderClass='publisher-placeholder'
                confirmType='done'
                keepVisibleOnKeyboard={false}
                onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                onFocus={() => setStickerPickerOpen(false)}
                onInput={(event) => setTopicKeyword(event.detail.value.replace(/^#+/u, ''))}
                onConfirm={() => {
                  if (!topicNameExists && isCreatableTopicName(normalizedTopicKeyword)) {
                    addCommunityTopicName()
                  }
                }}
              />
            </View>

            <ScrollView className='publisher-topic-sheet__results' scrollY enhanced showScrollbar={false}>
              {topicSearchLoading && <Text className='publisher-topic-sheet__state'>正在搜索</Text>}
              {!topicSearchLoading && topicSearchError && (
                <Text className='publisher-topic-sheet__state'>暂时无法加载话题</Text>
              )}
              {!topicSearchLoading && !topicSearchError && normalizedTopicKeyword && !topicNameExists && isCreatableTopicName(normalizedTopicKeyword) && (
                <View
                  className='publisher-topic-result publisher-topic-result--create'
                  ariaRole='button'
                  ariaLabel={`添加新话题${normalizedTopicKeyword}`}
                  onClick={addCommunityTopicName}
                >
                  <View className='publisher-topic-result__copy'>
                    <Text className='publisher-topic-result__name'>#{normalizedTopicKeyword}</Text>
                    <Text className='publisher-topic-result__hint'>创建为新话题</Text>
                  </View>
                  <Text className='publisher-topic-result__action'>添加</Text>
                </View>
              )}
              {!topicSearchLoading && !topicSearchError && filteredTopics.map((item) => {
                const selected = form.communityTopicIds.includes(item.id)
                return (
                  <View
                    key={item.id}
                    className={`publisher-topic-result ${selected ? 'publisher-topic-result--selected' : ''}`}
                    ariaRole='button'
                    ariaLabel={`${selected ? '移除' : '添加'}话题${item.name}`}
                    onClick={() => {
                      toggleCommunityTopic(item.id)
                      changeTopicPickerOpen(false)
                    }}
                  >
                    <Text className='publisher-topic-result__name'>#{item.name}</Text>
                    <Text className='publisher-topic-result__meta'>{item.post_count} 条动态</Text>
                  </View>
                )
              })}
              {!topicSearchLoading && !topicSearchError && filteredTopics.length === 0 && !normalizedTopicKeyword && (
                <Text className='publisher-topic-sheet__state'>暂无可选话题</Text>
              )}
              {!topicSearchLoading && !topicSearchError && normalizedTopicKeyword && !isCreatableTopicName(normalizedTopicKeyword) && (
                <Text className='publisher-topic-sheet__state'>话题仅支持中文、字母、数字或下划线</Text>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {!loadingForm && (
        <View className={`publisher-actions ${keyboardHeight > 0 ? 'publisher-actions--keyboard' : ''}`}>
          {validationError && (
            <View className='publisher-actions__status'>
              <View />
              <Text>{validationError}</Text>
            </View>
          )}
          <View className='publisher-actions__buttons'>
            {mode === 'create' && (
              <View
                className='publisher-actions__draft'
                ariaRole='button'
                ariaLabel='保存草稿并退出'
                onClick={() => !submitting && saveAndLeave()}
              >
                保存退出
              </View>
            )}
            <View
              id='publisher-submit'
              className={`publisher-actions__submit ${validationError || submitting ? 'publisher-actions__submit--disabled' : ''}`}
              ariaRole='button'
              ariaLabel={submitting ? '正在提交' : validationError ? `暂不可提交，${validationError}` : '提交审核'}
              onClick={() => !validationError && !submitting && void submit()}
            >
              {submitting ? '正在提交' : mode === 'create' ? '提交审核' : '保存并提交'}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
