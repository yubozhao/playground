import { Server as SocketIOServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { logger, logWebSocket } from '../utils/logger'
import { query } from '../config/database'
import { stockDataService } from '../services/stockDataService'

interface AuthenticatedSocket extends Socket {
  userId?: string
  userEmail?: string
}

interface SocketRooms {
  [ticker: string]: Set<string> // ticker -> set of socket IDs
}

class WebSocketHandler {
  private io: SocketIOServer
  private connectedUsers = new Map<string, AuthenticatedSocket>() // userId -> socket
  private socketRooms: SocketRooms = {}
  private priceUpdateInterval: NodeJS.Timeout | null = null

  constructor(io: SocketIOServer) {
    this.io = io
    this.setupMiddleware()
    this.setupEventHandlers()
    this.startPriceUpdateService()
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token
        
        if (!token) {
          throw new Error('Authentication token required')
        }

        // Verify JWT token
        const JWT_SECRET = process.env.JWT_SECRET
        if (!JWT_SECRET) {
          throw new Error('JWT secret not configured')
        }

        const decoded = jwt.verify(token, JWT_SECRET) as any
        
        // Get user data from database
        const result = await query(
          'SELECT id, email FROM users WHERE id = $1',
          [decoded.id]
        )

        if (result.rows.length === 0) {
          throw new Error('User not found')
        }

        const user = result.rows[0]
        socket.userId = user.id
        socket.userEmail = user.email

        logWebSocket('User authenticated', {
          userId: user.id,
          email: user.email,
          socketId: socket.id,
        })

        next()
      } catch (error) {
        logger.error('WebSocket authentication failed:', error)
        next(new Error('Authentication failed'))
      }
    })
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket)
    })
  }

  private handleConnection(socket: AuthenticatedSocket) {
    const { userId, userEmail } = socket
    
    if (!userId) {
      socket.disconnect()
      return
    }

    // Store user connection
    this.connectedUsers.set(userId, socket)

    logWebSocket('User connected', {
      userId,
      email: userEmail,
      socketId: socket.id,
      totalConnections: this.connectedUsers.size,
    })

    // Send connection confirmation
    socket.emit('connection_status', { status: 'connected' })

    // Handle stock subscriptions
    socket.on('subscribe', (data: { tickers: string[] }) => {
      this.handleSubscribe(socket, data.tickers)
    })

    socket.on('unsubscribe', (data: { tickers: string[] }) => {
      this.handleUnsubscribe(socket, data.tickers)
    })

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason)
    })

    // Load user's watchlists and auto-subscribe
    this.autoSubscribeToUserStocks(socket)
  }

  private async autoSubscribeToUserStocks(socket: AuthenticatedSocket) {
    try {
      if (!socket.userId) return

      // Get user's watchlist stocks
      const result = await query(`
        SELECT DISTINCT ws.ticker
        FROM watchlist_stocks ws
        JOIN watchlists w ON ws.watchlist_id = w.id
        WHERE w.user_id = $1
      `, [socket.userId])

      const tickers = result.rows.map(row => row.ticker)
      
      if (tickers.length > 0) {
        this.subscribeToTickers(socket, tickers)
        
        logWebSocket('Auto-subscribed to user stocks', {
          userId: socket.userId,
          tickers,
        })
      }
    } catch (error) {
      logger.error('Error auto-subscribing to user stocks:', error)
    }
  }

  private handleSubscribe(socket: AuthenticatedSocket, tickers: string[]) {
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return
    }

    const validTickers = tickers
      .filter(ticker => typeof ticker === 'string' && ticker.length <= 10)
      .map(ticker => ticker.toUpperCase())

    if (validTickers.length === 0) {
      return
    }

    this.subscribeToTickers(socket, validTickers)

    logWebSocket('User subscribed to tickers', {
      userId: socket.userId,
      socketId: socket.id,
      tickers: validTickers,
    })
  }

  private handleUnsubscribe(socket: AuthenticatedSocket, tickers: string[]) {
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return
    }

    const validTickers = tickers
      .filter(ticker => typeof ticker === 'string')
      .map(ticker => ticker.toUpperCase())

    this.unsubscribeFromTickers(socket, validTickers)

    logWebSocket('User unsubscribed from tickers', {
      userId: socket.userId,
      socketId: socket.id,
      tickers: validTickers,
    })
  }

  private subscribeToTickers(socket: AuthenticatedSocket, tickers: string[]) {
    tickers.forEach(ticker => {
      // Join socket to ticker room
      socket.join(`stock:${ticker}`)
      
      // Track in our room structure
      if (!this.socketRooms[ticker]) {
        this.socketRooms[ticker] = new Set()
      }
      this.socketRooms[ticker].add(socket.id)
    })
  }

  private unsubscribeFromTickers(socket: AuthenticatedSocket, tickers: string[]) {
    tickers.forEach(ticker => {
      // Leave socket from ticker room
      socket.leave(`stock:${ticker}`)
      
      // Remove from our room structure
      if (this.socketRooms[ticker]) {
        this.socketRooms[ticker].delete(socket.id)
        
        // Clean up empty rooms
        if (this.socketRooms[ticker].size === 0) {
          delete this.socketRooms[ticker]
        }
      }
    })
  }

  private handleDisconnection(socket: AuthenticatedSocket, reason: string) {
    const { userId, userEmail } = socket

    // Remove from connected users
    if (userId) {
      this.connectedUsers.delete(userId)
    }

    // Clean up room subscriptions
    Object.keys(this.socketRooms).forEach(ticker => {
      this.socketRooms[ticker].delete(socket.id)
      
      if (this.socketRooms[ticker].size === 0) {
        delete this.socketRooms[ticker]
      }
    })

    logWebSocket('User disconnected', {
      userId,
      email: userEmail,
      socketId: socket.id,
      reason,
      totalConnections: this.connectedUsers.size,
    })
  }

  private startPriceUpdateService() {
    // Update prices every 30 seconds during market hours
    this.priceUpdateInterval = setInterval(async () => {
      await this.broadcastPriceUpdates()
    }, 30000)

    logger.info('Price update service started')
  }

  private async broadcastPriceUpdates() {
    try {
      const subscribedTickers = Object.keys(this.socketRooms)
      
      if (subscribedTickers.length === 0) {
        return
      }

      // Get current market status
      const marketStatus = stockDataService.getMarketStatus()
      
      // Skip updates if market is closed (unless you want after-hours updates)
      if (marketStatus === 'CLOSED') {
        return
      }

      // Get batch quotes for all subscribed tickers
      const quotes = await stockDataService.getBatchStockQuotes(subscribedTickers)

      // Broadcast updates to each ticker room
      Object.entries(quotes).forEach(([ticker, quote]) => {
        const priceUpdate = {
          ticker: quote.ticker,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          timestamp: quote.timestamp,
          marketSession: quote.marketSession,
        }

        this.io.to(`stock:${ticker}`).emit('price_update', priceUpdate)
      })

      // Broadcast market status
      this.io.emit('market_status', { status: marketStatus })

      logWebSocket('Price updates broadcasted', {
        tickerCount: subscribedTickers.length,
        marketStatus,
      })
    } catch (error) {
      logger.error('Error broadcasting price updates:', error)
    }
  }

  public async broadcastAlert(alert: {
    userId: string
    ticker: string
    alertType: 'PRICE_UP' | 'PRICE_DOWN'
    threshold: number
    currentPrice: number
    percentChange: number
    message: string
  }) {
    const userSocket = this.connectedUsers.get(alert.userId)
    
    if (userSocket) {
      userSocket.emit('alert', {
        ticker: alert.ticker,
        alertType: alert.alertType,
        threshold: alert.threshold,
        currentPrice: alert.currentPrice,
        percentChange: alert.percentChange,
        message: alert.message,
        timestamp: new Date().toISOString(),
      })

      logWebSocket('Alert broadcasted', {
        userId: alert.userId,
        ticker: alert.ticker,
        alertType: alert.alertType,
      })
    }
  }

  public getConnectedUserCount(): number {
    return this.connectedUsers.size
  }

  public getSubscriptionStats(): { totalTickers: number; totalSubscriptions: number } {
    const totalTickers = Object.keys(this.socketRooms).length
    const totalSubscriptions = Object.values(this.socketRooms).reduce(
      (sum, subscribers) => sum + subscribers.size,
      0
    )

    return { totalTickers, totalSubscriptions }
  }

  public shutdown() {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval)
      this.priceUpdateInterval = null
    }

    // Disconnect all sockets
    this.io.disconnectSockets()
    
    logger.info('WebSocket handler shutdown completed')
  }
}

let webSocketHandler: WebSocketHandler | null = null

export const initializeWebSocket = (io: SocketIOServer): void => {
  webSocketHandler = new WebSocketHandler(io)
  logger.info('WebSocket handler initialized')
}

export const getWebSocketHandler = (): WebSocketHandler | null => {
  return webSocketHandler
}

export default WebSocketHandler