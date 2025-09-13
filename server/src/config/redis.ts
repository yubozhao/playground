import Redis from 'redis'
import { logger } from '../utils/logger'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Create Redis client
export const redis = Redis.createClient({
  url: REDIS_URL,
  retryDelayOnFailover: 100,
  enableAutoPipelining: true,
  maxRetriesPerRequest: 3,
  retryDelayOnClusterDown: 300,
  maxRetriesPerRequest: null,
  lazyConnect: true,
})

// Error handling
redis.on('error', (err) => {
  logger.error('Redis Client Error:', err)
})

redis.on('connect', () => {
  logger.info('Redis client connected')
})

redis.on('ready', () => {
  logger.info('Redis client ready')
})

redis.on('end', () => {
  logger.info('Redis client disconnected')
})

redis.on('reconnecting', () => {
  logger.info('Redis client reconnecting')
})

// Connect to Redis
export const connectRedis = async (): Promise<void> => {
  try {
    await redis.connect()
    await redis.ping()
    logger.info('Redis connected successfully')
  } catch (error) {
    logger.error('Redis connection failed:', error)
    throw error
  }
}

// Cache helper functions with proper error handling
export const cacheHelpers = {
  // Set value with expiration
  set: async (key: string, value: any, expireInSeconds?: number): Promise<void> => {
    try {
      const serializedValue = JSON.stringify(value)
      if (expireInSeconds) {
        await redis.setEx(key, expireInSeconds, serializedValue)
      } else {
        await redis.set(key, serializedValue)
      }
    } catch (error) {
      logger.error('Redis SET error:', { key, error })
      throw error
    }
  },

  // Get value and parse JSON
  get: async <T = any>(key: string): Promise<T | null> => {
    try {
      const value = await redis.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      logger.error('Redis GET error:', { key, error })
      return null // Return null instead of throwing to allow fallback
    }
  },

  // Delete key
  del: async (key: string): Promise<void> => {
    try {
      await redis.del(key)
    } catch (error) {
      logger.error('Redis DEL error:', { key, error })
      throw error
    }
  },

  // Check if key exists
  exists: async (key: string): Promise<boolean> => {
    try {
      const result = await redis.exists(key)
      return result === 1
    } catch (error) {
      logger.error('Redis EXISTS error:', { key, error })
      return false
    }
  },

  // Set multiple keys
  mset: async (keyValuePairs: Record<string, any>): Promise<void> => {
    try {
      const serializedPairs: Record<string, string> = {}
      for (const [key, value] of Object.entries(keyValuePairs)) {
        serializedPairs[key] = JSON.stringify(value)
      }
      await redis.mSet(serializedPairs)
    } catch (error) {
      logger.error('Redis MSET error:', error)
      throw error
    }
  },

  // Get multiple keys
  mget: async <T = any>(keys: string[]): Promise<(T | null)[]> => {
    try {
      const values = await redis.mGet(keys)
      return values.map(value => value ? JSON.parse(value) : null)
    } catch (error) {
      logger.error('Redis MGET error:', { keys, error })
      return keys.map(() => null)
    }
  },

  // Increment key
  incr: async (key: string): Promise<number> => {
    try {
      return await redis.incr(key)
    } catch (error) {
      logger.error('Redis INCR error:', { key, error })
      throw error
    }
  },

  // Set expiration on existing key
  expire: async (key: string, seconds: number): Promise<boolean> => {
    try {
      const result = await redis.expire(key, seconds)
      return result === 1
    } catch (error) {
      logger.error('Redis EXPIRE error:', { key, seconds, error })
      return false
    }
  },

  // Get keys matching pattern
  keys: async (pattern: string): Promise<string[]> => {
    try {
      return await redis.keys(pattern)
    } catch (error) {
      logger.error('Redis KEYS error:', { pattern, error })
      return []
    }
  },

  // Hash operations
  hash: {
    set: async (key: string, field: string, value: any): Promise<void> => {
      try {
        await redis.hSet(key, field, JSON.stringify(value))
      } catch (error) {
        logger.error('Redis HSET error:', { key, field, error })
        throw error
      }
    },

    get: async <T = any>(key: string, field: string): Promise<T | null> => {
      try {
        const value = await redis.hGet(key, field)
        return value ? JSON.parse(value) : null
      } catch (error) {
        logger.error('Redis HGET error:', { key, field, error })
        return null
      }
    },

    getAll: async <T = any>(key: string): Promise<Record<string, T>> => {
      try {
        const hash = await redis.hGetAll(key)
        const result: Record<string, T> = {}
        for (const [field, value] of Object.entries(hash)) {
          result[field] = JSON.parse(value)
        }
        return result
      } catch (error) {
        logger.error('Redis HGETALL error:', { key, error })
        return {}
      }
    },

    del: async (key: string, field: string): Promise<void> => {
      try {
        await redis.hDel(key, field)
      } catch (error) {
        logger.error('Redis HDEL error:', { key, field, error })
        throw error
      }
    },
  },

  // List operations
  list: {
    push: async (key: string, value: any): Promise<number> => {
      try {
        return await redis.lPush(key, JSON.stringify(value))
      } catch (error) {
        logger.error('Redis LPUSH error:', { key, error })
        throw error
      }
    },

    pop: async <T = any>(key: string): Promise<T | null> => {
      try {
        const value = await redis.lPop(key)
        return value ? JSON.parse(value) : null
      } catch (error) {
        logger.error('Redis LPOP error:', { key, error })
        return null
      }
    },

    length: async (key: string): Promise<number> => {
      try {
        return await redis.lLen(key)
      } catch (error) {
        logger.error('Redis LLEN error:', { key, error })
        return 0
      }
    },

    range: async <T = any>(key: string, start: number, stop: number): Promise<T[]> => {
      try {
        const values = await redis.lRange(key, start, stop)
        return values.map(value => JSON.parse(value))
      } catch (error) {
        logger.error('Redis LRANGE error:', { key, start, stop, error })
        return []
      }
    },
  },
}

// Stock-specific cache keys
export const cacheKeys = {
  stockPrice: (ticker: string) => `stock:price:${ticker}`,
  stockSearch: (query: string) => `stock:search:${query}`,
  stockHistory: (ticker: string, timeframe: string) => `stock:history:${ticker}:${timeframe}`,
  news: (ticker: string) => `news:${ticker}`,
  social: (ticker: string) => `social:${ticker}`,
  userWatchlists: (userId: string) => `user:watchlists:${userId}`,
  userAlerts: (userId: string) => `user:alerts:${userId}`,
  marketStatus: () => 'market:status',
  rateLimitUser: (userId: string) => `ratelimit:user:${userId}`,
  rateLimitIP: (ip: string) => `ratelimit:ip:${ip}`,
}

// Cache TTL constants (in seconds)
export const cacheTTL = {
  stockPrice: 30, // 30 seconds for real-time prices
  stockSearch: 600, // 10 minutes for search results
  stockHistoryIntraday: 3600, // 1 hour for intraday data
  stockHistoryDaily: 86400, // 24 hours for daily data
  news: 3600, // 1 hour for news
  social: 1800, // 30 minutes for social media
  userWatchlists: 300, // 5 minutes for user watchlists
  userAlerts: 300, // 5 minutes for user alerts
  marketStatus: 60, // 1 minute for market status
}

// Health check for Redis
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const result = await redis.ping()
    return result === 'PONG'
  } catch (error) {
    logger.error('Redis health check failed:', error)
    return false
  }
}

// Close Redis connection gracefully
export const closeRedisConnection = async (): Promise<void> => {
  try {
    await redis.quit()
    logger.info('Redis connection closed successfully')
  } catch (error) {
    logger.error('Error closing Redis connection:', error)
    throw error
  }
}

export default redis