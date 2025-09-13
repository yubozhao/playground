# Stock Price Dashboard

A comprehensive real-time stock price dashboard application built with React and Node.js, providing live stock tracking, watchlist management, price alerts, and integrated news/social feeds.

## Features

### Core Functionality
- 📊 **Real-time Stock Tracking** - Live price updates every 30 seconds during market hours
- 🗂️ **Watchlist Management** - Custom watchlists with categories and organization
- 🔔 **Price Alerts** - Automated alerts for 5% price changes or custom thresholds
- 📈 **Interactive Charts** - Historical price charts with technical indicators
- 📰 **News Integration** - Company-related financial news and articles
- 🐦 **Social Media Feed** - Twitter sentiment and social mentions
- 🔐 **User Authentication** - Secure JWT-based authentication system

### Technical Features
- ⚡ **Real-time Updates** - WebSocket connections for live data streaming
- 💾 **Multi-layer Caching** - Redis caching with optimized performance
- 🏗️ **Microservices Architecture** - Scalable service-oriented design
- 📊 **Time-series Data** - InfluxDB for historical stock data storage
- 🔄 **Background Processing** - Automated alert monitoring and delivery
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Node.js API    │    │   PostgreSQL    │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼               ┌───────▼───────┐               ▼
┌─────────────────┐      │   Services    │    ┌─────────────────┐
│   WebSocket     │      │ - Stock Data  │    │     Redis       │
│  (Real-time)    │◄─────┤ - Alerts      │◄──►│    (Cache)      │
└─────────────────┘      │ - News/Social │    └─────────────────┘
                         └───────────────┘
                                 │
                         ┌───────▼───────┐
                         │   InfluxDB    │
                         │ (Time-series) │
                         └───────────────┘
```

## Tech Stack

### Frontend
- **React 18** with TypeScript and Vite
- **Tailwind CSS** for styling and responsive design
- **Chart.js** for interactive historical charts
- **Socket.IO Client** for real-time WebSocket connections
- **Zustand** for state management
- **React Query** for data fetching and caching

### Backend
- **Node.js 18** with Express and TypeScript
- **Socket.IO** for WebSocket real-time communication
- **PostgreSQL** for relational data (users, watchlists, alerts)
- **Redis** for caching and session management
- **InfluxDB** for time-series stock price data
- **JWT** for authentication and authorization
- **Winston** for structured logging

### Infrastructure
- **Docker & Docker Compose** for containerization
- **Multi-stage builds** for optimized production images
- **Health checks** for all services
- **Nginx** for frontend static serving

### External APIs
- **IEX Cloud** (Primary) - Real-time and historical stock data
- **Alpha Vantage** (Fallback) - Backup stock data provider
- **News API** - Financial news and articles
- **Twitter API v2** - Social media sentiment data
- **SendGrid** - Email notifications for alerts

## Getting Started

### Prerequisites
- **Docker** and **Docker Compose** (Recommended)
- **Node.js 18+** (For local development)
- **API Keys** for external services (see Environment Variables)

### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stock-price-dashboard
   ```

2. **Set up environment variables**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your API keys and configuration
   ```

3. **Start all services**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/health

### Local Development Setup

1. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install

   # Install backend dependencies
   cd server && npm install && cd ..

   # Install frontend dependencies
   cd client && npm install && cd ..
   ```

2. **Start databases** (using Docker)
   ```bash
   docker-compose up -d postgres redis influxdb
   ```

3. **Set up environment variables**
   ```bash
   cp server/.env.example server/.env
   # Edit with your configuration
   ```

4. **Start development servers**
   ```bash
   # Start both frontend and backend
   npm run dev

   # Or start individually
   npm run server:dev    # Backend on :3001
   npm run client:dev    # Frontend on :5173
   ```

## Environment Variables

### Required API Keys
```bash
# Financial Data APIs
IEX_CLOUD_API_KEY=your-iex-cloud-api-key
ALPHA_VANTAGE_API_KEY=your-alpha-vantage-api-key

# News & Social Media
NEWS_API_KEY=your-news-api-key  
TWITTER_BEARER_TOKEN=your-twitter-bearer-token

# Email Notifications
SENDGRID_API_KEY=your-sendgrid-api-key
```

### Database Configuration
```bash
DATABASE_URL=postgresql://stockuser:stockpass@localhost:5432/stock_dashboard
REDIS_URL=redis://:redispass@localhost:6379
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=your-influxdb-token
```

### Security Settings
```bash
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
BCRYPT_ROUNDS=12
```

## API Documentation

### Authentication Endpoints
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh JWT token

### Stock Data Endpoints
- `GET /api/v1/stocks/search?q={query}` - Search stocks by ticker/company
- `GET /api/v1/stocks/{ticker}` - Get current stock quote
- `GET /api/v1/stocks/{ticker}/history?timeframe={1D|5D|1M|3M|1Y|5Y}` - Historical data
- `POST /api/v1/stocks/batch` - Get multiple stock quotes

### Watchlist Management
- `GET /api/v1/watchlists` - Get user watchlists
- `POST /api/v1/watchlists` - Create new watchlist
- `POST /api/v1/watchlists/{id}/stocks` - Add stock to watchlist
- `DELETE /api/v1/watchlists/{id}/stocks/{ticker}` - Remove stock

### Price Alerts
- `GET /api/v1/alerts` - Get user alerts
- `POST /api/v1/alerts` - Create price alert
- `PUT /api/v1/alerts/{id}` - Update alert settings
- `GET /api/v1/alerts/history` - Get alert history

### News & Social Data
- `GET /api/v1/news/{ticker}` - Get company news
- `GET /api/v1/social/{ticker}` - Get social media mentions

## WebSocket Events

### Client → Server
```javascript
// Subscribe to stock updates
socket.emit('subscribe', { tickers: ['AAPL', 'GOOGL'] })

// Unsubscribe from updates  
socket.emit('unsubscribe', { tickers: ['AAPL'] })
```

### Server → Client
```javascript
// Real-time price updates
socket.on('price_update', (data) => {
  // { ticker, price, change, changePercent, volume, timestamp }
})

// Price alert notifications
socket.on('alert', (data) => {
  // { ticker, message, alertType, threshold, currentPrice }
})

// Market status updates
socket.on('market_status', (data) => {
  // { status: 'PRE'|'REGULAR'|'POST'|'CLOSED' }
})
```

## Performance Specifications

### SLA Targets (Per PRD Requirements)
- **Page Load Time**: <3 seconds on standard broadband
- **API Response Time**: <500ms for stock data (95th percentile) 
- **WebSocket Latency**: <100ms for real-time updates
- **Alert Delivery**: 90% within 30 seconds of trigger
- **System Uptime**: 99.5% during market hours (9:30 AM - 4:00 PM EST)
- **Concurrent Users**: Support 1000+ without performance degradation

### Caching Strategy
- **Real-time Prices**: 30s TTL in Redis
- **Search Results**: 10min TTL in Redis  
- **Historical Data**: 1h TTL for intraday, 24h for daily
- **News Articles**: 1h TTL in Redis
- **User Watchlists**: 5min TTL in Redis

## Deployment

### Production Deployment
```bash
# Build and deploy with Docker
docker-compose -f docker-compose.prod.yml up -d

# Or build individually
docker build -t stock-dashboard-backend ./server
docker build -t stock-dashboard-frontend ./client
```

### Health Monitoring
- **Backend Health**: http://localhost:3001/health
- **Database Health**: Automatic health checks in Docker Compose
- **Service Dependencies**: Automated startup ordering and health verification

## Development Commands

```bash
# Development
npm run dev              # Start both frontend and backend
npm run client:dev       # Start frontend only
npm run server:dev       # Start backend only

# Building
npm run build           # Build both projects
npm run client:build    # Build frontend only  
npm run server:build    # Build backend only

# Testing
npm test               # Run all tests
npm run test:client    # Run frontend tests
npm run test:server    # Run backend tests

# Code Quality
npm run lint           # Lint all projects
npm run typecheck      # Type check all projects
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Architecture Decisions

### Why InfluxDB for Time-Series Data?
- Optimized for high-frequency stock price ingestion
- Efficient storage and querying of historical data
- Built-in retention policies for data lifecycle management
- Superior performance for time-range queries

### Why Socket.IO for Real-Time Updates?
- Automatic fallback to polling if WebSockets fail
- Room-based subscriptions for efficient ticker grouping
- Built-in reconnection and error handling
- Redis adapter support for horizontal scaling

### Why Multi-Provider API Strategy?
- **Reliability**: Fallback ensures 99.5% uptime target
- **Rate Limiting**: Distributes load across providers
- **Cost Optimization**: Primary/fallback reduces API costs
- **Data Validation**: Cross-verification for accuracy

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the API documentation for endpoint details
- Review Docker Compose logs for debugging: `docker-compose logs`