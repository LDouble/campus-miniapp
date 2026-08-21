# OUSea小程序：生活服务详情操作收进右上角菜单

**Priority:** High
**Status:** Implemented
**Type:** Enhancement
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Overview

统一跑腿、找同行、闲置详情页的操作层级：编辑和取消/撤回等删除类管理行为进入详情内容右上角的三点菜单；由 `available_actions` 下发的高频业务行为继续在底部直接展示。举报保持独立可见，底部评论框按 Ousea / Global 重整。

## User Story

**As a** 浏览校园生活详情的用户
**I want** 在右上角菜单管理内容，同时直接看到当前关键业务行为
**So that** 低频管理入口不干扰评论，高频动作仍然方便触达

## Implementation Overview

1. 新增三类详情共享的 `DetailOverflowActions`，使用不小于 `88rpx` 的三点触控区。
2. 菜单消费现有 `buildDetailFooterActions` 结果，不重新解释权限和状态；仅收纳编辑及取消/撤回等删除类管理行为。
3. 非作者的举报保持独立可见，不进入三点菜单。
4. 接单、进度推进、购买/响应、加入/退出、重新提交与认证等高频行为继续由 `DetailComments.actions` 在底部直接展示；联系方式仍按现有权限展示。
5. 菜单打开、关闭和执行过程中避免事件穿透、重复执行，并保持 loading 状态。
6. 底部评论框按 Ousea / Global 重整：使用语义表面色、浅边框、规范字号和 `88rpx` 触控区，发布按钮恢复各业务主题色并兼容暗色模式。
7. 发布按钮与外露业务按钮采用“`88rpx` 触控热区 + 紧凑视觉主体”，发布图标使用 Master 指定的白色向上箭头；非输入态不重复展示发布按钮，点击输入框即可进入输入态。
8. 输入态的表情与发布按钮组成自适应右侧操作组，保留独立触控热区，同时缩小并拉近可见图形。
9. 表情图标与发布箭头统一为 `32rpx` 视觉尺寸。

## Files to Create

- `src/features/life-services/components/detail-overflow-actions.tsx` - 共享三点菜单组件。

## Files to Modify

- `src/features/life-services/detail.scss` - 三点入口与菜单样式。
- `src/features/life-services/components/detail-comments.scss` - 底部评论框 Ousea / Global 视觉校准。
- `src/packages/social/errands/detail.tsx` - 跑腿操作迁移。
- `src/packages/social/carpool/detail.tsx` - 找同行操作迁移。
- `src/packages/social/marketplace/detail.tsx` - 闲置操作迁移。
- 相关 smoke 测试 - 验证菜单能力和底部栏精简。

## Libraries/Dependencies

- **Taro 4.1.11** - 使用 `View` 触控事件和现有 React 状态，不新增依赖。

## Design/UX Considerations

- 用户明确要求右上角三点菜单只收纳编辑与删除类管理行为；举报按 Master 保持独立可见。
- 菜单外观沿用帖子深色操作浮层的视觉语言，但允许多项操作纵向排列，避免窄屏横向拥挤。
- 底部留言栏直接展示高频业务行为，只把编辑和删除类低频管理行为收进菜单。

## Testing Requirements

- 三类详情页在存在编辑或删除类行为时展示三点入口，且只展示服务端允许的管理行为。
- 非作者可从独立举报入口举报，作者不会错误出现举报。
- 点击菜单项只执行一次，点击页面其他区域可以关闭菜单。
- 底部 `DetailComments` 完整接收过滤后的高频业务 `actions`，输入态隐藏、退出输入态恢复。
- lint、typecheck、详情相关 smoke 与 dark-mode smoke 通过；不重复执行 watch build。

---

**Implementation Notes:** 用户已明确指定三类业务和交互方向；实现继续复用现有动作构建结果，避免权限分叉。

## Implementation Result

- 新增共享 `DetailOverflowActions`，提供大触控区、透明遮罩、滚动收起、忙碌态防重复提交。
- 跑腿、找同行、闲置详情仅把编辑与删除类管理动作合并至右上角菜单，举报独立可见。
- 三类详情底部评论栏继续直接展示高频 `available_actions`，输入态自动隐藏这些动作。
- 评论框使用 Ousea 语义表面、边框、字号和安全区；发布按钮改用白色向上箭头，保持 `88rpx` 热区但将可见圆缩至 `56rpx`，业务按钮可见胶囊缩至 `64rpx`。
- 输入态表情与发布按钮合并为自适应靠右操作组，可见图形间距收紧，同时保留互不重叠的独立触控区域。
- 表情图标与向上发布箭头统一为 `32rpx`，保持同一视觉权重。
- 已通过 lint、typecheck、详情操作、详情导航、移动端交互、设计 Token、字体及暗色模式 smoke；按约定未重复构建。
