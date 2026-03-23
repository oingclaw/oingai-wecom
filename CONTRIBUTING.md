# Contributing

感谢对 `oingai-wecom` 的关注。

## 开发流程

1. Fork 仓库并创建主题分支。
2. 保持修改聚焦，避免把无关格式化和功能改动混在一起。
3. 提交前执行：

```bash
npm install
npm run typecheck
npm run build
```

4. 在 Pull Request 中说明背景、修改点、验证方式和兼容性影响。

## 代码约定

- 使用 TypeScript
- 尽量保持与官方 `~/.openclaw/extensions/wecom/` 插件的命名和目录习惯一致
- 新增能力时优先补充类型定义和最小必要文档
- 不要提交真实企业微信凭据、内部账号标识或生产环境 URL

## 报告问题

提交 Issue 时请包含以下信息：

- OpenClaw 版本
- Node.js 版本
- `oingai-wecom` 版本
- 官方 `wecom` 插件版本
- 复现步骤
- 实际结果与预期结果

## 安全问题

如果发现凭据泄露、任意模块加载、未授权发送等安全问题，请不要先公开提交敏感细节。优先通过私下渠道联系维护者，并附上最小复现说明。
