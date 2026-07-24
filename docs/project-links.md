# 全栈项目关联

三个项目使用同一功能标识关联跨端开发：

| 项目 | 仓库 | 职责 |
| --- | --- | --- |
| 服务端 | [LDouble/backend_demo](https://github.com/LDouble/backend_demo) | Go API、数据库、权限、OpenAPI 契约 |
| 管理端 | [LDouble/campus-admin-web](https://github.com/LDouble/campus-admin-web) | 运营管理、审核和配置 |
| 用户端 | [LDouble/campus-miniapp](https://github.com/LDouble/campus-miniapp) | 微信小程序用户体验 |

## 关联规则

跨项目需求使用同一个 GitHub issue，标题包含统一的功能标识，例如 `feat(campus-circle): ...`。各仓库的 PR 必须互相链接，并在描述中注明依赖的服务端契约提交或 PR、迁移和权限影响，以及本地联调地址和验证命令。

服务端先更新 OpenAPI 契约，管理端和用户端随后同步生成客户端。三个仓库保持独立提交和独立 CI，不直接复制请求/响应类型。
