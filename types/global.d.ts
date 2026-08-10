/// <reference types="@tarojs/taro" />

declare module '*.png';
declare module '*.gif';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.css';
declare module '*.less';
declare module '*.scss';
declare module '*.sass';
declare module '*.styl';

declare namespace NodeJS {
  interface ProcessEnv {
    /** NODE 内置环境变量, 会影响到最终构建生成产物 */
    NODE_ENV: 'development' | 'production',
    /** 当前构建的平台 */
    TARO_ENV: 'weapp' | 'swan' | 'alipay' | 'h5' | 'rn' | 'tt' | 'quickapp' | 'qq' | 'jd'
    /**
     * 当前构建的小程序 appid
     * @description 若不同环境有不同的小程序，可通过在 env 文件中配置环境变量`TARO_APP_ID`来方便快速切换 appid， 而不必手动去修改 dist/project.config.json 文件
     * @see https://taro-docs.jd.com/docs/next/env-mode-config#特殊环境变量-taro_app_id
     */
    TARO_APP_ID: string
    /** 当前构建版本；未配置时保持完整版本兼容行为。 */
    TARO_APP_EDITION?: 'full' | 'qualification'
    /** 仅显式启用时将微信 AI Skill 集成到完整版构建产物。 */
    TARO_APP_WECHAT_AI_ENABLED?: '0' | '1' | 'false' | 'true'
    /** 当前小程序登录所用 AppID，必须与 TARO_APP_ID 一致。 */
    TARO_APP_WECHAT_APP_ID?: string
    /** 新版小程序 AppID，仅资格版迁移入口使用。 */
    TARO_APP_TARGET_WECHAT_APP_ID?: string
    /** 新版小程序默认打开路径。 */
    TARO_APP_TARGET_DEFAULT_PATH?: string
    /** 非生产构建打开新版小程序时使用的环境版本。 */
    TARO_APP_TARGET_MINIAPP_ENV_VERSION?: 'develop' | 'trial' | 'release'
    /** 完整版构建脚本读取的当前小程序 AppID。 */
    TARO_APP_FULL_WECHAT_APP_ID?: string
    /** 资格版构建脚本读取的当前小程序 AppID。 */
    TARO_APP_QUALIFICATION_WECHAT_APP_ID?: string
  }
}
