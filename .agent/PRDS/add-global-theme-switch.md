# Campus Miniapp：全局深色模式开关

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Overview

在“我的”页面增加“跟随系统”和“深色模式”控制。首次使用时跟随系统主题；用户也可以明确保存深色或浅色偏好并覆盖系统主题。主题切换覆盖整个常规小程序运行时，包括主包、分包、页面组件、自定义导航、原生窗口背景和自定义 TabBar。

## Requirements

1. “我的”新增独立的“显示与外观”区域，只展示一个“深色模式”设置项；点击整行使用微信原生 ActionSheet 选择“跟随系统 / 打开 / 关闭”，右侧展示当前值。
2. 偏好支持 system/light/dark 三态并持久化；system 实时跟随微信外观，显式 light/dark 在重启后仍生效。
3. 通过 Taro 生成页面模板为每个页面根节点统一挂载主题 class，Ousea / Global 语义 token 与暗色例外样式均由该 class 驱动。
4. 手动浅色必须能覆盖系统深色，手动深色必须能覆盖系统浅色。
5. 同步原生导航栏、下拉背景、窗口背景、原生 TabBar 配置和自定义 TabBar。
6. 不改变现有浅色、深色 token 数值，不修改业务数据、导航和页面布局。
7. 保留系统主题监听：仅在偏好为 system 时跟随系统变化。
8. 用户在“我的”修改主题偏好后，通过微信原生重启能力和绝对页面路径 `/pages/index/index` 回到首页；冷启动时由页面初始 data 直接提供目标主题，避免先浅后深。原生重启不可用时回退为即时同步并重建页面栈。

## Files to Modify

- `src/features/theme-preference.ts`：主题读取、持久化、订阅与原生窗口同步。
- `config/plugins/weapp-compat.js`：向 Taro 页面模板传递主题值并为页面根节点注入主题 class。
- `src/app.ts`、`src/app.scss`：主题初始化与全局语义 token。
- `src/styles/_dark-mode.scss` 及页面局部暗色样式：从系统媒体查询迁移为全局主题 class。
- `src/pages/profile/index.tsx`、`index.scss`：新增显示与外观开关。
- `src/custom-tab-bar/*`、`src/utils/tabbar.ts`：同步自定义 TabBar 主题。
- `scripts/dark-mode-smoke.ts`：补充全局切换、持久化和手动覆盖断言。

## Testing Requirements

- `yarn test:dark-mode`
- `yarn test:design-tokens`
- `yarn test:typography`
- `yarn test:profile-username`
- `yarn test:tabbar-layout`
- `yarn typecheck`
- `yarn lint`
- `git diff --check`

当前已运行 `taro build --type weapp --watch`，不重复执行构建命令。

已通过：`yarn lint`、`yarn typecheck`、`yarn test:dark-mode`、`yarn test:design-tokens`、`yarn test:typography`、`yarn test:community-detail-figma`、插件级页面/组件注入模拟测试与 `git diff --check`。

## Manual Acceptance Criteria

- 系统浅色时打开开关，当前页和切换后的任意主包/分包页面立即为深色。
- 系统深色时关闭开关，整个小程序立即为浅色，不被媒体查询重新覆盖。
- 切换 Tab、进入详情、返回和重启后主题保持一致。
- 在“我的”切换主题后小程序自动重启回首页，不得把首页路径错误拼接到个人页目录；深色首帧不先展示浅色页面。
- 自定义 TabBar、状态栏附近背景、下拉刷新区域与页面内容没有明暗割裂。
