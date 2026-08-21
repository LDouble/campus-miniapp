# OUSea小程序：微信 AI 校园信息 Skill

**Priority:** High
**Status:** In Progress
**Type:** Feature
**Created:** 2026-08-10
**Last Updated:** 2026-08-10

## Overview

为OUSea小程序接入微信小程序 AI 开发模式，将现有的官方通知、校车和空教室查询能力封装成微信 AI 可调用的原子接口。用户可在微信 AI 对话中用自然语言查询校园公开信息，并在需要查看完整结果时通过 handoff 小程序卡片进入已有业务页面。

本任务不建设小程序内的大模型对话界面，也不直接调用 CloudBase AI+。微信 AI 负责理解用户意图和编排 Skill，小程序原子接口负责以受控方式调用现有校园后端。

## User Story

**As a** OUSea小程序用户
**I want** 在微信 AI 中直接查询学校通知、校车安排和空教室
**So that** 我无需先进入小程序逐层寻找功能，也能得到结构化结果并在需要时继续进入完整页面。

## Description

第一期创建单一 `campus-info` Skill，包含三个公开、只读的原子接口：

1. `searchOfficialNotices`：按关键词、分类和时间范围检索学校官方通知。
2. `queryShuttleSchedule`：按校区、日期或方向查询校车线路和班次。
3. `findEmptyClassrooms`：按校区、日期和节次查询可用教室。

每个接口均返回适合模型总结的文本 `content`、结构化 `structuredContent`、对应的原子 GUI 卡片，并在查看完整列表时返回 handoff。三张卡片只展示最多 3 条必要摘要，用户点击卡片后进入既有业务页面继续查看。

原子 GUI 卡片与 handoff 小程序卡片是两个不同的展示单元：GUI 卡片只负责只读摘要，不直接调用小程序导航 API；在小程序内部 AI 开发模式中，通过 `components[].relatedPage` 和 `viewCtx.setRelatedPage()` 提供标题栏“进入小程序”入口；在外部微信 AI 场景中继续通过 `_meta.ui.pagePath + handoff` 进入同一业务页。组件文案统一描述为“通过卡片入口进入小程序”，不假设下方一定另行出现 handoff 卡片。

## Context

当前小程序采用 Taro 4、React 和 TypeScript，运行时页面通过 `apiRequest` 调用现有后端；微信 AI Skill 则要求原生 JavaScript 独立分包，不能引用主包、React、Taro Hook 或 `getApp()` 状态。项目同时维护完整版与资质版构建，AI 能力与 AppID 权限绑定，因此第一期只在完整版构建启用，资质版不得携带未经授权的 `agent` 配置。

官方 AI 开发模式要求：

- `skills` 为独立分包。
- `app.json` 顶层配置 `lazyCodeLoading: "requiredComponents"`。
- `agent.skills[]` 声明 Skill 名称、描述和路径。
- `project.config.json` 打包配置包含 `skills`。
- Skill 内包含 `SKILL.md`、`mcp.json`、`index.js`、原子接口和独立请求/鉴权工具。
- 进入小程序的主要方式为 handoff；第一期不依赖 `wx.openAgent` 或 `wx.navigateBackAgent`。

## Goals

- 让微信 AI 能稳定发现并调用三个校园公开信息能力。
- 保持 Taro 源码为唯一事实来源，构建产物可重复生成。
- 不改变现有页面正常访问路径和后端业务语义。
- 为后续个人课表、考试等登录态 Skill 建立可复用的原生请求、环境配置和校验基础。

## Non-Goals

- 不在小程序内新增聊天页面或模型供应商 SDK。
- 不新增后端 AI、RAG、向量数据库或模型调用接口。
- 不开放成绩、课表、考试、教务凭证、手机号、联系方式等个人或敏感数据。
- 不开放社区发布、评论、点赞、报名、占用上报、支付等写操作。
- 不生成半屏页或新的小程序业务页面；原子 GUI 组件仅用于微信 AI 对话内的只读结果摘要。
- 不为 H5、支付宝、百度、抖音等非微信端提供 AI Skill。
- 不替代微信公众平台上的 AI 开发模式权限申请与审核。

## Implementation Overview

### 1. 源码与构建产物分层

在 `src/ai-mode/skills/campus-info/` 维护原生 Skill 源码，在 `src/ai-mode/page-meta.json` 维护页面元数据。通过 Taro `copy.patterns` 将这些文件复制到完整版输出目录：

```text
src/ai-mode/
├── page-meta.json
└── skills/
    └── campus-info/
        ├── SKILL.md
        ├── mcp.json
        ├── index.js
        ├── apis/
        │   ├── searchOfficialNotices.js
        │   ├── queryShuttleSchedule.js
        │   └── findEmptyClassrooms.js
        └── utils/
            ├── config.js
            ├── request.js
            └── result.js
```

不得直接修改或提交 `dist/full`。完整版构建后应生成：

```text
dist/full/page-meta.json
dist/full/skills/campus-info/**
```

### 2. Taro 应用配置

在 `src/app.config.ts` 中仅对完整版添加：

- `subPackages: [{ root: "skills", pages: [], independent: true }]`
- `lazyCodeLoading: "requiredComponents"`
- `agent.skills[0]` 的 `name`、`description`、`path`
- `agent.pageMetadata: "page-meta.json"`

保留现有页面、tabBar 和资质版裁剪逻辑。若 Taro 类型尚未声明 `agent`，应通过项目内最小类型扩展解决，不使用无边界的 `any`。

### 3. 原子接口设计

所有接口由 `wx.modelContext.createSkill` / `registerAPI` 注册，网络请求统一经过 Skill 私有的 `utils/request.js`。原子接口不得直接使用 `Taro.request`、主包 `apiRequest`、`getApp()` 或跨分包 import。

#### `searchOfficialNotices`

输入：

- `keyword`：可选，通知标题或正文关键词。
- `category`：可选，后端支持的通知分类。
- `pageSize`：可选，限制返回数量，采用小上限。

输出：

- 通知 ID、标题、来源、分类、发布时间、摘要。
- 命中数量和查询条件。
- handoff 到 `/pages/official-notices/index`；若只命中单条，可 handoff 到 `/pages/official-notices/detail` 并携带 `id`。

#### `queryShuttleSchedule`

输入：

- `campus`：可选，目标或出发校区。
- `date`：可选，`YYYY-MM-DD`。
- `keyword`：可选，路线或站点关键词。

输出：

- 路线 ID、名称、运行日期、方向、站点和班次摘要。
- handoff 到 `/pages/shuttle/index`；单路线可 handoff 到 `/pages/shuttle/detail` 并携带 `id`。

#### `findEmptyClassrooms`

输入：

- `campus`：必填或由 Skill 根据业务允许的默认值补齐。
- `date`：必填，`YYYY-MM-DD`。
- `sections`：必填，节次数组，必须符合现有 1 至 12 节规则。
- `building`：可选，教学楼筛选。

输出：

- 校区、日期、节次、教学楼、教室名称和可用状态。
- handoff 到 `/pages/empty-classroom/index`，query 必须与现有页面可解析参数保持一致；如现有页面不支持 URL 预填，应在本任务内增加向后兼容的只读预填解析。

### 4. 环境与网络请求

Skill 独立请求层需要根据 `wx.getAccountInfoSync().miniProgram.envVersion` 选择审核/开发 API 与生产 API，行为与当前 `src/api/environment.ts` 一致。构建时由受控脚本把现有环境配置注入 Skill 产物，源码和日志不得包含私密凭证。

三个公开查询接口的权限角色包含 guest/member，但现有 HTTP 中间件仍统一要求 Bearer Token。Skill 独立分包必须复刻最小登录链路：

- `wx.login` 获取 code，并调用 `POST /api/v1/auth/wechat/login` 换取 TokenPair。
- 同一 AppID 下主包与独立 Skill 分包共享小程序 storage；Skill 复用主包现有 `campus.auth.accessToken.v1`、`campus.auth.refreshToken.v1`、`campus.auth.expiresAt.v1` 键，使双方共享会话。
- Access Token 临近过期时通过 `POST /api/v1/auth/refresh` 刷新；刷新失败后清理 Skill 私有会话并重新微信登录。
- 三个业务 GET 请求统一携带 `Authorization: Bearer <access_token>`，遇到会话失效只允许刷新并重试一次。
- 不修改后端匿名白名单，不扩大现有接口的公网授权边界。

### 5. Handoff 接力

`mcp.json` 在每个需要进入小程序的接口 `_meta.ui.pagePath` 中声明绝对页面路径，不包含 query。接口返回顶层：

```js
{
  content: [{ type: 'text', text: '...' }],
  structuredContent: { ... },
  handoff: {
    query: '...',
    card: { title: '...' }
  }
}
```

在 `src/app.ts` 的早期生命周期中注册 `wx.onAgentHandoff`，只缓存当前接力所需的 `path`、`query`、`payload`，不得持久化敏感信息。现有三个业务页面读取普通路由 query；payload 仅用于首屏加速，页面最终仍以真实后端查询为准。

### 6. 页面元数据

`page-meta.json` 至少声明：

- `/pages/official-notices/index`
- `/pages/official-notices/detail`
- `/pages/shuttle/index`
- `/pages/shuttle/detail`
- `/pages/empty-classroom/index`

名称与描述使用用户可理解的校园场景，不包含内部 API、数据库或实现术语。

## Features / Requirements

1. **微信 AI Skill 注册**
   - 完整版 `app.json` 能发现 `campus-info`。
   - `agent.skills[].description` 非空且准确覆盖三个能力。
   - `skills` 为独立分包，并启用 required-components 懒加载。

2. **原子接口**
   - 输入 Schema 收敛，字符串长度、日期格式、节次范围和返回数量有明确上限。
   - 输出 Schema 与实现返回完全一致。
   - 所有接口只读、幂等，不产生数据库写入或订阅授权弹窗。
   - 错误内容对用户友好，不暴露 URL、令牌、请求头、堆栈和内部错误结构。

3. **数据最小化**
   - 只返回完成当前回答所需字段。
   - 通知正文只返回短摘要，不向模型传输完整附件内容。
   - 不返回联系方式、用户标识、访问令牌或教务数据。

4. **Handoff**
   - 卡片标题说明即将打开的校园功能。
   - query 使用 `encodeURIComponent` 兼容的简单键值，不携带完整响应。
   - 页面能在无 payload、冷启动和登录状态变化时重新获取数据。
   - 原子接口成功与空结果文案均提示通过卡片入口进入小程序；三张 GUI 卡片不声明无法生效的直接跳页事件。
   - `mcp.json.components[]` 为三张 GUI 卡分别声明真实存在的 `relatedPage`；组件收到 Result 后用 `_meta.relatedPageQuery` 设置动态 query。

5. **构建隔离**
   - 完整版包含 AI Skill。
   - 资质版不包含 `agent`、`skills` 分包或 AI 源码复制产物。
   - H5 等非微信构建不引用 `wx.modelContext`。

6. **可观测性**
   - 原子接口仅记录请求 ID、接口名、耗时、结果状态等非敏感诊断信息。
   - 失败能够关联现有后端 `request_id`，但用户回答中不暴露内部上下文。

7. **原子 UI 卡片**
   - `searchOfficialNotices` 使用通知列表卡，最多展示 3 条通知的来源、分类、日期、标题与摘要。
   - `queryShuttleSchedule` 使用校车线路卡，最多展示 3 条线路的起终点、服务类型、下一班和部分发车时间。
   - `findEmptyClassrooms` 使用空教室卡，展示查询校区、日期、节次、总数，并最多展示 3 间教室。
   - 三张卡片均支持空结果、长文本省略和“还有 N 条”提示，不在组件内重新请求业务接口。
   - 组件比例为 1:1，根节点不设置固定高度；必须监听 `NotificationType.Overflow` 并输出官方校验要求的基线日志。
   - 原子组件不提供伪造的按钮或 `api/call`，卡片点击继续使用接口现有 handoff。

## Files to Create

- `src/ai-mode/page-meta.json` - 微信 AI 页面元数据。
- `src/ai-mode/skills/campus-info/SKILL.md` - 校园信息 Skill 的业务说明和编排规则。
- `src/ai-mode/skills/campus-info/mcp.json` - 三个原子接口及输入输出 Schema。
- `src/ai-mode/skills/campus-info/index.js` - Skill 初始化与原子接口注册。
- `src/ai-mode/skills/campus-info/apis/searchOfficialNotices.js` - 官方通知原子接口。
- `src/ai-mode/skills/campus-info/apis/queryShuttleSchedule.js` - 校车原子接口。
- `src/ai-mode/skills/campus-info/apis/findEmptyClassrooms.js` - 空教室原子接口。
- `src/ai-mode/skills/campus-info/utils/config.js` - 小程序环境与 API 地址解析。
- `src/ai-mode/skills/campus-info/utils/request.js` - 独立分包请求封装。
- `src/ai-mode/skills/campus-info/utils/result.js` - 文本、结构化结果、错误结果与 handoff 辅助函数。
- `src/ai-mode/skills/campus-info/components/official-notice-list/index.js` - 通知卡片数据映射和 Result/Overflow 生命周期。
- `src/ai-mode/skills/campus-info/components/official-notice-list/index.json` - 通知原子组件声明。
- `src/ai-mode/skills/campus-info/components/official-notice-list/index.wxml` - 通知卡片结构。
- `src/ai-mode/skills/campus-info/components/official-notice-list/index.wxss` - 通知卡片视觉样式。
- `src/ai-mode/skills/campus-info/components/shuttle-route-list/index.js` - 校车卡片数据映射和 Result/Overflow 生命周期。
- `src/ai-mode/skills/campus-info/components/shuttle-route-list/index.json` - 校车原子组件声明。
- `src/ai-mode/skills/campus-info/components/shuttle-route-list/index.wxml` - 校车卡片结构。
- `src/ai-mode/skills/campus-info/components/shuttle-route-list/index.wxss` - 校车卡片视觉样式。
- `src/ai-mode/skills/campus-info/components/empty-classroom-list/index.js` - 空教室卡片数据映射和 Result/Overflow 生命周期。
- `src/ai-mode/skills/campus-info/components/empty-classroom-list/index.json` - 空教室原子组件声明。
- `src/ai-mode/skills/campus-info/components/empty-classroom-list/index.wxml` - 空教室卡片结构。
- `src/ai-mode/skills/campus-info/components/empty-classroom-list/index.wxss` - 空教室卡片视觉样式。
- `src/features/wechat-ai/handoff.ts` - handoff 临时数据的类型安全存取。
- `src/types/wechat-ai.d.ts` - 当前微信 AI API 的最小类型声明。
- `scripts/wechat-ai-smoke.ts` - 构建产物、配置、Schema 和版本隔离 smoke test。

## Files to Modify

- `src/app.config.ts` - 完整版增加 `subPackages`、`lazyCodeLoading` 和 `agent` 配置。
- `src/ai-mode/skills/campus-info/mcp.json` - 注册三张组件并为对应 API 增加 `componentPath`。
- `config/index.ts` - 仅为微信完整版复制 AI Skill 和页面元数据。
- `project.config.json` - 将 `skills` 加入打包包含配置。
- `src/app.ts` - 注册 `wx.onAgentHandoff`。
- `src/pages/official-notices/index.tsx` - 解析通知 handoff 查询参数。
- `src/pages/official-notices/detail.tsx` - 兼容通知详情 handoff。
- `src/pages/shuttle/index.tsx` - 解析校车 handoff 查询参数。
- `src/pages/shuttle/detail.tsx` - 兼容路线详情 handoff。
- `src/pages/empty-classroom/index.tsx` - 解析并预填空教室 handoff 查询参数。
- `package.json` - 增加微信 AI smoke test 并接入 `ci:check`。

最终实施时可根据真实页面 query 能力减少不必要修改；不得为了匹配本文档而改动无关页面。

## API Endpoints

本任务原则上不新增后端端点，复用：

- `GET /api/v1/official-notices`
- `GET /api/v1/official-notices/{id}`
- `GET /api/v1/shuttle/routes`
- `GET /api/v1/shuttle/routes/{id}`
- `GET /api/v1/classrooms/available`

若验证发现这些公开数据接口强制用户登录，应暂停原子接口实现，单独评审是否新增受限的匿名只读端点；不得在本任务中未经批准扩大后端授权范围。

## Database Changes

无数据库结构和数据迁移。

## Libraries/Dependencies

- Taro 4.1.11：继续使用现有构建系统和 `copy.patterns`，不新增运行时依赖。
- 微信小程序 AI 开发模式：使用 `wx.modelContext`、`wx.onAgentHandoff`、独立 Skill 分包和 handoff 协议。
- 微信开发者工具：使用支持 AI 开发模式的版本，验证 AppID 权限、原子接口执行和 handoff。
- 官方 `wechat-miniprogram/ai-mode-skills`：作为生成规范和校验工具来源，不把其完整仓库加入产品依赖。

当前环境没有 Context7 工具，本 PRD 依据微信官方 AI Mode Demo、官方 `ai-mode-skills` 工具集、本地 Taro 文档和项目构建产物制定。实施前如官方协议更新，应以当时官方规范为准并同步更新 PRD。

## Technical Implementation

### Architecture Approach

```text
微信 AI
  └─ 调用 campus-info 原子接口
      └─ 独立 Skill 分包（原生 JS）
          └─ 现有校园后端公开 GET API
              └─ content + structuredContent + handoff
                  └─ 现有 Taro 页面
```

Skill 是产品能力适配层，不复制业务数据库，也不在客户端实现新的业务规则。真实数据、排序和可见性继续由现有后端决定。

### Technical Considerations

- **独立分包**：不得访问主包模块、`getApp()`、React 上下文或 Taro 编译产物内部模块 ID。
- **配置注入**：审核与生产 API 地址必须沿用现有环境选择逻辑，且构建结果可审计。
- **权限**：微信 AI 开发模式及 handoff 权限由 AppID 控制；无权限是外部阻断，不得通过代码绕过。
- **接口白名单**：原子接口只使用官方允许的 `wx.request`、账户信息和 `wx.modelContext` API。
- **大小限制**：通知和列表返回必须限制条数与文本长度，避免独立分包和模型上下文膨胀。
- **时效性**：校车和空教室回答必须携带日期/节次，避免把动态信息表达为长期事实。
- **兼容性**：Taro 构建可能过滤未知 `agent` 字段，必须以最终 `dist/full/app.json` 为准验证。
- **失败策略**：网络失败时返回可重试文本，不自动跳转、不发起写操作。

### Security and Privacy

- 只允许 GET 类公开查询；代码审查中对写方法、上传、支付、定位和个人信息调用进行阻断。
- 不把访问令牌、教务账号、Refresh Token 或用户资料复制到 Skill 源码、handoff payload 或日志；运行时仅通过共享 storage 读取现有会话。
- 所有 query 参数进行白名单规范化和长度限制，防止任意 URL 拼接。
- 后端响应只映射声明字段，忽略未知字段。
- 日志不得打印请求头、完整响应正文或 handoff payload。
- 通知摘要保留来源和时间，避免 AI 把摘要误认为完整官方原文。

### Design/UX Considerations

- 微信 AI 回复先给结论，再给来源/日期，并明确可点击小程序卡片查看完整信息。
- 通知卡沿用现有鼠尾草绿和重要通知暖橙提示；校车卡沿用深海蓝、青绿与暖橙；空教室卡沿用蓝绿与米白渐变。
- 通知、线路和教室摘要最多展示 3 条；标题与摘要使用单行或双行省略，超量以“还有 N 条”表达。
- 卡片同时支持浅色和深色模式，不使用外部图片、字体、emoji、滚动列表或固定高度。
- handoff 进入现有页面后保持现有视觉和交互，不新增重复结果页。
- 查询条件不足时由微信 AI 继续追问，不由原子接口猜测敏感或关键参数。
- 空结果应说明已使用的校区、日期和节次，便于用户修改条件。

## Testing Requirements

### Unit and Smoke Tests

- 校验 `mcp.json`、`page-meta.json` 可解析且字段完整。
- 校验三个原子接口名称唯一，输入输出 Schema 与注册代码一致。
- 校验仅允许预期的 GET 端点和页面路径。
- 校验完整版构建包含 AI 配置与文件，资质版不包含。
- 校验 handoff `pagePath` 存在于最终 `app.json` 页面清单，且不包含 query。
- 校验 API 环境选择与现有 develop/trial/release 规则一致。

### Integration Tests

- `searchOfficialNotices`：关键词命中、多条结果、单条结果、空结果、后端失败。
- `queryShuttleSchedule`：指定校区/日期、单路线、多路线、无班次、无效日期。
- `findEmptyClassrooms`：合法节次、多教学楼、空结果、非法节次、后端失败。
- 三个接口返回值通过官方 `outputSchema` 校验。
- 三个 handoff 页面在冷启动和已有小程序页面栈两种情况下正确打开。
- 三张原子组件通过 `render.mjs --from-execute` 复用真实接口结果完成渲染。
- `consoleMessages.snapshotCard` 包含 created、收到 Result、setData、`overflow monitor=on`，且不出现 `overflowed=true`。
- 通知、校车和空教室卡分别验证正常数据、空态、长文本和超量摘要。

### E2E Tests

- 微信 AI 输入“最近有什么学校通知”，获得摘要并 handoff 到通知列表或详情。
- 微信 AI 输入“今天去西海岸的校车”，获得路线/班次并 handoff 到校车页面。
- 微信 AI 输入“明天下午崂山有哪些空教室”，在节次不明确时追问或按明确参数调用，随后 handoff 到已预填页面。
- 对需要个人数据或写操作的请求，Skill 不声明对应工具，微信 AI 不应调用不存在的能力。

### Manual Testing Checklist

- 公众平台已为目标 AppID 开通 AI 开发模式。
- 微信开发者工具版本支持 agent 编译模式并已登录。
- 完整版构建和模拟器正常启动，原有首页、通知、校车、空教室不回归。
- 三个原子接口 execute 成功，输出没有敏感字段。
- 三张原子组件 render 成功，截图、组件树、字段绑定、长文本省略和溢出监测均通过官方 5 项核对。
- 三个 handoff 卡片打开正确页面并保留查询上下文。
- 网络失败、空结果和无效输入均产生可理解回答。
- 控制台无 `TypeError`、`ReferenceError`、未处理 Promise 或接口 5xx。
- 资质版构建与现有 CI 保持通过。

## Rollout and Rollback

- 首次只在开发版/体验版 AppID 验证，不直接上传正式版。
- 通过微信 AI 实际调用验证后，再提交小程序审核。
- 回滚时移除完整版的 `agent` 配置和 AI 文件复制规则即可；现有页面和后端接口无需回滚。
- 若平台权限、基础库或协议不稳定，保留源码但通过构建常量禁用 AI 配置，不影响普通小程序功能。

## Risks and Open Decisions

- 目标 AppID 是否已在公众平台选择“开发模式”并获得 handoff 权限，需要在实施验证前确认。
- 微信开发者工具可能要求 nightly 或更新版本，当前 CLI 可用不等同于已启用 agent 编译能力。
- 三个查询端点的匿名访问策略需要通过真实请求或后端契约确认。
- Taro 4.1.11 对未知 `agent` 配置字段的保留行为必须通过构建验证。
- 官方 AI 开发模式仍在快速迭代，`mcp.json` Schema、handoff 和校验工具版本可能变化。

---

**Implementation Notes:**

实施阶段先完成静态源码与构建集成，再运行官方校验工具。若 AppID 权限或开发者工具版本阻断 execute/handoff，应保留静态校验结果并报告外部阻断，不得以模拟成功替代真实微信 AI 验证。
