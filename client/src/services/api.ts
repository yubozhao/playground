import axios, { AxiosInstance, AxiosResponse } from 'axios'
import {
  ApiResponse,
  PaginatedResponse,
  User,
  AuthTokens,
  LoginCredentials,
  RegisterData,
  Stock,
  StockSearchResult,
  Watchlist,
  PriceAlert,
  AlertNotification,
  NewsArticle,
  SocialMention,
  HistoricalDataPoint,
} from '../types'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: '/api/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          
          try {
            const refreshToken = this.getRefreshToken()
            if (refreshToken) {
              const response = await this.refreshToken(refreshToken)
              if (response.success) {
                this.setTokens(response.data.accessToken, response.data.refreshToken)
                originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`
                return this.client(originalRequest)
              }
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError)
            this.clearTokens()
            window.location.href = '/login'
          }
        }
        
        return Promise.reject(error)
      }
    )
  }

  private getToken(): string | null {
    return localStorage.getItem('token')
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken')
  }

  private setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem('token', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
  }

  private clearTokens() {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  }

  // Auth endpoints
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: User } & AuthTokens>> {
    const response: AxiosResponse<ApiResponse<{ user: User } & AuthTokens>> = 
      await this.client.post('/auth/login', credentials)
    return response.data
  }

  async register(data: RegisterData): Promise<ApiResponse<{ user: User } & AuthTokens>> {
    const response: AxiosResponse<ApiResponse<{ user: User } & AuthTokens>> = 
      await this.client.post('/auth/register', data)
    return response.data
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<AuthTokens>> {
    const response: AxiosResponse<ApiResponse<AuthTokens>> = 
      await this.client.post('/auth/refresh', { refreshToken })
    return response.data
  }

  async logout(): Promise<ApiResponse<void>> {
    const response: AxiosResponse<ApiResponse<void>> = 
      await this.client.post('/auth/logout')
    return response.data
  }

  // Stock endpoints
  async searchStocks(query: string): Promise<ApiResponse<StockSearchResult[]>> {
    const response: AxiosResponse<ApiResponse<StockSearchResult[]>> = 
      await this.client.get(`/stocks/search?q=${encodeURIComponent(query)}`)
    return response.data
  }

  async getStock(ticker: string): Promise<ApiResponse<Stock>> {
    const response: AxiosResponse<ApiResponse<Stock>> = 
      await this.client.get(`/stocks/${ticker}`)
    return response.data
  }

  async getStocks(tickers: string[]): Promise<ApiResponse<Stock[]>> {
    const response: AxiosResponse<ApiResponse<Stock[]>> = 
      await this.client.post('/stocks/batch', { tickers })
    return response.data
  }

  async getHistoricalData(
    ticker: string,
    timeframe: '1D' | '5D' | '1M' | '3M' | '1Y' | '5Y'
  ): Promise<ApiResponse<HistoricalDataPoint[]>> {
    const response: AxiosResponse<ApiResponse<HistoricalDataPoint[]>> = 
      await this.client.get(`/stocks/${ticker}/history?timeframe=${timeframe}`)
    return response.data
  }

  // Watchlist endpoints
  async getWatchlists(): Promise<ApiResponse<Watchlist[]>> {
    const response: AxiosResponse<ApiResponse<Watchlist[]>> = 
      await this.client.get('/watchlists')
    return response.data
  }

  async createWatchlist(name: string, category?: string): Promise<ApiResponse<Watchlist>> {
    const response: AxiosResponse<ApiResponse<Watchlist>> = 
      await this.client.post('/watchlists', { name, category })
    return response.data
  }

  async updateWatchlist(id: string, updates: { name?: string; category?: string }): Promise<ApiResponse<Watchlist>> {
    const response: AxiosResponse<ApiResponse<Watchlist>> = 
      await this.client.put(`/watchlists/${id}`, updates)
    return response.data
  }

  async deleteWatchlist(id: string): Promise<ApiResponse<void>> {
    const response: AxiosResponse<ApiResponse<void>> = 
      await this.client.delete(`/watchlists/${id}`)
    return response.data
  }

  async addToWatchlist(watchlistId: string, ticker: string): Promise<ApiResponse<void>> {
    const response: AxiosResponse<ApiResponse<void>> = 
      await this.client.post(`/watchlists/${watchlistId}/stocks`, { ticker })
    return response.data
  }

  async removeFromWatchlist(watchlistId: string, ticker: string): Promise<ApiResponse<void>> {
    const response: AxiosResponse<ApiResponse<void>> = 
      await this.client.delete(`/watchlists/${watchlistId}/stocks/${ticker}`)
    return response.data
  }

  // Alert endpoints
  async getAlerts(): Promise<ApiResponse<PriceAlert[]>> {
    const response: AxiosResponse<ApiResponse<PriceAlert[]>> = 
      await this.client.get('/alerts')
    return response.data
  }

  async createAlert(alert: Omit<PriceAlert, 'id' | 'userId' | 'createdAt'>): Promise<ApiResponse<PriceAlert>> {
    const response: AxiosResponse<ApiResponse<PriceAlert>> = 
      await this.client.post('/alerts', alert)
    return response.data
  }

  async updateAlert(id: string, updates: Partial<PriceAlert>): Promise<ApiResponse<PriceAlert>> {
    const response: AxiosResponse<ApiResponse<PriceAlert>> = 
      await this.client.put(`/alerts/${id}`, updates)
    return response.data
  }

  async deleteAlert(id: string): Promise<ApiResponse<void>> {
    const response: AxiosResponse<ApiResponse<void>> = 
      await this.client.delete(`/alerts/${id}`)
    return response.data
  }

  async getAlertHistory(page = 1, limit = 20): Promise<ApiResponse<PaginatedResponse<AlertNotification>>> {
    const response: AxiosResponse<ApiResponse<PaginatedResponse<AlertNotification>>> = 
      await this.client.get(`/alerts/history?page=${page}&limit=${limit}`)
    return response.data
  }

  // News endpoints
  async getNews(ticker: string, page = 1, limit = 20): Promise<ApiResponse<PaginatedResponse<NewsArticle>>> {
    const response: AxiosResponse<ApiResponse<PaginatedResponse<NewsArticle>>> = 
      await this.client.get(`/news/${ticker}?page=${page}&limit=${limit}`)
    return response.data
  }

  // Social endpoints
  async getSocialMentions(ticker: string, page = 1, limit = 20): Promise<ApiResponse<PaginatedResponse<SocialMention>>> {
    const response: AxiosResponse<ApiResponse<PaginatedResponse<SocialMention>>> = 
      await this.client.get(`/social/${ticker}?page=${page}&limit=${limit}`)
    return response.data
  }
}

const apiClient = new ApiClient()

// Export individual API modules for cleaner imports
export const authApi = {
  login: apiClient.login.bind(apiClient),
  register: apiClient.register.bind(apiClient),
  refreshToken: apiClient.refreshToken.bind(apiClient),
  logout: apiClient.logout.bind(apiClient),
}

export const stockApi = {
  search: apiClient.searchStocks.bind(apiClient),
  getStock: apiClient.getStock.bind(apiClient),
  getStocks: apiClient.getStocks.bind(apiClient),
  getHistoricalData: apiClient.getHistoricalData.bind(apiClient),
}

export const watchlistApi = {
  getAll: apiClient.getWatchlists.bind(apiClient),
  create: apiClient.createWatchlist.bind(apiClient),
  update: apiClient.updateWatchlist.bind(apiClient),
  delete: apiClient.deleteWatchlist.bind(apiClient),
  addStock: apiClient.addToWatchlist.bind(apiClient),
  removeStock: apiClient.removeFromWatchlist.bind(apiClient),
}

export const alertApi = {
  getAll: apiClient.getAlerts.bind(apiClient),
  create: apiClient.createAlert.bind(apiClient),
  update: apiClient.updateAlert.bind(apiClient),
  delete: apiClient.deleteAlert.bind(apiClient),
  getHistory: apiClient.getAlertHistory.bind(apiClient),
}

export const newsApi = {
  getNews: apiClient.getNews.bind(apiClient),
}

export const socialApi = {
  getMentions: apiClient.getSocialMentions.bind(apiClient),
}

export default apiClient