/**
 * OingAI WeCom Plugin - Configuration Utilities
 */

import type { PluginConfig } from '../types';

// 默认配置
const DEFAULT_CONFIG: PluginConfig = {
  agentApiUrl: process.env.OPENCLAW_AGENT_API_URL || 'http://localhost:3000',
  agentApiKey: process.env.OPENCLAW_AGENT_API_KEY,
  botWsUrl: process.env.OPENCLAW_BOT_WS_URL,
  mcpProfile: process.env.OPENCLAW_MCP_PROFILE || 'wecom',
};

// 全局配置实例
let config: PluginConfig = { ...DEFAULT_CONFIG };

/**
 * 获取当前配置
 */
export function getConfig(): PluginConfig {
  return { ...config };
}

/**
 * 更新配置
 */
export function updateConfig(newConfig: Partial<PluginConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * 初始化配置（从插件配置加载）
 */
export function initConfig(pluginConfig?: Record<string, unknown>): void {
  if (pluginConfig) {
    config = {
      agentApiUrl: (pluginConfig.agentApiUrl as string) || DEFAULT_CONFIG.agentApiUrl,
      agentApiKey: (pluginConfig.agentApiKey as string) || DEFAULT_CONFIG.agentApiKey,
      botWsUrl: (pluginConfig.botWsUrl as string) || DEFAULT_CONFIG.botWsUrl,
      mcpProfile: (pluginConfig.mcpProfile as string) || DEFAULT_CONFIG.mcpProfile,
    };
  }
}