# Campus Miniapp：隐藏纯文字二手详情伪图片卡

**Priority:** High
**Status:** Done
**Type:** Bug
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Overview

修复二手详情页在 `image_urls` 为空时仍渲染大尺寸占位图库的问题。纯文字二手信息应直接展示标题、价格和后续详情，不再把商品描述复制到一张模拟图片卡中。

## User Story

**As a** 浏览纯文字二手信息的学生
**I want** 详情页只展示发布者真正上传的媒体
**So that** 我不会把系统生成的文字底板误认为商品图片，也不会看到重复描述和无意义的大面积占位

## Requirements

1. 仅当 `item.image_urls.length > 0` 时渲染 `market-detail-gallery`、轮播和真实图片。
2. `image_urls` 为空时不渲染 `market-detail-gallery__empty` 或任何伪图片占位卡。
3. 纯文字商品描述继续通过 `market-detail-title` 展示一次，价格区自然上移。
4. “图片审核中”提示只允许在真实图库存在时出现。
5. 不修改二手列表卡片、本次接口协议、商品分享和有图详情的轮播行为。

## Files to Modify

- `src/packages/social/marketplace/detail.tsx`
- `src/packages/social/marketplace/detail.scss`（清理详情页不再使用的伪图片样式）
- `scripts/detail-author-header-smoke.ts`
- 相关详情 smoke test（如需新增断言）

## API Endpoints

不涉及接口或数据结构变更；继续以 `MarketplaceListingView.image_urls` 判断是否存在可展示图片。

## Testing Requirements

- 有图详情仍渲染 `Swiper` 和真实 `Image`。
- 无图详情不创建图库或文字占位卡。
- `yarn test:detail-author-header`
- `yarn test:business-detail-navigation`
- `yarn typecheck`
- `yarn lint`
- `git diff --check`

按当前开发约定，不执行 `yarn build:weapp`。

## Acceptance Criteria

- 纯文字二手详情不再出现大尺寸假图片卡。
- 描述不重复，价格与后续内容自然承接。
- 有真实图片的二手详情显示和交互无回归。

---

**Implemented:** 已改为仅真实图片 URL 存在时渲染详情图库。
