# Campus Miniapp：收紧首页常用服务卡高度

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Overview

首页常用服务使用五列动态宫格，当前每个入口被后置样式固定为 `163rpx` 高，外层与标题区也保留了较多纵向空间。优化目标是在不减少服务数量、不缩小文字可读性、不牺牲触控热区的前提下，减少卡片高度，让首页首屏容纳更多有效内容。

## Box Model Analysis

- 当前两行宫格约为：外层上下 `54rpx` + 标题区约 `80rpx` + 宫格 `163 × 2 + 12 = 338rpx`，合计约 `472rpx`。
- 单项真实内容约为：图标底板 `84rpx` + 图文间距 `14rpx` + 标签行高 `33rpx`，共 `131rpx`；`163rpx` 高度中约有 `32rpx` 额外空白。
- 建议两行宫格约为：外层上下 `44rpx` + 标题区 `96rpx` + 宫格 `132 × 2 + 8 = 272rpx`，合计约 `412rpx`。
- 两行场景预计减少约 `60rpx / 30px`；动态服务达到三行时节省更明显。

## Design Direction

- 保持五列布局、服务顺序、运行时启用过滤和现有 Ousea 蓝色图标风格。
- 单项高度由 `163rpx` 收至 `132rpx`，仍明显高于 `88rpx` 最小触控目标。
- 图标底板由 `84rpx` 收至 `76rpx`，内部功能图标继续保持 `44rpx`，不降低识别性。
- 图文间距由 `14rpx` 收至 `8rpx`，宫格行距由 `12rpx` 收至 `8rpx`。
- 外层上/下内边距由 `28/26rpx` 收至 `24/20rpx`。
- 标题区采用 `96rpx` 总高度，其中“全部”入口继续保持至少 `88rpx` 点击热区。
- 不修改字号、颜色、圆角体系、服务数据或导航行为。

## Requirements

1. 首页常用服务入口最终生效高度统一为 `132rpx`，删除重复的 `163rpx` 后置覆盖。
2. 图标底板为 `76rpx × 76rpx`，内部图标保持 `44rpx × 44rpx`。
3. 服务名称继续使用现有 `22rpx / 33rpx` 排版，并保持单行省略。
4. 宫格行距调整为 `8rpx`，五列横向布局与窄屏适配保持不变。
5. 外层卡片改为 `24rpx 20rpx 20rpx`，标题区整体高度为 `96rpx`。
6. “全部”入口触控尺寸不得低于 `88rpx`；各服务入口高度不得低于 `88rpx`。
7. 保留浅色、暗色、减少动态效果和按压反馈。

## Files to Modify

- `src/pages/index/index.scss`
- `scripts/home-guest-smoke.ts`

## API Endpoints

不涉及接口、运行时配置、服务启用状态或路由修改。

## Testing Requirements

- `yarn test:home-guest`
- `yarn test:design-tokens`
- `yarn test:typography`
- `yarn test:dark-mode`
- `yarn typecheck`
- `yarn lint`
- `git diff --check`

按当前开发约定，不执行 `yarn build:weapp`。

## Acceptance Criteria

- 两行常用服务卡预计比当前减少约 `60rpx` 高度。
- 图标、名称和五列对齐不拥挤、不裁切。
- “全部”和每个服务入口仍易于点击。
- 动态服务数量变化时自动按内容行数增高，不出现固定空白行。

---

**Implemented:** 已按约 `60rpx` 的紧凑方案完成，并保留 `88rpx` 安全触控热区。
