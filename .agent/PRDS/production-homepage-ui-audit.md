# OUSea小程序：生产域名首页 UI 验收

**Priority:** High
**Status:** Done
**Type:** Audit
**Created:** 2026-08-20
**Last Updated:** 2026-08-20

## 概述

在当前社区界面重构 PR 分支上，将仅用于本机调试的 API 基地址切换到 `https://product.weouc.com`，使用生产真实数据重新检查首页。验收以微信开发者工具模拟器截图、运行时计算样式、网络请求和控制台为证据，不改变正式版本既有的 review/production 隔离策略。

## 范围

### 包含

1. 通过被 Git 忽略的本地环境配置将开发版 API 指向生产域名。
2. 重新编译并打开 `pages/index/index`，确认首页请求实际访问生产域名。
3. 检查顶部安全区、用户信息、快捷入口、内容卡片、市场卡片、社区 Feed 和底部 TabBar。
4. 覆盖真实长昵称、长标题、图片缺失、数据为空、接口失败和列表滚动边界。
5. 对发现的问题按阻断、高、中、低优先级给出调整建议；只有明显且低风险的回归才直接修复。

### 不包含

- 不提交本地生产域名覆盖配置。
- 不移除正式构建的 review/production 隔离和 HTTPS 校验。
- 不修改生产数据、账号资料或服务端配置。
- 不为了截图伪造首页数据。

## 实现与验收方案

1. 保留 `config/api-endpoints.ts` 和 `src/api/environment.ts` 的正式环境选择逻辑，仅在 `.env.local` 设置本地开发基地址。
2. 使用开发者工具重新编译首页，并通过 network 日志确认请求主机。
3. 分别截取首页首屏、中段服务内容和底部社区 Feed，检查横向溢出、文字截断、卡片密度、图片比例与底部遮挡。
4. 读取关键元素尺寸和计算样式，避免只依赖肉眼判断。
5. 检查 console 中的错误和警告，并将数据问题与纯 UI 问题分开记录。

## 可能修改的文件

- `.env.local` - 本机临时切换生产 API；已被 Git 忽略，不进入 PR
- `src/pages/index/index.tsx` - 仅在生产数据暴露明确结构问题时修复
- `src/pages/index/index.scss` - 仅在生产数据暴露明确布局问题时修复
- `scripts/*home*-smoke.ts` - 对实际修复补充稳定回归

## 验收标准

1. 模拟器首页 API 请求主机为 `product.weouc.com`。
2. 首页首屏不穿透状态栏，主要内容无横向溢出。
3. 真实长文本不会撑破卡片、覆盖操作按钮或挤压时间信息。
4. 图片缺失、空数据和请求失败均有可理解的状态呈现。
5. 页面滚动到底部后内容不被自定义 TabBar 或安全区遮挡。
6. 控制台无新增运行时错误，生产请求失败能够明确归因。
7. 输出带截图依据的 UI 调整清单，并区分立即修复与后续优化。

## 验证命令

- `yarn test:api-environment`
- `yarn typecheck`
- `yarn lint`
- `yarn build:weapp`
- `git diff --check`

---

**Implementation Notes:**

用户已明确要求切换生产域名并检查首页，因此本任务文档创建后按该授权直接执行。生产域名覆盖只存在于本机忽略文件，避免把开发者工具永久绑到生产环境。

本机 `.env.local` 已设置 `TARO_APP_API_BASE_URL=https://product.weouc.com`，开发构建的首页认证、社区、闲置、官方通知和未读数请求均命中生产域名，关键请求返回 200；Network 未发现 4xx/5xx，Console 未发现 error。截图证据为 `/tmp/home-product-top.png`、`/tmp/home-product-mid.png` 和 `/tmp/home-product-bottom.png`。

生产数据确认一个需要优先修复的首页 UI 问题：紧凑二手卡片虽然在宿主类设置了单行截断，但 `StickerContent` 的 `.sticker-content__text` 将文本恢复为 `white-space: pre-wrap`，真实长描述把卡片正文撑到约 643px，造成双列高度严重失衡并显著推迟后续社区内容。建议让紧凑卡片的内部文本继承宿主截断规则，并限制为一至两行。

该问题已在后续 `homepage-typography-wechat-guideline` 任务中修复：首页紧凑二手描述及内部 `StickerContent` 文本统一为两行截断，并使用生产数据重新完成双列布局验收。

其余生产页面表现：状态栏和折叠导航未被内容穿透；服务入口在当前 390px 视口完整；通知与社区长标题已正确截断；页面滚动到底部后最终社区条目未被自定义 TabBar 遮挡。后续可增强官方通知独立 loading/error/retry、远程图片失败占位，以及首页校区文案在窄屏下的显示优先级。
