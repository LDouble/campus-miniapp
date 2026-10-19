// 为 Node smoke test 补齐构建期 API 常量，并替换微信运行时依赖。
Object.assign(global, {
  __CAMPUS_REVIEW_API_BASE_URL__: 'https://review.example.invalid',
  __CAMPUS_PRODUCTION_API_BASE_URL__: 'https://product.example.invalid',
  __CAMPUS_WECHAT_APP_ID__: 'wx0000000000000000',
  __CAMPUS_APP_RELEASE__: 'smoke-test',
  __CAMPUS_MINIAPP_VERSION__: 'smoke-test',
  __CAMPUS_APP_EDITION__: 'full',
  __CAMPUS_WECHAT_AI_ENABLED__: false,
  __CAMPUS_TARGET_WECHAT_APP_ID__: '',
  __CAMPUS_TARGET_DEFAULT_PATH__: 'pages/index/index',
  __CAMPUS_TARGET_MINIAPP_ENV_VERSION__: 'release',
})

require('./mock-taro.cjs')
