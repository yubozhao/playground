import { Router } from 'express'
import Joi from 'joi'
import { authenticate } from '../middleware/auth'
import { asyncHandler, sendSuccess, ValidationError } from '../middleware/errorHandler'
import { stockDataService } from '../services/stockDataService'

const router = Router()

// Get single stock quote
router.get('/:ticker', authenticate, asyncHandler(async (req, res) => {
  const { ticker } = req.params
  
  if (!ticker || ticker.length > 10) {
    throw new ValidationError('Invalid ticker symbol')
  }

  const quote = await stockDataService.getStockQuote(ticker.toUpperCase())
  
  if (!quote) {
    throw new ValidationError('Stock not found')
  }

  sendSuccess(res, quote)
}))

// Get multiple stock quotes
router.post('/batch', authenticate, asyncHandler(async (req, res) => {
  const schema = Joi.object({
    tickers: Joi.array().items(Joi.string().max(10)).max(50).required(),
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    throw new ValidationError('Validation failed', error.details)
  }

  const { tickers } = value
  const quotes = await stockDataService.getBatchStockQuotes(tickers)

  sendSuccess(res, Object.values(quotes))
}))

// Search stocks
router.get('/search', authenticate, asyncHandler(async (req, res) => {
  const { q: query } = req.query

  if (!query || typeof query !== 'string' || query.length < 1) {
    throw new ValidationError('Search query is required')
  }

  const results = await stockDataService.searchStocks(query)
  sendSuccess(res, results)
}))

// Get historical data
router.get('/:ticker/history', authenticate, asyncHandler(async (req, res) => {
  const { ticker } = req.params
  const { timeframe = '1D' } = req.query

  if (!ticker) {
    throw new ValidationError('Ticker symbol is required')
  }

  const validTimeframes = ['1D', '5D', '1M', '3M', '1Y', '5Y']
  if (!validTimeframes.includes(timeframe as string)) {
    throw new ValidationError('Invalid timeframe')
  }

  const data = await stockDataService.getHistoricalData(ticker, timeframe as string)
  sendSuccess(res, data)
}))

export default router