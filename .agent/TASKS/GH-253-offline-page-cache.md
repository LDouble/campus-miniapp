# 任务：首页、论坛、课表缓存优先与离线容错

- ID：GH-253-offline-page-cache
- 类型：体验增强及缺陷修复
- 状态：代码已实现，目标回归及构建通过；完整检查存在基线失败，用户已要求发起 PR
- 优先级：高
- 创建及更新：2026-09-21
- 跟踪 Issue：https://github.com/LDouble/campus-miniapp/issues/253
- 需求文档：[缓存优先与离线容错](../PRDS/GH-253-offline-page-cache.md)
- 工作分支：feature/GH-253-offline-page-cache
- 起点：origin/master，b722e31

## 工作项

- [x] 检查现有工作区，创建独立 Issue 与最新 master 工作区。
- [x] 检查首页、论坛缓存与异常路径。
- [x] 用户补充授权接口异常也展示本地信息，按该规则实施。
- [x] 建立可复现失败用例，再实现共享缓存及页面接入。
- [x] 验证用户隔离、请求乱序、缓存损坏、分页与写操作后刷新。
- [x] 执行仓库检查与微信端关键交互验证。
- [x] 独立影响审查并记录未覆盖范围。

## 环境记录

主仓库与本工作区依赖声明及 yarn.lock 一致，已复用主仓库 node_modules 绝对路径软连接，并加入本地 exclude；tsc 可执行（5.9.3）。当前 shell 无 yarn 可执行入口，存在 corepack，正式验证前需通过 corepack 使用仓库兼容的 Yarn；已通过 corepack yarn 执行目标回归、lint、类型检查与小程序构建；未部署。详见需求文档的验证记录。
