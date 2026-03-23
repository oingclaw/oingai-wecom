declare module 'openclaw' {
  export interface Plugin {
    name: string;
    version: string;
    description?: string;
    author?: string;
    initialize?: (config?: Record<string, unknown>) => void;
    cleanup?: () => void;
    getTools?: () => ToolDefinition[];
    executeTool?: (toolName: string, params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
  }

  export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, {
        type: string;
        description?: string;
      }>;
      required?: string[];
    };
  }

  export interface ToolContext {
    sessionId?: string;
    userId?: string;
    accountId?: string;
    channel?: string;
    [key: string]: unknown;
  }

  export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
  }

  // 工具执行器类型 - 使用宽松的参数类型
  export type ToolExecutor = (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;

  export function createPlugin(config?: Record<string, unknown>): Plugin;
}