# oingai-wecom

`oingai-wecom` 是一个面向 OpenClaw 的企业微信推送补丁（WeCom Push Patch），用于缓解 Bot WebSocket 发送频率限制带来的投递问题。

当前实现聚焦两个工具：

- `oingai_wecom_send`
- `oingai_wecom_session_resolve`

项目设计上优先复用官方 `wecom` 插件的运行时能力，并在 Bot WS 不可用或命中频率限制时给出 Agent API fallback 路径，便于上层继续完成消息投递。

## 元数据规范（重要）

本仓库当前只认一套插件身份，避免安装后出现 `plugin id mismatch` 类 warning：

- `package.json name`: `oingai-wecom`
- `openclaw.plugin.json id`: `oingai-wecom`
- `openclaw.plugin.json name`: `oingai-wecom`
- 运行时插件 `id/name`: `oingai-wecom`

历史上的 `@oingai/wecom` 命名已废弃。若本机仍残留旧元数据，建议重新安装本仓库构建产物。

## 功能特性

- 双模式发送设计：优先 Bot WS，保留 Agent API fallback 路径
- 命中 Bot WS 频率限制 `846607` 时返回明确错误语义
- 直接按 `userId` 生成会话目标和 Agent API target
- 以补丁形式工作，尽量不侵入官方 `wecom` 插件结构

## 前置要求

- Node.js `>= 18`
- OpenClaw `>= 1.0.0`
- 已安装并可正常工作的官方 `wecom` 插件
- 官方 `wecom` 插件已经建立可用的 Bot WS 连接

## 安装方法

本地源码安装：

```bash
npm install
npm run build
openclaw plugins install /oing_ai/oingai-wecom --link
openclaw plugins enable oingai-wecom
```

若历史上安装过 `@oingai/wecom`，先卸载再安装当前版本：

```bash
openclaw plugins disable oingai-wecom || true
openclaw plugins remove oingai-wecom || true
openclaw plugins remove wecom || true
openclaw plugins install /oing_ai/oingai-wecom --link
openclaw plugins enable oingai-wecom
```

发布到 npm 后也可以直接安装：

```bash
openclaw plugins install oingai-wecom
openclaw plugins enable oingai-wecom
```

## 使用方法

发送消息：

```json
{
  "tool": "oingai_wecom_send",
  "arguments": {
    "userId": "jin",
    "message": "hello from oingai-wecom",
    "accountId": "default"
  }
}
```

解析会话与目标：

```json
{
  "tool": "oingai_wecom_session_resolve",
  "arguments": {
    "userId": "jin",
    "accountId": "default"
  }
}
```

`oingai_wecom_send` 当前行为：

- Bot WS 可用时直接发送 Markdown
- Bot WS 不可用时返回 `wecom-agent:<accountId>:<userId>` fallback target
- 命中 `846607` 时返回频率限制错误，便于上层切换到 Agent API 路径

## 配置说明

本插件当前没有独立的复杂配置项，`openclaw.plugin.json` 使用空 `configSchema`。运行时依赖来自官方 `wecom` 插件和上层消息发送能力：

| 项目 | 说明 |
| --- | --- |
| `accountId` | 可选，企业微信账号标识。未传时由当前工具上下文或插件内部默认值决定。 |
| Bot WS 连接 | 由官方 `wecom` 插件维护，本插件只读取其推送句柄。 |
| Agent API fallback | 通过 `wecom-agent:<accountId>:<userId>` 目标格式交给上层继续发送。 |

## 与官方插件的关系

参考目录：`~/.openclaw/extensions/wecom/`

官方插件负责完整的企业微信通道与运行时能力；`oingai-wecom` 只补充推送和目标解析层。相比官方插件，本仓库保持更小的代码面，但也意味着它依赖官方插件的内部实现约定。

## 开发

```bash
npm run typecheck
npm run build
```

## 安全说明

- 不要把 `CorpId`、`AgentSecret`、`BotSecret` 等真实凭据提交到仓库
- 开源前请再次检查 `TASKS.md`、脚本、测试数据和本地配置文件
- 当前实现仍存在对本地绝对路径和官方插件内部模块的耦合，详情见 `security_best_practices_report.md`

## License

MIT
