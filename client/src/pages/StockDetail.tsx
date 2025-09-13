import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, Plus, Newspaper, MessageSquare, TrendingUp, TrendingDown } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Stock, HistoricalDataPoint, ChartTimeframe, NewsArticle, SocialMention } from '../types'
import { stockApi, newsApi, socialApi } from '../services/api'
import { useStockStore } from '../store/stockStore'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import { formatDistanceToNow, format } from 'date-fns'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const TIMEFRAMES: ChartTimeframe[] = [
  { label: '1D', value: '1D', interval: '1m' },
  { label: '5D', value: '5D', interval: '5m' },
  { label: '1M', value: '1M', interval: '1h' },
  { label: '3M', value: '3M', interval: '1d' },
  { label: '1Y', value: '1Y', interval: '1d' },
  { label: '5Y', value: '5Y', interval: '1wk' },
]

export default function StockDetail() {
  const { ticker } = useParams<{ ticker: string }>()
  const navigate = useNavigate()
  const { getStock, updateStock } = useStockStore()

  const [stock, setStock] = useState<Stock | null>(null)
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([])
  const [news, setNews] = useState<NewsArticle[]>([])
  const [socialMentions, setSocialMentions] = useState<SocialMention[]>([])
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>(TIMEFRAMES[0])
  const [isLoadingChart, setIsLoadingChart] = useState(false)
  const [isLoadingNews, setIsLoadingNews] = useState(false)
  const [isLoadingSocial, setIsLoadingSocial] = useState(false)

  useEffect(() => {
    if (!ticker) return

    // Try to get stock from store first, then fetch if not available
    const existingStock = getStock(ticker.toUpperCase())
    if (existingStock) {
      setStock(existingStock)
    } else {
      fetchStockData(ticker.toUpperCase())
    }

    fetchHistoricalData(ticker.toUpperCase(), selectedTimeframe.value)
    fetchNews(ticker.toUpperCase())
    fetchSocialMentions(ticker.toUpperCase())
  }, [ticker])

  useEffect(() => {
    if (ticker) {
      fetchHistoricalData(ticker.toUpperCase(), selectedTimeframe.value)
    }
  }, [selectedTimeframe, ticker])

  const fetchStockData = async (stockTicker: string) => {
    try {
      const response = await stockApi.getStock(stockTicker)
      if (response.success) {
        setStock(response.data)
        updateStock(response.data)
      } else {
        toast.error('Stock not found')
        navigate('/dashboard')
      }
    } catch (error) {
      console.error('Error fetching stock data:', error)
      toast.error('Failed to load stock data')
      navigate('/dashboard')
    }
  }

  const fetchHistoricalData = async (stockTicker: string, timeframe: string) => {
    setIsLoadingChart(true)
    try {
      const response = await stockApi.getHistoricalData(stockTicker, timeframe as any)
      if (response.success) {
        setHistoricalData(response.data)
      }
    } catch (error) {
      console.error('Error fetching historical data:', error)
      toast.error('Failed to load chart data')
    } finally {
      setIsLoadingChart(false)
    }
  }

  const fetchNews = async (stockTicker: string) => {
    setIsLoadingNews(true)
    try {
      const response = await newsApi.getNews(stockTicker, 1, 10)
      if (response.success) {
        setNews(response.data.items)
      }
    } catch (error) {
      console.error('Error fetching news:', error)
    } finally {
      setIsLoadingNews(false)
    }
  }

  const fetchSocialMentions = async (stockTicker: string) => {
    setIsLoadingSocial(true)
    try {
      const response = await socialApi.getMentions(stockTicker, 1, 10)
      if (response.success) {
        setSocialMentions(response.data.items)
      }
    } catch (error) {
      console.error('Error fetching social mentions:', error)
    } finally {
      setIsLoadingSocial(false)
    }
  }

  if (!stock) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) {
      return `${(volume / 1e9).toFixed(1)}B`
    } else if (volume >= 1e6) {
      return `${(volume / 1e6).toFixed(1)}M`
    } else if (volume >= 1e3) {
      return `${(volume / 1e3).toFixed(1)}K`
    }
    return volume.toLocaleString()
  }

  const chartData = {
    labels: historicalData.map(point => {
      if (selectedTimeframe.value === '1D') {
        return format(new Date(point.timestamp), 'HH:mm')
      } else if (selectedTimeframe.value === '5D') {
        return format(new Date(point.timestamp), 'MMM dd HH:mm')
      } else {
        return format(new Date(point.timestamp), 'MMM dd')
      }
    }),
    datasets: [
      {
        label: `${stock.ticker} Price`,
        data: historicalData.map(point => point.close),
        borderColor: stock.change >= 0 ? '#10b981' : '#ef4444',
        backgroundColor: stock.change >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: any) {
            return `${stock.ticker}: ${formatPrice(context.parsed.y)}`
          }
        }
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false,
        },
      },
      y: {
        display: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: function(value: any) {
            return formatPrice(value)
          }
        }
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  }

  const isPositive = stock.change > 0
  const isNegative = stock.change < 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-900">{stock.ticker}</h1>
              <span className="text-sm text-slate-500">{stock.marketSession}</span>
            </div>
            <p className="text-slate-600">{stock.companyName}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button className="btn-secondary flex items-center space-x-2">
            <Bell className="w-4 h-4" />
            <span>Create Alert</span>
          </button>
          
          <button className="btn-primary flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Add to Watchlist</span>
          </button>
        </div>
      </div>

      {/* Price Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-4 mb-2">
              <span className="text-4xl font-bold text-slate-900">
                {formatPrice(stock.price)}
              </span>
              <div
                className={clsx(
                  'flex items-center space-x-2 px-3 py-2 rounded-lg',
                  {
                    'bg-success-100 text-success-800': isPositive,
                    'bg-danger-100 text-danger-800': isNegative,
                    'bg-slate-100 text-slate-800': stock.change === 0,
                  }
                )}
              >
                {isPositive && <TrendingUp className="w-5 h-5" />}
                {isNegative && <TrendingDown className="w-5 h-5" />}
                <span className="font-semibold">
                  {isPositive && '+'}
                  {formatPrice(Math.abs(stock.change))} ({isPositive && '+'}
                  {stock.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
            
            <div className="text-sm text-slate-500">
              Last updated {formatDistanceToNow(new Date(stock.timestamp), { addSuffix: true })}
            </div>
          </div>

          <div className="text-right space-y-2">
            {stock.high && stock.low && (
              <>
                <div className="text-sm">
                  <span className="text-slate-500">Day Range: </span>
                  <span>{formatPrice(stock.low)} - {formatPrice(stock.high)}</span>
                </div>
              </>
            )}
            
            <div className="text-sm">
              <span className="text-slate-500">Volume: </span>
              <span className="font-medium">{formatVolume(stock.volume)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Price Chart</h2>
          
          <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1">
            {TIMEFRAMES.map((timeframe) => (
              <button
                key={timeframe.value}
                onClick={() => setSelectedTimeframe(timeframe)}
                className={clsx(
                  'px-3 py-1 text-sm rounded transition-colors',
                  selectedTimeframe.value === timeframe.value
                    ? 'bg-white shadow-sm font-medium text-primary-600'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {timeframe.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-96">
          {isLoadingChart ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : historicalData.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              No chart data available
            </div>
          )}
        </div>
      </div>

      {/* News and Social Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* News */}
        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center space-x-2">
            <Newspaper className="w-5 h-5 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-900">Latest News</h3>
          </div>
          
          <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
            {isLoadingNews ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : news.length > 0 ? (
              news.map((article) => (
                <div key={article.id} className="p-4">
                  <h4 className="font-medium text-slate-900 mb-2 line-clamp-2">
                    {article.headline}
                  </h4>
                  <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                    {article.summary}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{article.source}</span>
                    <span>{formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-500">
                No news articles available
              </div>
            )}
          </div>
        </div>

        {/* Social Mentions */}
        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-900">Social Mentions</h3>
          </div>
          
          <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
            {isLoadingSocial ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : socialMentions.length > 0 ? (
              socialMentions.map((mention) => (
                <div key={mention.id} className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 mb-2">
                        {mention.content}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>@{mention.author}</span>
                        <span>{formatDistanceToNow(new Date(mention.publishedAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-500">
                No social mentions available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}