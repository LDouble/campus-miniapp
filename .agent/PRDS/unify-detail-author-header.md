# Campus Miniapp：统一详情作者头部与标题层级

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-21
**Last Updated:** 2026-08-21

## Overview

将跑腿、二手、找同行详情页的作者信息从自定义导航栏中央下移到正文顶部，按帖子详情的“作者信息 → 内容标题 → 业务详情”阅读顺序重构。帖子、跑腿、二手和找同行共用同一作者头部基础组件，头像统一为 `80rpx × 80rpx` 的圆角矩形，昵称、时间、状态和更多操作形成稳定的信息层级。

## User Story

**As a** 浏览校园帖子与生活服务详情的学生
**I want** 四类详情页以一致的作者头部和内容顺序呈现
**So that** 我能先确认发布者，再快速阅读标题和关键详情，不需要在导航栏与正文之间来回寻找信息

## Context

- 帖子详情的作者头像、昵称和发布时间已经位于正文顶部，页面导航栏只承载“帖子详情”和返回操作。
- 跑腿、二手、找同行目前通过 `CustomNavbar.barContent` 把发布者头像和昵称放在导航栏内，作者信息离开正文语境，长昵称还会与微信胶囊和返回按钮争抢宽度。
- 三类业务详情虽然都包含标题或描述，但组件结构不同：跑腿使用 `DetailBusinessIntro.title`，找同行使用 `DetailBusinessIntro.description`，二手使用页面私有的 `market-detail-title`，导致内容层级不一致。
- 现有 `DetailAuthorNavbar` 只适用于导航栏，不支持正文中的时间、状态、等级徽章和右侧操作，继续扩展会固化错误职责。
- Ousea / Global 要求新视觉优先复用公共组件，头像、触控区、页面 gutter 和标题字号使用统一 Token。

## Design Direction

- 导航栏只显示返回按钮与稳定页面标题：“帖子详情”“跑腿详情”“闲置详情 / 求购详情”“找同行详情”，不再塞入作者信息。
- 正文首屏统一使用作者头部：左侧圆角矩形头像，中间昵称与弱元信息，右侧保留该详情已有的更多操作入口。
- 头像视觉尺寸为 `80rpx × 80rpx`，圆角为 `18rpx`，与当前 `40px / 9px` 头像规范一致；头像与整段作者身份保持可点击，并保留不小于 `88rpx` 的有效触控高度。
- 昵称使用深海蓝 `--ousea-ocean-600`、Regular/Medium 字重；发布时间和审核状态使用语义弱文本色，不用业务色抢占标题层级。
- 业务标题紧跟作者头部：跑腿使用任务描述作为标题，二手使用商品描述作为标题，找同行使用同行描述作为标题。标题之后再展示标签、图片、价格、路线和关键业务信息。
- 帖子没有独立标题字段，不从正文截取或伪造标题；仍按“作者头部 → 话题 → 正文 → 图片”呈现，仅把作者头像同步为矩形。
- `ui-ux-pro-max` 检索结果中的玫红配色、Web 字体和桌面网格不适用于当前小程序，予以舍弃；仅采纳移动端最小 `44px` 触控目标和清晰内容层级原则，视觉值以 Ousea / Global 为准。

## Requirements

1. **公共作者头部**
   - 新建或改造一个正文级公共作者头部组件，帖子、跑腿、二手、找同行均可复用。
   - 支持头像、昵称、用户 ID、发布时间、状态、等级徽章和右侧操作插槽；业务页面只传数据，不复制布局。
   - 作者未删除时点击头像或作者区域继续进入公开主页；已删除作者不得跳转。
   - 长昵称单行省略，徽章和右侧操作不可被挤出屏幕；320px–375px 宽度无横向溢出。

2. **矩形头像**
   - 四类详情作者头像统一为 `80rpx × 80rpx`、`18rpx` 圆角矩形，图片使用 `aspectFill` 语义并继承圆角。
   - 不修改评论头像及其他页面头像；本次矩形规范只作用于详情正文作者头部。
   - 头像 fallback、稳定用户配色、懒加载和可访问名称继续保留。

3. **导航栏职责收敛**
   - 跑腿、二手、找同行移除 `CustomNavbar.barContent` 中的 `DetailAuthorNavbar`。
   - 导航栏仍保留页面标题和返回能力，不改变微信胶囊、安全区与页面加载行为。
   - 删除不再使用的导航栏作者组件；若仍有其他调用方，则仅移除本任务范围内引用并保留兼容。

4. **标题进入详情主体**
   - 跑腿标题位于作者头部之后、业务标签和报酬路线信息之前。
   - 二手标题位于作者头部之后、商品图片和价格信息之前，不能继续被大图压到首屏下方。
   - 找同行描述升级为正文标题，位于作者头部之后、路线与出发时间之前。
   - 标题使用统一 Ousea `title/body` 层级、支持贴纸和任意长文本自然换行，不固定高度、不提前截断。

5. **原有行为不回归**
   - 举报、编辑、删除/撤回、审核状态、业务操作、分享、图片预览、联系方式、评论和点赞逻辑保持不变。
   - 更多操作仍位于正文作者头部右侧或紧邻标签的稳定位置，点击热区不小于 `88rpx`，不得与作者主页跳转穿透。
   - 页面加载、错误态、下拉刷新、快照预渲染、暗色模式和安全区行为保持不变。

## Implementation Overview

1. 将 `DetailAuthorNavbar` 的身份展示能力重构为正文级 `DetailAuthorHeader`，通过插槽兼容帖子等级徽章、状态与更多操作。
2. 帖子详情替换私有作者头部 DOM，继续使用现有数据与菜单逻辑；头像样式切换到统一矩形规范。
3. 跑腿和找同行在 `DetailBusinessIntro` 顶部插入公共作者头部，并统一把描述映射到标题槽位。
4. 二手详情调整 hero 顺序为“作者头部 → 标题/标签/操作 → 图片 → 价格”，保留轮播、审核遮罩和业务信息。
5. 收敛 `detail.scss`、`marketplace/detail.scss` 与 `community/detail.scss` 的作者头部样式，Token 与暗色模式只维护一套。
6. 更新 smoke tests，断言三个业务页不再使用 `barContent`，四类详情共用作者头部、矩形头像及标题顺序。

## Files to Create

- `src/features/life-services/components/detail-author-header.tsx` - 四类详情页正文级作者头部组件。
- `src/features/life-services/components/detail-author-header.scss` - 统一头像、昵称、元信息与操作区盒子模型；如项目更适合集中样式，可合并到现有公共详情 SCSS。
- `scripts/detail-author-header-smoke.ts` - 作者头部复用、导航栏职责和标题顺序断言。

## Files to Modify

- `src/packages/social/community/detail.tsx` - 复用公共作者头部并保留等级、状态、菜单和主页跳转行为。
- `src/packages/social/community/detail.scss` - 移除帖子私有作者头部样式，保留页面内容样式。
- `src/packages/social/errands/detail.tsx` - 作者信息下移，标题进入正文头部。
- `src/packages/social/marketplace/detail.tsx` - 作者信息下移并重排标题、图片与价格顺序。
- `src/packages/social/marketplace/detail.scss` - 适配统一 hero 内容顺序。
- `src/packages/social/carpool/detail.tsx` - 作者信息下移，描述升级为标题。
- `src/features/life-services/detail.scss` - 统一业务详情作者头部、标题间距与暗色语义。
- `src/styles/_typography.scss` - 将新作者头部和详情标题绑定 Ousea 字体层级。
- `src/styles/_dark-mode.scss` - 同步作者头部、矩形头像底板和元信息暗色样式。
- `package.json` - 注册新增 smoke test（如新增独立测试脚本）。

## Files to Remove

- `src/features/life-services/components/detail-author-navbar.tsx` - 在确认无剩余调用方后删除，避免继续把作者信息放入导航栏。

## API Endpoints

不新增或修改接口。继续使用详情接口已有的 `author_avatar_url`、`author_nickname`、作者 ID、`created_at`、审核状态和可用操作字段。

## Libraries/Dependencies

- 使用现有 React、Taro `View` / `Text`、`UserAvatar`、`CustomNavbar` 与 Ousea / Global Token。
- 不新增第三方依赖，不改变 Taro 编译配置。

## Testing Requirements

### Automated Tests

- `yarn test:detail-author-header`
- `yarn test:community-detail-figma`
- `yarn test:community-detail-navigation`
- `yarn test:business-detail-navigation`
- `yarn test:detail-actions`
- `yarn test:typography`
- `yarn test:dark-mode`
- `yarn test:design-tokens`
- `yarn typecheck`
- `yarn lint`
- `git diff --check`

按当前开发约定，不执行 `yarn build:weapp`，由已运行的 `taro build --type weapp --watch` 持续编译。

### Manual Testing

- 分别打开帖子、跑腿、二手、找同行详情，确认作者头像、昵称、时间和更多操作起始线一致。
- 验证四类头像均为 `40px` 圆角矩形，图片、fallback 和长昵称均不变形。
- 验证跑腿、二手、找同行的标题都紧跟作者头部，超长文本、贴纸与无图片二手内容不溢出。
- 验证二手有图、无图、多图轮播时标题都不会被图片压到作者信息之前或首屏下方。
- 验证点击作者进入个人主页，点击右侧更多不会穿透到作者主页。
- 验证浅色、暗色以及 320px、360px、375px 屏宽。

## Risks and Constraints

- 二手详情当前图片位于标题之前，重排 DOM 可能影响审核遮罩、轮播高度和首屏滚动位置，需要保持图片逻辑原样，仅调整展示顺序。
- 帖子详情拥有等级徽章和作者删除态，公共组件需要通过明确属性或插槽兼容，不能把社区业务逻辑放进公共层。
- 三类业务标题都复用 `description` 字段，但意义不同；只统一视觉层级，不修改服务端字段与用户文案。
- 当前工作区包含同一详情改造链路尚未提交的评论组件修改，实施时必须保留，不覆盖或拆散已有变更。

---

**Implementation Notes:** 本任务中的“和帖子详情一样”指正文级作者身份与内容优先顺序，不复制帖子专属的等级徽章、话题、点赞或分享能力。帖子没有独立标题字段，不从正文生成伪标题。
