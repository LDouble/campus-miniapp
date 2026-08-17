# campus-miniapp: 外部凭据填充后的绑定引导动效

**Priority:** Medium
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-17
**Last Updated:** 2026-08-17

## Overview

用户从其他小程序进入教务绑定页时，账号、密码和学生类型会自动填充。页面需要在填充完成后清楚提示用户下一步点击“验证并绑定”，减少用户误以为已经完成绑定的情况。

## User Story

**As a** 从其他小程序跳转而来的用户
**I want** 在凭据自动填充后看到下一步操作提示
**So that** 我能快速完成验证和绑定。

## Implementation Overview

在现有外部凭据预填充状态基础上增加一次性引导状态，仅在完整凭据被接收且“验证并绑定”按钮可点击时展示。来源小程序的 `extraData` 在 App 生命周期中接收并仅供绑定页消费一次；引导由短文案、方向指示和低频脉冲动效组成；手动进入、降低动态效果偏好和提交中状态不展示或停止动效。

## Features / Requirements

1. 外部凭据填充成功后，显示“信息已填好，点击验证并绑定”的引导。
2. 引导视觉上指向“验证并绑定”按钮，并使用有限次数的轻量脉冲动效。
3. 用户点击提交、切换为学生证认证或没有完整外部凭据时，不显示该引导。
4. `prefers-reduced-motion: reduce` 下保留静态提示，不播放动效。

## Files to Modify

- `src/pages/academic-verification/index.tsx` - 维护预填充引导状态并渲染提示。
- `src/pages/academic-verification/index.scss` - 添加按钮强调、提示和降低动态效果样式。
- `scripts/academic-verification-miniapp-prefill-smoke.ts` - 覆盖引导触发和无密码日志的静态回归检查。

## Libraries/Dependencies

- 不新增依赖；沿用 React、Taro 和当前页面 SCSS 动效写法。

## Testing Requirements

- 验证完整外部凭据会开启绑定引导。
- 验证无效或缺失的外部数据不会显示引导。
- 验证降低动态效果时禁用动画。
- 运行 TypeScript 类型检查、小程序构建和对应 smoke 测试。

---

**Implementation Notes:** 动效仅用于当前用户明确需要的下一步操作，不自动提交账号或密码。
