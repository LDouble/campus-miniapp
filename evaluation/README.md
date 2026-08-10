# 微信 AI `campus-info` 评测文件

## 文件说明

- `campus-info.testcases.json`：用于微信开发者工具评测插件上传的自定义 Intent 集。
- `../scripts/wechat-ai-evaluation-dataset-smoke.ts`：校验新版官方格式、数量、复杂度和接口覆盖。

评测文件严格使用官方模板结构：

```json
{
  "cases": [
    { "intent": "用户真实可能提出的问题或请求" }
  ],
  "entities": [
    {
      "type": "campus",
      "content": { "name": "崂山校区" },
      "source": ["queryShuttleSchedule", "findEmptyClassrooms"]
    }
  ]
}
```

不包含旧版 `wxa-skills-eval` 使用的 `skills`、`checklist` 或 `scoring_criteria` 字段。

## 覆盖情况

当前共 52 条 Intent：

| 能力 | 数量 | 对应原子接口 |
| --- | ---: | --- |
| 官方通知 | 18 | `searchOfficialNotices` |
| 校车安排 | 18 | `queryShuttleSchedule` |
| 空教室 | 16 | `findEmptyClassrooms` |

三个原子接口覆盖率为 100%。多条件查询包含关键词、来源、分类、时间范围、校区、日期、线路类型、节次范围及结果概括要求，复杂 Intent 比例高于 30%。

## 本地校验

```bash
yarn test:wechat-ai-evaluation-dataset
```

校验内容：

1. 顶层只包含 `cases` 和 `entities`；
2. Intent 数量在 50–100 条之间，且不存在空值或重复；
3. 每条 case 只包含自然语言 `intent`；
4. `entities[].type`、`content` 和 `source` 符合官方示例；
5. `source` 只能引用当前 `mcp.json` 声明的三个原子接口；
6. 三个接口覆盖率为 100%，复杂 Intent 比例不低于 30%。

## 在微信开发者工具中使用

1. 使用最新 Nightly 微信开发者工具；
2. 切换到“小程序 AI 编译”，调试基础库使用 3.16.2 或以上；
3. 上传需要评测的开发版本；
4. 打开评测插件，选择已上传版本和 `campus-info` SKILL；
5. 在“添加评测文件”中上传 `evaluation/campus-info.testcases.json`；
6. 执行评测文件检测，重点确认格式规范、Intent 数量、接口覆盖度、复杂度和多样性；
7. 生成用例后先人工核对，再生成轨迹并执行评测。

评测依赖测试微信账号的共享登录态和真实校园数据。不要在评测文件中填写账号、密码、Token 或完整业务数据库。

## 参考

- [微信小程序 AI 评测指南：参数配置](https://developers.weixin.qq.com/miniprogram/dev/ai/evaluation-guide.html#_2-2-2-%E5%8F%82%E6%95%B0%E9%85%8D%E7%BD%AE)
- [微信官方评测文件示例](https://p6ngateway.weixin.qq.com/mmbizwxaskillsvr/static/testcase-example.json)
