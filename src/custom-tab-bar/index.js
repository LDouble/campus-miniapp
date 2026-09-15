import {
  requestWechatSubscriptionForModule,
  requestWechatSubscriptionForPublishSection
} from '../features/wechat-subscription'
import { getCampusTheme, subscribeCampusTheme } from '../features/theme-preference'

const qualification = __CAMPUS_APP_EDITION__ === 'qualification'
const unreadCountStorageKey = 'campus.messages.unread-count.v1'
const privateUnreadCountStorageKey = 'campus.private-messages.unread-count.v1'

const getStoredUnreadCount = () => {
  const noticeCount = Number(wx.getStorageSync(unreadCountStorageKey))
  const privateCount = Number(wx.getStorageSync(privateUnreadCountStorageKey))
  const normalizedNoticeCount = Number.isFinite(noticeCount) ? Math.max(0, Math.floor(noticeCount)) : 0
  const normalizedPrivateCount = Number.isFinite(privateCount) ? Math.max(0, Math.floor(privateCount)) : 0
  return normalizedNoticeCount + normalizedPrivateCount
}

const fullTabs = [
  {
    pagePath: 'pages/index/index',
    text: '首页',
    iconPath: '/assets/tabbar/home.png',
    selectedIconPath: '/assets/tabbar/home-active.png'
  },
  {
    pagePath: 'pages/community/index',
    text: '社区',
    iconPath: '/assets/tabbar/community.png',
    selectedIconPath: '/assets/tabbar/community-active.png'
  },
  {
    pagePath: 'pages/messages/index',
    text: '消息',
    iconPath: '/assets/tabbar/messages.png',
    selectedIconPath: '/assets/tabbar/messages-active.png'
  },
  {
    pagePath: 'pages/profile/index',
    text: '我的',
    iconPath: '/assets/tabbar/profile.png',
    selectedIconPath: '/assets/tabbar/profile-active.png'
  }
]

Component({
  data: {
    selected: 0,
    hidden: false,
    darkMode: getCampusTheme() === 'dark',
    unreadCount: getStoredUnreadCount(),
    publishSection: 'community',
    qualification,
    list: qualification ? fullTabs.filter(item => item.pagePath !== 'pages/community/index') : fullTabs
  },

  lifetimes: {
    attached() {
      this.unsubscribeCampusTheme = subscribeCampusTheme((theme) => {
        this.setData({ darkMode: theme === 'dark' })
      })
      this.syncSelected()
    },
    detached() {
      if (this.unsubscribeCampusTheme) this.unsubscribeCampusTheme()
    }
  },

  pageLifetimes: {
    show() {
      if (this.data.hidden) {
        this.setData({ hidden: false })
      }
      this.syncSelected()
    }
  },

  methods: {
    syncSelected() {
      const pages = getCurrentPages()
      const route = pages.length
        ? pages[pages.length - 1].route.replace(/^\//, '')
        : ''
      const selected = this.data.list.findIndex(item => item.pagePath === route)
      const darkMode = getCampusTheme() === 'dark'
      const nextData = {}

      if (selected >= 0 && selected !== this.data.selected) {
        nextData.selected = selected
      }
      if (darkMode !== this.data.darkMode) {
        nextData.darkMode = darkMode
      }
      const unreadCount = getStoredUnreadCount()
      if (unreadCount !== this.data.unreadCount) {
        nextData.unreadCount = unreadCount
      }
      if (Object.keys(nextData).length > 0) {
        this.setData(nextData)
      }
    },

    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      const item = this.data.list[index]

      if (!item) return

      if (index === this.data.selected) {
        if (item.pagePath === 'pages/community/index') {
          wx.pageScrollTo({ scrollTop: 0, duration: 240 })
        }
        return
      }

      if (item.pagePath === 'pages/community/index') {
        requestWechatSubscriptionForModule('community')
      }

      this.setData({ selected: index })
      wx.switchTab({ url: `/${item.pagePath}` })
    },

    publish() {
      if (qualification) return
      const publishSection = ['community', 'errands', 'market', 'carpool'].includes(
        this.data.publishSection
      )
        ? this.data.publishSection
        : 'community'
      requestWechatSubscriptionForPublishSection(publishSection)
      wx.navigateTo({ url: `/pages/publish/index?section=${publishSection}` })
    }
  }
})
