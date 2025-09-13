export interface User {
  id: string
  email: string
  notificationPreferences: Record<string, boolean>
  createdAt: string
  updatedAt: string
}

export interface Stock {
  ticker: string
  companyName: string
  price: number
  change: number
  changePercent: number
  volume: number
  high?: number
  low?: number
  open?: number
  previousClose?: number
  marketCap?: number
  peRatio?: number
  timestamp: string
  marketSession: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED'
}

export interface StockSearchResult {
  ticker: string
  companyName: string
  exchange: string
  industry?: string
  price?: number
  change?: number
  changePercent?: number
}

export interface Watchlist {
  id: string
  userId: string
  name: string
  category?: string
  stocks: WatchlistStock[]
  createdAt: string
}

export interface WatchlistStock {
  id: string
  watchlistId: string
  ticker: string
  companyName: string
  addedAt: string
}

export interface PriceAlert {
  id: string
  userId: string
  ticker: string
  alertType: 'ABOVE' | 'BELOW' | 'PERCENT_CHANGE'
  thresholdValue?: number
  thresholdPercent?: number
  isActive: boolean
  createdAt: string
}

export interface AlertNotification {
  id: string
  alertId: string
  triggeredAt: string
  triggerPrice: number
  deliveredVia: 'WEBSOCKET' | 'EMAIL'
  deliveryStatus: 'PENDING' | 'DELIVERED' | 'FAILED'
  ticker: string
  alertType: 'PRICE_UP' | 'PRICE_DOWN'
  threshold: number
  currentPrice: number
  percentChange: number
  message: string
}

export interface NewsArticle {
  id: string
  headline: string
  summary: string
  source: string
  url: string
  publishedAt: string
  ticker: string
  sentiment?: number
  relevanceScore?: number
}

export interface SocialMention {
  id: string
  platform: 'TWITTER' | 'REDDIT'
  content: string
  author: string
  url: string
  publishedAt: string
  ticker: string
  sentiment?: number
  engagementMetrics: {
    likes?: number
    retweets?: number
    replies?: number
    upvotes?: number
    comments?: number
  }
}

export interface HistoricalDataPoint {
  timestamp: string
  price: number
  volume: number
  high: number
  low: number
  open: number
  close: number
}

export interface ChartTimeframe {
  label: string
  value: '1D' | '5D' | '1M' | '3M' | '1Y' | '5Y'
  interval: string
}

export interface PriceUpdate {
  ticker: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: string
  marketSession: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED'
}

export interface WebSocketEvent {
  type: 'price_update' | 'alert' | 'connection_status'
  data: PriceUpdate | AlertNotification | { status: 'connected' | 'disconnected' }
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  totalItems: number
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  confirmPassword: string
}

export interface StockCardProps {
  stock: Stock
  onRemove?: (ticker: string) => void
  onViewDetails?: (ticker: string) => void
  showRemoveButton?: boolean
  isLoading?: boolean
}

export interface SearchComponentProps {
  onStockSelect: (stock: StockSearchResult) => void
  placeholder?: string
  className?: string
}

export interface ChartConfig {
  timeframe: ChartTimeframe
  showVolume: boolean
  showTechnicalIndicators: boolean
  indicators: {
    sma: { enabled: boolean; periods: number[] }
    rsi: { enabled: boolean; period: number }
  }
}

export interface MarketStatus {
  isOpen: boolean
  nextOpen: string
  nextClose: string
  timezone: string
  session: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED'
}