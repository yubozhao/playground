import { InfluxDB, Point } from '@influxdata/influxdb-client'
import { logger } from '../utils/logger'

const INFLUXDB_URL = process.env.INFLUXDB_URL || 'http://localhost:8086'
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || 'stock-dashboard'
const INFLUXDB_BUCKET = process.env.INFLUXDB_BUCKET || 'stock-prices'

if (!INFLUXDB_TOKEN) {
  logger.warn('INFLUXDB_TOKEN not provided, time-series functionality will be limited')
}

// Create InfluxDB client
export const influxDB = new InfluxDB({
  url: INFLUXDB_URL,
  token: INFLUXDB_TOKEN || '',
})

// Get write API for bucket
export const getWriteAPI = () => {
  return influxDB.getWriteApi(INFLUXDB_ORG, INFLUXDB_BUCKET, 'ns')
}

// Get query API
export const getQueryAPI = () => {
  return influxDB.getQueryApi(INFLUXDB_ORG)
}

// Test InfluxDB connection
export const connectInfluxDB = async (): Promise<void> => {
  try {
    if (!INFLUXDB_TOKEN) {
      logger.warn('InfluxDB token not configured, skipping connection test')
      return
    }

    const queryApi = getQueryAPI()
    const query = `from(bucket: "${INFLUXDB_BUCKET}") |> range(start: -1m) |> limit(n:1)`
    
    await queryApi.collectRows(query)
    
    logger.info('InfluxDB connected successfully', {
      url: INFLUXDB_URL,
      org: INFLUXDB_ORG,
      bucket: INFLUXDB_BUCKET,
    })
  } catch (error) {
    logger.error('InfluxDB connection failed:', error)
    throw error
  }
}

// Write stock price data
export const writeStockPrice = async (data: {
  ticker: string
  exchange: string
  price: number
  volume: number
  high: number
  low: number
  open: number
  marketSession: string
  timestamp?: Date
}) => {
  try {
    if (!INFLUXDB_TOKEN) return

    const writeApi = getWriteAPI()
    const point = new Point('stock_prices')
      .tag('ticker', data.ticker)
      .tag('exchange', data.exchange)
      .tag('session', data.marketSession)
      .floatField('price', data.price)
      .intField('volume', data.volume)
      .floatField('high', data.high)
      .floatField('low', data.low)
      .floatField('open', data.open)

    if (data.timestamp) {
      point.timestamp(data.timestamp)
    }

    writeApi.writePoint(point)
    await writeApi.close()

  } catch (error) {
    logger.error('Error writing stock price to InfluxDB:', error)
  }
}

// Write news sentiment data
export const writeNewsSentiment = async (data: {
  ticker: string
  source: string
  sentimentScore: number
  articleCount: number
  timestamp?: Date
}) => {
  try {
    if (!INFLUXDB_TOKEN) return

    const writeApi = getWriteAPI()
    const point = new Point('news_sentiment')
      .tag('ticker', data.ticker)
      .tag('source', data.source)
      .floatField('sentiment_score', data.sentimentScore)
      .intField('article_count', data.articleCount)

    if (data.timestamp) {
      point.timestamp(data.timestamp)
    }

    writeApi.writePoint(point)
    await writeApi.close()

  } catch (error) {
    logger.error('Error writing news sentiment to InfluxDB:', error)
  }
}

// Write social media metrics
export const writeSocialMetrics = async (data: {
  ticker: string
  platform: string
  mentionCount: number
  sentimentScore: number
  engagementTotal: number
  timestamp?: Date
}) => {
  try {
    if (!INFLUXDB_TOKEN) return

    const writeApi = getWriteAPI()
    const point = new Point('social_metrics')
      .tag('ticker', data.ticker)
      .tag('platform', data.platform)
      .intField('mention_count', data.mentionCount)
      .floatField('sentiment_score', data.sentimentScore)
      .intField('engagement_total', data.engagementTotal)

    if (data.timestamp) {
      point.timestamp(data.timestamp)
    }

    writeApi.writePoint(point)
    await writeApi.close()

  } catch (error) {
    logger.error('Error writing social metrics to InfluxDB:', error)
  }
}

// Query historical stock prices
export const queryStockPrices = async (
  ticker: string,
  timeframe: string
): Promise<Array<{
  timestamp: string
  price: number
  volume: number
  high: number
  low: number
  open: number
}>> => {
  try {
    if (!INFLUXDB_TOKEN) return []

    const queryApi = getQueryAPI()
    
    // Map timeframe to InfluxDB range
    const timeRanges: Record<string, string> = {
      '1D': '-1d',
      '5D': '-5d', 
      '1M': '-30d',
      '3M': '-90d',
      '1Y': '-365d',
      '5Y': '-1825d'
    }

    const range = timeRanges[timeframe] || '-1d'
    
    const query = `
      from(bucket: "${INFLUXDB_BUCKET}")
        |> range(start: ${range})
        |> filter(fn: (r) => r._measurement == "stock_prices")
        |> filter(fn: (r) => r.ticker == "${ticker}")
        |> filter(fn: (r) => r._field == "price" or r._field == "volume" or r._field == "high" or r._field == "low" or r._field == "open")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"])
    `

    const results: any[] = []
    
    await queryApi.collectRows(query, (row, tableMeta) => {
      const obj = tableMeta.toObject(row)
      results.push({
        timestamp: obj._time,
        price: obj.price || 0,
        volume: obj.volume || 0,
        high: obj.high || 0,
        low: obj.low || 0,
        open: obj.open || 0,
      })
    })

    return results
  } catch (error) {
    logger.error('Error querying stock prices from InfluxDB:', error)
    return []
  }
}

// Health check for InfluxDB
export const checkInfluxDBHealth = async (): Promise<boolean> => {
  try {
    if (!INFLUXDB_TOKEN) return false
    
    const queryApi = getQueryAPI()
    const query = `from(bucket: "${INFLUXDB_BUCKET}") |> range(start: -1m) |> limit(n:1)`
    
    await queryApi.collectRows(query)
    return true
  } catch (error) {
    logger.error('InfluxDB health check failed:', error)
    return false
  }
}