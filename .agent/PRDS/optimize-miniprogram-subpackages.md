# 小程序业务页面分包与主包瘦身

**Priority:** High
**Status:** Done
**Type:** Enhancement
**Created:** 2026-08-16
**Last Updated:** 2026-08-16

## 背景

当前 `dist/full` 构建产物精确体积为 2,429,902 B（2.317 MiB），38 个页面全部声明在主包，已超过微信小程序常见的 2 MiB 主包限制约 325 KiB，导致开发者工具无法正常生成预览。

其中 32 张校园鲨表情原始体积共 464,429 B（453.5 KiB）。实测将图片统一优化为 96×96、128 色透明 PNG 后仅 109,491 B（106.9 KiB），减少 76.4%；因此表情继续留在主包，信息流、详情、评论和发布器都保持图片展示。

## 目标

1. 将所有无需留在主包、且现有目录可直接作为分包根目录的页面迁入普通分包。
2. 保持所有现有页面 URL 不变，避免批量修改导航和分享路径。
3. 启用 Taro `mini.optimizeMainPackage`，避免纯分包业务模块继续进入主包公共 chunk。
4. 完整版与资格版均能构建，现有微信 AI 独立 `skills` 分包继续生效。
5. 完整版主包体积低于 1.5 MiB，预留后续迭代空间；单个分包低于 2 MiB。
6. 表情图片在主包保持全局可用，同时将总体积压缩至 110 KiB 以内。

## 分包范围

### 保留主包

- `pages/index/index`：启动页与首页 Tab。
- `pages/community/index`：社区 Tab。
- `pages/messages/index`：消息 Tab。
- `pages/profile/index`：我的 Tab。
- `pages/app-login/index`：登录与启动链路。
- 资格版的 `pages/feature-migrated/index`。

### 普通分包

按现有目录直接声明以下分包，页面 URL 保持不变：

- 学业：`pages/academic`。
- 社团：`pages/clubs`。
- 校车：`pages/shuttle`。
- 官方通知：`pages/official-notices`。
- 单页业务：`academic-verification`、`materials`、`empty-classroom`、`calendar`、`services`、`publish`、`my-services`、`errands`、`marketplace`、`carpool`、`public-profile`、`user-level`、`daily-checkin`、`account-cancellation`、`content-report`、`webview`、`feature-unavailable`。

### Social 聚合分包

以下页面迁入统一的 `packages/social` 普通分包，并同步更新内部导航路径：

- 社区详情与话题详情；
- 发布器与“我的服务”；
- 跑腿、二手、同行详情；
- 内容举报；

表情资源不进入 `social` 分包：小程序不能跨分包引用文件，资源型独立分包无法被主包及其他分包共享。

资格版构建继续根据现有排除清单过滤不开放的分包页面，不生成空分包。

## 技术方案

1. 将 `src/app.config.ts` 的单一 `pages` 清单拆成：
   - 主包页面清单；
   - 普通业务分包清单；
   - 可选微信 AI 独立分包。
2. 使用分包 `root + pages` 拼接后的完整路径复用现有资格版排除规则。
3. 合并业务分包与 AI `skills` 分包，避免后者覆盖前者。
4. 在 `config/index.ts` 的 `mini` 配置中启用：

   ```ts
   optimizeMainPackage: { enable: true }
   ```

5. 将 32 张表情统一压缩为 96×96、128 色透明 PNG，维持安全协议和统一图片渲染。
6. 首轮不配置 `preloadRule`，避免为了体验优化重新增加首次下载压力；待包体与真实跳转验证稳定后再评估。

## 约束与风险

- Tab 页必须位于主包，不能迁移。
- 分包可以依赖主包，主包不能依赖只存在于分包的模块。构建后需检查 Taro 是否正确将首页引用的学业公共类型保留在主包。
- Taro 主包优化可能复制被多个分包使用的模块，总包会略增，但主包应显著下降。
- 表情保留在主包会占用约 106.9 KiB，后续新增表情时需持续使用同等压缩规格。
- 若某个现有目录不能被微信识别为普通分包根目录，则只对该目录回退，不通过修改页面 URL 强行搬迁。

## 验收标准

1. `dist/full/app.json` 同时包含主包 `pages` 与普通 `subPackages`。
2. 四个 Tab 页面均仍在主包；非 Tab 目标页面不再重复出现在主包 `pages`。
3. 完整版与资格版 `yarn build:weapp` 均通过。
4. 精确统计的完整版本主包体积低于 1.5 MiB，所有单分包低于 2 MiB。
5. 首页、社区、发布器、学业、校车、社团、资料、生活服务详情等代表页面可正常打开。
6. 微信开发者工具可生成预览，不再报告主包超过限制。
7. `yarn typecheck`、现有 smoke tests 与 `git diff --check` 通过。
8. 主包信息流与 `social` 分包内都显示图片表情，损坏或未知标记仍降级为文字。

## 实施步骤

1. 重构 app 配置并合并 AI 独立分包。
2. 启用 Taro 主包优化并构建完整版、资格版。
3. 统计主包、分包及总包精确体积；按构建结果调整边界。
4. 使用微信开发者工具编译、跳转代表页面并生成预览验证。
5. 更新本文档与任务状态，记录最终体积结果。

## 实施结果

- 完整版主包仅保留首页、登录、社区、消息、我的 5 个页面，其余天然独立页面迁入 15 个普通业务分包。
- 社区详情、话题、发布器、我的服务、跑腿/二手/同行详情和内容举报迁入统一 `packages/social` 分包，所有运行时路由、分享路径、鉴权白名单和 smoke 测试已同步。
- 已启用 Taro `mini.optimizeMainPackage`，分包专属公共依赖不会继续无条件进入主包。
- 32 张表情统一压缩为 96×96、128 色透明 PNG，总体积从 464,429 B 降至 109,491 B，减少 76.4%，主包及分包页面仍统一显示图片表情。
- 本地精确统计：主包 973,482 B（0.928 MiB），最大 `social` 分包 300,308 B（0.286 MiB）。
- 微信开发者工具 `auto_preview` 成功；工具统计主包 947,729 B，总包 2,010,551 B，不再触发主包 2 MiB 限制。
- 完整版与资格版均构建成功，资格版受限页面检查通过。
- TypeScript、全量 ESLint、表情、评论、媒体、社区、业务详情、分享和订阅相关 smoke tests 均通过。
