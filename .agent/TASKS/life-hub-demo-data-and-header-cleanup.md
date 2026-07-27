## Task: 校园生活重复 Slogan 清理与多状态演示数据

**ID:** life-hub-demo-data-and-header-cleanup
**Label:** 小程序与后端: 清理 Tab 下重复 Slogan 并初始化四业务演示数据
**Description:** 删除校园生活一级 Tab 下重复的业务宣传区，并提供安全、幂等、可清理的本地演示数据命令，为社区、跑腿、二手和拼车构造公开态与“我的服务”多状态数据。
**Type:** Enhancement
**Status:** Done
**Priority:** High
**Created:** 2026-07-26
**Updated:** 2026-07-26
**PRD:** [产品需求文档](../PRDS/life-hub-demo-data-and-header-cleanup.md)

---

## 完成结果

- 已删除社区、跑腿、二手和拼车 Tab 下方的重复标题/Slogan 卡片。
- 已实现 `campusctl demo seed|clean|reset`，并增加 `make demo-seed|demo-clean|demo-reset`。
- 已为当前本地已认证成员 ID 6 创建社区 6、跑腿 9、二手 8、拼车 8 条多状态数据。
- 已使用配置表精确记录演示资源 ID，清理不依赖模糊删除，界面不显示内部版本标识。
- 已通过前端类型检查、微信构建、真实模拟器个人记录 E2E、Go 全量测试、race、vet 和 lint。
