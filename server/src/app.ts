import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import dotenv from 'dotenv'
import { logger } from './utils/logger'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { connectDatabase, initializeDatabase } from './config/database'
import { connectRedis } from './config/redis'
import { connectInfluxDB } from './config/influxdb'
import { initializeWebSocket } from './websocket/socketHandler'
import { alertService } from './services/alertService'
import authRoutes from './routes/auth'
import stockRoutes from './routes/stocks'
import watchlistRoutes from './routes/watchlists'
import alertRoutes from './routes/alerts'
import newsRoutes from './routes/news'
import socialRoutes from './routes/social'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.WEBSOCKET_CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})

const PORT = process.env.PORT || 3001
const NODE_ENV = process.env.NODE_ENV || 'development'

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}))

// CORS middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  })
  next()
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
  })
})

// API routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/stocks', stockRoutes)
app.use('/api/v1/watchlists', watchlistRoutes)
app.use('/api/v1/alerts', alertRoutes)
app.use('/api/v1/news', newsRoutes)
app.use('/api/v1/social', socialRoutes)

// Error handling middleware
app.use(notFoundHandler)
app.use(errorHandler)

// Initialize database and Redis connections
const initializeServices = async () => {
  try {
    // Connect to PostgreSQL
    await connectDatabase()
    logger.info('Database connected successfully')

    // Initialize database tables
    await initializeDatabase()
    logger.info('Database tables initialized successfully')

    // Connect to Redis
    await connectRedis()
    logger.info('Redis connected successfully')

    // Connect to InfluxDB
    await connectInfluxDB()
    logger.info('InfluxDB connected successfully')

    // Initialize WebSocket handlers
    initializeWebSocket(io)
    logger.info('WebSocket handlers initialized')

    // Start alert processing service
    alertService.start()
    logger.info('Alert processing service started')

  } catch (error) {
    logger.error('Failed to initialize services:', error)
    process.exit(1)
  }
}

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`)
  
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err)
      process.exit(1)
    }
    
    logger.info('Server closed successfully')
    process.exit(0)
  })

  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down')
    process.exit(1)
  }, 30000)
}

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Start server
const startServer = async () => {
  await initializeServices()
  
  server.listen(PORT, () => {
    logger.info(`Stock Dashboard API server running on port ${PORT}`)
    logger.info(`Environment: ${NODE_ENV}`)
    logger.info(`Health check: http://localhost:${PORT}/health`)
  })
}

startServer().catch((error) => {
  logger.error('Failed to start server:', error)
  process.exit(1)
})

export default app