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
      const pages = getCurrentPages()
      const route = pages.length ? pages[pages.length - 1].route : ''
      const selected = this.data.list.findIndex(item => item.pagePath === route)
      if (selected >= 0) this.setData({ selected })
    }
  },
  methods: {
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      if (index === 3) {
        wx.navigateTo({ url: '/pages/publish/index' })
        return
      }
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
