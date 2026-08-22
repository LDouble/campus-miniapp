# 一起自习 API 契约

小程序前端调用统一的 `/api/v1/study-rooms` 资源。所有接口必须登录，并要求 `academic_verification.identity.status = verified`；否则返回 `403 academic_verification_required`。

## 核心规则

- 房间标题长度为 2—30 字，创建后进入内容审核；只有 `approved` 房间可以被公开检索和聊天。
- 房间容量允许 `2、4、6、8、12、16、20`，服务端加入事务必须锁定房间并再次检查人数，禁止超员。
- `private` 房间不出现在公开列表，只能凭服务端生成的高熵 `invite_code` 加入；日志不得记录邀请码原文。
- 成员加入时记录 `active_since`，离开时将本次差值累加到 `accumulated_seconds`。重复加入/离开需幂等。
- 消息正文最长 200 字，必须审核；列表只返回 `approved` 消息。服务端按房间的 `message_cooldown_seconds` 原子校验发言间隔。
- 只有房主可以修改发言间隔。允许值为 `0、30、60、120、300、600` 秒。
- 房间、成员、标题和消息均应进入现有内容举报与管理员审核体系。

## 数据结构

`StudyRoomDetail` 在列表摘要字段之外包含：

```json
{
  "moderation_status": "approved",
  "message_cooldown_seconds": 60,
  "viewer_joined": true,
  "viewer_is_owner": true,
  "viewer_user_id": 1001,
  "invite_code": "仅私密房间房主可见",
  "next_message_at": "2026-08-22T12:01:00Z",
  "members": [],
  "messages": []
}
```

成员至少包含 `user_id、username、avatar_url、accumulated_seconds、active_since、is_owner`。消息至少包含 `id、user_id、username、avatar_url、content、moderation_status、created_at`。

## 接口

### 查询公开房间

`GET /api/v1/study-rooms?visibility=public&status=approved`

返回 `{ items, total }`。私密、待审核、已拒绝或已关闭房间不得出现。

### 创建房间

`POST /api/v1/study-rooms`

```json
{
  "title": "期末一起冲刺",
  "capacity": 8,
  "visibility": "private",
  "message_cooldown_seconds": 60
}
```

创建者自动成为房主和活跃成员。使用 `Idempotency-Key` 防止重复创建。

### 查询房间

`GET /api/v1/study-rooms/{id}?invite={invite_code}`

公开房间不要求 `invite`。私密房间仅允许已有成员或持有效邀请码的认证用户读取必要摘要；`invite_code` 只返回给房主。

### 加入与离开

- `POST /api/v1/study-rooms/{id}/members`，请求体 `{ "invite_code": "..." }`
- `DELETE /api/v1/study-rooms/{id}/members/me`
- `GET /api/v1/study-rooms/{id}/members`

加入操作使用 `Idempotency-Key`。满员返回 `409 study_room_full`；无效邀请返回 `403 invalid_study_room_invite`。

### 消息

- `GET /api/v1/study-rooms/{id}/messages?after_id={id}`
- `POST /api/v1/study-rooms/{id}/messages`，请求体 `{ "content": "..." }`

发言过快返回 `429 study_room_message_cooldown`，并通过错误详情或 `Retry-After` 返回剩余秒数。提交成功但待审核时仍返回消息对象，其 `moderation_status` 为 `pending`。

### 房主设置

`PUT /api/v1/study-rooms/{id}/message-cooldown`

请求体 `{ "seconds": 60 }`。非房主返回 `403 study_room_owner_required`。

## 推荐表与索引

- `study_rooms`：房主、标题、审核状态、可见性、容量、发言间隔、生命周期时间。
- `study_room_members`：房间与用户唯一索引、累计秒数、活跃开始时间、加入/离开时间。
- `study_room_messages`：房间、用户、正文、审核状态、创建时间；索引 `(room_id, id)`。
- `study_room_invites`：邀请码哈希、房间、创建者、过期/撤销时间；禁止保存可直接使用的明文日志。

定时任务应处理异常断线留下的 `active_since`，并按产品策略关闭长期无人房间。

## 本地 UI 预览

后端完成前可执行 `yarn preview:study-rooms`。该命令只允许 development 构建，在“一起自习”模块内模拟已认证用户和示例房间，不会修改真实认证状态。预览开关若进入非 development 构建会直接报错终止。
