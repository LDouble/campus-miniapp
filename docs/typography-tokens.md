# Ousea / Global 字体 Token 规范

## 设计基准

全局使用系统字体，不下载或内嵌自定义字体。字体栈为：

```scss
system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif
```

Token 以 375px 设计宽度为换算基准，`1px = 2rpx`。Ousea / Global 是新开发的唯一基础字号源；既有 `--campus-font-*` 仅作为兼容语义层。字号、字重和行高必须按完整角色组合，不能只取其中一项。

## Ousea / Global 原始角色

| 角色 | 设计值 | CSS Token | 典型用途 |
|---|---:|---|---|
| `badge` | `10px / 20rpx` | `--ousea-font-size-badge` | 徽章、角标 |
| `caption` | `12px / 24rpx` | `--ousea-font-size-caption` | 时间、辅助信息 |
| `label` | `13.5px / 27rpx` | `--ousea-font-size-label` | 昵称、操作按钮 |
| `comment` | `15px / 30rpx` | `--ousea-font-size-comment` | 评论、信息流摘要 |
| `body` | `16px / 32rpx` | `--ousea-font-size-body` | 帖子正文 |
| `title` | `16.5px / 33rpx` | `--ousea-font-size-title` | 模块标题 |

行高只使用 `--ousea-line-height-post: 1.85`、`--ousea-line-height-comment: 1.65` 与 `--ousea-line-height-ui: 1.4`。字重只使用 `400 / 500 / 600 / 700`。

## Campus 兼容语义角色

| 语义角色 | 设计值 | CSS 字号 Token | CSS 行高 Token | Sass 字号 / 行高 Token | 首页用途 |
|---|---|---|---|---|---|
| 辅助信息 | 12px / 400 / 18px | `--campus-font-size-auxiliary: 24rpx` | `--campus-line-height-auxiliary: 36rpx` | `$font-size-auxiliary` / `$line-height-auxiliary` | 时间、状态、来源、服务名称、TabBar |
| 正文 | 14px / 400 / 22px | `--campus-font-size-body: 28rpx` | `--campus-line-height-body: 44rpx` | `$font-size-body` / `$line-height-body` | 学校名、说明、作者、次级操作、空状态 |
| 重要正文 | 15px / 400 / 23px | `--campus-font-size-important-body: 30rpx` | `--campus-line-height-important-body: 46rpx` | `$font-size-important-body` / `$line-height-important-body` | 课程名、通知和内容标题 |
| 卡片标题 | 16px / 500 / 24px | `--campus-font-size-card-title: 32rpx` | `--campus-line-height-card-title: 48rpx` | `$font-size-card-title` / `$line-height-card-title` | 首页区块和卡片标题 |
| 页面标题 | 18px / 600 / 27px | `--campus-font-size-page-title: 36rpx` | `--campus-line-height-page-title: 54rpx` | `$font-size-page-title` / `$line-height-page-title` | 页面导航标题 |
| 大标题 | 20px / 600 / 30px | `--campus-font-size-large-title: 40rpx` | `--campus-line-height-large-title: 60rpx` | `$font-size-large-title` / `$line-height-large-title` | Hero 主标题 |

## 字重

| 语义角色 | CSS Token | Sass Token | 值 |
|---|---|---|---:|
| 常规 | `--campus-font-weight-regular` | `$font-weight-regular` | `400` |
| 中等 | `--campus-font-weight-medium` | `$font-weight-medium` | `500` |
| 半粗 | `--campus-font-weight-semibold` | `$font-weight-semibold` | `600` |

正文和重要正文保持 `400`，卡片标题使用 `500`，只有页面标题、大标题和必要的数字强调使用 `600`。不要使用 `650`、`700`、`750` 等无法在不同 Android 系统字体中稳定映射的非规范字重。

## 文本颜色

| 语义角色 | CSS Token | Sass Token | 浅色值 |
|---|---|---|---|
| 主文字 | `--campus-text-primary` | `$color-text-primary` | Ousea `ink-900` / `#1A2333` |
| 次文字 | `--campus-text-secondary` | `$color-text-secondary` | Ousea `ink-500` / `#6B7A90` |
| 辅助文字 | `--campus-text-auxiliary` | `$color-text-auxiliary` | Ousea `ink-300` / `#A6B2C2` |

暗色模式使用同名 Token 提供独立值。历史的 `heading`、`body`、`muted` 变量只作为兼容别名，新增样式应使用 `primary`、`secondary`、`auxiliary`。

## 使用方式

普通 SCSS/WXSS 直接组合完整角色，并保留回退值：

```scss
.card-title {
  color: var(--campus-text-primary, #1f2329);
  font-size: var(--campus-font-size-card-title, 32rpx);
  font-weight: var(--campus-font-weight-medium, 500);
  line-height: var(--campus-line-height-card-title, 48rpx);
}
```

已接入 Sass Token 的样式使用统一映射：

```scss
@use '../../styles/tokens' as token;

.body-copy {
  color: token.$color-text-primary;
  font-size: token.$font-size-body;
  font-weight: token.$font-weight-regular;
  line-height: token.$line-height-body;
}
```

自定义 TabBar 等原生组件受微信组件样式隔离影响，必须保留 Token fallback，并在组件内部重复声明系统字体栈。

## 维护规则

1. 新组件先确定语义角色，再一次性使用对应字号、字重和行高。
2. 不创建 `--home-font-*`、`--detail-font-*` 等页面私有字体 Token。
3. 新组件优先使用 Ousea `badge / caption / label / comment / body / title`；只有维护旧组件时使用 Campus 六级兼容角色。
4. 文本颜色使用 Ousea `ink-900 / 700 / 500 / 300`；品牌色仅用于链接、选中和业务状态。
5. 修改全局值时同时更新 `design-system/campus-miniapp/ousea-design-tokens.json`、`src/app.scss`、`src/styles/_tokens.scss` 与 `scripts/typography-smoke.ts`。
6. 字号不得替代布局约束；生产长文本仍需使用单行省略或两行截断。
7. 字体规范调整后必须在微信开发者工具和至少两种 Android 系统字体环境中复核。
