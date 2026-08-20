# 海大校园小程序：首页字体层级优化

**Priority:** High
**Status:** Done
**Type:** Bugfix
**Created:** 2026-08-20
**Last Updated:** 2026-08-20

## 概述

微信小程序官方设计指南当前将常用字号划分为 22、17、15、14、12pt，分别用于一级标题、常用二级标题/正文、三级标题、辅助内容和注释内容。首页现有部分持续可见文字仅约 9–11px，低于官方注释层级；不同区块的标题、正文与元信息也存在层级相近、辨识度不足的问题。

本次在不改变首页业务结构和已确认字重偏好的前提下，按语义角色提高字号并统一行高，同时处理生产数据下长标题和二手描述撑破布局的问题。

## 目标

1. 首页持续可见的功能名、状态、时间、来源、TabBar 标签不低于 24rpx（375px 视口约 12px）。
2. 二级标题使用约 34rpx，三级标题/核心卡片标题使用约 30rpx，辅助内容使用 28rpx，注释内容使用 24rpx。
3. 同一语义角色跨首页区块保持一致，正文与元信息有清晰层级。
4. 生产长文案通过单行省略或两行截断稳定布局，不因字体提升产生横向溢出或卡片异常增高。

## 范围

### 包含

- 首页身份信息、课程卡、服务入口、官方通知、Hero、社区摘要、二手卡片的字号与行高。
- 自定义 TabBar 标签字号。
- 首页 Hero、课程、通知、社区和二手长文案的截断规则。
- 字体层级及长文案的静态回归断言。
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
| 二级标题、正文 | 17pt / Medium 或 Regular | 34rpx |
| 三级标题 | 15pt / Medium | 30rpx |
| 辅助内容 | 14pt / Medium | 28rpx |
| 注释内容 | 12pt / Medium | 24rpx |

## 实现方案

1. 在首页最终主题覆盖区统一关键选择器，减少早期历史样式对最终字号的干扰。
2. 区块标题提升到 34rpx；卡片核心标题提升到 30rpx；作者、按钮、功能名等提升到 28rpx；时间、状态、来源等提升到 24rpx。
3. Hero 保持 35rpx 视觉主标题，但为所有分支补充两行标题/副标题约束，避免固定高度 Swiper 被长文案撑破。
4. 二手紧凑卡片覆盖 `StickerContent` 内部文本的 `white-space`，将描述稳定限制为两行。
5. 在 smoke 测试中断言代表性层级递增、TabBar 最低字号，以及生产长文案的截断语义。

## 验收标准

1. 首页无持续可见业务文字小于 24rpx；纯图标内部或非首页组件不纳入本任务。
2. 关键层级满足：注释 24rpx < 辅助 28rpx < 三级标题 30rpx < 二级标题 34rpx。
3. 服务入口和 TabBar 标签在 375px 与 390px 视口清晰可读，且不截断常见四字名称。
4. Hero、课程、通知、社区、二手真实长文案不横向溢出、不覆盖操作项，二手卡片描述最多两行。
5. 首页相关 smoke、字号 smoke、类型检查、Lint 与微信小程序构建通过。
6. 生产数据预览无新增 Console error 或接口失败。

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

已在首页最终主题覆盖区新增 24 / 28 / 30 / 34rpx 四档语义字号，分别对应官方 12 / 14 / 15 / 17pt 层级；Hero 主标题保留 35rpx。课程、服务、通知、社区摘要、二手卡片与自定义 TabBar 均按角色接入，社区作者保持 400 字重。

生产数据预览确认区块标题计算值为 17px、二手内容标题为 15px、服务入口为 12px。二手描述与 `StickerContent` 内层文本统一限制为两行，无图卡片标签与 kicker 已分离；首页社区摘要会将贴纸协议转换为可读标签。最终截图：`/tmp/home-typography-top-clean.png`、`/tmp/home-typography-market-final.png`、`/tmp/home-typography-community-final.png`、`/tmp/home-typography-bottom-final.png`。

`test:typography`、`test:home-guest`、`test:today-home`、`test:api-environment`、TypeScript、ESLint 与微信小程序构建均通过；模拟器 Console 未发现 error，Network 未发现 4xx/5xx。
