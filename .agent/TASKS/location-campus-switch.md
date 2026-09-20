# 任务：定位提示切换西海岸校区与作息

- ID：GH-244-location-campus-switch
- 类型：功能增强
- 状态：实现与自动化验证完成，待真机验收
- 创建日期：2026-09-20
- 跟踪 Issue：https://github.com/LDouble/campus-miniapp/issues/244
- PRD：[定位切换校区](../PRDS/location-campus-switch.md)

## 执行事项

- [x] 核对现有首页切换入口、校区持久化和课表读取机制。
- [x] 从最新 origin/master 创建独立小程序 Feature 工作区。
- [x] 实现定位识别、单次运行去重和异步状态保护。
- [x] 用户确认后复用校区持久化和首页刷新，核对课表作息联动。
- [x] 验证确认、取消、授权拒绝、位置未知及手动切换竞态。
- [x] 运行 lint、typecheck、设计令牌、排版、深色模式及小程序构建检查。

## 验证结果

2026-09-20 用户确认方案后实现，工作分支 `feature/GH-244-location-campus-switch`，起点为 `origin/master` 的 `e8cb088`。

以下检查通过：

- `yarn test:campus-location`：定位识别与精度边界、持久化与作息、确认/取消、重复进入、离页、手选、目标停用、超时及异常。
- `yarn lint`、`yarn typecheck`。
- `yarn test:design-tokens`、`yarn test:typography`、`yarn test:dark-mode`。
- `yarn test:academic-schedule`、`yarn test:home-guest`、`yarn test:home-notification-checkin`。
- `yarn build:weapp`：通过；Webpack 提示 common.js 256 KiB 超出推荐大小，不影响构建。
- `git diff --check`。

本机构建需要使用 ARM Node；Intel Node 22 与共享 ARM SWC 二进制不匹配。最终构建使用已有 ARM Node 24 调用 Yarn 1.22.22，未修改共享依赖或锁文件。

## 验收限制

- 尚未真机验证微信定位授权、真实定位精度和原生弹窗。上线前需在两校区实际验证。
- 已扩展 app.config.ts 位置授权用途文案；微信公众平台隐私保护指引也应覆盖校区识别用途，本次未操作公众平台。
- Git 提交与 PR 记录以仓库历史为准；本次不发布小程序线上版本。

## 追加修复：课表格子地点显示

- 按用户要求继续在当前分支修复。
- 原因：地点固定两行截断，基础样式和后置覆盖重复限制；空状态区占用高度。
- 处理：地点按剩余高度换行，课程名保留优先级，空状态区不渲染，长地点不撑高课表网格。
- 验证通过：lint、typecheck、academic-schedule、design-tokens、typography、dark-mode、build:weapp、diff --check。
- 使用真实课表 SCSS 在独立无头 Chrome 的 320/375px 宽度下检查长地点和单节/多节格子：充足空间完整显示，单节格子高度不被撑开，地点不越界。
- 模拟器已重新打开课表，沿用用户要求的 product API；当前学期无课程，未将样例写入用户课表。

## 模拟器补充验收

- 已按用户要求将识别半径改为 10 公里，边界测试通过。
- 按用户要求连接 product API，Network 确认请求成功；通过模拟器 Sensor 设置西海岸坐标后，实际出现校区与作息切换弹窗。该验证使用模拟坐标，不替代真机定位验收。
