import path from 'path'
import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import devConfig from './dev'
import prodConfig from './prod'
import vitePluginImp from 'vite-plugin-imp'
import { loadApiEndpoints } from './api-endpoints'
// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'webpack5'>(async (merge, { command, mode }) => {
  const requestedEdition = process.env.TARO_APP_EDITION
  const appEdition = requestedEdition || 'full'

  if (appEdition !== 'full' && appEdition !== 'qualification') {
    throw new Error(
      `不支持的 TARO_APP_EDITION：${appEdition}。仅支持 full 或 qualification。`,
    )
  }

  const configuredProjectAppId = process.env.TARO_APP_ID?.trim()
  const configuredWechatAppId = process.env.TARO_APP_WECHAT_APP_ID?.trim()
  if (
    configuredProjectAppId &&
    configuredWechatAppId &&
    configuredProjectAppId !== configuredWechatAppId
  ) {
    throw new Error(
      'TARO_APP_ID 必须与 TARO_APP_WECHAT_APP_ID 一致，避免微信项目配置和登录 AppID 不匹配。',
    )
  }

  const currentWechatAppId =
    configuredWechatAppId ||
    configuredProjectAppId ||
    (requestedEdition ? '' : 'wx0d9936d6708f44c0')
  if (!currentWechatAppId) {
    throw new Error(
      `构建 ${appEdition} 版本时必须配置 TARO_APP_ID 和 TARO_APP_WECHAT_APP_ID。`,
    )
  }

  const targetWechatAppId = process.env.TARO_APP_TARGET_WECHAT_APP_ID?.trim() || ''
  const targetDefaultPath =
    process.env.TARO_APP_TARGET_DEFAULT_PATH?.trim() || 'pages/index/index'
  const requestedTargetMiniappEnvVersion =
    process.env.TARO_APP_TARGET_MINIAPP_ENV_VERSION?.trim()
  const targetMiniappEnvVersion =
    process.env.NODE_ENV === 'production'
      ? 'release'
      : requestedTargetMiniappEnvVersion || 'release'
  if (!['develop', 'trial', 'release'].includes(targetMiniappEnvVersion)) {
    throw new Error(
      `不支持的 TARO_APP_TARGET_MINIAPP_ENV_VERSION：${targetMiniappEnvVersion}。仅支持 develop、trial 或 release。`,
    )
  }
  const outputRoot = `dist/${appEdition}`
  const wechatAiEnabled = appEdition === 'full'
    && ['1', 'true'].includes(
      String(process.env.TARO_APP_WECHAT_AI_ENABLED || '').trim().toLowerCase(),
    )
  const wechatAiModeCopyPatterns = wechatAiEnabled
    ? [
        {
          from: 'src/ai-mode/skills',
          to: `${outputRoot}/skills`
        },
        {
          from: 'src/ai-mode/page-meta.json',
          to: `${outputRoot}/page-meta.json`
        }
      ]
    : []
  const apiEndpoints = loadApiEndpoints(
    process.env,
    process.env.NODE_ENV === 'production',
  )
  const buildApiEndpoints = process.env.NODE_ENV === 'production'
    ? {
        review: apiEndpoints.production,
        production: apiEndpoints.production,
      }
    : {
        review: apiEndpoints.review,
        production: apiEndpoints.production,
      }
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'campus-miniapp',
    date: '2026-7-25',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot,
    plugins: [
      '@tarojs/plugin-html',
      path.resolve(__dirname, 'plugins/weapp-compat.js'),
    ],
    defineConstants: {
      __CAMPUS_REVIEW_API_BASE_URL__: JSON.stringify(buildApiEndpoints.review),
      __CAMPUS_PRODUCTION_API_BASE_URL__: JSON.stringify(buildApiEndpoints.production),
      __CAMPUS_WECHAT_APP_ID__: JSON.stringify(currentWechatAppId),
      __CAMPUS_APP_RELEASE__: JSON.stringify(
        process.env.TARO_APP_RELEASE || process.env.npm_package_version || 'development',
      ),
      __CAMPUS_APP_EDITION__: JSON.stringify(appEdition),
      __CAMPUS_WECHAT_AI_ENABLED__: JSON.stringify(wechatAiEnabled),
      __CAMPUS_TARGET_WECHAT_APP_ID__: JSON.stringify(targetWechatAppId),
      __CAMPUS_TARGET_DEFAULT_PATH__: JSON.stringify(targetDefaultPath),
      __CAMPUS_TARGET_MINIAPP_ENV_VERSION__: JSON.stringify(targetMiniappEnvVersion),
    },
    copy: {
      patterns: [
        {
          from: 'src/assets/tabbar',
          to: `${outputRoot}/assets/tabbar`
        },
        ...wechatAiModeCopyPatterns
      ],
      options: {
      }
    },
    framework: 'react',
    compiler: {

      type: 'webpack5',
      prebundle: {
        enable: false
      }
    },
    cache: {
      enable: false // Webpack 持久化缓存配置，建议开启。默认配置请参考：https://docs.taro.zone/docs/config-detail#cache
    },
    mini: {
      optimizeMainPackage: {
        enable: true,
      },
      imageUrlLoaderOption: {
        // TabBar 等高频组件使用独立静态文件，避免 Base64 随每个组件实例重复解析。
        limit: true,
        publicPath: '/'
      },
      postcss: {
        pxtransform: {
          enable: true,
          config: {
            selectorBlackList: ['nut-']
          }
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
      }
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      output: {
        filename: 'js/[name].[hash:8].js',
        chunkFilename: 'js/[name].[chunkhash:8].js'
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css'
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
      }
    },
    rn: {
      appName: 'taroDemo',
      postcss: {
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
        }
      }
    }
  }
  if (process.env.NODE_ENV === 'development') {
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig)
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig)
})
