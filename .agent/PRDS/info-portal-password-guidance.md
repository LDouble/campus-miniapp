# Miniapp: 信息门户密码引导与重复错误凭据拦截

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-15
**Last Updated:** 2026-08-15

## Overview

优化校园身份认证页面的凭据填写体验，明确区分信息门户密码、微信密码和小程序账号密码；当校方明确返回账号密码错误或密码过期后，在当前页面会话内阻止用户原样重复提交同一组凭据，减少无效上游请求和限流消耗。

## User Story

**As a** 需要绑定教务身份的学生  
**I want** 清楚知道应填写哪套密码，并在重复提交已被拒绝的密码时得到明确提醒  
**So that** 我不会误填微信或小程序密码，也不会反复触发无效教务认证请求。

## Context

当前页面已经使用“信息门户密码”作为字段标题，但提示分散，用户仍可能将其理解为微信密码或小程序密码。当前提交失败后只显示 Toast，不记录刚被拒绝的凭据，因此相同学号、学生类型和密码可以立即重复请求。

后端当前的 `invalid_academic_credentials` 语义偏宽。除校方页面明确包含“用户名或密码错误”等文本外，登录完成状态不明、门户学号与提交学号不一致、教务服务跳回登录页等兜底场景也可能返回该错误码。若客户端直接据此拦截，会把部分校方异常误记为坏密码。

## Implementation Overview

- 小程序在凭据表单顶部增加醒目的说明卡片，文案明确为：“请填写中国海洋大学信息门户/统一身份认证账号密码，不是微信密码，也不是本小程序账号密码。”
- 页面内记录最近一次被明确拒绝的凭据三元组：标准化学号、学生类型、密码。仅保存在组件内存，不写本地存储、不写日志。
- 仅当 API 返回 `invalid_academic_credentials` 或 `academic_password_expired` 时记录；网络错误、服务不可用、限流、验证码、身份类型不匹配均不记录。
- 再次提交完全相同三元组时不发请求，改为弹窗引导。修改学号、学生类型或密码中的任一项后允许重新提交。
- 后端收紧 OUC 错误映射：只有明确的账号/密码错误文本映射为 `invalid_academic_credentials`，明确的过期错误码或文本映射为 `academic_password_expired`；认证未完成、身份响应不一致、服务重新跳转登录等非明确场景映射为可重试的服务异常或更准确的身份异常。

## Features / Requirements

1. **凭据来源提示**
   - 表单可见区域明确展示密码来源。
   - 明确排除微信密码和小程序账号密码。
   - 原有“仅保存在本机、服务端不持久化”说明继续保留。

2. **重复错误凭据拦截**
   - 比较标准化学号、学生类型和密码的完整组合。
   - 账号密码错误时提示用户核对信息门户账号密码。
   - 密码过期时提示用户先在校方统一身份认证页面修改密码。
   - 拦截发生在 `verifyAcademicCredentials` 调用前。
   - 页面卸载后不保留失败密码，避免扩大敏感数据生命周期。

3. **错误状态展示**
   - 首次明确拒绝后，在密码输入框附近显示持久的行内说明，不只依赖短暂 Toast。
   - 用户修改任一凭据字段后，行内状态转为可再次提交。
   - 不在埋点、错误上报、日志或本地存储中记录密码。

4. **后端错误语义收紧**
   - 保留明确凭据错误文本：“用户名或密码错误”“账号或密码错误”“用户名或密码不正确”“用户名或密码有误”“账号或密码有误”“密码错误”。
   - 移除宽泛的“认证失败”凭据错误匹配。
   - 登录仍停留在统一认证域、门户身份学号不一致、服务跳回登录页或落到意外地址时，不再返回 `invalid_academic_credentials`。
   - 网络、超时、解析错误继续返回 `academic_provider_unavailable`。
   - 密码过期仍仅由校方错误码 `40605` 或明确过期文本触发。

## Files to Create

- `src/features/academic-verification/credential-rejection.ts` - 封装页面内被拒凭据的精确比较和提示文案。
- `scripts/academic-credential-repeat-smoke.ts` - 验证提示文案、错误分类和重复提交拦截源码契约。

## Files to Modify

- `src/pages/academic-verification/index.tsx` - 增加引导、页面内拒绝凭据状态和提交前拦截。
- `src/pages/academic-verification/index.scss` - 增加提示卡片和行内错误状态样式。
- `package.json` - 注册目标 smoke 测试命令。
- 后端 `internal/modules/academic/infrastructure/ouc/sso.go` - 收紧登录失败文本与认证未完成分类。
- 后端 `internal/modules/academic/infrastructure/ouc/provider.go` - 收紧门户身份和服务访问异常分类。
- 后端相关 OUC 集成测试 - 覆盖明确拒绝与非明确异常的映射边界。

## API Endpoints

不新增接口，不修改 OpenAPI 结构。继续使用：

- `POST /api/v1/academic-verification/credentials`

现有错误码保持兼容，但 `invalid_academic_credentials` 的触发范围会收紧。

## Libraries/Dependencies

- Taro React 现有依赖，不新增第三方包。
- Taro `Input` 使用受控 `value`/`onInput`，密码展示继续使用 `password` 属性。
- Taro `showModal` 用于重复提交拦截提示。

## Technical Considerations

- 失败密码只保留在当前页面组件状态中，页面销毁即释放。
- 不使用持久化密码哈希；学生密码熵可能有限，持久化无盐摘要仍会扩大离线猜测风险。
- 客户端拦截是体验优化，服务端既有按用户、学号摘要和 IP 的限流仍是安全边界。
- 后端采用保守分类：无法证明是密码错误时，不返回密码错误码。

## Testing Requirements

### Unit / Smoke Tests

- 页面包含信息门户、非微信密码、非小程序密码的明确提示。
- 首次 `invalid_academic_credentials` 会记录当前三元组。
- 首次 `academic_password_expired` 会记录当前三元组。
- 相同三元组再次提交不会调用 API。
- 修改密码、学号或学生类型后允许提交。
- 服务不可用、限流、验证码和身份类型错误不会触发本地拦截。
- OUC 明确账号密码错误文本仍映射为 `ErrInvalidCredentials`。
- OUC 密码过期码/文本仍映射为 `ErrPasswordExpired`。
- 登录状态不明、门户学号不一致和服务重新跳转登录不再映射为凭据错误。

### Validation

- `yarn test:academic-credential-repeat`
- `yarn typecheck`
- `yarn build:weapp`
- 后端 OUC 与 academic verification 目标包测试
- 两个仓库 `git diff --check`

---

**Implementation Notes:**

当前核查结论是：密码过期分类较严格，只来自校方 `40605` 或明确过期文本；账号密码错误分类目前包含若干兜底场景，需要先收紧后再作为客户端重复拦截依据。
