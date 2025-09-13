import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Bell, 
  Search, 
  TrendingUp, 
  Settings,
  Plus,
  List
} from 'lucide-react'
import { clsx } from 'clsx'
import { useStockStore } from '../../store/stockStore'
import { watchlistApi } from '../../services/api'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function Sidebar() {
  const location = useLocation()
  const { watchlists, activeWatchlistId, setActiveWatchlist, createWatchlist } = useStockStore()
  const [isCreating, setIsCreating] = useState(false)
  const [newWatchlistName, setNewWatchlistName] = useState('')

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/search', icon: Search, label: 'Search Stocks' },
    { path: '/alerts', icon: Bell, label: 'Alerts' },
    { path: '/trending', icon: TrendingUp, label: 'Trending' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ]

  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim()) return

    try {
      const response = await watchlistApi.create(newWatchlistName.trim())
      if (response.success) {
        createWatchlist(response.data)
        setNewWatchlistName('')
        setIsCreating(false)
        setActiveWatchlist(response.data.id)
        toast.success('Watchlist created successfully')
      } else {
        toast.error(response.error || 'Failed to create watchlist')
      }
    } catch (error) {
      console.error('Error creating watchlist:', error)
      toast.error('Failed to create watchlist')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateWatchlist()
    } else if (e.key === 'Escape') {
      setIsCreating(false)
      setNewWatchlistName('')
    }
  }

  return (
    <div className="sidebar-nav">
      <div className="p-6">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-8 h-8 text-primary-600" />
          <h1 className="text-xl font-bold text-gradient">StockTracker</h1>
        </div>
      </div>

      <nav className="mt-8">
        <div className="px-4 mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Navigation
          </p>
        </div>
        
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx('sidebar-nav-item', { active: isActive })}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-8">
        <div className="px-4 mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Watchlists
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            title="Create new watchlist"
          >
            <Plus className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {isCreating && (
          <div className="px-4 mb-2">
            <input
              type="text"
              value={newWatchlistName}
              onChange={(e) => setNewWatchlistName(e.target.value)}
              onKeyDown={handleKeyPress}
              onBlur={() => {
                if (!newWatchlistName.trim()) {
                  setIsCreating(false)
                }
              }}
              placeholder="Watchlist name"
              className="input-field text-sm py-1"
              autoFocus
            />
          </div>
        )}

        <div className="max-h-64 overflow-y-auto scrollbar-hide">
          {watchlists.map((watchlist) => (
            <button
              key={watchlist.id}
              onClick={() => setActiveWatchlist(watchlist.id)}
              className={clsx(
                'sidebar-nav-item w-full text-left',
                { active: activeWatchlistId === watchlist.id }
              )}
            >
              <List className="w-5 h-5" />
              <div className="flex-1 min-w-0">
                <span className="truncate">{watchlist.name}</span>
                <span className="text-xs text-slate-500 ml-1">
                  ({watchlist.stocks.length})
                </span>
              </div>
            </button>
          ))}
        </div>

        {watchlists.length === 0 && !isCreating && (
          <div className="px-4 py-2 text-sm text-slate-500">
            No watchlists yet. Create one to start tracking stocks.
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
        <div className="text-xs text-slate-500 space-y-1">
          <div>Market Status: <span className="text-success-600 font-medium">OPEN</span></div>
          <div>Last Update: <span className="font-medium">2:30 PM EST</span></div>
        </div>
      </div>
    </div>
  )
}