Component({
  data: {
    selected: 0,
    list: [
      { pagePath: 'pages/index/index', text: '首页', icon: '⌂' },
      { pagePath: 'pages/community/index', text: '社区', icon: '◎' },
      { pagePath: 'pages/mine/index', text: '我的', icon: '●' }
    ]
  },
  lifetimes: {
    attached() {
      this.syncSelected()
    }
  },
  pageLifetimes: {
    show() {
      this.syncSelected()
    }
  },
  methods: {
    syncSelected() {
      const pages = getCurrentPages()
      const route = pages.length ? pages[pages.length - 1].route.replace(/^\//, '') : ''
      const selected = this.data.list.findIndex(item => item.pagePath === route)
      if (selected >= 0 && selected !== this.data.selected) this.setData({ selected })
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
    },
    message() {
      wx.showToast({ title: '消息功能即将开放', icon: 'none' })
    }
  }
})
