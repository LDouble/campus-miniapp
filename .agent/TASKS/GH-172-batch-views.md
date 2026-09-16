# 浏览量批量优化任务

- 状态：已完成（本地提交，未推送、未部署）
- PRD：[批量浏览量](../PRDS/GH-172-batch-views.md)
- [x] 新增兼容批接口与后端批量数据库/Redis操作。
- [x] 客户端延时合并、上限分批、旧后端回退、生命周期刷新。
- [x] 目标回归测试及契约生成检查。
- [x] 本地提交与验证结果记录。

## 验证记录

- 后端：application、infrastructure、redisclient 目标测试通过；generate-check、migration-check、check-architecture 通过。
- 小程序：typecheck、lint、阅读/批量/曝光回归、design-tokens、typography、dark-mode、build:weapp 通过。构建保留已有包体积告警。
- 契约：后端正式契约新增批接口；小程序从兼容基线 72531b4 加本次校园圈源契约重新生成，未混入无关支付接口。
- 联调边界：本次未部署后端，未在真实服务验证批接口；现有旧后端会触发 404/405 回退。本轮以自动化测试验证批处理，不将旧环境的单帖成功当作批接口验证。
- HTTP：批量 handler 请求绑定/响应回归通过（guest/member、1/20/21条、自读/去重/隐藏）；路由权限和 OpenAPI 已核对。
