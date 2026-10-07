# 用户拉黑与私信拦截（小程序）

## 契约与范围

- Feature ID：`user-block-private-message`
- 后端 OpenAPI 契约提交：`e0d618bfc9559ab8a9bab2858f26a88cf570877a`（包含聚合产物 `api/openapi.yaml`）
- 他人主页新增拉黑与取消拉黑操作；拉黑前确认，页面根据主页接口返回的 `is_blocked` 恢复状态，操作期间防止重复提交。
- 私信文字和图片发送识别 `private_message_blocked`，显示“对方暂不接收你的私信”；文字失败时保留输入，图片失败时进入失败状态。
- `src/api/generated/schema.ts` 由完整后端 OpenAPI 契约生成，包含该后端提交中其他已存在的契约更新；生成目录未手工修补。

## 验证记录

- `corepack yarn lint`：通过。
- `corepack yarn typecheck`：通过。
- `corepack yarn test:direct-messages`：通过。
- `corepack yarn test:public-profile-campus`：通过。
- `corepack yarn build:weapp`：通过。
- `git diff --check`：通过。
- 微信自动化运行时当前不可用，真机主页拉黑交互、私信发送反馈尚未验收。

