import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import devConfig from './dev'
import prodConfig from './prod'
import vitePluginImp from 'vite-plugin-imp'
import { loadApiEndpoints } from './api-endpoints'
// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'webpack5'>(async (merge, { command, mode }) => {
  const apiEndpoints = loadApiEndpoints(
    process.env,
    process.env.NODE_ENV === 'production',
  )
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
    outputRoot: 'dist',
    plugins: ['@tarojs/plugin-html'],
    defineConstants: {
      __CAMPUS_REVIEW_API_BASE_URL__: JSON.stringify(apiEndpoints.review),
      __CAMPUS_STAGING_API_BASE_URL__: JSON.stringify(apiEndpoints.staging),
      __CAMPUS_PRODUCTION_API_BASE_URL__: JSON.stringify(apiEndpoints.production),
      __CAMPUS_WECHAT_APP_ID__: JSON.stringify(
        process.env.TARO_APP_WECHAT_APP_ID || 'wx0d9936d6708f44c0',
      ),
      __CAMPUS_APP_RELEASE__: JSON.stringify(
        process.env.TARO_APP_RELEASE || process.env.npm_package_version || 'development',
      ),
    },
    copy: {
      patterns: [
        {
          from: 'src/assets/tabbar',
          to: 'dist/assets/tabbar'
        }
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
