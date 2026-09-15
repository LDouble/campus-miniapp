# OUSea小程序：社团宣传主页

**Priority:** High
**Status:** Done
**Type:** Feature
**Created:** 2026-08-04
**Last Updated:** 2026-08-04

## 概述

新增社团宣传目录小程序体验。访客可以搜索、筛选、浏览与分享已发布社团；完成校园身份认证的学生可以创建或维护社团资料、上传宣传图片并提交审核；管理员审核与运营能力由后端和管理端承担。

## 用户故事

**作为** 校园应用访客
**我想** 按关键词和分类浏览社团主页、预览宣传图并分享
**从而** 快速了解校园社团。

**作为** 已完成校园认证的学生
**我想** 创建或维护带 Logo、封面和多张宣传图的社团主页并查看审核状态
**从而** 持续展示社团形象。

## 产品范围

- 社团广场支持搜索、分类筛选、分页、下拉刷新、骨架、空状态和错误重试。
- 公开详情展示封面、Logo、分类、名称、口号、简介、基本资料、详细介绍和零至九张宣传图。
- 详情图集支持全屏预览和微信好友分享，分享图优先级为封面、首张宣传图、Logo、默认图。
- 编辑页支持创建和更新草稿、Logo/封面/宣传图上传、图集说明、排序、删除、失败重试和提交审核。
- 我的社团页展示草稿、审核中、驳回、已发布和已下架状态，并提供允许的后续操作。
- 首页快捷入口和全部服务入口受 `club` 运行时模块控制；默认状态为 `hidden`。

## 核心规则

- 创建、编辑、图片上传和提交审核依赖后端校园身份门槛；客户端复用统一认证引导和安全回跳。
- Logo 必填，封面可选，宣传图最多九张且每张说明最多六十字。
- 图片仅允许 JPEG、PNG、WebP，单张不超过 5 MiB。
- 上传复用对象存储短期目标，显示上传进度；上传完成确认后媒体才可绑定草稿。
- 提交后的修订不可编辑；驳回或修改已发布资料时由服务端创建或返回可编辑草稿。
- 已发布社团存在待审修订时，公开详情继续展示当前发布版本。
- 所有写请求使用幂等键，草稿更新和送审携带 `expected_version`。

## 接口

- `GET /api/v1/club-categories`
- `GET /api/v1/clubs`
- `GET /api/v1/clubs/{id}`
- `POST /api/v1/clubs`
- `GET /api/v1/clubs/mine`
- `GET /api/v1/clubs/{id}/editor`
- `PATCH /api/v1/clubs/{id}/draft`
- `POST /api/v1/clubs/{id}/submit-review`
- `POST /api/v1/clubs/media/upload-target`
- `POST /api/v1/clubs/media/{mediaId}/complete`

## 技术方案

- 遵循 Taro 4、React、TypeScript、Sass 与现有 feature repository 分层。
- 后端 `api/openapi.yaml` 为契约事实来源，运行 `yarn api:generate` 生成 `src/api/generated/schema.ts`，不手工修改生成文件。
- `src/features/clubs` 提供由生成 schema 派生的领域类型、Repository、校验与编辑模型函数。
- 页面复用 `CustomNavbar`、`apiRequest`、`createIdempotencyKey`、`uploadFileToObjectStorage` 和校园身份认证门槛。
- 图片选择使用 `Taro.chooseMedia`，预览使用 `Taro.previewImage`，详情分享使用 `useShareAppMessage` 并启用页面分享配置。

## 设计与可访问性

- 延续现有暖白背景、薄荷主色、低饱和橙色点缀与柔和卡片层级。
- 可点击区域最小高度为 88rpx（约 44px），文本对比度不低于 4.5:1。
- 点击态使用透明度或背景色过渡，不使用导致布局位移的缩放。
- 遵循减少动效设置，图片加载失败使用统一占位表达。

## 测试要求

- 模型 smoke 测试覆盖字段长度、宣传图数量、图片格式/体积、顺序交换、状态操作和分享图优先级。
- 微信构建产物验证四页注册、详情分享配置、入口和媒体 API 存在。
- 执行 `yarn lint`、`yarn typecheck`、社团 smoke 测试和 `yarn build:weapp`。

## 非目标

- 不包含入社申请、成员管理、收藏、评论、活动、动态、签到、任务或私人联系方式。
- 不在小程序实现管理员审核和分类维护界面。
- 不引入新依赖，不绕过后端所有权、认证或审核状态机。

---

**实现说明：** 本 PRD 已由用户提供并批准的跨端计划细化为小程序范围，后端与管理端由并行任务实现。
