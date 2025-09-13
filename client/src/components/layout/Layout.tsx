import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useEffect } from 'react'
import { useStockStore } from '../../store/stockStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { watchlistApi, alertApi, stockApi } from '../../services/api'
import toast from 'react-hot-toast'

export default function Layout() {
  const { 
    setWatchlists, 
    setAlerts, 
    updateStocks, 
    getWatchlistStocks,
    activeWatchlistId 
  } = useStockStore()
  const { subscribe, unsubscribe } = useWebSocket()

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load watchlists
        const watchlistsResponse = await watchlistApi.getAll()
        if (watchlistsResponse.success) {
          setWatchlists(watchlistsResponse.data)
        }

        // Load alerts
        const alertsResponse = await alertApi.getAll()
        if (alertsResponse.success) {
          setAlerts(alertsResponse.data)
        }
      } catch (error) {
        console.error('Error loading initial data:', error)
        toast.error('Failed to load some data. Please refresh the page.')
      }
    }

    loadInitialData()
  }, [setWatchlists, setAlerts])

  // Subscribe to stock updates for active watchlist
  useEffect(() => {
    if (!activeWatchlistId) return

    const watchlistStocks = getWatchlistStocks()
    const tickers = watchlistStocks.map(stock => stock.ticker)

    if (tickers.length > 0) {
      // Fetch initial stock data
      stockApi.getStocks(tickers).then(response => {
        if (response.success) {
          updateStocks(response.data)
        }
      }).catch(error => {
        console.error('Error fetching initial stock data:', error)
      })

      // Subscribe to real-time updates
      subscribe(tickers)

      // Cleanup: unsubscribe when component unmounts or watchlist changes
      return () => {
        unsubscribe(tickers)
      }
    }
  }, [activeWatchlistId, getWatchlistStocks, subscribe, unsubscribe, updateStocks])

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}