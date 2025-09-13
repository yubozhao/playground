import winston from 'winston'

const logLevel = process.env.LOG_LEVEL || 'info'
const nodeEnv = process.env.NODE_ENV || 'development'

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`
    }
    
    return logMessage
  })
)

// Create transports array
const transports: winston.transport[] = []

// Console transport (always enabled in development)
if (nodeEnv === 'development') {
  transports.push(
    new winston.transports.Console({
      level: logLevel,
      format: consoleFormat,
    })
  )
} else {
  transports.push(
    new winston.transports.Console({
      level: logLevel,
      format: logFormat,
    })
  )
}

// File transports for production
if (nodeEnv === 'production') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  )

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: 'logs/combined.log',
      level: logLevel,
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
    })
  )
}

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'stock-dashboard-api' },
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
})

// Handle exceptions and rejections
logger.exceptions.handle(
  new winston.transports.Console({ format: consoleFormat }),
  ...(nodeEnv === 'production' ? [
    new winston.transports.File({
      filename: 'logs/exceptions.log',
      format: logFormat,
    })
  ] : [])
)

logger.rejections.handle(
  new winston.transports.Console({ format: consoleFormat }),
  ...(nodeEnv === 'production' ? [
    new winston.transports.File({
      filename: 'logs/rejections.log',
      format: logFormat,
    })
  ] : [])
)

// Create a stream object with 'write' function for Morgan
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim())
  },
}

// Helper functions for structured logging
export const logRequest = (req: any, additionalData?: any) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    ...additionalData,
  })
}

export const logResponse = (req: any, res: any, additionalData?: any) => {
  logger.info('HTTP Response', {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: res.get('X-Response-Time'),
    userId: req.user?.id,
    ...additionalData,
  })
}

export const logError = (error: Error, req?: any, additionalData?: any) => {
  logger.error('Application Error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    request: req ? {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userId: req.user?.id,
    } : undefined,
    ...additionalData,
  })
}

export const logWebSocket = (event: string, data?: any) => {
  logger.info('WebSocket Event', {
    event,
    data,
    timestamp: new Date().toISOString(),
  })
}

export const logDatabaseQuery = (query: string, duration?: number, additionalData?: any) => {
  logger.debug('Database Query', {
    query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
    duration,
    ...additionalData,
  })
}

export const logExternalAPI = (service: string, endpoint: string, status: number, duration?: number) => {
  logger.info('External API Call', {
    service,
    endpoint,
    status,
    duration,
    timestamp: new Date().toISOString(),
  })
}

export const logAlert = (event: string, data?: any) => {
  logger.info('Alert Event', {
    event,
    data,
    timestamp: new Date().toISOString(),
  })
}

// Performance monitoring
export const performanceLogger = {
  start: (label: string) => {
    const start = process.hrtime()
    return {
      end: (additionalData?: any) => {
        const [seconds, nanoseconds] = process.hrtime(start)
        const duration = seconds * 1000 + nanoseconds / 1e6 // Convert to milliseconds
        
        logger.info('Performance Metric', {
          label,
          duration: parseFloat(duration.toFixed(2)),
          ...additionalData,
        })
        
        return duration
      },
    }
  },
}

export default logger