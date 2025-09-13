import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler, sendPaginatedResponse } from '../middleware/errorHandler'

const router = Router()

// Mock news data for demo purposes
const generateMockNews = (ticker: string, page: number, limit: number) => {
  const mockArticles = [
    {
      id: '1',
      headline: `${ticker} Reports Strong Q4 Earnings, Beats Expectations`,
      summary: `${ticker} has announced better-than-expected quarterly results, with revenue growth of 15% year-over-year.`,
      source: 'Financial Times',
      url: `https://example.com/news/${ticker.toLowerCase()}-earnings`,
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      ticker,
      sentiment: 0.8,
      relevanceScore: 0.95,
    },
    {
      id: '2',
      headline: `Analysts Upgrade ${ticker} Price Target Following Innovation Announcement`,
      summary: `Multiple analysts have raised their price targets for ${ticker} following the company's latest product innovation announcement.`,
      source: 'Reuters',
      url: `https://example.com/news/${ticker.toLowerCase()}-upgrade`,
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      ticker,
      sentiment: 0.7,
      relevanceScore: 0.88,
    },
    {
      id: '3',
      headline: `${ticker} Faces Regulatory Scrutiny Over New Business Practices`,
      summary: `Regulatory authorities have announced an investigation into ${ticker}'s new business practices in the international market.`,
      source: 'Bloomberg',
      url: `https://example.com/news/${ticker.toLowerCase()}-regulation`,
      publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      ticker,
      sentiment: -0.3,
      relevanceScore: 0.82,
    },
    {
      id: '4',
      headline: `${ticker} Announces Strategic Partnership with Major Tech Company`,
      summary: `${ticker} has entered into a strategic partnership that is expected to drive significant growth in the coming quarters.`,
      source: 'TechCrunch',
      url: `https://example.com/news/${ticker.toLowerCase()}-partnership`,
      publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      ticker,
      sentiment: 0.6,
      relevanceScore: 0.9,
    },
    {
      id: '5',
      headline: `Market Volatility Affects ${ticker} Trading Volume`,
      summary: `Recent market volatility has led to increased trading volume for ${ticker}, with institutional investors adjusting their positions.`,
      source: 'MarketWatch',
      url: `https://example.com/news/${ticker.toLowerCase()}-volume`,
      publishedAt: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
      ticker,
      sentiment: 0.1,
      relevanceScore: 0.75,
    },
  ]

  // Simulate pagination
  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit
  const paginatedArticles = mockArticles.slice(startIndex, endIndex)

  return {
    articles: paginatedArticles,
    totalItems: mockArticles.length,
  }
}

// Get news for specific ticker
router.get('/:ticker', authenticate, asyncHandler(async (req, res) => {
  const { ticker } = req.params
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))

  // In a real implementation, this would call external news APIs
  const { articles, totalItems } = generateMockNews(ticker.toUpperCase(), page, limit)

  sendPaginatedResponse(res, articles, totalItems, page, limit)
}))

export default router