/**
 * OingAI WeCom Plugin
 *
 * OpenClaw 企业微信推送补丁，聚焦两个能力：
 * 1. 优先通过官方 wecom 插件的 Bot WS 发送 Markdown
 * 2. 当 Bot WS 不可用或命中频率限制时，返回 Agent API fallback 指引
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

const VERSION = "0.0.1";
const PLUGIN_ID = "oingai-wecom";
const PLUGIN_NAME = "oingai-wecom";
const DEFAULT_ACCOUNT_ALIAS = "default";
const DEFAULT_ACCOUNT_ENV = "OINGAI_WECOM_DEFAULT_ACCOUNT_ID";
const WECOM_EXTENSION_ENV = "OINGAI_WECOM_EXTENSION_PATH";

type ToolContextLike = {
  accountId?: string;
  messageChannel?: string;
};

type ToolFactory = (toolContext: ToolContextLike | undefined) => {
  name: string;
  label: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
  execute: (_toolCallId: string, rawParams: unknown) => Promise<{
    content: Array<{ type: "text"; text: string }>;
    details: Record<string, never>;
  }>;
} | null;

type PluginApiLike = {
  registerTool: (factory: ToolFactory, options: { name: string }) => void;
};

type BotWsPushHandle = {
  isConnected: () => boolean;
  sendMarkdown: (chatId: string, content: string) => Promise<void>;
};

type OfficialWecomModule = {
  getBotWsPushHandle: (accountId: string) => BotWsPushHandle | undefined;
};

type WecomModuleSearchOptions = {
  cwd?: string;
  explicitExtensionPath?: string;
  homeDir?: string;
};

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: {},
  };
}

function trimNonEmpty(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getDefaultAccountId(envValue = process.env[DEFAULT_ACCOUNT_ENV]): string {
  return trimNonEmpty(envValue) ?? DEFAULT_ACCOUNT_ALIAS;
}

export function resolveAccountId(
  toolContext: ToolContextLike | undefined,
  rawAccountId: unknown
): string {
  return (
    trimNonEmpty(rawAccountId) ??
    trimNonEmpty(toolContext?.accountId) ??
    getDefaultAccountId()
  );
}

function normalizeExtensionRoot(explicitExtensionPath: string): string {
  return explicitExtensionPath.endsWith(".js")
    ? path.dirname(path.dirname(path.dirname(explicitExtensionPath)))
    : explicitExtensionPath;
}

export function buildWecomModuleCandidates(
  options: WecomModuleSearchOptions = {}
): string[] {
  const cwd = options.cwd ?? process.cwd();
  const homeDir = options.homeDir ?? homedir();
  const configuredRoot = trimNonEmpty(options.explicitExtensionPath);

  const fileCandidates = [
    configuredRoot ? path.join(normalizeExtensionRoot(configuredRoot), "dist/app/index.js") : null,
    path.resolve(__dirname, "../../wecom/dist/app/index.js"),
    path.join(homeDir, ".openclaw/extensions/wecom/dist/app/index.js"),
    path.join(cwd, "extensions/wecom/dist/app/index.js"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const moduleCandidates = [
    "@yanhaidao/wecom/dist/app/index.js",
    "wecom/dist/app/index.js",
  ];

  return [...new Set([...moduleCandidates, ...fileCandidates])];
}

function coerceOfficialWecomModule(loaded: unknown): OfficialWecomModule | null {
  const candidate = loaded as {
    getBotWsPushHandle?: unknown;
    default?: { getBotWsPushHandle?: unknown };
  };

  if (typeof candidate?.getBotWsPushHandle === "function") {
    return { getBotWsPushHandle: candidate.getBotWsPushHandle as OfficialWecomModule["getBotWsPushHandle"] };
  }

  if (typeof candidate?.default?.getBotWsPushHandle === "function") {
    return {
      getBotWsPushHandle:
        candidate.default.getBotWsPushHandle as OfficialWecomModule["getBotWsPushHandle"],
    };
  }

  return null;
}

/**
 * 获取官方 wecom 插件的 Bot WS Push Handle
 */
function getOfficialWecomModule(): OfficialWecomModule | null {
  const explicitExtensionPath = trimNonEmpty(process.env[WECOM_EXTENSION_ENV]);

  for (const candidate of buildWecomModuleCandidates({ explicitExtensionPath: explicitExtensionPath ?? undefined })) {
    try {
      const loaded = candidate.includes(path.sep)
        ? existsSync(candidate)
          ? require(candidate)
          : null
        : require(require.resolve(candidate, { paths: [process.cwd(), __dirname] }));

      const officialModule = coerceOfficialWecomModule(loaded);
      if (officialModule) {
        return officialModule;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * 通过 Bot WS 发送消息
 */
async function sendViaBotWs(
  handle: BotWsPushHandle,
  userId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await handle.sendMarkdown(userId, message);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg.includes("846607") || errorMsg.toLowerCase().includes("frequency limit")) {
      return {
        success: false,
        error: "Bot WS 频率限制 (846607)",
      };
    }

    return { success: false, error: errorMsg };
  }
}

export function createSessionFormats(userId: string, accountId: string) {
  const normalizedUserId = userId.trim();
  const normalizedAccountId = accountId.trim();
  const sessionKey = `agent:main:wecom:direct:${normalizedUserId}`;
  const agentApiTarget = `wecom-agent:${normalizedAccountId}:${normalizedUserId}`;

  return {
    sessionKey,
    botWsTarget: normalizedUserId,
    agentApiTarget,
  };
}

/**
 * 创建 oingai_wecom_send 工具工厂
 */
function createSendToolFactory(): ToolFactory {
  return (toolContext) => {
    if (toolContext?.messageChannel !== "wecom") {
      return null;
    }

    return {
      name: "oingai_wecom_send",
      label: "OingAI WeCom Send",
      description:
        "发送企业微信消息。优先使用官方 wecom 插件的 Bot WS；失败时返回 Agent API fallback 指引。",
      parameters: {
        type: "object",
        properties: {
          userId: {
            type: "string",
            description: "接收消息的用户 ID（如 'jin'、'vivi'）",
          },
          message: {
            type: "string",
            description: "要发送的消息内容（支持 Markdown）",
          },
          accountId: {
            type: "string",
            description: "可选的企业微信账号 ID；默认使用上下文账号或 default",
          },
        },
        required: ["userId", "message"],
      },
      async execute(_toolCallId, rawParams) {
        try {
          const params = rawParams as {
            accountId?: string;
            message?: string;
            userId?: string;
          };

          const userId = trimNonEmpty(params.userId);
          const message = trimNonEmpty(params.message);
          const accountId = resolveAccountId(toolContext, params.accountId);

          if (!userId) {
            return textResult({
              success: false,
              error: '参数 "userId" 必须是非空字符串',
            });
          }

          if (!message) {
            return textResult({
              success: false,
              error: '参数 "message" 必须是非空字符串',
            });
          }

          const wecomModule = getOfficialWecomModule();

          if (!wecomModule?.getBotWsPushHandle) {
            return textResult({
              success: false,
              mode: "module-unavailable",
              error: "无法定位官方 wecom 插件的 Bot WS 发送模块",
              fallbackGuidance: {
                target: `wecom-agent:${accountId}:${userId}`,
                note: "请改用上层 message 工具或 Agent API 路径继续发送。",
              },
            });
          }

          const handle = wecomModule.getBotWsPushHandle(accountId);
          if (!handle || !handle.isConnected()) {
            return textResult({
              success: false,
              mode: "bot-ws-unavailable",
              error: "Bot WS 连接不可用",
              fallbackGuidance: {
                target: `wecom-agent:${accountId}:${userId}`,
                note: "Bot WS 不可用时，本插件只返回 fallback 目标，不会自动代发。",
              },
            });
          }

          const result = await sendViaBotWs(handle, userId, message);
          if (result.success) {
            return textResult({
              success: true,
              accountId,
              messageLength: message.length,
              mode: "bot-ws",
              userId,
            });
          }

          return textResult({
            success: false,
            mode: "bot-ws-failed",
            error: result.error,
            fallbackGuidance: {
              method: "使用 message 工具或 Agent API target 继续发送",
              target: `wecom-agent:${accountId}:${userId}`,
              example:
                `message(action="send", channel="wecom", target="wecom-agent:${accountId}:${userId}", message="...")`,
            },
          });
        } catch (error) {
          return textResult({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    };
  };
}

/**
 * 创建 oingai_wecom_session_resolve 工具工厂
 */
function createSessionResolveToolFactory(): ToolFactory {
  return (toolContext) => {
    if (toolContext?.messageChannel !== "wecom") {
      return null;
    }

    return {
      name: "oingai_wecom_session_resolve",
      label: "OingAI WeCom Session Resolve",
      description:
        "根据 userId 生成常用的 WeCom 目标格式，便于上层切换 sessions_send 或 Agent API 路径。",
      parameters: {
        type: "object",
        properties: {
          userId: {
            type: "string",
            description: "用户 ID（如 'jin'、'vivi'）",
          },
          accountId: {
            type: "string",
            description: "可选的企业微信账号 ID；默认使用上下文账号或 default",
          },
        },
        required: ["userId"],
      },
      async execute(_toolCallId, rawParams) {
        try {
          const params = rawParams as { accountId?: string; userId?: string };
          const userId = trimNonEmpty(params.userId);

          if (!userId) {
            return textResult({
              success: false,
              error: '参数 "userId" 必须是非空字符串',
            });
          }

          const accountId = resolveAccountId(toolContext, params.accountId);
          const formats = createSessionFormats(userId, accountId);

          return textResult({
            success: true,
            accountId,
            formats,
            note: "sessionKey 为按当前约定推导出的格式，请以运行时真实会话为准。",
            usage: {
              sessions_send: `sessions_send(sessionKey: "${formats.sessionKey}", message: "...")`,
              message_agentApi:
                `message(action="send", channel="wecom", target="${formats.agentApiTarget}", message="...")`,
              message_botWs:
                `message(action="send", channel="wecom", target="${formats.botWsTarget}", message="...")`,
            },
            userId,
          });
        } catch (error) {
          return textResult({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    };
  };
}

const plugin = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  version: VERSION,
  description: "OpenClaw 企业微信推送补丁，优先 Bot WS，失败时返回 Agent API fallback 指引。",
  configSchema: emptyPluginConfigSchema(),
  register(api: PluginApiLike) {
    console.log(`[oingai-wecom] Registering plugin v${VERSION}`);
    api.registerTool(createSendToolFactory(), { name: "oingai_wecom_send" });
    api.registerTool(createSessionResolveToolFactory(), {
      name: "oingai_wecom_session_resolve",
    });
  },
};

export const __internal = {
  buildWecomModuleCandidates,
  createSessionFormats,
  getDefaultAccountId,
  resolveAccountId,
};

export default plugin;
