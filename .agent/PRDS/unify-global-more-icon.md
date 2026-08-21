# Campus Miniapp：统一全局更多图标

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Overview

将小程序内承担“更多 / 展开操作”语义的 `..`、`•••` 文本和竖向点号 SVG，统一替换为同一个横向三圆点 SVG。图标采用 Ousea 深海蓝，浅色卡片可继续搭配浅蓝底板，暗色模式使用提亮后的语义主色；按钮点击热区与交互逻辑保持不变。

## User Story

**As a** 浏览帖子和生活服务内容的学生
**I want** 所有更多操作入口使用一致、清晰的图标
**So that** 我能立即识别操作入口，并且不会看到由系统字体、字距和基线造成的不同点号样式

## Design Direction

- 使用 `24 × 24` viewBox 的横向三圆点 SVG，圆心位于 `6 / 12 / 18`，半径 `2.1`，视觉宽度克制且三个点完全等圆。
- 浅色图标使用 `--ousea-ocean-600` 对应的 `#1D5FD6`；暗色模式提亮为 `#60A5FA`。
- 实际图标视觉尺寸约 `36rpx / 18px`，交互按钮仍保持至少 `88rpx × 88rpx`。
- Feed 卡片允许保留 `surface-subtle` 浅色底板；详情页可使用无底板版本。底板属于按钮容器，不进入 SVG。
- 参考 Lucide 的一致 viewBox/几何规范和 Material 的 overflow action 语义，但最终颜色、尺寸和状态均以 Ousea / Global 为准。

## Requirements

1. 新增唯一公共资产 `src/assets/icons/more-horizontal.svg`，不再用 `Text` 渲染点号。
2. 替换帖子 Feed 操作按钮中的 `••`，保留展开、收起、阻止事件穿透和评论面板逻辑。
3. 替换帖子详情当前竖向 `detail-more.svg`，改为横向图标。
4. 替换跑腿、找同行列表卡片中的 `•••` 装饰图形；不改变整卡点击详情行为。
5. 替换跑腿、二手、找同行详情公共溢出菜单触发器中的 `•••`，保留菜单、遮罩、滚动收起和删除/编辑操作。
6. 不替换加载状态中的 `···`、文本省略号、输入占位符或“加载更多”文案；它们不属于操作图标。
7. 清理不再使用的 `src/assets/community/detail-more.svg` 和重复 `src/assets/community/more.svg`，确保更多操作只引用一个资产。
8. 浅色、暗色及按压态均保持清晰；所有功能入口继续提供现有 `ariaLabel`。

## Implementation Overview

1. 新增横向三圆点 SVG 公共资产。
2. 将社区帖子、帖子详情、跑腿/找同行卡片和公共详情溢出菜单中的文字节点改为 Taro `Image`。
3. 收敛相关 SCSS 的字号、字距和基线偏移，统一为图标宽高、底板与按压透明度。
4. 更新暗色模式，只对公共更多图标做语义提亮，不全局反色其他图片。
5. 新增 smoke test，扫描操作组件，禁止重新出现 `••` / `•••` 和旧更多资产引用。

## Files to Create

- `src/assets/icons/more-horizontal.svg` - 唯一公共更多图标。
- `scripts/more-icon-smoke.ts` - 全局资产复用、无文字点号和暗色模式断言。

## Files to Modify

- `src/features/community/post-card.tsx`
- `src/features/community/feed-panel.scss`
- `src/packages/social/community/detail.tsx`
- `src/packages/social/community/detail.scss`
- `src/features/life-services/components/errand-card.tsx`
- `src/features/life-services/components/carpool-card.tsx`
- `src/features/life-services/components/detail-overflow-actions.tsx`
- `src/features/life-services/list-panel.scss`
- `src/features/life-services/detail.scss`
- `src/styles/_dark-mode.scss`
- 相关 smoke tests 与 `package.json`

## API Endpoints

不涉及接口、数据结构或业务状态修改。

## Libraries/Dependencies

- 使用现有 Taro `Image` 与本地 SVG 资产。
- 不新增第三方依赖。

## Testing Requirements

- `yarn test:more-icon`
- `yarn test:community-list-figma`
- `yarn test:community-detail-figma`
- `yarn test:detail-actions`
- `yarn test:dark-mode`
- `yarn test:design-tokens`
- `yarn typecheck`
- `yarn lint`
- `git diff --check`

按当前开发约定，不执行 `yarn build:weapp`。

## Risks and Constraints

- Taro 小程序外链 SVG 无法直接继承 CSS `currentColor`，因此浅色资产使用固定 Ousea 深海蓝，暗色模式通过定向样式提亮。
- 文字点号原本依赖字体和 `letter-spacing`，替换后需删除相应规则，避免 SVG 出现多余位移。
- “全局”限定为更多操作语义，不包含加载动画、普通标点和文本溢出省略号。

---

**Preview:** `/Users/liangluo/.codex/visualizations/2026/08/20/01a01eff-0488-79a3-84cf-c71559c05e51/global-more-icon-preview.png`
