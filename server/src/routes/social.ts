import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler, sendPaginatedResponse } from '../middleware/errorHandler'

const router = Router()

// Mock social media data for demo purposes
const generateMockSocialMentions = (ticker: string, page: number, limit: number) => {
  const mockMentions = [
    {
      id: '1',
      platform: 'TWITTER' as const,
      content: `$${ticker} looking strong today! Great earnings report and solid guidance for next quarter. 📈 #investing`,
      author: 'MarketGuru2024',
      url: `https://twitter.com/marketguru2024/status/123456789`,
      publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      ticker,
      sentiment: 0.8,
      engagementMetrics: {
        likes: 245,
        retweets: 87,
        replies: 32,
      },
    },
    {
      id: '2',
      platform: 'TWITTER' as const,
      content: `Interesting technical setup on $${ticker}. Breaking above key resistance levels. Volume looks good. 👀`,
      author: 'TechAnalyst',
      url: `https://twitter.com/techanalyst/status/123456790`,
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      ticker,
      sentiment: 0.6,
      engagementMetrics: {
        likes: 156,
        retweets: 43,
        replies: 18,
      },
    },
    {
      id: '3',
      platform: 'REDDIT' as const,
      content: `What do you think about ${ticker}'s latest quarterly results? Seems like they're executing well on their strategy but concerned about the competitive landscape.`,
      author: 'InvestorRed',
      url: `https://reddit.com/r/investing/comments/xyz/${ticker.toLowerCase()}_discussion`,
      publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      ticker,
      sentiment: 0.2,
      engagementMetrics: {
        upvotes: 89,
        comments: 45,
      },
    },
    {
      id: '4',
      platform: 'TWITTER' as const,
      content: `$${ticker} gap down this morning seems overdone. Good entry opportunity for long-term investors IMO. DYOR 📊`,
      author: 'ValueHunter',
      url: `https://twitter.com/valuehunter/status/123456791`,
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      ticker,
      sentiment: 0.4,
      engagementMetrics: {
        likes: 67,
        retweets: 23,
        replies: 12,
      },
    },
    {
      id: '5',
      platform: 'REDDIT' as const,
      content: `Anyone else following ${ticker}? Their recent partnership announcement could be a game changer. Thoughts on fair value?`,
      author: 'StockSeeker',
      url: `https://reddit.com/r/stocks/comments/abc/${ticker.toLowerCase()}_partnership`,
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      ticker,
      sentiment: 0.7,
      engagementMetrics: {
        upvotes: 134,
        comments: 67,
      },
    },
  ]

  // Simulate pagination
  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit
  const paginatedMentions = mockMentions.slice(startIndex, endIndex)

  return {
    mentions: paginatedMentions,
    totalItems: mockMentions.length,
  }
}

// Get social mentions for specific ticker
router.get('/:ticker', authenticate, asyncHandler(async (req, res) => {
  const { ticker } = req.params
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))

  // In a real implementation, this would call Twitter API, Reddit API, etc.
  const { mentions, totalItems } = generateMockSocialMentions(ticker.toUpperCase(), page, limit)

  sendPaginatedResponse(res, mentions, totalItems, page, limit)
}))

export default router