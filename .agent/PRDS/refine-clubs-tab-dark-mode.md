# Campus Miniapp：优化社团 Tab 深色模式

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Overview

社团广场已使用部分全局语义变量，但 Hero、卡片描边、目录分隔、骨架屏和状态反馈仍保留浅色专用值，系统进入深色模式时会出现过亮蓝青色块、白边和浅色占位。目标是在保留现有页面结构、社团蓝青识别感和两种浏览模式的前提下，建立清晰、低眩光的深色层级。

## User Story

**As a** 使用系统深色模式浏览社团的用户
**I want** 社团广场所有入口、卡片和状态反馈具有一致的深色视觉
**So that** 卡片与内容清晰可读，且不会出现突兀白边和高亮浅色块

## Design Direction

- 页面使用 `page / surface / surface-subtle` 三层深色语义面。
- Hero 保留蓝青识别感，但改用低明度深海蓝渐变，白色标题继续保持高对比。
- 搜索框、分类、我的社团、视图切换使用语义边框，不使用白色或浅蓝描边。
- 卡片与目录列表保持同一表面层级；用户上传的封面与 Logo 不反色。
- 默认社团图标、搜索等功能 SVG 定向提亮。
- 主操作和激活态使用深色模式可承载白字的 `#2563EB`，避免 `#60A5FA` 配白字对比不足。
- 骨架屏、错误态、空状态与索引浮层同步适配。

## Requirements

1. 社团页背景、导航衔接和 Hero 在深色模式下无浅色残留。
2. 搜索框、分类筛选、工作区入口和卡片/目录切换边界清晰。
3. 卡片、目录列表、索引栏使用统一深色表面、边框和低扩散阴影。
4. Logo 白边、目录浅色分隔线、默认封面底板全部切换为深色语义值。
5. 社团名称、简介、分类、数量和辅助信息保持明确的四级文字对比。
6. 骨架屏、加载、空、错误与局部刷新失败状态均有对应深色表现。
7. 激活分类、创建主页、重试等实色按钮继续使用白字，背景对比度达到 4.5:1。
8. 保留页面布局、触控热区、卡片/目录切换、搜索、索引滑动和业务接口。

## Files to Modify

- `src/styles/_dark-mode.scss` - 增加社团广场模块级深色覆盖。
- `scripts/dark-mode-smoke.ts` - 增加社团页深色规则和关键对比度断言。
- `scripts/clubs-smoke.ts` - 增加社团页主题结构回归断言（如有必要）。

## API Endpoints

不涉及接口、数据结构或请求逻辑修改。

## Technical Implementation

- 深色规则继续集中在全局 `prefers-color-scheme: dark` 覆盖层。
- 使用 `page .clubs-page ...` 提升主题规则权重，避免被页面末尾浅色默认声明覆盖。
- 只对固定功能图标应用滤镜，封面、Logo 等用户图片保持原色。
- 不新增页面私有基础 token，不修改 Ousea 全局 token。

## Testing Requirements

- `yarn test:dark-mode`
- `yarn test:clubs`
- `yarn test:design-tokens`
- `yarn test:typography`
- `yarn typecheck`
- `yarn lint`
- `git diff --check`

按当前开发约定，不执行 `yarn build:weapp`。

## Acceptance Criteria

- 深色模式下 Hero 不刺眼，标题、说明和图标清晰。
- 卡片视图与目录视图均无白色边框、浅色骨架或不可见功能图标。
- 搜索、筛选、视图切换、索引及状态反馈层级一致。
- 浅色模式、页面布局和全部业务交互保持不变。

---

**Implementation Notes:** UI/UX 技能用于检查对比度、卡片层级和状态完整性；最终颜色以 Ousea / Global 为准，不采用技能检索中与项目冲突的黑金配色与字体建议。

**Implemented:** 社团广场完整深色覆盖与回归断言已完成，未修改接口、布局、浅色模式或业务交互。
