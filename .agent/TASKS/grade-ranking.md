## Task: 成绩排名组与自主授权报告

**ID:** GH-242-grade-ranking
**Label:** Campus 成绩排名
**Description:** 实现已获用户批准的排名组、成绩规则、本人明细、自主授权汇总、站内通知，以及 provider→analytics 教务班级更新链。
**Type:** Feature
**Status:** Completed
**Priority:** High
**Created:** 2026-09-19
**Updated:** 2026-09-19
**PRD:** [需求与验收](../PRDS/grade-ranking.md)
**Issue:** https://github.com/LDouble/campus-miniapp/issues/242

用户于本次会话明确“按照这个方案执行”，并增加 provider 查询班级后 analytics 消费更新要求。加入排名组仅同意将自己的成绩用于本组计算，不自动授予任何其他成员成绩读取权限。自建组始终标识参与者范围，不自动升级为权威行政班。

## 实现与验证

已完成排名组、逐学期本人同步、个人/授权汇总报告、到期撤销、站内消息跳转和普通用户入口。Provider 到 Analytics 的教务班级更新与版本化计算由同名 Academic / Backend 功能分支提供。

小程序通过 lint、typecheck、设计令牌/字体/暗色检查及 build:weapp；服务端通过规则与消息回归、真实会话/RBAC测试和独立 MySQL 8.4 档案存储测试。发布前还需四端 PR CI 及部署专用 ranking_event_redis 与数据库迁移；本任务不修改现有 Release 环境。
