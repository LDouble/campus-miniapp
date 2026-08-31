# 小程序：首页通知订阅与签到引导

**Priority:** High
**Status:** Done
**Type:** Feature
**Created:** 2026-08-31
**Last Updated:** 2026-08-31

## Overview

在首页为确有未读消息、且仍有订阅模板未接受的登录用户提供低打扰引导；同时将已有的每日签到能力以头部轻量状态呈现，帮助未签到用户直接完成签到。

## User Story

**作为** 有未读消息的校园用户
**我想** 在合适的时机获知可以开启微信通知提醒
**以便** 后续不遗漏校园消息。

**作为** 当天尚未签到的用户
**我想** 在首页直接完成签到
**以便** 不必额外寻找签到页面。

## Requirements

1. 通知订阅浮层
   - 仅限已登录、未读消息总数大于 0 的用户。
   - 读取既有运行时订阅模板配置；无可用模板时不展示。
   - 每个账户、本机每 7 天最多展示一次；点击“暂不”或完成授权请求后均记录展示时间。
   - 用户点击主操作时，在点击同步调用链中打开微信订阅设置面板，由微信统一管理总开关和各模板。
   - 关闭、拒绝、接口失败或微信能力不可用时，首页保持可用，不重复强提示。
   - 浮层不重复显示未读数量，不与消息 TabBar 的红点承担相同信息层级；主文案聚焦“开启提醒”。

2. 签到引导
   - 已登录且签到状态为“启用、今日未签到”时，在首页头部周次旁展示轻量“签到”操作；已签到时展示“已连签 N 天”状态。
   - 点击主操作直接调用既有签到接口；成功后就地更新连续天数、奖励和完成态，不跳转页面。
   - 已签到、未登录、签到能力未启用或状态获取失败时不展示该卡片。
   - 签到请求中防止重复点击，失败给出轻量提示且允许重试。

3. 体验与视觉
   - 复用 Ousea / Global 令牌：首页卡片使用 `surface`、`border`、`primary`/`success` 等语义色；不新增页面局部基础 token。
   - 浮层使用 `surface` 和深色遮罩，圆角遵循 Sheet 规范；不使用胶囊式大主按钮。
   - 同时适配浅色、暗色、减少动态效果和底部安全区。

## Implementation Overview

- 在 `features/home/` 新增纯函数，负责 7 天频控存储键、账户隔离、展示判定及未读数归一。
- 首页复用已有 `noticesRepository.unreadCount()` 和私信未读共享资源，汇总未读状态；不新增后端请求契约。
- 为既有订阅请求模块提供可等待的结果入口，以便在用户点击后记录本次展示，但仍保证微信 API 位于同步点击链中。
- 未签到时显示直接签到操作，已签到后就地切换为连续签到状态（签到历史仍从现有页面查看）。
- 新增 smoke test 覆盖频控边界、未读/模板/登录门槛和签到状态转换；更新首页页面规范以记录该引导层级。

## Files to Create

- `src/features/home/notification-guide.ts` - 通知引导的账户隔离频控与展示判定。
- `scripts/home-notification-checkin-smoke.ts` - 引导门槛与签到交互的静态验证。

## Files to Modify

- `src/pages/index/index.tsx` - 加载未读与签到状态，渲染浮层和直接签到入口。
- `src/pages/index/index.scss` - 首页引导卡片和浮层的浅色/暗色样式。
- `src/features/wechat-subscription/request.ts` - 提供首页可调用的订阅请求结果能力，保持现有行为兼容。
- `src/features/home/today.ts` - 将签到任务模型调整为首页直接完成。
- `design-system/campus-miniapp/pages/home.md` - 补充通知和签到引导的视觉及信息层级规则。
- `package.json` - 增加专项 smoke test 命令。

## API Endpoints

- `GET /api/v1/notices/unread-count` - 既有校园通知未读数。
- `GET /api/v1/private-messages/unread-count` - 既有私信未读数。
- `POST /api/v1/notices/subscriptions` - 既有微信订阅授权登记。
- `GET /api/v1/checkins/me/status` - 既有今日签到状态。
- `POST /api/v1/checkins` - 既有完成今日签到。

## Non-goals

- 不新增或修改后端 API、消息模板、积分规则。
- 不在首页新增第二个未读角标或顶部通知入口。
- 不替换消息页、签到历史页的既有功能。

## Testing Requirements

- 频控在首次、7 天内、满 7 天、不同账户和无未读场景下正确判定。
- 无模板、未登录、授权失败与未读请求失败时不弹浮层。
- 未签到用户可直接签到，成功后不再出现待签到引导；重复点击不会重复提交。
- 执行 lint、类型检查、设计 token、深色模式、微信订阅、每日签到、专项 smoke test 和小程序构建。

## Risks

- 微信订阅授权必须由用户点击触发，不能在浮层出现时自动申请。
- 当前授权登记接口仅记录“接受”的模板，因此频控必须以本地展示时间为准，不能将“用户此前是否拒绝”误判为永久关闭。
