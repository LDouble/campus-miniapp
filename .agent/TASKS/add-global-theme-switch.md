## Task: 增加全局深色模式开关

**ID:** add-global-theme-switch
**Label:** Campus Miniapp: 全局深色模式开关
**Description:** 在“我的”增加深色模式开关，持久化用户选择并同步整个小程序的页面、原生窗口与自定义 TabBar。
**Type:** Enhancement
**Status:** Done
**Priority:** High
**Created:** 2026-08-21
**Updated:** 2026-08-21
**PRD:** [Link](../PRDS/add-global-theme-switch.md)

---

**Implementation Notes:** 本任务是现有全局深色模式适配的补充，继续在当前功能分支实施。主题偏好支持跟随系统、浅色、深色三态；“我的”合并为单个“深色模式”入口，通过原生 ActionSheet 选择“跟随系统 / 打开 / 关闭”。页面初始 data、页面实例 `setData` 与 Taro 生成模板根节点覆盖主包、分包及缓存页面，并同步原生窗口与自定义 TabBar。设置页修改偏好后使用微信 `restartMiniProgram` 和绝对路径 `/pages/index/index` 重启回首页；不支持时回退到 `reLaunch`。冷启动首帧直接读取已保存偏好。已由现有 watch 验证产物注入，按开发约定未重复执行 weapp build。
