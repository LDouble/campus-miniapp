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
    navigationStyle: 'custom',
    enablePullDownRefresh: true
  }
})
