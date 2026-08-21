# 海大校园小程序：修正移动端评论与点赞交互

**Priority:** High
**Status:** Done
**Type:** Bug
**Created:** 2026-08-20
**Last Updated:** 2026-08-21

## Overview

统一移动端点击反馈与帖子互动行为：移除 `hoverClass` 触摸态，列表评论可直接回复，非帖子业务不提供点赞，并让新评论与回复即时出现在当前列表。

## Implementation Overview

1. 清理小程序 JSX 中的 `hoverClass` 及配套 hover 时间属性，保留真实点击、禁用和加载状态。
2. 为 `CommunityPostCard` 的评论预览增加回复回调，把目标评论传入现有 `CommunityCommentSheet`。
3. 扩展现有 composer 的初始回复目标，不新增评论输入实现。
4. 首页仅 `campus_circle_post` 传入点赞能力，其他三类不展示点赞入口和点赞摘要。
5. 评论/回复提交后，无论是否待审核，都先回填当前用户可见的本地预览；公开计数仍只在审核通过后增加。
6. 列表评论框在真机 `Textarea` blur 时不提前卸载，避免接口成功后丢失本地回填。
7. 评论预览使用行内文本流，超长正文换行后从评论行左侧重新开始，不与正文首字符做 flex 对齐。
8. 评论提交期间暂停滚动 dismiss；失败解锁后重新激活监听，避免首次滚动被消费后后续滚动无法关闭。
9. 回复键盘弹起后，将列表或详情中被回复的评论滚动到输入组件上方，并抑制这次程序化滚动触发 overlay dismiss。
10. 回复期间为页面末尾补足临时滚动空间；二级评论预览与根评论左侧对齐，仅用“回复”关系说明层级。
11. 评论提交期间保持取消与发布事件监听稳定，规避 Taro 4.1.11 在动态移除监听时触发 `_num` 运行时异常。
12. `CommunityPostCard` 整卡作为详情点击区域；头像、昵称、更多操作、点赞、评论与回复保留独立行为并阻止冒泡。

## Files to Modify

- `src/features/community/post-card.tsx`
- `src/features/community/comment-sheet.tsx`
- `src/features/community/feed-panel.tsx`
- `src/features/life-services/components/detail-comments.tsx`
- `src/pages/index/index.tsx`
- 相关列表 TSX 与 smoke 测试

## Libraries/Dependencies

- **Taro**（Context7：`/nervjs/taro-docs`）：`View` 的 `hoverClass` 是小程序按压态；删除后保留普通点击事件。

## Testing Requirements

- 非帖子混排项不出现点赞入口或点赞摘要。
- 点击根评论和二级回复都打开带目标昵称的回复输入框。
- 新评论和新回复提交后立即回填列表。
- 全量 lint、typecheck 与评论相关 smoke 通过；不重复执行用户已运行的 watch build。
- review 测试环境实际提交二级回复后接口返回 201，提交后的模拟器 console 无 `_num` / `TypeError`。

---

**Implementation Notes:** 用户已直接要求修复上述四项，视为当前 bugfix 的实施授权。
