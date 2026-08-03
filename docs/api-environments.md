# API 环境分流

小程序在同一份提审代码内固化两个 API 地址，并在运行时根据微信 `envVersion` 选择：

| `envVersion` | API 环境 |
| --- | --- |
| `develop` 或未知值 | review |
| `trial` | production |
| `release` | production |

未知值回落 review，防止开发或审核运行时误连生产数据。不支持通过远程配置、请求 Header 或查询参数切换 API 环境。

当前默认域名为：

- review：`https://review.weouc.com`
- production：`https://product.weouc.com`

生产构建默认使用上述两个域名，也可以通过环境变量覆盖：

```bash
TARO_APP_REVIEW_API_BASE_URL=https://review.weouc.com \
TARO_APP_PRODUCTION_API_BASE_URL=https://product.weouc.com \
yarn build:weapp
```

`TARO_APP_API_BASE_URL` 只作为本地开发兼容值，生产构建不会用它替代上述两个域名。两个域名都需要加入微信小程序的合法请求域名；`product.weouc.com` 对应的产品服务器上线后，线上环境才会有可用的生产 API。
