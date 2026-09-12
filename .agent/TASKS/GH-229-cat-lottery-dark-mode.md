## Task: 猫猫图鉴与抽奖深色模式修复

**ID:** GH-229-cat-lottery-dark-mode
**Label:** 小程序：深色模式修复
**Description:** 修复猫猫图鉴浅色背景残留和抽奖详情深色文字覆盖失效。
**Type:** Bug
**Status:** Testing
**Priority:** High
**Created:** 2026-09-12
**Updated:** 2026-09-12
**PRD:** [修复方案](../PRDS/GH-229-cat-lottery-dark-mode.md)

跟踪 Issue：https://github.com/LDouble/campus-miniapp/issues/229

从最新 origin/master（90bb122）创建 feature/GH-229-cat-lottery-dark-mode；旧 PR #219 已合并。不修改主仓提审包。用户已确认方案，代码修复完成。

## 验证记录

- 预览反馈补充：首页常用服务增加猫猫图鉴入口，直达 `/pages/cat-atlas/index`，使用与现有服务一致的浅色/深色猫咪 SVG 图标。
- 全部服务的猫猫图鉴入口同步使用同一套猫咪 SVG 与语义底板，随主题切换浅色/深色资源。

- 预览反馈补充：用户要求移除猫猫图鉴 dbar，已删除列表底部悬浮导航及专用图标引用、样式，底部预留调整为 32rpx 加安全区，保留工具栏的我的相遇图鉴入口。

- lint、typecheck、design-tokens、typography、lottery、cat-atlas、dark-mode 通过。
- Feature 工作区完整生产构建 build:weapp 通过，保留既有 CSS chunk 顺序警告；构建未触及主仓提审包。
- 新增猫猫与抽奖 Sass 编译选择器回归，并接入现有 dark-mode 命令和 CI；验证主题 class 在页面根节点自身时仍能正确命中。
- 微信开发者工具初次连接缺少 MCP Token，用户补充配置后已成功推送最新手机预览；尚未完成逐页截图与计算颜色验收。
- 未修改 API 或业务逻辑，未替换 master 提审构建。用户已要求提交、推送并创建 PR。
