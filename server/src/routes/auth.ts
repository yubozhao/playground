import { Router } from 'express'
import bcrypt from 'bcryptjs'
import Joi from 'joi'
import { query, withTransaction } from '../config/database'
import { 
  generateAccessToken, 
  generateRefreshToken, 
  validateRefreshToken, 
  authenticate,
  blacklistToken 
} from '../middleware/auth'
import { 
  asyncHandler, 
  sendSuccess, 
  ValidationError, 
  AuthenticationError,
  ConflictError 
} from '../middleware/errorHandler'
import { logger } from '../utils/logger'
import { cacheHelpers } from '../config/redis'

const router = Router()

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required().max(255),
  password: Joi.string().min(8).required().max(128),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
})

const loginSchema = Joi.object({
  email: Joi.string().email().required().max(255),
  password: Joi.string().required().max(128),
})

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
})

// Register endpoint
router.post('/register', asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = registerSchema.validate(req.body)
  if (error) {
    throw new ValidationError('Validation failed', error.details)
  }

  const { email, password } = value

  await withTransaction(async (client) => {
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    if (existingUser.rows.length > 0) {
      throw new ConflictError('User with this email already exists')
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12')
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Create user
    const result = await client.query(
      `INSERT INTO users (email, password_hash, notification_preferences) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, notification_preferences, created_at`,
      [email.toLowerCase(), passwordHash, {}]
    )

    const user = result.rows[0]

    // Create default watchlist
    await client.query(
      `INSERT INTO watchlists (user_id, name, category) 
       VALUES ($1, $2, $3)`,
      [user.id, 'My Watchlist', 'default']
    )

    // Generate tokens
    const tokenPayload = { id: user.id, email: user.email }
    const accessToken = generateAccessToken(tokenPayload)
    const refreshToken = generateRefreshToken(tokenPayload)

    logger.info('User registered successfully', {
      userId: user.id,
      email: user.email,
      timestamp: new Date().toISOString(),
    })

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        notificationPreferences: user.notification_preferences,
        createdAt: user.created_at,
      },
      accessToken,
      refreshToken,
    }, 'User registered successfully', 201)
  })
}))

// Login endpoint
router.post('/login', asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = loginSchema.validate(req.body)
  if (error) {
    throw new ValidationError('Validation failed', error.details)
  }

  const { email, password } = value

  // Get user from database
  const result = await query(
    'SELECT id, email, password_hash, notification_preferences FROM users WHERE email = $1',
    [email.toLowerCase()]
  )

  if (result.rows.length === 0) {
    throw new AuthenticationError('Invalid email or password')
  }

  const user = result.rows[0]

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash)
  
  if (!isValidPassword) {
    throw new AuthenticationError('Invalid email or password')
  }

  // Generate tokens
  const tokenPayload = { id: user.id, email: user.email }
  const accessToken = generateAccessToken(tokenPayload)
  const refreshToken = generateRefreshToken(tokenPayload)

  // Clear any cached user data to ensure fresh data on next request
  const userCacheKey = `user:${user.id}`
  await cacheHelpers.del(userCacheKey)

  logger.info('User logged in successfully', {
    userId: user.id,
    email: user.email,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  })

  sendSuccess(res, {
    user: {
      id: user.id,
      email: user.email,
      notificationPreferences: user.notification_preferences,
    },
    accessToken,
    refreshToken,
  }, 'Login successful')
}))

// Refresh token endpoint
router.post('/refresh', validateRefreshToken, asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AuthenticationError('Invalid refresh token')
  }

  // Generate new tokens
  const tokenPayload = { id: req.user.id, email: req.user.email }
  const accessToken = generateAccessToken(tokenPayload)
  const refreshToken = generateRefreshToken(tokenPayload)

  logger.info('Tokens refreshed successfully', {
    userId: req.user.id,
    timestamp: new Date().toISOString(),
  })

  sendSuccess(res, {
    accessToken,
    refreshToken,
  }, 'Tokens refreshed successfully')
}))

// Logout endpoint
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.substring(7)
  
  if (token) {
    // Blacklist the current token
    await blacklistToken(token)
  }

  // Clear user cache
  if (req.user) {
    const userCacheKey = `user:${req.user.id}`
    await cacheHelpers.del(userCacheKey)

    logger.info('User logged out successfully', {
      userId: req.user.id,
      timestamp: new Date().toISOString(),
    })
  }

  sendSuccess(res, null, 'Logout successful')
}))

// Get current user profile
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AuthenticationError('User not found')
  }

  // Get fresh user data from database
  const result = await query(
    `SELECT id, email, notification_preferences, created_at, updated_at 
     FROM users WHERE id = $1`,
    [req.user.id]
  )

  if (result.rows.length === 0) {
    throw new AuthenticationError('User not found')
  }

  const user = result.rows[0]

  sendSuccess(res, {
    id: user.id,
    email: user.email,
    notificationPreferences: user.notification_preferences,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }, 'User profile retrieved successfully')
}))

// Update user profile
router.put('/me', authenticate, asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AuthenticationError('User not found')
  }

  const updateSchema = Joi.object({
    notificationPreferences: Joi.object().optional(),
  })

  const { error, value } = updateSchema.validate(req.body)
  if (error) {
    throw new ValidationError('Validation failed', error.details)
  }

  const { notificationPreferences } = value

  // Update user in database
  const result = await query(
    `UPDATE users 
     SET notification_preferences = COALESCE($2, notification_preferences),
         updated_at = NOW()
     WHERE id = $1 
     RETURNING id, email, notification_preferences, created_at, updated_at`,
    [req.user.id, notificationPreferences]
  )

  if (result.rows.length === 0) {
    throw new AuthenticationError('User not found')
  }

  const updatedUser = result.rows[0]

  // Clear user cache
  const userCacheKey = `user:${req.user.id}`
  await cacheHelpers.del(userCacheKey)

  logger.info('User profile updated', {
    userId: req.user.id,
    updatedFields: Object.keys(value),
    timestamp: new Date().toISOString(),
  })

  sendSuccess(res, {
    id: updatedUser.id,
    email: updatedUser.email,
    notificationPreferences: updatedUser.notification_preferences,
    createdAt: updatedUser.created_at,
    updatedAt: updatedUser.updated_at,
  }, 'Profile updated successfully')
}))

// Change password endpoint
router.put('/change-password', authenticate, asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AuthenticationError('User not found')
  }

  const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required().max(128),
    newPassword: Joi.string().min(8).required().max(128),
    confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
  })

  const { error, value } = changePasswordSchema.validate(req.body)
  if (error) {
    throw new ValidationError('Validation failed', error.details)
  }

  const { currentPassword, newPassword } = value

  // Get current password hash
  const result = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user.id]
  )

  if (result.rows.length === 0) {
    throw new AuthenticationError('User not found')
  }

  const currentPasswordHash = result.rows[0].password_hash

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, currentPasswordHash)
  
  if (!isValidPassword) {
    throw new AuthenticationError('Current password is incorrect')
  }

  // Hash new password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12')
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds)

  // Update password
  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [newPasswordHash, req.user.id]
  )

  logger.info('Password changed successfully', {
    userId: req.user.id,
    timestamp: new Date().toISOString(),
  })

  sendSuccess(res, null, 'Password changed successfully')
}))

// Validate token endpoint (for client-side token validation)
router.get('/validate', authenticate, asyncHandler(async (req, res) => {
  sendSuccess(res, {
    valid: true,
    user: req.user,
  }, 'Token is valid')
}))

export default router