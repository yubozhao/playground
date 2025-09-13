import { TrendingUp, TrendingDown, Minus, X, Eye } from 'lucide-react'
import { clsx } from 'clsx'
import { StockCardProps } from '../../types'
import { formatDistanceToNow } from 'date-fns'
import MiniChart from './MiniChart'

export default function StockCard({
  stock,
  onRemove,
  onViewDetails,
  showRemoveButton = true,
  isLoading = false,
}: StockCardProps) {
  if (isLoading) {
    return (
      <div className="stock-card">
        <div className="animate-pulse">
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 rounded w-16"></div>
              <div className="h-3 bg-slate-200 rounded w-32"></div>
            </div>
            <div className="h-6 bg-slate-200 rounded w-20"></div>
          </div>
          <div className="space-y-2">
            <div className="h-6 bg-slate-200 rounded w-24"></div>
            <div className="h-4 bg-slate-200 rounded w-28"></div>
          </div>
          <div className="mt-4">
            <div className="h-12 bg-slate-200 rounded"></div>
          </div>
        </div>
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

  const isPositive = stock.change > 0
  const isNegative = stock.change < 0
  const isNeutral = stock.change === 0

  const changeIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus
  const ChangeIcon = changeIcon

  const cardClasses = clsx(
    'stock-card relative',
    {
      'stock-card-price-up': isPositive,
      'stock-card-price-down': isNegative,
    }
  )

  const changeClasses = clsx({
    'price-change-up': isPositive,
    'price-change-down': isNegative,
    'price-change-neutral': isNeutral,
  })

  const marketSessionLabel = {
    PRE: 'Pre-market',
    REGULAR: 'Market',
    POST: 'After-hours',
    CLOSED: 'Closed',
  }[stock.marketSession]

  return (
    <div className={cardClasses}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900">{stock.ticker}</h3>
          <p className="text-sm text-slate-600 truncate max-w-[180px]">
            {stock.companyName}
          </p>
        </div>
        
        <div className="flex items-center space-x-1">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(stock.ticker)}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors"
              title="View details"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          
          {showRemoveButton && onRemove && (
            <button
              onClick={() => onRemove(stock.ticker)}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-danger-600 transition-colors"
              title="Remove from watchlist"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Price and Change */}
      <div className="mb-3">
        <div className="flex items-center space-x-3 mb-2">
          <span className="text-2xl font-bold text-slate-900">
            {formatPrice(stock.price)}
          </span>
          <div className={clsx('flex items-center space-x-1', changeClasses)}>
            <ChangeIcon className="w-4 h-4" />
            <span className="font-medium">
              {isPositive && '+'}
              {formatPrice(Math.abs(stock.change))}
            </span>
            <span className="font-medium">
              ({isPositive && '+'}
              {stock.changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Market session indicator */}
        <div className="text-xs text-slate-500 flex items-center space-x-2">
          <span>{marketSessionLabel}</span>
          <span>•</span>
          <span>Vol: {formatVolume(stock.volume)}</span>
        </div>
      </div>

      {/* Mini Chart */}
      <div className="mb-3">
        <MiniChart 
          ticker={stock.ticker}
          currentPrice={stock.price}
          change={stock.change}
          height={50}
        />
      </div>

      {/* Additional Info */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center space-x-4">
          {stock.high && stock.low && (
            <>
              <span>H: {formatPrice(stock.high)}</span>
              <span>L: {formatPrice(stock.low)}</span>
            </>
          )}
        </div>
        
        <div>
          {formatDistanceToNow(new Date(stock.timestamp), { addSuffix: true })}
        </div>
      </div>

      {/* Real-time update indicator */}
      {isPositive && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-success-500 to-transparent opacity-50 animate-pulse-green"></div>
      )}
      {isNegative && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-danger-500 to-transparent opacity-50 animate-pulse-red"></div>
      )}
    </div>
  )
}