Component({
  data: {
    selected: 0,
    hidden: false,
    list: [
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
  },

  lifetimes: {
    attached() {
      this.syncSelected()
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

      if (selected >= 0 && selected !== this.data.selected) {
        this.setData({ selected })
      }
    },

    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      const item = this.data.list[index]

      if (!item || index === this.data.selected) return

      this.setData({ selected: index })
      wx.switchTab({ url: `/${item.pagePath}` })
    },

    publish() {
      wx.navigateTo({ url: '/pages/publish/index' })
    }
  }
})
