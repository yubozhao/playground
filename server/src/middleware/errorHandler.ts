import { Request, Response, NextFunction } from 'express'
import { logger, logError } from '../utils/logger'

export interface CustomError extends Error {
  statusCode?: number
  code?: string
  details?: any
}

export class AppError extends Error {
  public statusCode: number
  public isOperational: boolean
  public code?: string
  public details?: any

  constructor(message: string, statusCode: number, code?: string, details?: any) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    this.code = code
    this.details = details

    Error.captureStackTrace(this, this.constructor)
  }
}

// Specific error classes
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR')
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR')
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR')
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT_ERROR', details)
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string = 'External service error') {
    super(`${service}: ${message}`, 503, 'EXTERNAL_SERVICE_ERROR', { service })
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR')
  }
}

// Error handler middleware
export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logError(error, req, {
    statusCode: error.statusCode,
    code: error.code,
    details: error.details,
  })

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  let statusCode = error.statusCode || 500
  let message = error.message
  let code = error.code
  let details = error.details

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400
    code = 'VALIDATION_ERROR'
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401
    message = 'Invalid token'
    code = 'INVALID_TOKEN'
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Token expired'
    code = 'TOKEN_EXPIRED'
  } else if (error.name === 'CastError') {
    statusCode = 400
    message = 'Invalid ID format'
    code = 'INVALID_ID'
  } else if (error.code === '23505') { // PostgreSQL unique violation
    statusCode = 409
    message = 'Resource already exists'
    code = 'DUPLICATE_RESOURCE'
  } else if (error.code === '23503') { // PostgreSQL foreign key violation
    statusCode = 400
    message = 'Referenced resource does not exist'
    code = 'FOREIGN_KEY_VIOLATION'
  } else if (error.code === '23502') { // PostgreSQL not null violation
    statusCode = 400
    message = 'Required field is missing'
    code = 'MISSING_REQUIRED_FIELD'
  }

  // Don't expose internal error details in production
  if (!isDevelopment && statusCode === 500) {
    message = 'Internal server error'
    code = 'INTERNAL_ERROR'
    details = undefined
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    code,
    ...(details && { details }),
    ...(isDevelopment && statusCode === 500 && { stack: error.stack }),
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  })
}

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  const message = `Route ${req.method} ${req.originalUrl} not found`
  
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  })

  res.status(404).json({
    success: false,
    error: message,
    code: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  })
}

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// Validation error formatter
export const formatValidationError = (errors: any[]): ValidationError => {
  const details = errors.map(error => ({
    field: error.path,
    message: error.message,
    value: error.value,
  }))

  return new ValidationError('Validation failed', details)
}

// Database error handler
export const handleDatabaseError = (error: any): AppError => {
  logger.error('Database error:', error)

  switch (error.code) {
    case '23505': // Unique violation
      return new ConflictError('Resource already exists', {
        constraint: error.constraint,
        detail: error.detail,
      })
    
    case '23503': // Foreign key violation
      return new ValidationError('Referenced resource does not exist', {
        constraint: error.constraint,
        detail: error.detail,
      })
    
    case '23502': // Not null violation
      return new ValidationError('Required field is missing', {
        column: error.column,
        table: error.table,
      })
    
    case '22P02': // Invalid text representation
      return new ValidationError('Invalid data format', {
        detail: error.detail,
      })
    
    case '42703': // Undefined column
      return new ValidationError('Invalid field specified', {
        detail: error.detail,
      })
    
    default:
      return new AppError('Database operation failed', 500, 'DATABASE_ERROR')
  }
}

// External API error handler
export const handleExternalAPIError = (service: string, error: any): AppError => {
  logger.error(`External API error (${service}):`, error)

  if (error.response) {
    // API responded with error status
    const status = error.response.status
    const message = error.response.data?.message || error.message || 'External API error'
    
    if (status >= 500) {
      return new ExternalServiceError(service, 'Service temporarily unavailable')
    } else if (status === 429) {
      return new RateLimitError('API rate limit exceeded')
    } else if (status === 401) {
      return new ExternalServiceError(service, 'API authentication failed')
    } else {
      return new ExternalServiceError(service, message)
    }
  } else if (error.request) {
    // Request made but no response received
    return new ExternalServiceError(service, 'Service unavailable')
  } else {
    // Something else happened
    return new ExternalServiceError(service, error.message || 'Unknown error')
  }
}

// Success response helper
export const sendSuccess = (
  res: Response,
  data: any,
  message?: string,
  statusCode: number = 200
): void => {
  res.status(statusCode).json({
    success: true,
    data,
    ...(message && { message }),
    timestamp: new Date().toISOString(),
  })
}

// Paginated response helper
export const sendPaginatedResponse = (
  res: Response,
  data: any[],
  totalItems: number,
  currentPage: number,
  limit: number,
  message?: string
): void => {
  const totalPages = Math.ceil(totalItems / limit)
  
  res.status(200).json({
    success: true,
    data: {
      items: data,
      totalItems,
      currentPage,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
    ...(message && { message }),
    timestamp: new Date().toISOString(),
  })
}