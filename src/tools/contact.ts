/**
 * OingAI WeCom Plugin - 通讯录工具
 *
 * 提供 oingai_wecom_contact_search 工具，支持搜索企业通讯录
 */

import type { ToolDefinition, ToolContext, ToolResult } from 'openclaw';
import type { ContactSearchParams, WeComUser, WeComDepartment } from '../types';
import { getAgentApiService } from '../services/agent-api';
import { logger } from '../utils/logger';
import { getCache, setCache } from '../utils/cache';

// 缓存 key 前缀
const CACHE_KEY_PREFIX = 'contact:';

/**
 * 通讯录搜索工具定义
 */
export const contactSearchToolDefinition: ToolDefinition = {
  name: 'oingai_wecom_contact_search',
  description: '搜索企业微信通讯录。支持按姓名、手机号、邮箱进行模糊搜索，返回匹配的用户列表。',
  parameters: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '搜索关键词：姓名、手机号或邮箱',
      },
      departmentId: {
        type: 'string',
        description: '可选的部门ID，限定搜索范围',
      },
    },
    required: ['keyword'],
  },
};

/**
 * 获取部门列表工具定义
 */
export const departmentListToolDefinition: ToolDefinition = {
  name: 'oingai_wecom_department_list',
  description: '获取企业微信部门列表。',
  parameters: {
    type: 'object',
    properties: {
      departmentId: {
        type: 'string',
        description: '可选的父部门ID，不传则获取根部门列表',
      },
    },
    required: [],
  },
};

/**
 * 获取用户详情工具定义
 */
export const getUserToolDefinition: ToolDefinition = {
  name: 'oingai_wecom_contact_get',
  description: '获取企业微信用户的详细信息。',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: '用户ID',
      },
    },
    required: ['userId'],
  },
};

/**
 * 格式化用户信息
 */
function formatUserInfo(user: WeComUser): string {
  const parts = [
    `用户ID: ${user.userid}`,
    `姓名: ${user.name}`,
  ];

  if (user.mobile) {
    parts.push(`手机: ${user.mobile}`);
  }

  if (user.email) {
    parts.push(`邮箱: ${user.email}`);
  }

  if (user.position) {
    parts.push(`职位: ${user.position}`);
  }

  if (user.department && user.department.length > 0) {
    parts.push(`部门ID: ${user.department.join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * 搜索用户
 */
async function searchUsers(keyword: string, departmentId?: string): Promise<WeComUser[]> {
  // 检查缓存
  const cacheKey = `${CACHE_KEY_PREFIX}search:${keyword}:${departmentId || 'all'}`;
  const cached = getCache<WeComUser[]>(cacheKey);
  if (cached) {
    logger.debug('Search results from cache', { keyword });
    return cached;
  }

  // 调用 API 搜索
  const agentApi = getAgentApiService();
  const users = await agentApi.searchUsers(keyword, departmentId);

  // 缓存结果（较短 TTL）
  setCache(cacheKey, users, 60 * 1000); // 1分钟缓存

  return users;
}

/**
 * 执行通讯录搜索工具
 */
export async function executeContactSearchTool(
  params: ContactSearchParams,
  _context: ToolContext
): Promise<ToolResult> {
  try {
    logger.info('Executing contact search tool', { keyword: params.keyword });

    // 参数验证
    if (!params.keyword || typeof params.keyword !== 'string') {
      return {
        success: false,
        error: '参数 "keyword" 必须是非空字符串',
      };
    }

    // 搜索用户
    const users = await searchUsers(params.keyword, params.departmentId);

    if (users.length === 0) {
      return {
        success: true,
        data: {
          message: `未找到匹配 "${params.keyword}" 的用户`,
          users: [],
        },
      };
    }

    // 格式化结果
    const formattedUsers = users.map((user) => ({
      userId: user.userid,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      position: user.position,
    }));

    return {
      success: true,
      data: {
        message: `找到 ${users.length} 个匹配的用户`,
        users: formattedUsers,
        details: users.map(formatUserInfo).join('\n\n---\n\n'),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Contact search tool execution failed', { error: errorMessage });

    return {
      success: false,
      error: `搜索通讯录时发生错误: ${errorMessage}`,
    };
  }
}

/**
 * 执行获取用户详情工具
 */
export async function executeGetUserTool(
  params: { userId: string },
  _context: ToolContext
): Promise<ToolResult> {
  try {
    logger.info('Executing get user tool', { userId: params.userId });

    if (!params.userId) {
      return {
        success: false,
        error: '参数 "userId" 不能为空',
      };
    }

    const agentApi = getAgentApiService();
    const user = await agentApi.getUser(params.userId);

    if (!user) {
      return {
        success: false,
        error: `未找到用户: ${params.userId}`,
      };
    }

    return {
      success: true,
      data: {
        user: {
          userId: user.userid,
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          position: user.position,
          department: user.department,
          avatar: user.avatar,
        },
        formatted: formatUserInfo(user),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Get user tool execution failed', { error: errorMessage });

    return {
      success: false,
      error: `获取用户信息时发生错误: ${errorMessage}`,
    };
  }
}

/**
 * 执行获取部门列表工具
 */
export async function executeDepartmentListTool(
  params: { departmentId?: string },
  _context: ToolContext
): Promise<ToolResult> {
  try {
    logger.info('Executing department list tool', { departmentId: params.departmentId });

    const agentApi = getAgentApiService();
    const departments = await agentApi.listDepartments(params.departmentId);

    if (departments.length === 0) {
      return {
        success: true,
        data: {
          message: '未找到部门',
          departments: [],
        },
      };
    }

    return {
      success: true,
      data: {
        message: `找到 ${departments.length} 个部门`,
        departments: departments.map((dept) => ({
          id: dept.id,
          name: dept.name,
        })),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Department list tool execution failed', { error: errorMessage });

    return {
      success: false,
      error: `获取部门列表时发生错误: ${errorMessage}`,
    };
  }
}

/**
 * 完整的工具导出
 */
export const contactTools = {
  search: {
    definition: contactSearchToolDefinition,
    execute: executeContactSearchTool,
  },
  getUser: {
    definition: getUserToolDefinition,
    execute: executeGetUserTool,
  },
  listDepartments: {
    definition: departmentListToolDefinition,
    execute: executeDepartmentListTool,
  },
};