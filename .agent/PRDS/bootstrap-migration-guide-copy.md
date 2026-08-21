# OUSea小程序：Bootstrap 配置资格版迁移引导文案

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-09
**Last Updated:** 2026-08-09

## 一、概述

资格版当前将新版小程序名称、迁移标题、说明、按钮和提示文案写死在多个页面。为了便于发布后修正名称和措辞，允许现有 `/api/v1/runtime-configs/miniapp/bootstrap` 配置下发文案。配置能力仅限展示文本，不得影响资格版功能边界或跨小程序跳转行为。

用户已经确认按该边界执行。

## 二、配置结构

在 bootstrap 的 `value` 中增加可选字段：

```json
{
  "migration_guide": {
    "target_name": "OUSea新版",
    "title": "校园生活服务已迁移",
    "description": "校园社区、闲置互助、课程资料与社团服务，现已在「OUSea新版」提供。",
    "entry_button_text": "查看新版服务",
    "open_button_text": "打开新版小程序",
    "hint": "将在微信中打开另一小程序"
  }
}
```

## 三、功能边界

- 仅 `qualification` 版本消费该字段；`full` 版本行为不变。
- 只允许配置六个纯文本字段。
- 不允许配置显示开关、AppID、目标路径、模块映射、跳转类型、自动跳转或资格版页面清单。
- 每个字段必须去除首尾空白、非空并满足长度上限。
- 任一字段非法时，对该字段使用内置默认值，不让整份 bootstrap 配置失效。
- bootstrap 请求失败、缓存损坏或旧版本没有该字段时使用内置默认文案。
- 文案继续通过现有 runtime-config 缓存策略保存，不新增接口或后端权限。

## 四、实现方案

- 在 `MiniappRuntimeConfig` 增加 `migration_guide` 类型。
- 在默认 bootstrap 文档中提供与当前页面一致的默认文案。
- 校验器允许服务端缺省该字段，归一化阶段逐字段校验并合并默认值。
- 提供统一的 `getMigrationGuideCopy(config)` 读取函数，完整版固定返回默认文案。
- 首页、全部服务页和迁移承接页统一读取该函数，移除重复硬编码。
- 学业页面中的短提示不纳入本次配置，避免同一个长文案字段被错误复用于不同组件语境。

## 五、拟修改文件

- `src/features/runtime-config/index.ts`：类型、默认值、校验、归一化和文案读取函数。
- `src/pages/index/index.tsx`：首页迁移卡片读取配置。
- `src/pages/services/index.tsx`：全部服务迁移卡片读取配置。
- `src/pages/feature-migrated/index.tsx`：承接页加载 bootstrap 并读取配置。
- `scripts/qualification-build-smoke.ts` 或新增语义测试：验证默认回退和受限字段边界。

## 六、审核与安全要求

- 远程配置不得让资格版出现社区、发布、评论、上传、交易或社团编辑能力。
- 远程配置不得改变 `Taro.navigateToMiniProgram` 的 `appId`、`path`、`envVersion` 或触发时机。
- 文案不得支持 HTML、富文本、外链或可执行动作。
- 页面启动和生命周期内不得自动跨小程序跳转。

## 七、测试要求

- 无 `migration_guide` 时显示当前默认文案。
- 部分字段存在时只覆盖合法字段。
- 空字符串、错误类型和超长字段回退默认值。
- 首页、全部服务页和承接页使用同一份归一化文案。
- `yarn typecheck`、`yarn lint`、既有冒烟测试和 `yarn build` 通过。
- 资格版产物页面、Tab、AppID 白名单和受限接口审计继续通过。

## 八、完成标准

- bootstrap 可以调整资格版六项迁移文案。
- 配置缺失或失败时界面稳定显示默认内容。
- 构建期功能裁剪与跨小程序导航安全边界不受远程配置影响。

---

**文档依据：**

Taro `/nervjs/taro-docs` 说明 `getStorageSync`/`setStorageSync` 可读写可序列化本地缓存；本方案沿用现有 runtime-config 的校验、缓存和失败回退机制。
