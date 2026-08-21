## Task: 微信 AI 校园信息 Skill

**ID:** wechat-ai-campus-info
**Label:** OUSea小程序：微信 AI 校园通知、校车与空教室能力
**Description:** 将官方通知、校车与空教室三个公开只读场景封装为微信小程序 AI 开发模式 Skill，完成 Taro 构建集成、handoff 接力和微信开发者工具验证。
**Type:** Feature
**Status:** Testing
**Priority:** High
**Created:** 2026-08-10
**Updated:** 2026-08-10
**PRD:** [产品需求文档](../PRDS/wechat-ai-campus-info.md)

---

## 实施范围

- 申请并使用微信小程序 AI 开发模式，不在小程序内新增大模型聊天页。
- 创建一个 `campus-info` 独立 Skill，提供官方通知、校车与空教室三个公开只读原子接口。
- 由 Taro 源码配置稳定生成 `agent.skills`、独立 `skills` 分包、`page-meta.json` 和 `lazyCodeLoading`，禁止直接维护 `dist` 产物。
- 原子接口使用原生 JavaScript 和 `wx.modelContext`，复用现有后端公开查询契约，不复用 React 页面运行时。
- 为三个原子接口配置 handoff 接力页，用户点击微信 AI 返回的小程序卡片后进入现有业务页面。
- 为三个原子接口分别生成一张 1:1 原子 UI 卡片，在微信 AI 对话内展示最多 3 条摘要；卡片仍通过 handoff 进入现有页面。
- 原子 GUI 卡片保持只读，不伪造直接跳页事件；小程序内部通过组件标题栏的 `relatedPage` 入口进入完整页面，外部微信 AI 继续通过 handoff 小程序卡片进入。
- 第一阶段不暴露成绩、课表、考试、教务凭证、社区发布、联系方式、支付或其他敏感/写操作。

## 准出证据

- 完整版构建产物包含合法的 `agent.skills`、`skills/campus-info` 独立分包与 `page-meta.json`，资质版构建保持原行为。
- 三个原子接口的输入、输出 Schema 与真实后端响应一致，失败时返回可理解且不泄露内部信息的文本结果。
- handoff 的 `pagePath`、query 名称和现有页面入参一致。
- 三张原子组件通过 CLI render，生命周期、字段绑定、长文本省略与 Overflow 监听均满足官方 5 项核对。
- 官方静态校验、原子接口 execute 验证、Taro 类型检查、现有 smoke tests 与微信构建通过。
- 微信开发者工具中完成至少三条自然语言调用和三条 handoff 用户链路，控制台无未处理异常。

## 当前验证结果

- Taro 完整版与资格版构建通过；资格版未包含 `agent`、`skills` 或 `page-meta.json`。
- 官方静态与编译校验通过：117/117，0 error，0 warning，preview PASS。
- 三个原子接口 execute 均通过，并返回非空业务数据。
- 三个接口与三张 GUI 卡片均使用中性的“进入小程序”入口提示，兼容内部原子组件标题栏入口与外部 handoff 小程序卡片。
- 小程序内部入口已通过显式 `setRelatedPage({ path, query })` 配置；CLI 渲染不再出现 `setRelatedPage:fail relatedPage not configured in toolMeta`。
- 三张 UI 卡片已生成组件树并绑定真实字段；CLI render 截图阶段被开发者工具运行时的 `notifyCardRender:fail container not found for containerId=0` 阻塞，重启项目后又出现 `timeout waiting for snapshotCard callback`。待开发者工具运行时恢复后重跑 render 5 项核对与自然语言 handoff 验收。
