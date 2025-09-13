import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AuthenticationError, AuthorizationError } from './errorHandler'
import { query } from '../config/database'
import { cacheHelpers, cacheKeys } from '../config/redis'
import { logger } from '../utils/logger'

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        notificationPreferences: Record<string, boolean>
      }
    }
  }
}

interface JWTPayload {
  id: string
  email: string
  iat?: number
  exp?: number
}

const JWT_SECRET = process.env.JWT_SECRET
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT secrets are required in environment variables')
}

// Generate access token
export const generateAccessToken = (payload: { id: string; email: string }): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    issuer: 'stock-dashboard',
    audience: 'stock-dashboard-users',
  })
}

// Generate refresh token
export const generateRefreshToken = (payload: { id: string; email: string }): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: 'stock-dashboard',
    audience: 'stock-dashboard-users',
  })
}

// Verify access token
export const verifyAccessToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'stock-dashboard',
      audience: 'stock-dashboard-users',
    }) as JWTPayload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Access token expired')
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid access token')
    }
    throw new AuthenticationError('Token verification failed')
  }
}

// Verify refresh token
export const verifyRefreshToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'stock-dashboard',
      audience: 'stock-dashboard-users',
    }) as JWTPayload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Refresh token expired')
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid refresh token')
    }
    throw new AuthenticationError('Token verification failed')
  }
}

// Extract token from request
const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  return null
}

// Get user from database with caching
const getUserById = async (id: string): Promise<any> => {
  const cacheKey = `user:${id}`
  
  try {
    // Try to get from cache first
    const cachedUser = await cacheHelpers.get(cacheKey)
    if (cachedUser) {
      return cachedUser
    }
    
    // Get from database
    const result = await query(
      'SELECT id, email, notification_preferences FROM users WHERE id = $1',
      [id]
    )
    
    if (result.rows.length === 0) {
      return null
    }
    
    const user = {
      id: result.rows[0].id,
      email: result.rows[0].email,
      notificationPreferences: result.rows[0].notification_preferences || {},
    }
    
    // Cache for 5 minutes
    await cacheHelpers.set(cacheKey, user, 300)
    
    return user
  } catch (error) {
    logger.error('Error fetching user:', error)
    
    // Try to get from database without cache on Redis error
    try {
      const result = await query(
        'SELECT id, email, notification_preferences FROM users WHERE id = $1',
        [id]
      )
      
      if (result.rows.length === 0) {
        return null
      }
      
      return {
        id: result.rows[0].id,
        email: result.rows[0].email,
        notificationPreferences: result.rows[0].notification_preferences || {},
      }
    } catch (dbError) {
      logger.error('Error fetching user from database:', dbError)
      throw new AuthenticationError('Failed to verify user')
    }
  }
}

// Authentication middleware
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req)
    
    if (!token) {
      throw new AuthenticationError('Access token required')
    }
    
    // Verify token
    const decoded = verifyAccessToken(token)
    
    // Get user data
    const user = await getUserById(decoded.id)
    
    if (!user) {
      throw new AuthenticationError('User not found')
    }
    
    // Add user to request object
    req.user = user
    
    next()
  } catch (error) {
    next(error)
  }
}

// Optional authentication middleware (for public endpoints that can benefit from user context)
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req)
    
    if (token) {
      try {
        const decoded = verifyAccessToken(token)
        const user = await getUserById(decoded.id)
        
        if (user) {
          req.user = user
        }
      } catch (error) {
        // Silently fail for optional auth
        logger.debug('Optional authentication failed:', error)
      }
    }
    
    next()
  } catch (error) {
    next(error)
  }
}

// Authorization middleware factory
export const authorize = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required')
    }
    
    // For now, all authenticated users have access
    // In the future, you could check user roles/permissions here
    const userPermissions = ['read', 'write'] // Default permissions for authenticated users
    
    const hasPermission = permissions.every(permission => 
      userPermissions.includes(permission)
    )
    
    if (!hasPermission) {
      throw new AuthorizationError('Insufficient permissions')
    }
    
    next()
  }
}

// Rate limiting by user
export const userRateLimit = (maxRequests: number, windowMinutes: number) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next()
      }
      
      const key = cacheKeys.rateLimitUser(req.user.id)
      const windowSeconds = windowMinutes * 60
      
      // Get current request count
      const current = await cacheHelpers.get<number>(key) || 0
      
      if (current >= maxRequests) {
        throw new AuthenticationError('User rate limit exceeded')
      }
      
      // Increment request count
      if (current === 0) {
        await cacheHelpers.set(key, 1, windowSeconds)
      } else {
        await cacheHelpers.incr(key)
      }
      
      // Set headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - current - 1).toString(),
        'X-RateLimit-Reset': new Date(Date.now() + windowSeconds * 1000).toISOString(),
      })
      
      next()
    } catch (error) {
      next(error)
    }
  }
}

// Check if token is blacklisted (for logout functionality)
export const checkTokenBlacklist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req)
    
    if (token) {
      const blacklistKey = `blacklist:${token}`
      const isBlacklisted = await cacheHelpers.exists(blacklistKey)
      
      if (isBlacklisted) {
        throw new AuthenticationError('Token has been revoked')
      }
    }
    
    next()
  } catch (error) {
    next(error)
  }
}

// Blacklist token (for logout)
export const blacklistToken = async (token: string): Promise<void> => {
  try {
    // Decode to get expiration
    const decoded = jwt.decode(token) as JWTPayload
    
    if (decoded && decoded.exp) {
      const expiration = decoded.exp * 1000 - Date.now()
      
      if (expiration > 0) {
        const blacklistKey = `blacklist:${token}`
        await cacheHelpers.set(blacklistKey, true, Math.floor(expiration / 1000))
      }
    }
  } catch (error) {
    logger.error('Error blacklisting token:', error)
    // Don't throw error as this is a cleanup operation
  }
}

// Middleware to validate user ownership of resources
export const validateOwnership = (resourceIdParam: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required')
    }
    
    const resourceId = req.params[resourceIdParam]
    const userId = req.user.id
    
    // This would need to be customized based on the resource type
    // For now, we'll skip this validation and handle it in individual routes
    
    next()
  }
}

// Refresh token validation
export const validateRefreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body
    
    if (!refreshToken) {
      throw new AuthenticationError('Refresh token required')
    }
    
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken)
    
    // Get user data
    const user = await getUserById(decoded.id)
    
    if (!user) {
      throw new AuthenticationError('User not found')
    }
    
    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}

export default {
  authenticate,
  optionalAuthenticate,
  authorize,
  userRateLimit,
  checkTokenBlacklist,
  blacklistToken,
  validateOwnership,
  validateRefreshToken,
  generateAccessToken,
  generateRefreshToken,
}