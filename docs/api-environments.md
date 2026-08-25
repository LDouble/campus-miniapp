# API 环境分流

小程序在同一份提审代码内固化两个 API 地址，并在运行时根据微信 `envVersion` 选择：

| `envVersion` | API 环境 |
| --- | --- |
| `develop` 或未知值 | production |
| `trial` | production |
| `release` | production |

未知值回落 review，防止开发或审核运行时误连生产数据。不支持通过远程配置、请求 Header 或查询参数切换 API 环境。

当前默认域名为：

- review（仅保留为隔离配置）：`https://review.weouc.com`
- production：`https://product.weouc.com`

开发、预览和生产构建的运行时请求统一使用 `https://product.weouc.com`；review 地址仅保留为隔离配置，不会被小程序运行时选用。生产构建仍可以通过环境变量覆盖：

```bash
TARO_APP_REVIEW_API_BASE_URL=https://review.weouc.com \
TARO_APP_PRODUCTION_API_BASE_URL=https://product.weouc.com \
yarn build:weapp
```

## 微信订阅消息

订阅模板 ID 由公开运行时配置 `miniapp/bootstrap` 的
`subscription_templates` 字段按模块下发，每个模块最多 3 个模板。例如：

```json
{
  "subscription_templates": {
    "academic_grades": ["成绩通知模板 ID"],
    "academic_schedule": ["上课提醒模板 ID"],
    "community": ["社区动态模板 ID"],
    "errand": ["跑腿提醒模板 ID"],
    "marketplace": ["二手提醒模板 ID"],
    "carpool": ["拼车提醒模板 ID"]
  }
}
```

未配置的模块不会调起授权。授权请求在用户点击当前模块内容或点击入口跳转前发起，
不阻塞原按钮动作。只有微信明确返回 `accept` 的模板 ID 才会登记到
`POST /api/v1/notices/subscriptions`；`reject`、`ban` 和异常结果均不会登记。
实际发送仍需在后端私有 `wechat_subscription` 配置中为同一模板配置消息字段映射。

`TARO_APP_API_BASE_URL` 只作为本地开发兼容值，生产构建不会用它替代上述两个域名。两个域名都需要加入微信小程序的合法请求域名；`product.weouc.com` 对应的产品服务器上线后，线上环境才会有可用的生产 API。
