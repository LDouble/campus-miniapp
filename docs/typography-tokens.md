# 全局字体 Token 规范

## 设计目标

本规范来自首页在一加 Ace 2、小米和微信开发者工具中的真机对比结果。它保留高密度校园首页的轻盈感，同时降低 Android 厂商字体在 `500` 及以上字重上的渲染差异。

字体 Token 是全局基础值，不代表所有页面必须使用同一字号。组件应按内容角色选取 Token，页面只在明确的业务场景中组合这些基础值，不再重复声明页面私有字号变量。

## 字号

| 语义角色 | CSS Token | Sass Token | 值 | 首页用途 |
|---|---|---|---:|---|
| 注释 | `--campus-font-caption` | `$font-size-caption` | `22rpx` | 时间、状态、来源、服务名称、TabBar |
| 辅助 | `--campus-font-supporting` | `$font-size-supporting` | `24rpx` | 副标题、作者、次级操作 |
| 正文 | `--campus-font-body` | `$font-size-body` | `28rpx` | 课程名、通知标题、社区与二手内容 |
| 标题 | `--campus-font-title` | `$font-size-title` | `32rpx` | 首页区块标题、价格 |
| 展示 | `--campus-font-display` | `$font-size-display` | `34rpx` | Hero 主标题 |

## 字重

| 语义角色 | CSS Token | Sass Token | 值 | 使用约束 |
|---|---|---|---:|---|
| 常规 | `--campus-font-weight-regular` | `$font-weight-regular` | `400` | 28rpx 及以下文字默认使用 |
| 中等 | `--campus-font-weight-medium` | `$font-weight-medium` | `500` | 仅用于 32rpx 栏目标题、34rpx Hero 等标题 |
| 强调 | `--campus-font-weight-emphasis` | `$font-weight-emphasis` | `600` | 仅用于价格、关键数字等强强调信息 |

不要通过提高字重修复小字号发虚。小字优先使用 `400`，并搭配 `--campus-text-secondary` 提升灰字对比度。TabBar 选中态只改变颜色和图标，不改变字重。

## 行高

| 语义角色 | CSS Token | Sass Token | 值 | 使用场景 |
|---|---|---|---:|---|
| 标题 | `--campus-line-height-heading` | `$line-height-heading` | `1.3` | 32–34rpx 标题 |
| 注释 | `--campus-line-height-caption` | `$line-height-caption` | `1.35` | 22rpx 单行或短元信息 |
| 正文 | `--campus-line-height-body` | `$line-height-body` | `1.4` | 24–28rpx 正文、说明和操作 |

图标下方的单行标签、价格等特殊紧凑布局可保留组件级行高，但不应为普通正文创建新的页面私有 Token。

## 使用方式

普通 SCSS/WXSS 优先直接使用 CSS Token，并保留回退值：

```scss
.section-title {
  font-size: var(--campus-font-title, 32rpx);
  font-weight: var(--campus-font-weight-medium, 500);
  line-height: var(--campus-line-height-heading, 1.3);
}
```

已经接入 Sass Token 的样式可以使用统一映射：

```scss
@use '../../styles/tokens' as token;

.card-body {
  font-size: token.$font-size-body;
  font-weight: token.$font-weight-regular;
  line-height: token.$line-height-body;
}
```

自定义 TabBar 等原生组件可能受微信组件样式隔离影响，必须保留 Token 的 fallback，不能假设页面作用域中的自定义属性一定可见。

## 维护规则

1. 新组件按“注释、辅助、正文、标题、展示”选择字号，不按视觉感觉随意增加数值。
2. 28rpx 及以下默认使用 `400`；若确需强调，优先调整颜色和信息层级。
3. 不创建 `--home-font-*`、`--detail-font-*` 等重复页面 Token。
4. 修改全局值时同时更新 `src/app.scss`、`src/styles/_tokens.scss` 与 `scripts/typography-smoke.ts`，并在至少两种 Android 字体环境中复核。
5. 字号不得替代布局约束；生产长文本仍需使用单行省略或两行截断。
