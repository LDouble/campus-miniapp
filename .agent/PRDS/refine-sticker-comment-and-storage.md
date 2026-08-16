# 小程序: 调整评论表情尺寸与可读存储协议

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-16
**Last Updated:** 2026-08-16

## Overview

评论区表情目前为 `44rpx`，在头像和正文排版中辨识度偏低；输入框虽然展示 `[标签]`，提交时却编码为 `[[campus-sticker:v1:...]]`，Push 直接使用正文时会暴露内部前缀。

## Requirements

1. 评论和回复正文中的表情由 `44rpx` 调整为 `52rpx`，不改变信息流和发布正文尺寸。
2. 新发布的评论、动态及业务描述直接存储可读 `[标签]`，文字和多个表情继续支持任意混排。
3. `[标签]` 必须能解析成对应图片；客户端不支持的标签保持原始 `[具体含义]` 文本。
4. 历史 `[[campus-sticker:v1:id:标签]]` 内容继续解析为图片或可读标签，不做破坏性迁移。
5. Push、分享摘要和纯文本降级直接得到 `[标签]`，不得出现 `campus-sticker` 前缀。

## Implementation

- 调整 `detail-comments.scss` 的评论专用表情尺寸及基线。
- 修改 `features/stickers/content.ts`：新序列化直接输出 `[标签]`；解析阶段同时识别旧标记和受控标签 token。
- 保留表情 ID 与唯一标签映射，用标签在客户端恢复具体图片。
- 更新 `scripts/stickers-smoke.ts`，覆盖新存储、混排、未知标签和历史协议兼容。

## Acceptance Criteria

- 评论及嵌套回复表情均为 `52rpx`，文字行距无明显跳动。
- 新提交内容包含 `[开心][大哭]` 等可读 token，不包含内部协议前缀。
- 新旧两种正文均可渲染成图片。
- 未知 `[标签]` 原样展示；旧未知协议仍安全降级。
- 表情烟测、TypeScript 检查和微信小程序构建通过。
