# API 环境分流

小程序在构建时注入两个 API 地址，并在运行时根据微信 `envVersion` 选择：

| `envVersion` | API 环境 |
| --- | --- |
| `develop` 或未知值 | review（开发构建默认是本地 API） |
| `trial` | production |
| `release` | production |

未知值回落 review，防止开发或审核运行时误连生产数据。不支持通过远程配置、请求 Header 或查询参数切换 API 环境。

当前默认域名为：

- review（仅保留为隔离配置）：`https://review.weouc.com`
- production：`https://product.weouc.com`

生产构建的 review 和 production 地址都会固化为 `https://product.weouc.com`。开发构建的
`develop` 运行时使用 review 地址，默认是 `http://127.0.0.1:8080`，也可以通过
`TARO_APP_API_BASE_URL` 覆盖；trial/release 仍使用 product：

```bash
TARO_APP_REVIEW_API_BASE_URL=https://review.weouc.com \
TARO_APP_PRODUCTION_API_BASE_URL=https://product.weouc.com \
yarn build:weapp
```

## 本地部署分支联调

本地部署分支的 API 默认监听 `http://127.0.0.1:8080`。`dev:weapp` 已固定使用
development 构建模式，启动小程序 watch 时通过 `TARO_APP_API_BASE_URL` 注入本地业务 API 基地址：

```bash
TARO_APP_API_BASE_URL=http://127.0.0.1:8080 yarn dev:weapp
```

启动前可使用以下地址确认后端已经就绪：

```bash
curl http://127.0.0.1:8080/health/ready
```

`/health/ready` 仅是健康检查地址，不要把它写进
`TARO_APP_API_BASE_URL`；小程序会在基地址后拼接 `/api/v1/...` 业务路径。
该环境变量在构建时注入，修改后需要重启 watch，并在微信开发者工具中刷新
`dist/full` 项目。

微信开发者工具默认开启合法域名校验，本地 HTTP 请求会被拦截。首次本地联调时，
请在 `dist/full/project.private.config.json` 写入以下开发期配置，或在开发者工具
项目设置中关闭“合法域名校验”；该文件属于本机配置，不要提交到仓库：

```json
{
  "setting": {
    "urlCheck": false
  }
}
```

验证时应在网络面板看到 `http://127.0.0.1:8080/api/v1/...`。微信自身的
`report-online.sh.wxgateway.com` 埋点请求不属于 Campus 业务 API，可以忽略。

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
