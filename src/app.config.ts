export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/detail/index',
    'pages/verify/index',
    'pages/mine/index',
    'pages/community/index',
    'pages/publish/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'WeChat',
    navigationBarTextStyle: 'black',
    navigationStyle: 'custom'
  },
  usingComponents: {},
  tabBar: {
    custom: true,
    color: '#94a3b8',
    selectedColor: '#3b82f6',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/community/index', text: '社区' },
      { pagePath: 'pages/mine/index', text: '我的' }
    ]
  }
})
