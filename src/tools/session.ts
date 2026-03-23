/**
 * OingAI WeCom Plugin - 会话解析工具
 *
 * 提供 oingai_wecom_session_resolve 工具，解决 OpenClaw 核心 label 匹配问题
 *
 * 核心问题：OpenClaw 的 sessions_send 工具在匹配 label 时只检查 entry.label，
 * 不检查 entry.origin.label，导致通过用户 ID 无法匹配到会话。
 *
 * 解决方案：此工具会同时检查 entry.label 和 entry.origin.label，并能够从
 * sessionKey 中提取用户信息。
 */

import type { ToolDefinition, ToolContext, ToolResult } from 'openclaw';
import type { SessionResolveParams, WeComSession, ResolveSessionResult } from '../types';
import { getAgentApiService } from '../services/agent-api';
import { logger } from '../utils/logger';
import { getCache, setCache, sessionCacheKey } from '../utils/cache';

/**
 * 会话解析工具定义
 */
export const sessionResolveToolDefinition: ToolDefinition = {
  name: 'oingai_wecom_session_resolve',
  description: '通过用户ID或姓名解析企业微信会话。解决 OpenClaw 核心 label 匹配问题，支持从 sessionKey 提取用户信息。',
  parameters: {
    type: 'object',
    properties: {
      userIdentifier: {
        type: 'string',
        description: '用户标识：用户ID或姓名',
      },
    },
    required: ['userIdentifier'],
  },
};

/**
 * 会话列表工具定义
 */
export const sessionListToolDefinition: ToolDefinition = {
  name: 'oingai_wecom_session_list',
  description: '列出所有企业微信会话。',
  parameters: {
    type: 'object',
    properties: {
      includeUserInfo: {
        type: 'boolean',
        description: '是否包含用户信息',
      },
    },
    required: [],
  },
};

/**
 * 从 sessionKey 提取用户ID
 *
 * sessionKey 格式通常为: "user:xxx" 或 "single:xxx" 等
 */
function extractUserIdFromSessionKey(sessionKey: string): string | null {
  // 常见的 sessionKey 格式
  const patterns = [
    /^user:(.+)$/,           // user:jin
    /^single:(.+)$/,         // single:jin
    /^private:(.+)$/,        // private:jin
    /^wecom:user:(.+)$/,     // wecom:user:jin
    /^wecom:single:(.+)$/,   // wecom:single:jin
  ];

  for (const pattern of patterns) {
    const match = sessionKey.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // 如果没有匹配到模式，尝试直接使用 sessionKey 作为 userId
  // 但需要排除群聊等特殊情况
  if (!sessionKey.includes('group') && !sessionKey.includes('room')) {
    return sessionKey;
  }

  return null;
}

/**
 * 匹配会话（核心逻辑）
 *
 * 同时检查 entry.label 和 entry.origin.label
 */
function matchSession(
  sessions: WeComSession[],
  userIdentifier: string
): WeComSession | null {
  const normalizedIdentifier = userIdentifier.toLowerCase().trim();

  // 1. 精确匹配 sessionKey
  const sessionByKey = sessions.find(
    (s) => s.sessionKey.toLowerCase() === normalizedIdentifier
  );
  if (sessionByKey) {
    logger.debug('Session matched by sessionKey', { userIdentifier });
    return sessionByKey;
  }

  // 2. 匹配 entry.label
  const sessionByLabel = sessions.find(
    (s) => s.label && s.label.toLowerCase() === normalizedIdentifier
  );
  if (sessionByLabel) {
    logger.debug('Session matched by label', { userIdentifier });
    return sessionByLabel;
  }

  // 3. 匹配 entry.origin.label（关键！解决 OpenClaw bug）
  const sessionByOriginLabel = sessions.find(
    (s) => s.origin?.label && s.origin.label.toLowerCase() === normalizedIdentifier
  );
  if (sessionByOriginLabel) {
    logger.debug('Session matched by origin.label', { userIdentifier });
    return sessionByOriginLabel;
  }

  // 4. 匹配 entry.origin.userId
  const sessionByOriginUserId = sessions.find(
    (s) => s.origin?.userId && s.origin.userId.toLowerCase() === normalizedIdentifier
  );
  if (sessionByOriginUserId) {
    logger.debug('Session matched by origin.userId', { userIdentifier });
    return sessionByOriginUserId;
  }

  // 5. 从 sessionKey 提取 userId 并匹配
  const sessionByExtractedUserId = sessions.find((s) => {
    const extractedUserId = extractUserIdFromSessionKey(s.sessionKey);
    return extractedUserId && extractedUserId.toLowerCase() === normalizedIdentifier;
  });
  if (sessionByExtractedUserId) {
    logger.debug('Session matched by extracted userId from sessionKey', { userIdentifier });
    return sessionByExtractedUserId;
  }

  // 6. 模糊匹配姓名
  const sessionByFuzzyName = sessions.find((s) => {
    const labelMatch = s.label && s.label.toLowerCase().includes(normalizedIdentifier);
    const originLabelMatch = s.origin?.label && s.origin.label.toLowerCase().includes(normalizedIdentifier);
    return labelMatch || originLabelMatch;
  });
  if (sessionByFuzzyName) {
    logger.debug('Session matched by fuzzy name', { userIdentifier });
    return sessionByFuzzyName;
  }

  return null;
}

/**
 * 解析会话
 */
async function resolveSession(userIdentifier: string): Promise<ResolveSessionResult> {
  // 检查缓存
  const cached = getCache<ResolveSessionResult>(sessionCacheKey(userIdentifier));
  if (cached) {
    logger.debug('Session resolved from cache', { userIdentifier });
    return cached;
  }

  const agentApi = getAgentApiService();

  // 获取所有会话
  const sessions = await agentApi.listSessions();

  if (sessions.length === 0) {
    return {
      success: false,
      error: '未找到任何会话',
    };
  }

  // 匹配会话
  const matchedSession = matchSession(sessions, userIdentifier);

  if (!matchedSession) {
    // 尝试通过通讯录查找用户，然后创建会话
    const users = await agentApi.searchUsers(userIdentifier);
    if (users.length > 0) {
      const user = users[0];
      const result: ResolveSessionResult = {
        success: true,
        userId: user.userid,
        userName: user.name,
        sessionKey: undefined, // 没有现成的会话，但找到了用户
      };
      setCache(sessionCacheKey(userIdentifier), result);
      return result;
    }

    return {
      success: false,
      error: `未找到用户 "${userIdentifier}" 的会话`,
    };
  }

  // 提取用户信息
  const userId: string | undefined = (matchedSession.origin?.userId ||
                 matchedSession.userId ||
                 extractUserIdFromSessionKey(matchedSession.sessionKey)) ?? undefined;

  const userName: string | undefined = (matchedSession.origin?.userName ??
                   matchedSession.userName ??
                   matchedSession.label) ?? undefined;

  const result: ResolveSessionResult = {
    success: true,
    sessionKey: matchedSession.sessionKey || undefined,
    userId,
    userName,
  };

  // 缓存结果
  setCache(sessionCacheKey(userIdentifier), result);

  logger.info('Session resolved', {
    userIdentifier,
    sessionKey: result.sessionKey,
    userId: result.userId,
  });

  return result;
}

/**
 * 执行会话解析工具
 */
export async function executeSessionResolveTool(
  params: SessionResolveParams,
  _context: ToolContext
): Promise<ToolResult> {
  try {
    logger.info('Executing session resolve tool', { userIdentifier: params.userIdentifier });

    // 参数验证
    if (!params.userIdentifier || typeof params.userIdentifier !== 'string') {
      return {
        success: false,
        error: '参数 "userIdentifier" 必须是非空字符串',
      };
    }

    const result = await resolveSession(params.userIdentifier);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    const response: Record<string, unknown> = {
      message: '会话解析成功',
    };

    if (result.sessionKey) {
      response.sessionKey = result.sessionKey;
      response.canUseSessionSend = true;
      response.usage = `可以使用 sessions_send 工具发送消息，sessionKey: "${result.sessionKey}"`;
    }

    if (result.userId) {
      response.userId = result.userId;
      response.canUseDirectSend = true;
      if (!result.sessionKey) {
        response.usage = `用户存在但无活跃会话，可以使用 oingai_wecom_send 工具直接发送消息`;
      }
    }

    if (result.userName) {
      response.userName = result.userName;
    }

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Session resolve tool execution failed', { error: errorMessage });

    return {
      success: false,
      error: `解析会话时发生错误: ${errorMessage}`,
    };
  }
}

/**
 * 执行会话列表工具
 */
export async function executeSessionListTool(
  params: { includeUserInfo?: boolean },
  _context: ToolContext
): Promise<ToolResult> {
  try {
    logger.info('Executing session list tool', { includeUserInfo: params.includeUserInfo });

    const agentApi = getAgentApiService();
    const sessions = await agentApi.listSessions();

    if (sessions.length === 0) {
      return {
        success: true,
        data: {
          message: '当前没有活跃的企业微信会话',
          sessions: [],
        },
      };
    }

    const formattedSessions = sessions.map((s) => {
      const info: Record<string, unknown> = {
        sessionKey: s.sessionKey,
        label: s.label,
      };

      if (params.includeUserInfo) {
        info.userId = s.origin?.userId || s.userId || extractUserIdFromSessionKey(s.sessionKey);
        info.userName = s.origin?.userName || s.userName || s.label;
        info.origin = s.origin;
      }

      return info;
    });

    return {
      success: true,
      data: {
        message: `找到 ${sessions.length} 个会话`,
        sessions: formattedSessions,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Session list tool execution failed', { error: errorMessage });

    return {
      success: false,
      error: `获取会话列表时发生错误: ${errorMessage}`,
    };
  }
}

/**
 * 完整的工具导出
 */
export const sessionTools = {
  resolve: {
    definition: sessionResolveToolDefinition,
    execute: executeSessionResolveTool,
  },
  list: {
    definition: sessionListToolDefinition,
    execute: executeSessionListTool,
  },
};