/**
 * OingAI WeCom Plugin - Agent API Service
 *
 * 提供与 OpenClaw Agent API 的交互能力
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AgentApiConfig,
  AgentApiResponse,
  WeComUser,
  WeComSession,
  SendMessageResult,
  SendMessageOptions,
} from '../types';
import { getConfig } from '../utils/config';
import { logger } from '../utils/logger';

// API 端点
const API_ENDPOINTS = {
  // 消息发送
  SEND_MESSAGE: '/api/wecom/send',
  SEND_MESSAGE_TO_USER: '/api/wecom/user/:userId/send',

  // 通讯录
  GET_USER: '/api/wecom/user/:userId',
  SEARCH_USERS: '/api/wecom/users/search',
  LIST_DEPARTMENTS: '/api/wecom/departments',

  // 会话
  LIST_SESSIONS: '/api/wecom/sessions',
  RESOLVE_SESSION: '/api/wecom/session/resolve',
  GET_SESSION_BY_USER: '/api/wecom/session/by-user/:userId',

  // MCP 代理
  MCP_CALL: '/api/mcp/call',
};

/**
 * Agent API 服务类
 */
export class AgentApiService {
  private client: AxiosInstance;
  private config: AgentApiConfig;

  constructor(config?: Partial<AgentApiConfig>) {
    const pluginConfig = getConfig();

    this.config = {
      baseUrl: config?.baseUrl || pluginConfig.agentApiUrl || 'http://localhost:3000',
      apiKey: config?.apiKey || pluginConfig.agentApiKey,
      timeout: config?.timeout || 30000,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey }),
      },
    });

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.error('Agent API request failed', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });
        throw error;
      }
    );
  }

  // ==================== 消息发送 ====================

  /**
   * 发送消息给用户
   */
  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    try {
      // 先尝试直接通过用户 ID 发送
      const response = await this.client.post<AgentApiResponse<{ messageId: string }>>(
        API_ENDPOINTS.SEND_MESSAGE,
        {
          to: options.to,
          message: options.message,
          accountId: options.accountId,
        }
      );

      if (response.data.code === 0 && response.data.data) {
        return {
          success: true,
          messageId: response.data.data.messageId,
          channel: 'agent-api',
        };
      }

      return {
        success: false,
        error: response.data.message || '发送失败',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send message via Agent API', { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 发送消息给指定用户ID
   */
  async sendMessageToUser(userId: string, message: string): Promise<SendMessageResult> {
    try {
      const endpoint = API_ENDPOINTS.SEND_MESSAGE_TO_USER.replace(':userId', userId);
      const response = await this.client.post<AgentApiResponse<{ messageId: string }>>(endpoint, {
        message,
      });

      if (response.data.code === 0 && response.data.data) {
        return {
          success: true,
          messageId: response.data.data.messageId,
          channel: 'agent-api',
        };
      }

      return {
        success: false,
        error: response.data.message || '发送失败',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send message to user', { userId, error: errorMessage });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // ==================== 通讯录 ====================

  /**
   * 获取用户信息
   */
  async getUser(userId: string): Promise<WeComUser | null> {
    try {
      const endpoint = API_ENDPOINTS.GET_USER.replace(':userId', userId);
      const response = await this.client.get<AgentApiResponse<WeComUser>>(endpoint);

      if (response.data.code === 0 && response.data.data) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get user', { userId, error });
      return null;
    }
  }

  /**
   * 搜索用户
   */
  async searchUsers(keyword: string, departmentId?: string): Promise<WeComUser[]> {
    try {
      const response = await this.client.get<AgentApiResponse<WeComUser[]>>(
        API_ENDPOINTS.SEARCH_USERS,
        {
          params: {
            keyword,
            departmentId,
          },
        }
      );

      if (response.data.code === 0 && response.data.data) {
        return response.data.data;
      }

      return [];
    } catch (error) {
      logger.error('Failed to search users', { keyword, error });
      return [];
    }
  }

  /**
   * 获取部门列表
   */
  async listDepartments(parentId?: string): Promise<{ id: number; name: string }[]> {
    try {
      const response = await this.client.get<AgentApiResponse<{ id: number; name: string }[]>>(
        API_ENDPOINTS.LIST_DEPARTMENTS,
        {
          params: { parentId },
        }
      );

      if (response.data.code === 0 && response.data.data) {
        return response.data.data;
      }

      return [];
    } catch (error) {
      logger.error('Failed to list departments', { error });
      return [];
    }
  }

  // ==================== 会话管理 ====================

  /**
   * 获取所有会话
   */
  async listSessions(): Promise<WeComSession[]> {
    try {
      const response = await this.client.get<AgentApiResponse<WeComSession[]>>(
        API_ENDPOINTS.LIST_SESSIONS
      );

      if (response.data.code === 0 && response.data.data) {
        return response.data.data;
      }

      return [];
    } catch (error) {
      logger.error('Failed to list sessions', { error });
      return [];
    }
  }

  /**
   * 解析会话（通过用户标识）
   */
  async resolveSession(userIdentifier: string): Promise<WeComSession | null> {
    try {
      const response = await this.client.post<AgentApiResponse<WeComSession>>(
        API_ENDPOINTS.RESOLVE_SESSION,
        {
          userIdentifier,
        }
      );

      if (response.data.code === 0 && response.data.data) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      logger.error('Failed to resolve session', { userIdentifier, error });
      return null;
    }
  }

  /**
   * 通过用户ID获取会话
   */
  async getSessionByUserId(userId: string): Promise<WeComSession | null> {
    try {
      const endpoint = API_ENDPOINTS.GET_SESSION_BY_USER.replace(':userId', userId);
      const response = await this.client.get<AgentApiResponse<WeComSession>>(endpoint);

      if (response.data.code === 0 && response.data.data) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get session by user ID', { userId, error });
      return null;
    }
  }

  // ==================== MCP 代理 ====================

  /**
   * 调用 MCP 工具
   */
  async callMcpTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      const response = await this.client.post<AgentApiResponse<unknown>>(API_ENDPOINTS.MCP_CALL, {
        tool: toolName,
        args,
        profile: getConfig().mcpProfile,
      });

      if (response.data.code === 0) {
        return response.data.data;
      }

      throw new Error(response.data.message || 'MCP call failed');
    } catch (error) {
      logger.error('Failed to call MCP tool', { toolName, error });
      throw error;
    }
  }

  /**
   * 检查 API 连接状态
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

// 导出单例
let instance: AgentApiService | null = null;

export function getAgentApiService(): AgentApiService {
  if (!instance) {
    instance = new AgentApiService();
  }
  return instance;
}

export function resetAgentApiService(): void {
  instance = null;
}