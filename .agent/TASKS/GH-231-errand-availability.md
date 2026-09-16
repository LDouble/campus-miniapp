# 任务：跑腿可接单识别与角色状态文案

- ID：GH-231-errand-availability
- 状态：已实现并验证
- 类型：体验修复
- 跟踪：https://github.com/LDouble/campus-miniapp/issues/231
- PRD：[需求文档](../PRDS/GH-231-errand-availability.md)
- 范围：小程序展示、后端大厅分页排序；不改变业务状态机。

## 验证

- 小程序：`test:errand-display`、类型检查、Lint、生活服务刷新、详情动作、设计令牌、排版、深色模式和微信小程序构建均通过。
- 后端：跑腿模块全量测试通过。
- 服务端 PR：https://github.com/LDouble/backend_demo/pull/257（已合并）。
- 后端契约提交：`34e98627ebff13120c1813db6760458e1b9d1103`，OpenAPI 保持兼容。
- 已在微信开发者工具通过 production 域名预览，Network 确认 `https://product.weouc.com`。
- 小程序进入 PR 评审流程，尚未上传或发布体验版。
