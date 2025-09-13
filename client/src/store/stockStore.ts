import { create } from 'zustand'
import { Stock, Watchlist, PriceAlert, PriceUpdate } from '../types'

interface StockState {
  stocks: Record<string, Stock>
  watchlists: Watchlist[]
  activeWatchlistId: string | null
  alerts: PriceAlert[]
  isLoading: boolean
  lastUpdated: string | null
  marketStatus: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_HOURS'
}

interface StockActions {
  updateStock: (stock: Stock) => void
  updateStocks: (stocks: Stock[]) => void
  handlePriceUpdate: (update: PriceUpdate) => void
  setWatchlists: (watchlists: Watchlist[]) => void
  addToWatchlist: (watchlistId: string, ticker: string) => void
  removeFromWatchlist: (watchlistId: string, ticker: string) => void
  setActiveWatchlist: (watchlistId: string | null) => void
  createWatchlist: (watchlist: Watchlist) => void
  deleteWatchlist: (watchlistId: string) => void
  setAlerts: (alerts: PriceAlert[]) => void
  addAlert: (alert: PriceAlert) => void
  updateAlert: (alertId: string, updates: Partial<PriceAlert>) => void
  removeAlert: (alertId: string) => void
  setLoading: (loading: boolean) => void
  setMarketStatus: (status: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_HOURS') => void
  getStock: (ticker: string) => Stock | null
  getWatchlistStocks: (watchlistId?: string) => Stock[]
}

export const useStockStore = create<StockState & StockActions>((set, get) => ({
  stocks: {},
  watchlists: [],
  activeWatchlistId: null,
  alerts: [],
  isLoading: false,
  lastUpdated: null,
  marketStatus: 'CLOSED',

  updateStock: (stock: Stock) => {
    set((state) => ({
      stocks: {
        ...state.stocks,
        [stock.ticker]: stock,
      },
      lastUpdated: new Date().toISOString(),
    }))
  },

  updateStocks: (stocks: Stock[]) => {
    const stockMap = stocks.reduce((acc, stock) => {
      acc[stock.ticker] = stock
      return acc
    }, {} as Record<string, Stock>)
    
    set((state) => ({
      stocks: {
        ...state.stocks,
        ...stockMap,
      },
      lastUpdated: new Date().toISOString(),
    }))
  },

  handlePriceUpdate: (update: PriceUpdate) => {
    const { stocks } = get()
    const existingStock = stocks[update.ticker]
    
    if (existingStock) {
      const updatedStock: Stock = {
        ...existingStock,
        price: update.price,
        change: update.change,
        changePercent: update.changePercent,
        volume: update.volume,
        timestamp: update.timestamp,
        marketSession: update.marketSession,
      }
      
      get().updateStock(updatedStock)
    }
  },

  setWatchlists: (watchlists: Watchlist[]) => {
    set({ watchlists })
    
    // Set first watchlist as active if none is set
    const { activeWatchlistId } = get()
    if (!activeWatchlistId && watchlists.length > 0) {
      set({ activeWatchlistId: watchlists[0].id })
    }
  },

  addToWatchlist: (watchlistId: string, ticker: string) => {
    set((state) => ({
      watchlists: state.watchlists.map((watchlist) =>
        watchlist.id === watchlistId
          ? {
              ...watchlist,
              stocks: [
                ...watchlist.stocks,
                {
                  id: `${watchlistId}-${ticker}`,
                  watchlistId,
                  ticker,
                  companyName: state.stocks[ticker]?.companyName || ticker,
                  addedAt: new Date().toISOString(),
                },
              ],
            }
          : watchlist
      ),
    }))
  },

  removeFromWatchlist: (watchlistId: string, ticker: string) => {
    set((state) => ({
      watchlists: state.watchlists.map((watchlist) =>
        watchlist.id === watchlistId
          ? {
              ...watchlist,
              stocks: watchlist.stocks.filter((stock) => stock.ticker !== ticker),
            }
          : watchlist
      ),
    }))
  },

  setActiveWatchlist: (watchlistId: string | null) => {
    set({ activeWatchlistId: watchlistId })
  },

  createWatchlist: (watchlist: Watchlist) => {
    set((state) => ({
      watchlists: [...state.watchlists, watchlist],
    }))
  },

  deleteWatchlist: (watchlistId: string) => {
    set((state) => ({
      watchlists: state.watchlists.filter((w) => w.id !== watchlistId),
      activeWatchlistId:
        state.activeWatchlistId === watchlistId
          ? state.watchlists.find((w) => w.id !== watchlistId)?.id || null
          : state.activeWatchlistId,
    }))
  },

  setAlerts: (alerts: PriceAlert[]) => {
    set({ alerts })
  },

  addAlert: (alert: PriceAlert) => {
    set((state) => ({
      alerts: [...state.alerts, alert],
    }))
  },

  updateAlert: (alertId: string, updates: Partial<PriceAlert>) => {
    set((state) => ({
      alerts: state.alerts.map((alert) =>
        alert.id === alertId ? { ...alert, ...updates } : alert
      ),
    }))
  },

  removeAlert: (alertId: string) => {
    set((state) => ({
      alerts: state.alerts.filter((alert) => alert.id !== alertId),
    }))
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading })
  },

  setMarketStatus: (status: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'AFTER_HOURS') => {
    set({ marketStatus: status })
  },

  getStock: (ticker: string) => {
    return get().stocks[ticker] || null
  },

  getWatchlistStocks: (watchlistId?: string) => {
    const { watchlists, activeWatchlistId, stocks } = get()
    const targetWatchlistId = watchlistId || activeWatchlistId
    
    if (!targetWatchlistId) return []
    
    const watchlist = watchlists.find((w) => w.id === targetWatchlistId)
    if (!watchlist) return []
    
    return watchlist.stocks
      .map((stock) => stocks[stock.ticker])
      .filter(Boolean)
  },
}))