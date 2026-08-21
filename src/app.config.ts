const isQualificationEdition = __CAMPUS_APP_EDITION__ === 'qualification'
const isWechatAiEnabled = __CAMPUS_WECHAT_AI_ENABLED__
const fullPages = [
  'pages/index/index',
  'pages/app-login/index',
  'pages/community/index',
  'pages/community/detail',
  'pages/community/topic/index',
  'pages/errands/detail',
  'pages/marketplace/detail',
  'pages/carpool/detail',
  'pages/profile/index',
  'pages/public-profile/index',
  'pages/user-level/index',
  'pages/daily-checkin/index',
  'pages/account-cancellation/index',
  'pages/my-services/index',
  'pages/publish/index',
  'pages/messages/index',
  'pages/official-notices/index',
  'pages/official-notices/detail',
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
  'pages/clubs/mine',
  'pages/direct-messages/index',
  'pages/direct-messages/chat'
]

const qualificationExcludedPages = new Set([
  'pages/community/index',
  'pages/community/detail',
  'pages/community/topic/index',
  'pages/errands/detail',
  'pages/marketplace/detail',
  'pages/carpool/detail',
  'pages/public-profile/index',
  'pages/my-services/index',
  'pages/publish/index',
  'pages/materials/index',
  'pages/content-report/index',
  'pages/clubs/index',
  'pages/clubs/detail',
  'pages/clubs/edit',
  'pages/clubs/mine',
  'pages/direct-messages/index',
  'pages/direct-messages/chat'
])

const mainPagePaths = new Set([
  'pages/index/index',
  'pages/app-login/index',
  'pages/community/index',
  'pages/messages/index',
  'pages/profile/index',
])

const mainPages = fullPages.filter((page) => mainPagePaths.has(page))

const packageDefinitions = [
  {
    root: 'pages/academic',
    sourceRoot: 'pages/academic',
    pages: ['schedule/index', 'grades/index', 'exams/index', 'selection/index', 'statistics/courses', 'statistics/index'],
  },
  { root: 'pages/clubs', sourceRoot: 'pages/clubs', pages: ['index', 'detail', 'edit', 'mine'] },
  { root: 'pages/shuttle', sourceRoot: 'pages/shuttle', pages: ['index', 'detail'] },
  { root: 'pages/official-notices', sourceRoot: 'pages/official-notices', pages: ['index', 'detail'] },
  { root: 'pages/academic-verification', sourceRoot: 'pages/academic-verification', pages: ['index'] },
  { root: 'pages/materials', sourceRoot: 'pages/materials', pages: ['index'] },
  { root: 'pages/empty-classroom', sourceRoot: 'pages/empty-classroom', pages: ['index'] },
  { root: 'pages/calendar', sourceRoot: 'pages/calendar', pages: ['index'] },
  { root: 'pages/services', sourceRoot: 'pages/services', pages: ['index'] },
  { root: 'pages/campus-service', sourceRoot: 'pages/campus-service', pages: ['index', 'detail'] },
  { root: 'pages/public-profile', sourceRoot: 'pages/public-profile', pages: ['index'] },
  { root: 'pages/user-level', sourceRoot: 'pages/user-level', pages: ['index'] },
  { root: 'pages/daily-checkin', sourceRoot: 'pages/daily-checkin', pages: ['index'] },
  { root: 'pages/account-cancellation', sourceRoot: 'pages/account-cancellation', pages: ['index'] },
  { root: 'pages/webview', sourceRoot: 'pages/webview', pages: ['index'] },
  { root: 'pages/feature-unavailable', sourceRoot: 'pages/feature-unavailable', pages: ['index'] },
  {
    root: 'packages/social',
    sourceRoot: 'pages',
    pages: [
      'community/detail',
      'community/topic/index',
      'publish/index',
      'my-services/index',
      'errands/detail',
      'marketplace/detail',
      'carpool/detail',
      'content-report/index',
      'direct-messages/index',
      'direct-messages/chat',
    ],
  },
]

const subPackages = packageDefinitions.flatMap(({ root, sourceRoot, pages }) => {
  const availablePages = pages.filter((page) => !isQualificationEdition
    || !qualificationExcludedPages.has(`${sourceRoot}/${page}`))
  return availablePages.length ? [{ root, pages: availablePages }] : []
})

const pages = isQualificationEdition
  ? [
      ...mainPages.filter((page) => !qualificationExcludedPages.has(page)),
      'pages/feature-migrated/index',
    ]
  : mainPages

const fullTabBarList = [
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

const tabBarList = isQualificationEdition
  ? fullTabBarList.filter((item) => item.pagePath !== 'pages/community/index')
  : fullTabBarList

const targetMiniProgramAppId = __CAMPUS_TARGET_WECHAT_APP_ID__.trim()

const wechatAiModeConfig = isWechatAiEnabled
  ? {
      lazyCodeLoading: 'requiredComponents' as const,
      agent: {
        skills: [
          {
            name: 'campus-info',
            description: '查询校园通知、校车安排和空教室',
            path: 'skills/campus-info'
          }
        ],
        pageMetadata: 'page-meta.json'
      }
    }
  : {}

export default defineAppConfig({
  darkmode: true,
  themeLocation: 'theme.json',
  pages,
  subPackages: [
    ...subPackages,
    ...(isWechatAiEnabled ? [{ root: 'skills', pages: [], independent: true }] : []),
  ],
  window: {
    // Taro's types only list the resolved literals. WeChat resolves these
    // theme variables from theme.json before rendering the native chrome.
    backgroundTextStyle: '@backgroundTextStyle' as 'dark',
    navigationBarBackgroundColor: '@navigationBarBackgroundColor',
    navigationBarTitleText: '海大校园',
    navigationBarTextStyle: '@navigationBarTextStyle' as 'black',
    backgroundColor: '@backgroundColor'
  },
  usingComponents: {},
  tabBar: {
    custom: true,
    color: '@tabBarColor',
    selectedColor: '@tabBarSelectedColor',
    backgroundColor: '@tabBarBackgroundColor',
    borderStyle: '@tabBarBorderStyle' as 'white',
    list: tabBarList
  },
  ...(isQualificationEdition && targetMiniProgramAppId
    ? { navigateToMiniProgramAppIdList: [targetMiniProgramAppId] }
    : {}),
  ...wechatAiModeConfig
})
