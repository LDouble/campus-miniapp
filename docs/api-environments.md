# API 环境分流

小程序在同一份提审代码内固化三个 API 地址，并在运行时根据微信 `envVersion` 选择：

| `envVersion` | API 环境 |
| --- | --- |
| `develop` 或未知值 | review |
| `trial` | production |
| `release` | production |

未知值回落 review，防止开发或审核运行时误连生产数据。不支持通过远程配置、请求 Header 或查询参数切换 API 环境。

当前 review 地址临时固定为 `http://106.75.251.4:8080`；生产构建只需显式提供 production HTTPS 地址：

```bash
TARO_APP_PRODUCTION_API_BASE_URL=https://api.example.com \
yarn build:weapp
```

`TARO_APP_API_BASE_URL` 只作为本地开发兼容值，生产构建不会用它替代上述地址。review 的 HTTP/IP 地址仅用于当前联调，微信真机通常会因合法域名与 HTTPS 策略拒绝请求；正式提审前必须替换为已备案并加入小程序合法请求域名的 HTTPS 地址。
