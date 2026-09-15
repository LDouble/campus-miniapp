# Campus Miniapp：补齐四类社区详情页深色模式

**Priority:** High
**Status:** In Progress
**Type:** Bug Fix
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Overview

帖子、闲置、跑腿和找同行详情页已经具备基础深色表面，但仍存在失效的旧类名、浅色审核/错误态、浅紫业务徽章、业务操作按钮和评论输入区子控件。目标是以 Ousea / Global 语义色补齐这些状态，保持四类详情页和共享评论组件一致。

## Requirements

1. 帖子详情的互动图标使用当前真实类名，已点赞爱心保持品牌粉色。
2. 跑腿、闲置、找同行详情的加载/错误、审核提示、徽章和内联操作在深色模式下清晰可见。
3. 共享评论输入区的点赞按压、贴纸激活、联系方式和发布操作不残留浅色底板。
4. 四种业务的深色主操作底色均能承载白色文字或图标，普通文字对比度不低于 4.5:1。
5. 不改变浅色模式、页面布局、导航、接口、评论和业务操作逻辑。

## Files to Modify

- `src/styles/_dark-mode.scss` - 补齐详情页与共享评论组件深色规则。
- `scripts/dark-mode-smoke.ts` - 修正失效类名断言并增加关键状态、颜色对比度断言。

## API Endpoints

不涉及接口或数据结构修改。

## Testing Requirements

- `yarn test:dark-mode`
- `yarn test:community-detail-figma`
- `yarn test:business-detail-navigation`
- `yarn test:detail-actions`
- `yarn test:comment-reply`
- `yarn test:design-tokens`
- `yarn test:typography`
- `yarn typecheck`
- `yarn lint`
- `git diff --check`

按当前开发约定，不执行 `yarn build:weapp`。

## Acceptance Criteria

- 四类详情页在系统深色模式下无突兀白底、浅色徽章或不可见功能图标。
- 帖子爱心激活态、审核/错误态和业务操作语义仍可辨识。
- 评论输入区的普通、激活、按压和发布状态形成一致深色层级。
- 暗黑模式 smoke 能捕获真实组件类名及关键遗漏。

---

**Implementation Notes:** 保持深色覆盖集中在全局主题文件中，不新增页面私有基础 token。
