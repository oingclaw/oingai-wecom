/**
 * OingAI WeCom Plugin - Cache Utilities
 */

import type { CacheEntry } from '../types';

// 内存缓存存储
const cache = new Map<string, CacheEntry<unknown>>();

// 默认 TTL：5分钟
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * 设置缓存
 */
export function setCache<T>(key: string, value: T, ttl: number = DEFAULT_TTL): void {
  cache.set(key, {
    value,
    timestamp: Date.now(),
    ttl,
  });
}

/**
 * 获取缓存
 */
export function getCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    return null;
  }

  // 检查是否过期
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * 删除缓存
 */
export function deleteCache(key: string): boolean {
  return cache.delete(key);
}

/**
 * 清空所有缓存
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * 生成用户缓存 key
 */
export function userCacheKey(identifier: string): string {
  return `user:${identifier}`;
}

/**
 * 生成会话缓存 key
 */
export function sessionCacheKey(identifier: string): string {
  return `session:${identifier}`;
}