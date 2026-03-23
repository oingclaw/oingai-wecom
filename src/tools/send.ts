/**
 * OingAI WeCom Plugin - 消息发送工具
 *
 * 提供 oingai_wecom_send 工具，支持通过用户ID、姓名或手机号发送消息
 */

import type { ToolDefinition, ToolContext, ToolResult } from 'openclaw';
import type { SendToolParams, SendMessageResult, WeComUser } from '../types';
import { getAgentApiService } from '../services/agent-api';
import { logger } from '../utils/logger';
import { getCache, setCache, userCacheKey } from '../utils/cache';

/**
 * 用户匹配策略
 */
enum MatchStrategy {
  EXACT_ID = 'exact_id',       // 精确匹配用户ID
  EXACT_MOBILE = 'exact_mobile', // 精确匹配手机号
  FUZZY_NAME = 'fuzzy_name',   // 模糊匹配姓名
}

/**
 * 匹配结果
 */
interface MatchResult {
  userId: string;
  strategy: MatchStrategy;
  confidence: number;
}

/**
 * 发送消息工具定义
 */
export const sendToolDefinition: ToolDefinition = {
  name: 'oingai_wecom_send',
  description: '发送企业微信消息给指定用户。支持通过用户ID、姓名或手机号匹配用户，自动选择最佳发送通道（Bot WS 或 Agent API）。',
  parameters: {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        description: '接收消息的用户标识：用户ID（如 \'jin\', \'vivi\'）、姓名或手机号',
      },
      message: {
        type: 'string',
        description: '要发送的消息内容',
      },
      accountId: {
        type: 'string',
        description: '可选的企业微信账号ID，用于多账号场景',
      },
    },
    required: ['to', 'message'],
  },
};

/**
 * 查找用户
 */
async function findUser(identifier: string): Promise<MatchResult | null> {
  const agentApi = getAgentApiService();

  // 1. 检查缓存
  const cached = getCache<MatchResult>(userCacheKey(identifier));
  if (cached) {
    logger.debug('User found in cache', { identifier, userId: cached.userId });
    return cached;
  }

  // 2. 尝试精确匹配用户ID
  const userById = await agentApi.getUser(identifier);
  if (userById) {
    const result: MatchResult = {
      userId: userById.userid,
      strategy: MatchStrategy.EXACT_ID,
      confidence: 1.0,
    };
    setCache(userCacheKey(identifier), result);
    logger.info('User matched by ID', { identifier, userId: userById.userid });
    return result;
  }

  // 3. 搜索用户（姓名或手机号）
  const searchResults = await agentApi.searchUsers(identifier);
  if (searchResults.length === 0) {
    logger.warn('No user found', { identifier });
    return null;
  }

  // 4. 选择最佳匹配
  // 优先精确匹配手机号，然后按姓名匹配
  const exactMobileMatch = searchResults.find(
    (u) => u.mobile && u.mobile.replace(/\D/g, '') === identifier.replace(/\D/g, '')
  );

  if (exactMobileMatch) {
    const result: MatchResult = {
      userId: exactMobileMatch.userid,
      strategy: MatchStrategy.EXACT_MOBILE,
      confidence: 1.0,
    };
    setCache(userCacheKey(identifier), result);
    logger.info('User matched by mobile', { identifier, userId: exactMobileMatch.userid });
    return result;
  }

  // 5. 姓名模糊匹配 - 选择第一个结果
  const firstMatch = searchResults[0];
  const result: MatchResult = {
    userId: firstMatch.userid,
    strategy: MatchStrategy.FUZZY_NAME,
    confidence: searchResults.length === 1 ? 0.9 : 0.7, // 唯一匹配时置信度更高
  };

  setCache(userCacheKey(identifier), result);
  logger.info('User matched by name', {
    identifier,
    userId: firstMatch.userid,
    matchCount: searchResults.length,
  });

  return result;
}

/**
 * 发送消息核心逻辑
 */
async function sendMessageCore(params: SendToolParams): Promise<SendMessageResult> {
  const { to, message, accountId } = params;
  const agentApi = getAgentApiService();

  // 1. 查找用户
  const match = await findUser(to);
  if (!match) {
    return {
      success: false,
      error: `未找到用户: ${to}`,
    };
  }

  // 2. 发送消息
  const result = await agentApi.sendMessage({
    to: match.userId,
    message,
    accountId,
  });

  if (result.success) {
    logger.info('Message sent successfully', {
      to: match.userId,
      strategy: match.strategy,
      messageId: result.messageId,
    });
  }

  return result;
}

/**
 * 发送消息工具执行函数
 */
export async function executeSendTool(
  params: SendToolParams,
  _context: ToolContext
): Promise<ToolResult> {
  try {
    logger.info('Executing send tool', { to: params.to });

    // 参数验证
    if (!params.to || typeof params.to !== 'string') {
      return {
        success: false,
        error: '参数 "to" 必须是非空字符串',
      };
    }

    if (!params.message || typeof params.message !== 'string') {
      return {
        success: false,
        error: '参数 "message" 必须是非空字符串',
      };
    }

    // 发送消息
    const result = await sendMessageCore(params);

    if (result.success) {
      return {
        success: true,
        data: {
          messageId: result.messageId,
          channel: result.channel,
          message: `消息已成功发送给用户 ${params.to}`,
        },
      };
    }

    return {
      success: false,
      error: result.error || '消息发送失败',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Send tool execution failed', { error: errorMessage });

    return {
      success: false,
      error: `发送消息时发生错误: ${errorMessage}`,
    };
  }
}

/**
 * 完整的工具导出
 */
export const sendTool = {
  definition: sendToolDefinition,
  execute: executeSendTool,
};