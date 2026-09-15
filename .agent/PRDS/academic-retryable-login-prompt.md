# OUSea小程序: 教务认证快速失败重试提示

**Priority:** Medium
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-23
**Last Updated:** 2026-08-23

## 概述

服务端在信息门户认证阶段遇到可恢复的快速失败时，会返回稳定错误码 `academic_retryable`（HTTP 503）。小程序当前对该错误码没有专门映射，会直接显示服务端原始消息，无法稳定传达“本次未完成、可以再次尝试”的用户语义。

本任务在教务认证绑定页和课表、成绩、考试、选课等教务数据页分别增加该错误码的中文提示，保留现有手动重试流程，不执行自动重试或重复提交密码。

## 用户故事

作为正在绑定校园身份的用户，当教务服务暂时繁忙时，我希望知道需要重启小程序后重试绑定；作为查看教务数据的用户，我希望知道可以下拉重试刷新，而不是误以为账号或密码错误。

## 背景与契约

- 服务端错误码：`academic_retryable`。
- 服务端语义：本次认证未完成，用户稍后可以主动重试。
- 客户端边界：不自动重试、不增加定时器、不改变幂等键和凭据提交请求。
- 现有页面在请求结束后会清除 `working` 状态，“验证并绑定”按钮可再次点击，满足手动重试条件。

## 功能要求

1. 绑定页收到 `academic_retryable` 时，显示：`教务暂时繁忙，请重启小程序重试绑定。`
2. 教务数据页收到 `academic_retryable` 时，显示：`教务暂时繁忙，请下拉重试刷新。`
3. 原有无效凭据、密码过期、账号受限、验证码和其他服务错误的文案及处理逻辑保持不变。
4. 绑定页错误提示结束后恢复可操作状态；教务数据页继续使用现有重试按钮和下拉刷新流程。
5. 不因该错误码记录拒绝凭据，不触发密码符号转换，不弹出验证码冷却提示。
6. 补充源代码冒烟断言，防止两个场景的错误码映射和重试文案回归。

## 实施方案

- 在绑定页 `credentialErrorMessage` 的错误码映射中增加 `academic_retryable` 分支，使用重启小程序的绑定提示。
- 在公共 `resolveAcademicLoadError` 映射中增加 `academic_retryable` 分支，使用下拉刷新提示。
- 复用现有反馈区域、`working` finally 清理逻辑和教务重试动作，不引入新的状态管理或 UI 组件。
- 在现有绑定页和教务缓存提示冒烟测试中分别断言错误码与目标文案存在。
- 不修改 API 请求封装：`ApiError` 已保留服务端 `error.code`，可以直接供页面判断。

## 文件 to Create

- 无。

## 文件 to Modify

- `src/pages/academic-verification/index.tsx`：增加绑定页 `academic_retryable` 的中文错误提示映射。
- `src/pages/academic/components/academic-load-state.tsx`：增加教务数据页 `academic_retryable` 的下拉刷新提示映射。
- `scripts/academic-credential-repeat-smoke.ts`：增加可重试错误码和文案的静态断言。
- `scripts/academic-cache-metadata-smoke.ts`：增加教务数据页错误码和文案的静态断言。

## API 与数据库

不新增接口，不修改请求体、认证头、幂等键或数据库结构。

## 设计与交互

- 沿用认证页现有字段附近的错误反馈区域，保持错误图标、可访问告警语义和暗色模式样式。
- 绑定页文案固定为“教务暂时繁忙，请重启小程序重试绑定。”；教务数据页文案固定为“教务暂时繁忙，请下拉重试刷新。”，不暴露上游技术细节。
- 不增加自动重试动画、倒计时或不可操作的等待状态。

## 测试要求

### 静态冒烟

- 认证页包含 `academic_retryable` 分支。
- 映射文案包含服务繁忙和手动重试语义。
- 既有凭据错误、密码转换和验证码冷却断言继续通过。

### 回归验证

- `yarn lint`
- `yarn typecheck`
- `yarn test:academic-credential`
- `yarn test:academic-credential-repeat`
- `yarn test:academic-verification-refresh`
- `yarn build:weapp`

## 验收标准

1. 服务端返回 `academic_retryable` 时，绑定页显示“教务暂时繁忙，请重启小程序重试绑定。”。
2. 服务端返回 `academic_retryable` 时，教务数据页显示“教务暂时繁忙，请下拉重试刷新。”。
3. 绑定页请求结束后“验证并绑定”按钮重新可用，教务数据页现有重试动作不变。
4. 其他认证错误码的既有行为不变。
5. 相关 lint、类型检查、冒烟测试和微信小程序构建通过。

---

**Implementation Notes:**

本任务只适配客户端展示语义。后端错误码来源与 HTTP 503 约定见相邻 `campus_backend` 仓库的 OUC 登录韧性任务；小程序侧不承担自动重试责任。
