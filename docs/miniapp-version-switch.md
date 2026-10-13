# 小程序模块版本开关

后台可在 `modules.<模块键>.disabled_versions` 配置需要关闭模块的小程序版本号。客户端只做精确匹配：模块全局状态不是 `enabled` 时优先使用全局状态；全局启用且当前版本命中时，模块对该包隐藏。

构建上传到微信后台前，必须把本次上传的业务版本同时作为 `TARO_APP_MINIAPP_VERSION` 注入构建，例如：

```bash
TARO_APP_MINIAPP_VERSION=1.2.3 corepack yarn build:weapp
```

该值会编译为 `__CAMPUS_MINIAPP_VERSION__`，供首页、入口和请求头统一识别。它必须与微信后台上传的版本号及后台 `disabled_versions` 配置完全一致；不应使用 Git release、包的固定 `version` 字段或审核身份代替。

未设置该变量时，客户端才回退读取 `wx.getAccountInfoSync().miniProgram.version`。体验版和开发版通常没有该运行时版本，因此需要版本开关的体验包必须显式传入构建变量。构建变量可留空以保持既有构建与未按版本控制模块的兼容行为；非空值必须与后端契约 `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` 一致，例如 `1.2.3`、`review_2026-10`。
