# 拦截不可继续使用的教务凭据

## 状态

Approved。

## 目标

- 保持 `invalid_academic_credentials` 的当前凭据请求前拦截。
- 保持 `academic_password_expired` 的当前凭据请求前拦截。
- 新增 `academic_account_restricted` 的当前凭据请求前拦截。
- 查询接口遇到以上三类错误时清除本机旧教务凭据，避免后台继续使用。
- 三类错误均提示访问 `my.ouc.edu.cn` 修改密码或处理账号状态，不提供原凭据重试按钮。

## 交互

| 错误码 | 页面提示 | 后续操作 |
| --- | --- | --- |
| `invalid_academic_credentials` | 学号或密码不正确 | 访问信息门户修改密码后再更新本机密码 |
| `academic_password_expired` | 统一身份认证密码已过期 | 访问信息门户修改密码后再更新本机密码 |
| `academic_account_restricted` | 校方账号已锁定或冻结 | 访问信息门户处理账号状态和密码 |

客户端不自动重试以上任何认证业务错误，也不持久化被拒绝的密码或拦截状态。

## 验收

- 三类错误均保存当前页面内的拒绝状态，并在相同凭据再次提交前拦截。
- 修改账号、密码或学生类型后可重新提交。
- 相同凭据再次点击时只显示信息门户处理提示，不重新发起请求。
- 查询遇到三类错误均清除本机凭据。
- 目标 smoke test、TypeScript 类型检查、ESLint 和差异检查通过。
