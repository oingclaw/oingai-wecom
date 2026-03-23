/**
 * OingAI WeCom Plugin - Type Definitions
 */

// ==================== 用户相关类型 ====================

export interface WeComUser {
  userid: string;
  name: string;
  mobile?: string;
  email?: string;
  department?: number[];
  position?: string;
  avatar?: string;
  status?: number;
  enable?: number;
}

export interface WeComDepartment {
  id: number;
  name: string;
  parentid?: number;
  order?: number;
}

// ==================== 消息相关类型 ====================

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  channel?: 'bot-ws' | 'agent-api';
}

export interface SendMessageOptions {
  to: string;
  message: string;
  accountId?: string;
}

// ==================== 会话相关类型 ====================

export interface WeComSession {
  sessionKey: string;
  label: string | null;
  userId?: string;
  userName?: string;
  origin?: {
    label?: string | null;
    userId?: string;
    userName?: string;
  };
}

export interface ResolveSessionResult {
  success: boolean;
  sessionKey?: string;
  userId?: string;
  userName?: string;
  error?: string;
}

// ==================== Agent API 类型 ====================

export interface AgentApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

export interface AgentApiConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

// ==================== MCP 相关类型 ====================

export interface McpContactResponse {
  users: WeComUser[];
  total: number;
}

export interface McpConfig {
  profile?: string;
  enabled: boolean;
}

// ==================== 插件配置类型 ====================

export interface PluginConfig {
  agentApiUrl: string;
  agentApiKey?: string;
  botWsUrl?: string;
  mcpProfile?: string;
}

// ==================== 工具参数类型 ====================

export interface SendToolParams {
  to: string;
  message: string;
  accountId?: string;
}

export interface ContactSearchParams {
  keyword: string;
  departmentId?: string;
}

export interface SessionResolveParams {
  userIdentifier: string;
}

// ==================== 缓存类型 ====================

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}