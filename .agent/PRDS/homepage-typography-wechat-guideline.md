# 海大校园小程序：首页字体规范与全局 Token

**Priority:** High
**Status:** Done
**Type:** Bugfix
**Created:** 2026-08-20
**Last Updated:** 2026-08-20

## 概述

微信小程序官方设计指南当前将常用字号划分为 22、17、15、14、12pt，分别用于一级标题、常用二级标题/正文、三级标题、辅助内容和注释内容。首页现有部分持续可见文字仅约 9–11px，低于官方注释层级；不同区块的标题、正文与元信息也存在层级相近、辨识度不足的问题。

本次在不改变首页业务结构的前提下，按语义角色统一字号和行高，同时处理生产数据下长标题和二手描述撑破布局的问题。首轮严格映射官方点数后视觉偏臃肿，因此根据评审反馈改为紧凑型首页字号，并同步清理历史样式遗留的 600–750 重字重。真机验证稳定后，将首页私有变量提升为应用级语义 Token，作为其他页面后续复用的唯一基础字体契约。

## 目标

1. 首页持续可见的功能名、状态、时间、来源、TabBar 标签不低于 24rpx（375px 视口约 12px）。
2. 严格使用辅助信息 24rpx、正文 28rpx、重要正文 30rpx、卡片标题 32rpx、页面标题 36rpx、大标题 40rpx 六级字号。
3. 同一语义角色跨首页区块保持一致，正文与元信息有清晰层级。
4. 正文和重要正文使用 400，卡片标题使用 500，页面标题与大标题使用 600，不引入非规范中间字重。
5. 生产长文案通过单行省略或两行截断稳定布局，不产生横向溢出或卡片异常增高。
6. 浅色文本严格使用正文 `#1F2329`、次要 `#4E5969`、辅助 `#86909C` 三档颜色。
7. 字号、字重和行高在 `app.scss` 中以 CSS 自定义属性公开，并在 Sass Token 层提供同名映射；首页不再维护 `--home-font-*` 私有变量。
8. 最终字体规范使用系统字体，并严格采用用户确认的六级字号、字重、行高与三档文本颜色。

## 范围

### 包含

- 首页身份信息、课程卡、服务入口、官方通知、Hero、社区摘要、二手卡片的字号与行高。
- 自定义 TabBar 标签字号。
- 首页 Hero、课程、通知、社区和二手长文案的截断规则。
- 字体层级及长文案的静态回归断言。
- 全局字体 Token、Sass 映射及可复用规范文档。
- 使用生产 API 数据在微信开发者工具中重新预览首屏、中段和底部。

### 不包含

- 不改变社区列表、社区详情、评论组件中已确认的字号和字重。
- 不改变首页模块顺序、接口、数据模型或权限逻辑。
- 不把本机生产域名覆盖配置提交到 Git。
- 不追求所有文字使用同一字号；装饰性标签和辅助信息仍保留层级差异。

## 字体映射

| 语义角色 | 用户确认规格 | 小程序 Token 值 |
|---|---:|---:|
| 辅助信息 | 12px / 400 / 18px | 24rpx / 400 / 36rpx |
| 正文 | 14px / 400 / 22px | 28rpx / 400 / 44rpx |
| 重要正文 | 15px / 400 / 23px | 30rpx / 400 / 46rpx |
| 卡片标题 | 16px / 500 / 24px | 32rpx / 500 / 48rpx |
| 页面标题 | 18px / 600 / 27px | 36rpx / 600 / 54rpx |
| 大标题 | 20px / 600 / 30px | 40rpx / 600 / 60rpx |

## 全局 Token 契约

| 分类 | Token | 值 |
|---|---|---:|
| 字号 | `--campus-font-size-auxiliary` / `body` / `important-body` / `card-title` / `page-title` / `large-title` | `24` / `28` / `30` / `32` / `36` / `40rpx` |
| 字重 | `--campus-font-weight-regular` / `medium` / `semibold` | `400` / `500` / `600` |
| 行高 | `--campus-line-height-auxiliary` / `body` / `important-body` / `card-title` / `page-title` / `large-title` | `36` / `44` / `46` / `48` / `54` / `60rpx` |
| 颜色 | `--campus-text-primary` / `secondary` / `auxiliary` | `#1F2329` / `#4E5969` / `#86909C` |

CSS 自定义属性统一声明在 `src/app.scss`，Sass 映射统一声明在 `src/styles/_tokens.scss`。完整角色说明、用法和维护规则见 `docs/typography-tokens.md`。

## 实现方案

1. 在首页最终主题覆盖区统一关键选择器，减少早期历史样式对最终字号的干扰。
2. 首页区块标题使用卡片标题，课程名和内容标题使用重要正文，学校名、说明与操作使用正文，时间、状态、来源和 TabBar 使用辅助信息。
3. Hero 使用 40rpx / 600 / 60rpx 大标题，并同步增加 Swiper 和卡片高度，继续容纳两行标题与单行副标题。
4. 二手紧凑卡片覆盖 `StickerContent` 内部文本的 `white-space`，将描述稳定限制为两行。
5. 全局字体栈改为系统字体；正文、重要正文保持 400，卡片标题 500，页面与大标题 600；TabBar 普通态与激活态保持相同字重。
6. 全局提供主、次、辅助三档文本颜色，首页按信息层级消费；暗色模式继续使用同名 Token 的独立值。
7. 在 smoke 测试中断言代表性层级递增、小字号统一字重、TabBar 字号与字重，以及生产长文案的截断语义。
8. 移除首页 `--home-font-*` 私有变量，让首页与自定义 TabBar 直接消费全局 Token；原生组件保留 fallback 以兼容微信样式隔离。

## 验收标准

1. 首页无持续可见业务文字小于 24rpx；纯图标内部或非首页组件不纳入本任务。
2. 六级字体的字号、字重和行高与用户确认规格逐项一致。
3. 服务入口和 TabBar 标签在 375px 与 390px 视口清晰可读，且不截断常见四字名称；激活态不产生字重跳变。
4. Hero、课程、通知、社区、二手真实长文案不横向溢出、不覆盖操作项，二手卡片描述最多两行。
5. 首页相关 smoke、字号 smoke、类型检查、Lint 与微信小程序构建通过。
6. 生产数据预览无新增 Console error 或接口失败。
7. 一加 Ace 2 与小米均使用各自系统字体，小字号保持 400，页面层级和文本颜色保持一致。

## 验证命令

- `yarn test:typography`
- `yarn test:home-guest`
- `yarn test:today-home`
- `yarn test:api-environment`
- `yarn test:dark-mode`
- `yarn test:tabbar-layout`
- `yarn typecheck`
- `yarn lint`
- `yarn build:weapp`
- `git diff --check`

---

**Implementation Notes:**

用户已明确要求依据微信小程序设计指南检查并优化，因此本任务文档创建后直接进入实现。

最终按用户确认值建立六级全局语义 Token，并同步提供 CSS 自定义属性与 Sass 映射。首页课程、服务、通知、社区、二手和 Hero 已按内容角色接入；自定义 TabBar 因微信原生组件样式隔离，在组件内保留 Token fallback 与系统字体栈。

运行态计算样式确认：学校名为 14px / 400 / 22px，服务区标题为 16px / 500 / 24px，服务入口为 12px / 400 / 18px，通知标题为 15px / 400 / 23px，Hero 为 20px / 600 / 60rpx。正文、次要和辅助文本颜色分别计算为 `rgb(31, 35, 41)`、`rgb(78, 89, 105)`、`rgb(134, 144, 156)`。390px 模拟器中 `rpx` 会随视口等比缩放，设计值仍以 375px 基准换算。

模拟器截图：`/tmp/home-system-typography-v2.png`、`/tmp/home-system-typography-middle-v2.png`、`/tmp/home-system-typography-content-v2.png`。学校与校区名称完整显示，生产长通知和内容标题未产生新增溢出；Console 未匹配到 error/exception/failed，Network 未匹配到 4xx/5xx。

`test:typography`、`test:home-guest`、`test:today-home`、`test:api-environment`、`test:dark-mode`、`test:tabbar-layout`、TypeScript、ESLint、微信小程序构建和 WXSS 编译均通过。
