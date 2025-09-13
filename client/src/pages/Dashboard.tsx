import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Filter, Grid, List } from 'lucide-react'
import { useStockStore } from '../store/stockStore'
import { watchlistApi } from '../services/api'
import StockCard from '../components/stock/StockCard'
import SearchComponent from '../components/stock/SearchComponent'
import { StockSearchResult } from '../types'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    watchlists,
    activeWatchlistId,
    getWatchlistStocks,
    removeFromWatchlist,
    addToWatchlist,
    isLoading,
  } = useStockStore()

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showSearch, setShowSearch] = useState(false)

  const activeWatchlist = watchlists.find(w => w.id === activeWatchlistId)
  const watchlistStocks = getWatchlistStocks()

  const handleAddStock = async (stock: StockSearchResult) => {
    if (!activeWatchlistId) {
      toast.error('Please select a watchlist first')
      return
    }

    try {
      const response = await watchlistApi.addStock(activeWatchlistId, stock.ticker)
      if (response.success) {
        addToWatchlist(activeWatchlistId, stock.ticker)
        setShowSearch(false)
        toast.success(`${stock.ticker} added to watchlist`)
      } else {
        toast.error(response.error || 'Failed to add stock')
      }
    } catch (error) {
      console.error('Error adding stock to watchlist:', error)
      toast.error('Failed to add stock to watchlist')
    }
  }

  const handleRemoveStock = async (ticker: string) => {
    if (!activeWatchlistId) return

    try {
      const response = await watchlistApi.removeStock(activeWatchlistId, ticker)
      if (response.success) {
        removeFromWatchlist(activeWatchlistId, ticker)
        toast.success(`${ticker} removed from watchlist`)
      } else {
        toast.error(response.error || 'Failed to remove stock')
      }
    } catch (error) {
      console.error('Error removing stock from watchlist:', error)
      toast.error('Failed to remove stock from watchlist')
    }
  }

  const handleViewDetails = (ticker: string) => {
    navigate(`/stock/${ticker}`)
  }

  if (!activeWatchlistId && watchlists.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <List className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No watchlists yet
          </h3>
          <p className="text-slate-600 mb-6">
            Create your first watchlist to start tracking stocks and get real-time updates.
          </p>
          <p className="text-sm text-slate-500">
            Use the sidebar to create a new watchlist and start adding stocks.
          </p>
        </div>
      </div>
    )
  }

  if (!activeWatchlistId) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Select a watchlist
          </h3>
          <p className="text-slate-600">
            Choose a watchlist from the sidebar to view your stocks.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {activeWatchlist?.name || 'Dashboard'}
          </h1>
          <p className="text-slate-600">
            {watchlistStocks.length} stocks • Real-time updates
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                'p-2 rounded transition-colors',
                viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-slate-200'
              )}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'p-2 rounded transition-colors',
                viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-slate-200'
              )}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowSearch(!showSearch)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Stock</span>
          </button>
        </div>
      </div>

      {/* Search Component */}
      {showSearch && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <SearchComponent
            onStockSelect={handleAddStock}
            placeholder="Search for stocks to add to your watchlist..."
            className="w-full max-w-md"
          />
          <button
            onClick={() => setShowSearch(false)}
            className="mt-3 text-sm text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Market Status Banner */}
      <div className="bg-success-50 border border-success-200 rounded-lg px-4 py-3">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
          <span className="text-success-800 font-medium">Market is open</span>
          <span className="text-success-600">•</span>
          <span className="text-success-600 text-sm">Real-time updates active</span>
        </div>
      </div>

      {/* Stock Cards */}
      {watchlistStocks.length === 0 ? (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No stocks in this watchlist
            </h3>
            <p className="text-slate-600 mb-6">
              Add stocks to start tracking their prices and get real-time updates.
            </p>
            <button
              onClick={() => setShowSearch(true)}
              className="btn-primary"
            >
              Add Your First Stock
            </button>
          </div>
        </div>
      ) : (
        <div
          className={clsx(
            'grid gap-6',
            viewMode === 'grid' 
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'grid-cols-1'
          )}
        >
          {watchlistStocks.map((stock) => (
            <StockCard
              key={stock.ticker}
              stock={stock}
              onRemove={handleRemoveStock}
              onViewDetails={handleViewDetails}
              showRemoveButton={true}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}

      {/* Performance Summary */}
      {watchlistStocks.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Portfolio Summary
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-success-600">
                {watchlistStocks.filter(s => s.change > 0).length}
              </div>
              <div className="text-sm text-slate-600">Gainers</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-danger-600">
                {watchlistStocks.filter(s => s.change < 0).length}
              </div>
              <div className="text-sm text-slate-600">Losers</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-600">
                {watchlistStocks.filter(s => s.change === 0).length}
              </div>
              <div className="text-sm text-slate-600">Unchanged</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}