import { useEffect, useMemo, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Input, Picker, ScrollView, Text, Textarea, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { isApiError } from '../../api/client'
import type {
  CarpoolTripView,
  CampusCircleSectionView,
  ErrandView,
  MarketplaceListingView,
} from '../../api/types'
import { lifeServicesRepository } from '../../features/life-services/repository'
import './index.scss'

type PublishSection = 'community' | 'errands' | 'market' | 'carpool'
type PublishMode = 'create' | 'edit' | 'resubmit'

type PublisherForm = {
  content: string
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
  version: number
}

const DRAFT_KEY = 'lifePublisher.drafts.v2'
const CONTACT_LABELS = ['微信', '手机号', 'QQ']
const CONTACT_VALUES: PublisherForm['contactType'][] = ['wechat', 'phone', 'qq']

const sectionOptions: Array<{
  key: PublishSection
  label: string
  title: string
  hint: string
}> = [
  { key: 'community', label: '动态', title: '分享校园动态', hint: '记录校园生活、学习见闻与此刻心情' },
  { key: 'errands', label: '跑腿', title: '发布跑腿需求', hint: '把路线、时间和报酬说清楚，更容易被接单' },
  { key: 'market', label: '二手', title: '出售闲置好物', hint: '真实描述物品状态，优先选择校内面交' },
  { key: 'carpool', label: '拼车', title: '发布拼车行程', hint: '明确起终点、时间和座位，出发前再次确认' },
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

const emptyForm = (): PublisherForm => ({
  content: '',
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
  version: 0,
})

const flattenSections = (items: CampusCircleSectionView[]): CampusCircleSectionView[] => (
  items.flatMap((item) => [item, ...flattenSections(item.children || [])])
)

const storedDrafts = () => (
  Taro.getStorageSync<Partial<Record<PublishSection, PublisherForm>>>(DRAFT_KEY) || {}
)

const saveDraft = (section: PublishSection, form: PublisherForm) => {
  Taro.setStorageSync(DRAFT_KEY, {
    ...storedDrafts(),
    [section]: form,
  })
}

const clearDraft = (section: PublishSection) => {
  const drafts = storedDrafts()
  delete drafts[section]
  Taro.setStorageSync(DRAFT_KEY, drafts)
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
  onInput,
}: {
  label: string
  value: string
  placeholder: string
  maxlength?: number
  type?: 'text' | 'number' | 'digit'
  suffix?: string
  inputId?: string
  onInput: (value: string) => void
}) => (
  <View className='publisher-field'>
    <Text className='publisher-field__label'>{label}</Text>
    <View className='publisher-input'>
      <Input
        id={inputId}
        value={value}
        type={type}
        maxlength={maxlength}
        placeholder={placeholder}
        placeholderClass='publisher-placeholder'
        onInput={(event) => onInput(event.detail.value)}
      />
      {suffix && <Text>{suffix}</Text>}
    </View>
  </View>
)

export default function PublishPage() {
  const [section, setSection] = useState<PublishSection>('community')
  const [mode, setMode] = useState<PublishMode>('create')
  const [resourceId, setResourceId] = useState(0)
  const [form, setForm] = useState<PublisherForm>(emptyForm)
  const [sections, setSections] = useState<CampusCircleSectionView[]>([])
  const [sectionsReady, setSectionsReady] = useState(false)
  const [requestedCommunitySectionId, setRequestedCommunitySectionId] = useState(0)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const current = sectionOptions.find((item) => item.key === section) || sectionOptions[0]

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
    ...emptyForm(),
    content: item.description,
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
      const initialForm = storedDrafts()[initialSection] || emptyForm()
      setForm(
        initialSection === 'community' && initialCommunitySectionId > 0
          ? { ...initialForm, communitySectionId: initialCommunitySectionId }
          : initialForm,
      )
    }
    void lifeServicesRepository.listCampusCircleSections()
      .then((result) => setSections(result.items))
      .catch(() => setSections([]))
      .finally(() => setSectionsReady(true))
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
    const timer = setTimeout(() => saveDraft(section, form), 350)
    return () => clearTimeout(timer)
  }, [form, loadingEdit, mode, section])

  const selectSection = (next: PublishSection) => {
    if (mode !== 'create' || next === section) return
    saveDraft(section, form)
    setSection(next)
    setForm(storedDrafts()[next] || emptyForm())
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
    if (section === 'market' && toCents(form.priceYuan) <= 0) return '商品价格必须大于 0 元'
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
    clearDraft(section)
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
          description: form.content.trim(),
          price_cents: toCents(form.priceYuan),
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
      <CustomNavbar
        title={mode === 'create' ? '发布' : '编辑发布'}
        subtitle={mode === 'create' ? '统一发布器' : '修改后重新进入审核'}
        showBack
      />
      <View className='publisher-page__content'>
        <ScrollView className='publisher-types' scrollX enhanced showScrollbar={false}>
          <View className='publisher-types__inner'>
            {sectionOptions.map((item) => (
              <View
                key={item.key}
                className={`publisher-type ${section === item.key ? 'publisher-type--active' : ''} ${mode !== 'create' ? 'publisher-type--locked' : ''}`}
                onClick={() => selectSection(item.key)}
              >
                {item.label}
              </View>
            ))}
          </View>
        </ScrollView>

        <View className={`publisher-hero publisher-hero--${section}`}>
          <Text>{current.title}</Text>
          <Text>{current.hint}</Text>
          <View><Text>{mode === 'create' ? '自动保存草稿' : `编辑资源 #${resourceId}`}</Text><Text>提交后进入审核</Text></View>
        </View>

        {loadingEdit ? (
          <View className='publisher-loading'>正在加载原内容</View>
        ) : (
          <>
            <View className='publisher-section'>
              <Text className='publisher-section__title'>基本信息</Text>
              <View className='publisher-field'>
                <Text className='publisher-field__label'>
                  {section === 'community'
                    ? '动态内容'
                    : section === 'errands'
                      ? '任务说明'
                      : section === 'market'
                        ? '物品描述'
                        : '补充说明（可选）'}
                </Text>
                <View className='publisher-textarea'>
                  <Textarea
                    id='publisher-content'
                    value={form.content}
                    maxlength={section === 'community' ? 5000 : 2000}
                    placeholder={section === 'market' ? '描述成色、配件和使用情况' : section === 'errands' ? '说明物品、时间要求和注意事项' : section === 'carpool' ? '补充集合、行李或返程信息（可选）' : '分享真实、友善的校园内容'}
                    placeholderClass='publisher-placeholder'
                    onInput={(event) => update('content', event.detail.value)}
                  />
                  <Text>{form.content.length}</Text>
                </View>
              </View>
            </View>

            {section === 'errands' && (
              <View className='publisher-section'>
                <Text className='publisher-section__title'>任务与路线</Text>
                <InputField inputId='publisher-pickup-location' label='取件地' value={form.pickupLocation} maxlength={100} placeholder='例如：北区快递站' onInput={(value) => update('pickupLocation', value)} />
                <InputField inputId='publisher-dropoff-location' label='送达地' value={form.dropoffLocation} maxlength={100} placeholder='例如：图书馆南门' onInput={(value) => update('dropoffLocation', value)} />
                <View className='publisher-field'>
                  <Text className='publisher-field__label'>截止时间</Text>
                  <View className='publisher-picker-row'>
                    <Picker mode='date' value={form.deadlineDate} onChange={(event) => update('deadlineDate', String(event.detail.value))}><View>{form.deadlineDate}</View></Picker>
                    <Picker mode='time' value={form.deadlineTime} onChange={(event) => update('deadlineTime', String(event.detail.value))}><View>{form.deadlineTime}</View></Picker>
                  </View>
                </View>
                <InputField inputId='publisher-reward-yuan' label='任务报酬' value={form.rewardYuan} type='digit' maxlength={8} placeholder='请输入报酬' suffix='元' onInput={(value) => update('rewardYuan', value)} />
              </View>
            )}

            {section === 'market' && (
              <View className='publisher-section'>
                <Text className='publisher-section__title'>交易信息</Text>
                <InputField inputId='publisher-price-yuan' label='商品售价' value={form.priceYuan} type='digit' maxlength={10} placeholder='请输入售价' suffix='元' onInput={(value) => update('priceYuan', value)} />
                <View className='publisher-note'>
                  <Text>图片能力准备中</Text>
                  <Text>当前版本可先发布文字商品；通用校园媒体上传接通后，这里会支持 1–9 张图片排序。</Text>
                </View>
              </View>
            )}

            {section === 'carpool' && (
              <View className='publisher-section'>
                <Text className='publisher-section__title'>路线与座位</Text>
                <InputField inputId='publisher-origin' label='出发地' value={form.origin} maxlength={100} placeholder='例如：海大崂山校区北门' onInput={(value) => update('origin', value)} />
                <InputField inputId='publisher-destination' label='目的地' value={form.destination} maxlength={100} placeholder='例如：青岛北站' onInput={(value) => update('destination', value)} />
                <View className='publisher-field'>
                  <Text className='publisher-field__label'>出发时间</Text>
                  <View className='publisher-picker-row'>
                    <Picker mode='date' value={form.departureDate} onChange={(event) => update('departureDate', String(event.detail.value))}><View>{form.departureDate}</View></Picker>
                    <Picker mode='time' value={form.departureTime} onChange={(event) => update('departureTime', String(event.detail.value))}><View>{form.departureTime}</View></Picker>
                  </View>
                </View>
                <InputField inputId='publisher-total-seats' label='可加入人数' value={form.totalSeats} type='number' maxlength={2} placeholder='1–20' suffix='人' onInput={(value) => update('totalSeats', value)} />
              </View>
            )}

            {section === 'community' && (
              <View className='publisher-section'>
                <Text className='publisher-section__title'>发布板块</Text>
                {!sectionsReady && (
                  <View className='publisher-note'>
                    <Text>正在读取服务端板块</Text>
                    <Text>板块加载完成后才可提交。</Text>
                  </View>
                )}
                {sectionsReady && communitySectionOptions.length === 0 && (
                  <View className='publisher-note'>
                    <Text>暂无启用板块</Text>
                    <Text>请联系管理员在服务端创建并启用社区板块。</Text>
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
                <View className='publisher-note publisher-note--safe'>
                  <Text>板块由服务端统一配置</Text>
                  <Text>内容提交后进入审核，通过后才会出现在对应板块。</Text>
                </View>
              </View>
            )}

            {section !== 'community' && (
              <View className='publisher-section'>
                <Text className='publisher-section__title'>联系与安全</Text>
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
                    <Input
                      id='publisher-contact'
                      value={form.contact}
                      maxlength={128}
                      placeholder='仅在服务端授权后展示'
                      placeholderClass='publisher-placeholder'
                      onInput={(event) => update('contact', event.detail.value)}
                    />
                  </View>
                </View>
                <View className='publisher-note publisher-note--safe'>
                  <Text>联系方式不会公开展示</Text>
                  <Text>平台按发布者、参与者与交易状态决定谁可以查看完整联系方式。</Text>
                </View>
              </View>
            )}

            <View className='publisher-rule'>
              <Text>提交前请确认</Text>
              <Text>内容真实、字段完整，不发布验证码、账号密码或他人隐私。提交后会进入校园内容审核，并可在“我的服务”查看进度。</Text>
            </View>
          </>
        )}
      </View>

      {!loadingEdit && (
        <View className='publisher-actions'>
          {mode === 'create' && <View className='publisher-actions__draft' onClick={saveAndLeave}>保存草稿</View>}
          <View
            id='publisher-submit'
            className={`publisher-actions__submit ${validationError ? 'publisher-actions__submit--disabled' : ''}`}
            onClick={() => void submit()}
          >
            {submitting ? '正在提交' : mode === 'create' ? '提交审核' : '保存并提交'}
          </View>
        </View>
      )}
    </View>
  )
}
