export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/app-login/index',
    'pages/community/index',
    'pages/community/detail',
    'pages/errands/detail',
    'pages/marketplace/detail',
    'pages/carpool/detail',
    'pages/profile/index',
    'pages/account-cancellation/index',
    'pages/my-services/index',
    'pages/publish/index',
    'pages/messages/index',
    'pages/academic-verification/index',
    'pages/academic/schedule/index',
    'pages/academic/grades/index',
    'pages/academic/exams/index',
    'pages/academic/selection/index',
    'pages/academic/statistics/courses',
    'pages/academic/statistics/index',
    'pages/calendar/index',
    'pages/materials/index',
    'pages/empty-classroom/index',
    'pages/shuttle/index',
    'pages/shuttle/detail',
    'pages/services/index',
    'pages/content-report/index',
    'pages/webview/index',
    'pages/feature-unavailable/index',
    'pages/clubs/index',
    'pages/clubs/detail',
    'pages/clubs/edit',
    'pages/clubs/mine'
  ],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#f8fcfd',
    navigationBarTitleText: '海大校园',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f4fafc'
  },
  usingComponents: {},
  tabBar: {
    custom: true,
    color: '#8295a2',
    selectedColor: '#3095b6',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/tabbar/home.png',
        selectedIconPath: 'assets/tabbar/home-active.png'
      },
      {
        pagePath: 'pages/community/index',
        text: '社区',
        iconPath: 'assets/tabbar/community.png',
        selectedIconPath: 'assets/tabbar/community-active.png'
      },
      {
        pagePath: 'pages/messages/index',
        text: '消息',
        iconPath: 'assets/tabbar/messages.png',
        selectedIconPath: 'assets/tabbar/messages-active.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tabbar/profile.png',
        selectedIconPath: 'assets/tabbar/profile-active.png'
      }
    ]
  }
})
