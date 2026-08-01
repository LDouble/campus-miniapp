# API 环境分流

小程序在同一份提审代码内固化三个 API 地址，并在运行时根据微信 `envVersion` 选择：

| `envVersion` | API 环境 |
| --- | --- |
| `develop` 或未知值 | review |
| `trial` | production |
| `release` | production |

未知值回落 review，防止开发或审核运行时误连生产数据。不支持通过远程配置、请求 Header 或查询参数切换 API 环境。

生产构建必须显式提供两个互不相同的 HTTPS 地址：

```bash
TARO_APP_REVIEW_API_BASE_URL=https://review-api.example.com \
TARO_APP_PRODUCTION_API_BASE_URL=https://api.example.com \
yarn build:weapp
```

`TARO_APP_API_BASE_URL` 只作为本地开发兼容值，生产构建不会用它替代上述两个地址。提审前需将两个 HTTPS 域名全部加入小程序合法请求域名。
