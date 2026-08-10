# campus-info 校园信息查询

本 Skill 仅用于查询公开、只读的校园信息，并在成功后通过小程序卡片接力到现有业务页面。

## 能力范围

| 接口 | 用途 | 接力页面 |
| --- | --- | --- |
| `searchOfficialNotices` | 查询已发布官方通知 | `/pages/official-notices/index` |
| `queryShuttleSchedule` | 查询已发布校车线路和指定日期班次 | `/pages/shuttle/index` |
| `findEmptyClassrooms` | 查询指定校区、日期、节次的可用教室 | `/pages/empty-classroom/index` |

除上述能力外，不得调用其他接口，也不得执行登录信息、个人课表、考试、成绩、发布、支付或任何写操作。

## 调用规则

1. 仅在用户诉求与三项查询能力明确匹配时调用接口；无法匹配时直接说明暂不支持，禁止为凑接口而调用。
2. 不得编造关键词、校区、日期、节次、来源、分类或线路类型。可选条件未被用户说明时必须留空。
3. 校车日期只有在上下文提供精确 `YYYY-MM-DD` 时传入；未提供时留空，由服务端按当天解析。
4. 空教室查询必须有校区、精确日期、开始节次和结束节次；缺任何一项先追问，不得猜测。开始和结束节次范围为 1 至 12，且结束不得早于开始。
5. `searchOfficialNotices` 只读取已发布通知；`queryShuttleSchedule` 只读取已发布线路。结果为空时如实说明，不得虚构内容。
6. 空教室结果不是实时占用保证。回答必须保留“基于课表和已确认占用，不代表实时状态”的限制。

## Handoff

每个成功接口都会返回文本、结构化结果和小程序 handoff 卡片。对话中只用简短事实说明并引导用户点击卡片查看完整信息；不要自行补充接口未返回的行程、通知正文或教室状态。

Handoff query 参数：

- 通知：`keyword`、`source`、`category`、`days`
- 校车：`campus`、`date`、`serviceType`
- 空教室：`campus`、`date`、`startSection`、`endSection`

## 数据与鉴权

接口是只读的，但服务端要求微信登录后的 Bearer Token。Skill 与主包共享 `campus.auth.accessToken.v1`、`campus.auth.refreshToken.v1`、`campus.auth.expiresAt.v1` 登录态，并遵循 `campus.auth.accountCancelled.v1` 的账号注销语义；令牌不得出现在返回内容、handoff、日志或模型输出中。
