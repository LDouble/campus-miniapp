# Campus Platform 用户端小程序

基于 Taro 4、React 和 TypeScript 的微信小程序用户端。

## 关联项目

- 服务端：[LDouble/backend_demo](https://github.com/LDouble/backend_demo)
- 管理端：[LDouble/campus-admin-web](https://github.com/LDouble/campus-admin-web)
- 当前项目：[LDouble/campus-miniapp](https://github.com/LDouble/campus-miniapp)

服务端 OpenAPI 契约是请求和响应类型的唯一事实来源。客户端接口接入前先同步服务端契约，再生成 TypeScript 客户端，禁止手工维护重复 DTO。

## 开发

```bash
pnpm install
pnpm dev:weapp
```

将 `dist` 目录导入微信开发者工具进行预览。

## 构建

```bash
pnpm build:weapp
```
