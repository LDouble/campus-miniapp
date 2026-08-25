import { useMemo, useRef, useState } from 'react'
import Taro, {
  useDidShow,
  useLoad,
  usePullDownRefresh,
  useReachBottom,
} from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import type {
  CampusCirclePostView,
  CarpoolTripView,
  ErrandView,
  MarketplaceListingView,
  TradeOrderView,
} from '../../api/types'
import { isApiError } from '../../api/client'
import {
  requestWechatSubscriptionAndStopPropagation,
  requestWechatSubscriptionForModule,
  requestWechatSubscriptionForPublishSection,
} from '../../features/wechat-subscription'
import CustomNavbar from '../../components/custom-navbar'
import StickerContent from '../../components/sticker-content'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import {
  formatDateTime,
  formatMoney,
  formatOrderStatus,
  formatStatus,
  remainingSeats,
} from '../../features/life-services/format'
import { lifeServicesRepository } from '../../features/life-services/repository'
import { markLifeHubSectionDirty } from '../../features/life-services/refresh-policy'
import { saveCommunityDetailSnapshot } from '../../features/community/detail-snapshot'
import { saveBusinessDetailSnapshot } from '../../features/life-services/business-detail-snapshot'
import { plainStickerContent } from '../../features/stickers/content'
import { directMessageChatUrl } from '../../features/direct-messages/navigation'
import { privateMessagesRepository } from '../../features/direct-messages/repository'
import './index.scss'

type Section = 'published' | 'errands' | 'orders' | 'carpool'
type PublishedType = 'community' | 'errands' | 'market' | 'carpool'
type RecordItem =
  | CampusCirclePostView
  | ErrandView
  | MarketplaceListingView
  | CarpoolTripView
  | TradeOrderView

type PageResult = {
  items: RecordItem[]
  page: number
  page_size: number
  total: number
}

type ViewQuery = {
  section: Section
  relation: string
  publishedType: PublishedType
  orderType: 'all' | 'marketplace' | 'errand'
}

type FilterOption<TKey extends string> = {
  key: TKey
  label: string
}

type FilterStripProps<TKey extends string> = {
  label: string
  options: ReadonlyArray<FilterOption<TKey>>
  value: TKey
  secondary?: boolean
  onChange: (key: TKey) => void
}

const PAGE_SIZE = 20

const sections: Array<{ key: Section; label: string }> = [
  { key: 'published', label: '发布' },
  { key: 'errands', label: '接单' },
  { key: 'orders', label: '订单' },
  { key: 'carpool', label: '同行' },
]

const publishedTypes: Array<{ key: PublishedType; label: string }> = [
  { key: 'community', label: '动态' },
  { key: 'errands', label: '跑腿' },
  { key: 'market', label: '二手' },
  { key: 'carpool', label: '同行' },
]

const relationOptions: Record<Exclude<Section, 'published'>, Array<{ key: string; label: string }>> = {
  errands: [
    { key: 'accepted', label: '我接的' },
    { key: 'all', label: '全部相关' },
  ],
  orders: [
    { key: 'all', label: '全部' },
    { key: 'buyer', label: '我买到的' },
    { key: 'seller', label: '我卖出的' },
  ],
  carpool: [
    { key: 'organized', label: '我发起的' },
    { key: 'joined', label: '我参与的' },
    { key: 'all', label: '全部相关' },
  ],
}

const orderTypes = [
  { key: 'all', label: '全部类型' },
  { key: 'marketplace', label: '二手' },
  { key: 'errand', label: '跑腿' },
] as const

function FilterStrip<TKey extends string>({
  label,
  options,
  value,
  secondary = false,
  onChange,
}: FilterStripProps<TKey>) {
  return (
    <ScrollView
      className={`my-services-filter-scroll ${secondary ? 'my-services-filter-scroll--secondary' : ''}`}
      scrollX
      enhanced
      showScrollbar={false}
      ariaLabel={label}
    >
      <View className='my-services-filters'>
        {options.map((item) => (
          <View
            key={item.key}
            className={`my-services-filter my-services-filter--${item.key} ${value === item.key ? 'my-services-filter--active' : ''}`}
            ariaRole='button'
            ariaLabel={`${label}：${item.label}`}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const defaultRelation = (section: Section) => {
  if (section === 'errands') return 'accepted'
  if (section === 'carpool') return 'organized'
  return 'all'
}

const parseInitialView = (options: Record<string, string | undefined>): ViewQuery => {
  const requested = options.section
  if (requested === 'community' || requested === 'market') {
    return {
      section: 'published',
      relation: 'all',
      publishedType: requested,
      orderType: 'all',
    }
  }
  const section: Section = sections.some((item) => item.key === requested)
    ? requested as Section
    : requested === 'carpool'
      ? 'carpool'
      : 'published'
  const allowedRelations = section === 'published'
    ? []
    : relationOptions[section].map((item) => item.key)
  const relation = options.relation && allowedRelations.includes(options.relation)
    ? options.relation
    : defaultRelation(section)
  return {
    section,
    relation,
    publishedType: requested === 'errands' ? 'errands' : 'community',
    orderType: 'all',
  }
}

const recordSearchText = (item: RecordItem) => {
  if ('order_no' in item) {
    return `${item.order_no} ${item.title_snapshot} ${item.order_type}`
  }
  if ('pickup_location' in item) {
    return `${plainStickerContent(item.description)} ${item.pickup_location} ${item.dropoff_location}`
  }
  if ('price_cents' in item) {
    return plainStickerContent(item.description)
  }
  if ('departure_at' in item) {
    return `${plainStickerContent(item.description || '')} ${item.origin} ${item.destination}`
  }
  return plainStickerContent(item.content || '')
}

const openBusinessRecord = (item: RecordItem) => {
  let url = ''
  let module: 'community' | 'errand' | 'marketplace' | 'carpool'
  if ('order_no' in item) {
    if (item.resource_type === 'marketplace_listing') {
      module = 'marketplace'
      url = `/pages/marketplace/detail?id=${item.resource_id}`
    } else {
      module = 'errand'
      url = `/pages/errands/detail?id=${item.resource_id}`
    }
  } else if ('pickup_location' in item) {
    module = 'errand'
    saveBusinessDetailSnapshot('errand', item)
    url = `/pages/errands/detail?id=${item.id}&snapshot=1`
  } else if ('price_cents' in item) {
    module = 'marketplace'
    saveBusinessDetailSnapshot('marketplace', item)
    url = `/pages/marketplace/detail?id=${item.id}&snapshot=1`
  } else if ('departure_at' in item) {
    module = 'carpool'
    saveBusinessDetailSnapshot('carpool', item)
    url = `/pages/carpool/detail?id=${item.id}&snapshot=1`
  } else {
    module = 'community'
    saveCommunityDetailSnapshot(item as CampusCirclePostView)
    url = `/pages/community/detail?id=${item.id}&mode=post&snapshot=1`
  }
  requestWechatSubscriptionForModule(module)
  Taro.navigateTo({ url })
}

const positiveUserId = (value: unknown) => (
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0
)

const contactUserIdFor = (item: RecordItem) => {
  if ('order_no' in item || 'pickup_location' in item || 'departure_at' in item) {
    return positiveUserId((item as RecordItem & { contact_user_id?: number | null }).contact_user_id)
  }
  return 0
}

const mergePage = (current: RecordItem[], incoming: RecordItem[]) => {
  const seen = new Set(current.map((item) => `${'order_no' in item ? 'order' : 'record'}:${item.id}`))
  return current.concat(incoming.filter((item) => {
    const key = `${'order_no' in item ? 'order' : 'record'}:${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }))
}

const fetchPage = async (view: ViewQuery, page: number): Promise<PageResult> => {
  const paging = { page, pageSize: PAGE_SIZE }
  if (view.section === 'published') {
    if (view.publishedType === 'community') {
      return lifeServicesRepository.listMyCampusCirclePosts(paging)
    }
    if (view.publishedType === 'errands') {
      return lifeServicesRepository.listMyErrands({ ...paging, relation: 'published' })
    }
    if (view.publishedType === 'market') {
      return lifeServicesRepository.listMyMarketplaceListings(paging)
    }
    return lifeServicesRepository.listMyCarpoolTrips({ ...paging, relation: 'organized' })
  }
  if (view.section === 'errands') {
    return lifeServicesRepository.listMyErrands({
      ...paging,
      relation: view.relation as 'accepted' | 'all',
    })
  }
  if (view.section === 'orders') {
    return lifeServicesRepository.listMyTradeOrders({
      ...paging,
      relation: view.relation as 'all' | 'buyer' | 'seller',
      orderType: view.orderType === 'all' ? undefined : view.orderType,
    })
  }
  return lifeServicesRepository.listMyCarpoolTrips({
    ...paging,
    relation: view.relation as 'organized' | 'joined' | 'all',
  })
}

export default function MyServicesPage() {
  const initialView: ViewQuery = {
    section: 'published',
    relation: 'all',
    publishedType: 'community',
    orderType: 'all',
  }
  const [view, setView] = useState<ViewQuery>(initialView)
  const viewRef = useRef(initialView)
  const [items, setItems] = useState<RecordItem[]>([])
  const [page, setPage] = useState(0)
  const pageRef = useRef(0)
  const [total, setTotal] = useState(0)
  const totalRef = useRef(0)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [actionOrderId, setActionOrderId] = useState(0)
  const [contactUserId, setContactUserId] = useState(0)
  const requestVersion = useRef(0)
  const firstDidShow = useRef(true)

  const load = async (target = viewRef.current, reset = true) => {
    if (!reset && (loadingMore || items.length >= totalRef.current)) return
    const targetPage = reset ? 1 : pageRef.current + 1
    const version = reset ? requestVersion.current + 1 : requestVersion.current
    if (reset) {
      requestVersion.current = version
      setLoading(true)
      setError('')
    } else {
      setLoadingMore(true)
    }
    try {
      const result = await fetchPage(target, targetPage)
      if (version !== requestVersion.current || target !== viewRef.current) return
      setItems((current) => reset ? result.items : mergePage(current, result.items))
      pageRef.current = result.page
      totalRef.current = result.total
      setPage(result.page)
      setTotal(result.total)
    } catch (loadError) {
      if (version === requestVersion.current) {
        setError(isApiError(loadError) ? loadError.message : '服务记录加载失败')
      }
    } finally {
      if (version === requestVersion.current) {
        setLoading(false)
        setLoadingMore(false)
      }
      Taro.stopPullDownRefresh()
    }
  }

  const changeView = (next: ViewQuery) => {
    viewRef.current = next
    setView(next)
    setKeyword('')
    setItems([])
    pageRef.current = 0
    totalRef.current = 0
    setPage(0)
    setTotal(0)
    void load(next, true)
  }

  useLoad((options) => {
    changeView(parseInitialView(options))
  })

  useDidShow(() => {
    if (firstDidShow.current) {
      firstDidShow.current = false
      return
    }
    void load(viewRef.current, true)
  })

  usePullDownRefresh(() => {
    void load(viewRef.current, true)
  })

  useReachBottom(() => {
    void load(viewRef.current, false)
  })

  const visible = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) return items
    return items.filter((item) => recordSearchText(item).toLowerCase().includes(normalized))
  }, [items, keyword])

  const selectSection = (section: Section) => {
    changeView({
      ...viewRef.current,
      section,
      relation: defaultRelation(section),
    })
  }

  const openPublish = () => {
    const section = view.section === 'published'
      ? view.publishedType
      : view.section === 'errands'
        ? 'errands'
        : view.section === 'carpool'
          ? 'carpool'
          : 'market'
    requestWechatSubscriptionForPublishSection(section)
    Taro.navigateTo({ url: `/pages/publish/index?section=${section}` })
  }

  const emptyAction = () => {
    if (view.section === 'errands') {
      Taro.switchTab({ url: '/pages/community/index' })
      return
    }
    if (view.section === 'orders') {
      Taro.switchTab({ url: '/pages/community/index' })
      return
    }
    if (view.section === 'carpool') {
      Taro.switchTab({ url: '/pages/community/index' })
      return
    }
    openPublish()
  }

  const runOrderAction = async (
    order: TradeOrderView,
    action: 'cancel' | 'complete',
  ) => {
    const modal = await Taro.showModal({
      title: action === 'cancel' ? '取消订单' : '确认完成',
      content: action === 'cancel'
        ? '取消后将同步更新对应业务状态，是否继续？'
        : '请确认线下履约已经完成。',
      confirmText: action === 'cancel' ? '确认取消' : '确认完成',
    })
    if (!modal.confirm) return
    setActionOrderId(order.id)
    try {
      const updated = action === 'cancel'
        ? await lifeServicesRepository.cancelTradeOrder(order.id, order.version)
        : await lifeServicesRepository.completeTradeOrder(order.id, order.version)
      setItems((current) => current.map((item) => (
        'order_no' in item && item.id === updated.id ? updated : item
      )))
      markLifeHubSectionDirty('market')
      Taro.showToast({ title: action === 'cancel' ? '订单已取消' : '订单已完成', icon: 'success' })
    } catch (actionError) {
      Taro.showToast({
        title: isApiError(actionError) ? actionError.message : '订单操作失败',
        icon: 'none',
      })
    } finally {
      setActionOrderId(0)
    }
  }

  const openContact = async (item: RecordItem) => {
    const peerId = contactUserIdFor(item)
    if (!peerId) {
      Taro.showToast({ title: '暂时没有可联系的对方', icon: 'none' })
      return
    }
    setContactUserId(peerId)
    try {
      const conversation = await privateMessagesRepository.createConversation(peerId)
      await Taro.navigateTo({ url: directMessageChatUrl(conversation.id) })
    } catch (openError) {
      Taro.showToast({
        title: isApiError(openError) ? openError.message : '暂时无法打开私信，请稍后重试',
        icon: 'none',
      })
    } finally {
      setContactUserId(0)
    }
  }

  const emptyCopy = view.section === 'errands'
    ? ['还没有接过跑腿任务', '去看看有哪些待接任务吧']
    : view.section === 'orders'
      ? ['还没有交易订单', '完成接单或二手预订后会显示在这里']
      : view.section === 'carpool'
        ? ['还没有同行计划', '可以发布计划或响应同路同学']
        : ['还没有发布记录', '从统一发布器创建第一条内容']

  const currentPublishedType = publishedTypes.find(
    (item) => item.key === view.publishedType,
  )?.label || '动态'
  const heroSummary = view.section === 'published'
    ? `${currentPublishedType} · 共 ${total} 条记录`
    : `当前筛选 · 共 ${total} 条记录`

  return (
    <View className={`my-services my-services--${view.section}`}>
      <CustomNavbar title='我的发布' showBack />
      <View className='my-services__content'>
        <View className='my-services-hero'>
          <View className='my-services-hero__copy'>
            <Text className='my-services-hero__eyebrow'>CAMPUS ACTIVITY</Text>
            <Text className='my-services-hero__title'>我的校园足迹</Text>
            <Text className='my-services-hero__summary'>{heroSummary}</Text>
          </View>
          <View
            className='my-services-hero__publish'
            ariaRole='button'
            ariaLabel='发布新内容'
            onClick={openPublish}
          >
            <View className='my-services-hero__publish-icon' />
            <Text>发布</Text>
          </View>
        </View>

        <ScrollView className='my-services-tabs' scrollX enhanced showScrollbar={false}>
          <View className='my-services-tabs__inner'>
            {sections.map((item) => (
              <View
                key={item.key}
                className={`my-services-tabs__item my-services-tabs__item--${item.key} ${view.section === item.key ? 'my-services-tabs__item--active' : ''}`}
                ariaRole='button'
                ariaLabel={`查看${item.label}记录`}
                onClick={() => selectSection(item.key)}
              >
                {item.label}
              </View>
            ))}
          </View>
        </ScrollView>

        {view.section === 'published' && (
          <FilterStrip
            label='发布类型'
            options={publishedTypes}
            value={view.publishedType}
            onChange={(publishedType) => changeView({ ...viewRef.current, publishedType })}
          />
        )}

        {view.section !== 'published' && (
          <FilterStrip
            label='记录关系'
            options={relationOptions[view.section]}
            value={view.relation}
            onChange={(relation) => changeView({ ...viewRef.current, relation })}
          />
        )}

        {view.section === 'orders' && (
          <FilterStrip
            label='订单类型'
            options={orderTypes}
            value={view.orderType}
            secondary
            onChange={(orderType) => changeView({ ...viewRef.current, orderType })}
          />
        )}

        <View className='my-services-search'>
          <View className='my-services-search__icon' />
          <KeyboardSafeInput
            value={keyword}
            confirmType='search'
            maxlength={40}
            placeholder='搜索当前已加载记录'
            ariaLabel='搜索当前已加载记录'
            onInput={(event) => setKeyword(event.detail.value)}
          />
          {keyword && (
            <View
              className='my-services-search__clear'
              ariaRole='button'
              ariaLabel='清除搜索内容'
              onClick={() => setKeyword('')}
            >
              清除
            </View>
          )}
        </View>

        {loading && <View className='my-services-state'>正在加载真实服务记录</View>}
        {!loading && error && (
          <View className='my-services-state my-services-state--error'>
            <Text>{error}</Text>
            <View onClick={() => void load(viewRef.current, true)}>重新加载</View>
          </View>
        )}

        {!loading && !error && visible.map((item) => {
          if ('order_no' in item) {
            const order = item as TradeOrderView
            return (
              <View
                key={`order:${order.id}`}
                className='my-record-card my-record-card--order'
                ariaRole='button'
                ariaLabel={`查看${order.title_snapshot}订单详情`}
                onClick={() => openBusinessRecord(order)}
              >
                <View className='my-record-card__top'>
                  <Text className='my-record-card__kind'>{order.order_type === 'marketplace' ? '二手订单' : '跑腿订单'}</Text>
                  <Text className='my-record-card__status'>{formatOrderStatus(order.trade_status, order.fulfillment_status)}</Text>
                </View>
                <View className='my-record-card__amount'>{formatMoney(order.amount_cents)}</View>
                <Text className='my-record-card__title'>{order.title_snapshot}</Text>
                <Text className='my-record-card__body'>
                  {order.viewer_relation === 'buyer' ? '我是买方 / 发布者' : '我是卖方 / 接单者'} · {order.order_no}
                </Text>
                <View className='my-record-card__footer'>
                  <Text>{formatDateTime(order.updated_at)}</Text>
                  <Text>查看业务详情 ›</Text>
                </View>
                {(contactUserIdFor(order) > 0 || order.available_actions.includes('cancel') || order.available_actions.includes('complete')) && (
                  <View className='my-record-actions'>
                    {contactUserIdFor(order) > 0 && (
                      <View
                        className='my-record-actions__contact'
                        ariaRole='button'
                        ariaLabel='联系对方'
                        onClick={(event) => {
                          event.stopPropagation()
                          void openContact(order)
                        }}
                      >
                        {contactUserId === contactUserIdFor(order) ? '正在打开' : '联系对方'}
                      </View>
                    )}
                    {order.available_actions.includes('cancel') && (
                      <View
                        className='my-record-actions__secondary'
                        ariaRole='button'
                        ariaLabel='取消订单'
                        onClick={(event) => {
                          requestWechatSubscriptionAndStopPropagation(event)
                          void runOrderAction(order, 'cancel')
                        }}
                      >
                        {actionOrderId === order.id ? '处理中' : '取消订单'}
                      </View>
                    )}
                    {order.available_actions.includes('complete') && (
                      <View
                        className='my-record-actions__primary'
                        ariaRole='button'
                        ariaLabel='确认订单已完成'
                        onClick={(event) => {
                          requestWechatSubscriptionAndStopPropagation(event)
                          void runOrderAction(order, 'complete')
                        }}
                      >
                        {actionOrderId === order.id ? '处理中' : '确认完成'}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )
          }
          if ('pickup_location' in item) {
            const errand = item as ErrandView
            return (
              <View key={`errand:${errand.id}`} className='my-record-card my-record-card--errand' ariaRole='button' ariaLabel='查看跑腿详情' onClick={() => openBusinessRecord(errand)}>
                <View className='my-record-card__top'>
                  <Text className='my-record-card__kind'>{errand.viewer_relation === 'runner' ? '我的接单' : '我发布的跑腿'}</Text>
                  <Text className='my-record-card__status'>{formatStatus(errand.status, errand.review_status)}</Text>
                </View>
                <View className='my-record-card__amount'>{formatMoney(errand.reward_cents)}</View>
                <StickerContent content={errand.description} className='my-record-card__body' stickerClassName='my-record-card__sticker' />
                <View className='my-record-route'>
                  <Text>{errand.pickup_location}</Text><View className='my-record-route__line' /><Text>{errand.dropoff_location}</Text>
                </View>
                <View className='my-record-card__footer'>
                  <Text>{formatDateTime(errand.deadline)}</Text><Text>查看进度 ›</Text>
                </View>
                {contactUserIdFor(errand) > 0 && (
                  <View className='my-record-actions'>
                    <View
                      className='my-record-actions__contact'
                      ariaRole='button'
                      ariaLabel='联系对方'
                      onClick={(event) => {
                        event.stopPropagation()
                        void openContact(errand)
                      }}
                    >
                      {contactUserId === contactUserIdFor(errand) ? '正在打开' : '联系对方'}
                    </View>
                  </View>
                )}
              </View>
            )
          }
          if ('price_cents' in item) {
            const listing = item as MarketplaceListingView
            return (
              <View key={`market:${listing.id}`} className='my-record-card my-record-card--market' ariaRole='button' ariaLabel='查看二手商品详情' onClick={() => openBusinessRecord(listing)}>
                <View className='my-record-card__top'>
                  <Text className='my-record-card__kind'>我发布的二手</Text><Text className='my-record-card__status'>{formatStatus(listing.status)}</Text>
                </View>
                <View className='my-record-card__amount'>{formatMoney(listing.price_cents)}</View>
                <StickerContent content={listing.description} className='my-record-card__body' stickerClassName='my-record-card__sticker' />
                <View className='my-record-card__footer'>
                  <Text>{formatDateTime(listing.updated_at)}</Text><Text>查看商品 ›</Text>
                </View>
              </View>
            )
          }
          if ('departure_at' in item) {
            const trip = item as CarpoolTripView
            return (
              <View key={`carpool:${trip.id}`} className='my-record-card my-record-card--carpool' ariaRole='button' ariaLabel='查看同行详情' onClick={() => openBusinessRecord(trip)}>
                <View className='my-record-card__top'>
                  <Text className='my-record-card__kind'>{trip.viewer_relation === 'participant' ? '我参与的同行' : '我发起的同行'}</Text>
                  <Text className='my-record-card__status'>{formatStatus(trip.status, trip.review_status)}</Text>
                </View>
                <View className='my-record-route'>
                  <Text>{trip.origin}</Text><View className='my-record-route__line' /><Text>{trip.destination}</Text>
                </View>
                {trip.description && <StickerContent content={trip.description} className='my-record-card__body' stickerClassName='my-record-card__sticker' />}
                <View className='my-record-card__footer'>
                  <Text>{formatDateTime(trip.departure_at)}</Text>
                  <Text>{remainingSeats(trip.total_seats, trip.occupied_seats)} 人可同行 ›</Text>
                </View>
                {contactUserIdFor(trip) > 0 && (
                  <View className='my-record-actions'>
                    <View
                      className='my-record-actions__contact'
                      ariaRole='button'
                      ariaLabel='联系对方'
                      onClick={(event) => {
                        event.stopPropagation()
                        void openContact(trip)
                      }}
                    >
                      {contactUserId === contactUserIdFor(trip) ? '正在打开' : '联系对方'}
                    </View>
                  </View>
                )}
              </View>
            )
          }
          const post = item as CampusCirclePostView
          return (
            <View key={`post:${post.id}`} className='my-record-card' ariaRole='button' ariaLabel='查看动态详情' onClick={() => openBusinessRecord(post)}>
              <View className='my-record-card__top'>
                <Text className='my-record-card__kind'>我发布的动态</Text><Text className='my-record-card__status'>{formatStatus(post.status)}</Text>
              </View>
              <StickerContent content={post.content || '图片动态'} className='my-record-card__body' stickerClassName='my-record-card__sticker' />
              <View className='my-record-card__footer'>
                <Text>{formatDateTime(post.updated_at)}</Text>
                <Text>{post.like_count} 赞 · {post.comment_count} 评论</Text>
              </View>
            </View>
          )
        })}

        {!loading && !error && visible.length === 0 && (
          <View className='my-services-state my-services-state--empty'>
            <View>OUC</View>
            <Text>{keyword ? '没有找到相关记录' : emptyCopy[0]}</Text>
            <Text>{keyword ? '可清除关键词继续查看' : emptyCopy[1]}</Text>
            {!keyword && <View className='my-services-state__action' onClick={emptyAction}>去看看</View>}
          </View>
        )}

        {!loading && !error && visible.length > 0 && (
          <View className='my-services-load-more'>
            {items.length < total
              ? loadingMore ? '正在加载更多' : `继续上拉加载 · 第 ${page} 页`
              : '已经到底了'}
          </View>
        )}
      </View>
    </View>
  )
}
