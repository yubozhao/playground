import axios, { AxiosResponse } from 'axios'
import { logger, logExternalAPI, performanceLogger } from '../utils/logger'
import { cacheHelpers, cacheKeys, cacheTTL } from '../config/redis'
import { ExternalServiceError } from '../middleware/errorHandler'

// Stock data interfaces
export interface StockQuote {
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

export interface HistoricalDataPoint {
  timestamp: string
  price: number
  volume: number
  high: number
  low: number
  open: number
  close: number
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

// API Configuration
const IEX_CLOUD_API_KEY = process.env.IEX_CLOUD_API_KEY
const IEX_CLOUD_BASE_URL = process.env.IEX_CLOUD_BASE_URL || 'https://cloud.iexapis.com/stable'
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY
const ALPHA_VANTAGE_BASE_URL = process.env.ALPHA_VANTAGE_BASE_URL || 'https://www.alphavantage.co/query'

if (!IEX_CLOUD_API_KEY) {
  logger.warn('IEX_CLOUD_API_KEY not provided, stock data functionality will be limited')
}

// Axios instances for different APIs
const iexClient = axios.create({
  baseURL: IEX_CLOUD_BASE_URL,
  timeout: 10000,
  params: {
    token: IEX_CLOUD_API_KEY,
  },
})

const alphaVantageClient = axios.create({
  baseURL: ALPHA_VANTAGE_BASE_URL,
  timeout: 15000,
  params: {
    apikey: ALPHA_VANTAGE_API_KEY,
  },
})

// Request interceptors for logging
iexClient.interceptors.request.use((config) => {
  config.metadata = { startTime: Date.now() }
  return config
})

iexClient.interceptors.response.use(
  (response) => {
    const duration = Date.now() - response.config.metadata?.startTime
    logExternalAPI('IEX Cloud', response.config.url || '', response.status, duration)
    return response
  },
  (error) => {
    const duration = Date.now() - error.config?.metadata?.startTime
    logExternalAPI('IEX Cloud', error.config?.url || '', error.response?.status || 0, duration)
    throw error
  }
)

alphaVantageClient.interceptors.request.use((config) => {
  config.metadata = { startTime: Date.now() }
  return config
})

alphaVantageClient.interceptors.response.use(
  (response) => {
    const duration = Date.now() - response.config.metadata?.startTime
    logExternalAPI('Alpha Vantage', response.config.url || '', response.status, duration)
    return response
  },
  (error) => {
    const duration = Date.now() - error.config?.metadata?.startTime
    logExternalAPI('Alpha Vantage', error.config?.url || '', error.response?.status || 0, duration)
    throw error
  }
)

// Market session helper
const getMarketSession = (): 'PRE' | 'REGULAR' | 'POST' | 'CLOSED' => {
  const now = new Date()
  const easternTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)

  const [hours, minutes] = easternTime.split(':').map(Number)
  const currentTime = hours * 100 + minutes

  // Check if it's a weekend
  const dayOfWeek = now.getDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'CLOSED'
  }

  if (currentTime >= 400 && currentTime < 930) {
    return 'PRE'
  } else if (currentTime >= 930 && currentTime < 1600) {
    return 'REGULAR'
  } else if (currentTime >= 1600 && currentTime < 2000) {
    return 'POST'
  } else {
    return 'CLOSED'
  }
}

// IEX Cloud service functions
class IEXCloudService {
  // Get stock quote
  async getQuote(ticker: string): Promise<StockQuote | null> {
    if (!IEX_CLOUD_API_KEY) {
      throw new ExternalServiceError('IEX Cloud', 'API key not configured')
    }

    try {
      const response: AxiosResponse = await iexClient.get(`/stock/${ticker}/quote`)
      const data = response.data

      return {
        ticker: data.symbol,
        companyName: data.companyName,
        price: data.latestPrice,
        change: data.change,
        changePercent: data.changePercent * 100, // Convert to percentage
        volume: data.latestVolume,
        high: data.high,
        low: data.low,
        open: data.open,
        previousClose: data.previousClose,
        marketCap: data.marketCap,
        peRatio: data.peRatio,
        timestamp: new Date(data.latestUpdate).toISOString(),
        marketSession: getMarketSession(),
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw new ExternalServiceError('IEX Cloud', error.message)
    }
  }

  // Get multiple quotes
  async getBatchQuotes(tickers: string[]): Promise<Record<string, StockQuote>> {
    if (!IEX_CLOUD_API_KEY) {
      throw new ExternalServiceError('IEX Cloud', 'API key not configured')
    }

    if (tickers.length === 0) {
      return {}
    }

    try {
      const tickerString = tickers.join(',')
      const response: AxiosResponse = await iexClient.get(`/stock/market/batch`, {
        params: {
          symbols: tickerString,
          types: 'quote',
        },
      })

      const quotes: Record<string, StockQuote> = {}
      const marketSession = getMarketSession()

      for (const [symbol, data] of Object.entries(response.data)) {
        const quoteData = (data as any).quote
        quotes[symbol] = {
          ticker: quoteData.symbol,
          companyName: quoteData.companyName,
          price: quoteData.latestPrice,
          change: quoteData.change,
          changePercent: quoteData.changePercent * 100,
          volume: quoteData.latestVolume,
          high: quoteData.high,
          low: quoteData.low,
          open: quoteData.open,
          previousClose: quoteData.previousClose,
          marketCap: quoteData.marketCap,
          peRatio: quoteData.peRatio,
          timestamp: new Date(quoteData.latestUpdate).toISOString(),
          marketSession,
        }
      }

      return quotes
    } catch (error: any) {
      throw new ExternalServiceError('IEX Cloud', error.message)
    }
  }

  // Search stocks
  async searchStocks(query: string): Promise<StockSearchResult[]> {
    if (!IEX_CLOUD_API_KEY) {
      throw new ExternalServiceError('IEX Cloud', 'API key not configured')
    }

    try {
      const response: AxiosResponse = await iexClient.get('/search', {
        params: { fragment: query },
      })

      return response.data.map((item: any) => ({
        ticker: item.symbol,
        companyName: item.securityName,
        exchange: item.exchange,
        industry: item.sector,
      }))
    } catch (error: any) {
      throw new ExternalServiceError('IEX Cloud', error.message)
    }
  }

  // Get historical data
  async getHistoricalData(ticker: string, timeframe: string): Promise<HistoricalDataPoint[]> {
    if (!IEX_CLOUD_API_KEY) {
      throw new ExternalServiceError('IEX Cloud', 'API key not configured')
    }

    try {
      let endpoint = ''
      let chartParams: any = {}

      switch (timeframe) {
        case '1D':
          endpoint = `/stock/${ticker}/intraday-prices`
          chartParams = { chartInterval: 5 }
          break
        case '5D':
          endpoint = `/stock/${ticker}/chart/5d`
          break
        case '1M':
          endpoint = `/stock/${ticker}/chart/1m`
          break
        case '3M':
          endpoint = `/stock/${ticker}/chart/3m`
          break
        case '1Y':
          endpoint = `/stock/${ticker}/chart/1y`
          break
        case '5Y':
          endpoint = `/stock/${ticker}/chart/5y`
          break
        default:
          endpoint = `/stock/${ticker}/chart/1d`
      }

      const response: AxiosResponse = await iexClient.get(endpoint, {
        params: chartParams,
      })

      return response.data.map((item: any) => ({
        timestamp: item.date ? `${item.date}T${item.minute || '16:00:00'}Z` : item.datetime,
        price: item.close,
        volume: item.volume,
        high: item.high,
        low: item.low,
        open: item.open,
        close: item.close,
      })).filter((item: any) => item.price !== null)
    } catch (error: any) {
      throw new ExternalServiceError('IEX Cloud', error.message)
    }
  }
}

// Stock data service with caching and fallback
export class StockDataService {
  private iexService = new IEXCloudService()

  // Get single stock quote with caching
  async getStockQuote(ticker: string): Promise<StockQuote | null> {
    const performanceTimer = performanceLogger.start(`getStockQuote-${ticker}`)
    
    try {
      const cacheKey = cacheKeys.stockPrice(ticker.toUpperCase())
      
      // Try to get from cache first
      const cachedQuote = await cacheHelpers.get<StockQuote>(cacheKey)
      if (cachedQuote) {
        performanceTimer.end({ source: 'cache' })
        return cachedQuote
      }

      // Get from API
      const quote = await this.iexService.getQuote(ticker.toUpperCase())
      
      if (quote) {
        // Cache the result
        await cacheHelpers.set(cacheKey, quote, cacheTTL.stockPrice)
      }

      performanceTimer.end({ source: 'api' })
      return quote
    } catch (error) {
      performanceTimer.end({ error: true })
      logger.error(`Error fetching stock quote for ${ticker}:`, error)
      throw error
    }
  }

  // Get multiple stock quotes
  async getBatchStockQuotes(tickers: string[]): Promise<Record<string, StockQuote>> {
    const performanceTimer = performanceLogger.start(`getBatchStockQuotes-${tickers.length}`)
    
    try {
      const upperTickers = tickers.map(t => t.toUpperCase())
      const quotes: Record<string, StockQuote> = {}
      const tickersToFetch: string[] = []

      // Check cache for each ticker
      for (const ticker of upperTickers) {
        const cacheKey = cacheKeys.stockPrice(ticker)
        const cachedQuote = await cacheHelpers.get<StockQuote>(cacheKey)
        
        if (cachedQuote) {
          quotes[ticker] = cachedQuote
        } else {
          tickersToFetch.push(ticker)
        }
      }

      // Fetch missing quotes from API
      if (tickersToFetch.length > 0) {
        const fetchedQuotes = await this.iexService.getBatchQuotes(tickersToFetch)
        
        // Cache and add to results
        for (const [ticker, quote] of Object.entries(fetchedQuotes)) {
          const cacheKey = cacheKeys.stockPrice(ticker)
          await cacheHelpers.set(cacheKey, quote, cacheTTL.stockPrice)
          quotes[ticker] = quote
        }
      }

      performanceTimer.end({ 
        cached: upperTickers.length - tickersToFetch.length,
        fetched: tickersToFetch.length 
      })
      
      return quotes
    } catch (error) {
      performanceTimer.end({ error: true })
      logger.error('Error fetching batch stock quotes:', error)
      throw error
    }
  }

  // Search stocks with caching
  async searchStocks(query: string): Promise<StockSearchResult[]> {
    const performanceTimer = performanceLogger.start(`searchStocks-${query}`)
    
    try {
      const cacheKey = cacheKeys.stockSearch(query.toLowerCase())
      
      // Try cache first
      const cachedResults = await cacheHelpers.get<StockSearchResult[]>(cacheKey)
      if (cachedResults) {
        performanceTimer.end({ source: 'cache' })
        return cachedResults
      }

      // Get from API
      const results = await this.iexService.searchStocks(query)
      
      // Cache results
      await cacheHelpers.set(cacheKey, results, cacheTTL.stockSearch)

      performanceTimer.end({ source: 'api', resultCount: results.length })
      return results
    } catch (error) {
      performanceTimer.end({ error: true })
      logger.error(`Error searching stocks with query "${query}":`, error)
      throw error
    }
  }

  // Get historical data with caching
  async getHistoricalData(ticker: string, timeframe: string): Promise<HistoricalDataPoint[]> {
    const performanceTimer = performanceLogger.start(`getHistoricalData-${ticker}-${timeframe}`)
    
    try {
      const cacheKey = cacheKeys.stockHistory(ticker.toUpperCase(), timeframe)
      const ttl = timeframe === '1D' ? cacheTTL.stockHistoryIntraday : cacheTTL.stockHistoryDaily
      
      // Try cache first
      const cachedData = await cacheHelpers.get<HistoricalDataPoint[]>(cacheKey)
      if (cachedData) {
        performanceTimer.end({ source: 'cache' })
        return cachedData
      }

      // Get from API
      const data = await this.iexService.getHistoricalData(ticker.toUpperCase(), timeframe)
      
      // Cache results
      await cacheHelpers.set(cacheKey, data, ttl)

      performanceTimer.end({ source: 'api', dataPoints: data.length })
      return data
    } catch (error) {
      performanceTimer.end({ error: true })
      logger.error(`Error fetching historical data for ${ticker}:`, error)
      throw error
    }
  }

  // Get market status
  getMarketStatus(): 'PRE' | 'REGULAR' | 'POST' | 'CLOSED' {
    return getMarketSession()
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; services: Record<string, boolean> }> {
    const services: Record<string, boolean> = {}

    // Check IEX Cloud
    try {
      if (IEX_CLOUD_API_KEY) {
        await iexClient.get('/stock/AAPL/quote')
        services.iexCloud = true
      } else {
        services.iexCloud = false
      }
    } catch (error) {
      services.iexCloud = false
    }

    const healthy = Object.values(services).some(status => status)
    
    return { healthy, services }
  }
}

// Export singleton instance
export const stockDataService = new StockDataService()
export default stockDataService