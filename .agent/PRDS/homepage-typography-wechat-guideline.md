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

1. 首页持续可见的功能名、状态、时间、来源、TabBar 标签不低于 22rpx（375px 视口约 11px）。
2. 二级标题使用 32rpx，三级标题/核心卡片标题使用 28rpx，辅助内容使用 24rpx，注释内容使用 22rpx；Hero 保持 34rpx。
3. 同一语义角色跨首页区块保持一致，正文与元信息有清晰层级。
4. 28rpx 及以下文字统一使用 400；仅 32rpx 栏目标题、34rpx Hero 使用 500，只为价格等强强调信息保留 600。
5. 生产长文案通过单行省略或两行截断稳定布局，不产生横向溢出或卡片异常增高。
6. 小号灰字通过提高前景色对比度改善一加 Ace 2 的发虚感，不通过增大字号或加粗补偿。
7. 字号、字重和行高在 `app.scss` 中以 CSS 自定义属性公开，并在 Sass Token 层提供同名映射；首页不再维护 `--home-font-*` 私有变量。

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

## 字号映射

| 语义角色 | 官方参考 | 首页目标 |
|---|---:|---:|
| 一级标题 | 22pt / Medium | 首页当前无独立页面一级标题，不强行新增 |
| 二级标题、正文 | 17pt / Medium 或 Regular | 32rpx；Hero 34rpx |
| 三级标题 | 15pt / Medium | 28rpx |
| 辅助内容 | 14pt / Medium | 24rpx |
| 注释内容 | 12pt / Medium | 22rpx |

## 全局 Token 契约

| 分类 | Token | 值 |
|---|---|---:|
| 字号 | `--campus-font-caption` / `supporting` / `body` / `title` / `display` | `22` / `24` / `28` / `32` / `34rpx` |
| 字重 | `--campus-font-weight-regular` / `medium` / `emphasis` | `400` / `500` / `600` |
| 行高 | `--campus-line-height-heading` / `caption` / `body` | `1.3` / `1.35` / `1.4` |

CSS 自定义属性统一声明在 `src/app.scss`，Sass 映射统一声明在 `src/styles/_tokens.scss`。完整角色说明、用法和维护规则见 `docs/typography-tokens.md`。

## 实现方案

1. 在首页最终主题覆盖区统一关键选择器，减少早期历史样式对最终字号的干扰。
2. 区块标题使用 32rpx；卡片核心标题使用 28rpx；作者、按钮等使用 24rpx；时间、状态、来源等使用 22rpx。
3. Hero 使用 34rpx 视觉主标题，并保留两行标题/单行副标题约束，避免固定高度 Swiper 被长文案撑破。
4. 二手紧凑卡片覆盖 `StickerContent` 内部文本的 `white-space`，将描述稳定限制为两行。
5. 显式覆盖历史高字重：28rpx 及以下统一 400、32/34rpx 标题使用 500、价格使用 600；TabBar 普通态与激活态保持相同字重，仅以颜色和图标表达选中。
6. 首页辅助灰字使用高于原 `#90a1b9` 的对比度，避免不同 Android 系统字体抗锯齿造成的边缘发虚。
7. 在 smoke 测试中断言代表性层级递增、小字号统一字重、TabBar 字号与字重，以及生产长文案的截断语义。
8. 移除首页 `--home-font-*` 私有变量，让首页与自定义 TabBar 直接消费全局 Token；原生组件保留 fallback 以兼容微信样式隔离。

## 验收标准

1. 首页无持续可见业务文字小于 22rpx；纯图标内部或非首页组件不纳入本任务。
2. 关键层级满足：注释 22rpx < 辅助 24rpx < 三级标题 28rpx < 二级标题 32rpx。
3. 服务入口和 TabBar 标签在 375px 与 390px 视口清晰可读，且不截断常见四字名称；激活态不产生字重跳变。
4. Hero、课程、通知、社区、二手真实长文案不横向溢出、不覆盖操作项，二手卡片描述最多两行。
5. 首页相关 smoke、字号 smoke、类型检查、Lint 与微信小程序构建通过。
6. 生产数据预览无新增 Console error 或接口失败。
7. 一加 Ace 2 与小米截图对比中，小字号不再依赖 500 字重，辅助灰字的辨识度提升。

## 验证命令

- `yarn test:typography`
- `yarn test:home-guest`
- `yarn test:today-home`
- `yarn test:api-environment`
- `yarn typecheck`
- `yarn lint`
- `yarn build:weapp`
- `git diff --check`

---

**Implementation Notes:**

用户已明确要求依据微信小程序设计指南检查并优化，因此本任务文档创建后直接进入实现。

最终采用 22 / 24 / 28 / 32rpx 四档紧凑语义字号，Hero 主标题为 34rpx。课程、服务、通知、社区摘要、二手卡片与自定义 TabBar 均按角色接入；正文和内容统一为 400，栏目标题与操作统一为 500，仅价格保留 600。

生产数据预览确认区块标题计算值为 16px / 500、社区与二手内容标题为 14px / 400、服务入口为 11px / 400、Hero 为 17px / 500。二手描述与 `StickerContent` 内层文本统一限制为两行，无图卡片标签与 kicker 已分离；首页社区摘要会将贴纸协议转换为可读标签。最终截图：`/tmp/home-typography-compact-top-final.png`、`/tmp/home-typography-compact-market.png`、`/tmp/home-typography-compact-community.png`。

`test:typography`、`test:home-guest`、`test:today-home`、`test:api-environment`、TypeScript、ESLint 与微信小程序构建均通过；模拟器 Console 未发现 error，Network 未发现 4xx/5xx。

一加 Ace 2（1240×2772）与小米（1080×2400）真机截图对比确认，两端页面布局和字号层级一致，主要差异来自 Android 厂商系统字体的字形与 Medium 字重映射。后续修正将首页 28rpx 及以下文字全部统一为 400，32rpx 栏目标题与 34rpx Hero 保留 500，价格保留 600；TabBar 激活态同样保持 400，仅通过颜色表达选中。

辅助灰字从低对比度 muted 色切换为可随暗色模式变化的 `--campus-text-secondary`，TabBar 浅色态调整为 `#718096`。模拟器实测学校名、日程、服务、社区作者、正文、二手描述与操作均为 400，辅助色计算值为 `rgb(98, 116, 142)`，Hero 为 500、价格为 600。最终截图：`/tmp/home-typography-android-regular-clean.png`、`/tmp/home-typography-android-regular-content.png`。

后续将上述真机验证结果整理为全局字体 Token：五级字号、三级字重和三级行高同时在 CSS 自定义属性与 Sass Token 中公开，首页及自定义 TabBar 已完成迁移，首页不再存在 `--home-font-*` 或 `--home-text-*` 私有变量。新增 `docs/typography-tokens.md` 说明语义角色、跨 Android 字体规则、使用示例和维护边界。

运行态复核确认学校名为 14px / 400、服务入口为 11px / 400、栏目标题为 16px / 500、Hero 为 17px / 500；视觉层级与迁移前一致。截图：`/tmp/home-global-typography-tokens.png`。Console 未匹配到 error/exception/failed，Network 未匹配到 4xx/5xx；字体、首页、日程、环境、暗色和 TabBar smoke、TypeScript、ESLint、微信小程序构建均通过。
