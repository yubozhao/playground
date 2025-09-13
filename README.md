# Stock Price Dashboard

A comprehensive real-time stock price tracking dashboard with alerts, news integration, and social sentiment analysis.

## Features

- **Real-time Stock Tracking**: Live price updates with <30s latency
- **Interactive Dashboard**: Customizable watchlists with stock cards
- **Historical Charts**: Multiple timeframes with technical indicators
- **Price Alerts**: Custom thresholds and automatic notifications
- **Stock Search**: Fuzzy search across major exchanges
- **News Integration**: Financial news with sentiment analysis
- **Social Media**: Twitter and Reddit mentions tracking
- **Mobile Responsive**: Optimized for all devices

## Tech Stack

### Frontend
- React 18 + TypeScript + Vite
- Tailwind CSS for styling
- Zustand for state management
- TanStack Query for data fetching
- Chart.js for visualizations
- Socket.io for real-time updates

### Backend
- Node.js + Express + TypeScript
- PostgreSQL for data storage
- Redis for caching
- Socket.io for WebSockets
- JWT authentication
- Winston logging

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

2. **Setup environment**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your configuration
   ```

3. **Start development**
   ```bash
   npm run dev
   ```

Visit http://localhost:5173 for the frontend and http://localhost:3001/health for the API.

## API Keys Required

- IEX Cloud (stock data)
- News API (financial news)
- Twitter API v2 (social sentiment)

See `.env.example` for full configuration options.

## Architecture

```
React Client ←→ Express API ←→ PostgreSQL
     ↕            ↕           ↕
WebSocket ←→ Socket.io ←→ Redis Cache
                ↕
        External APIs
```

## License

MIT License - see LICENSE file for details.