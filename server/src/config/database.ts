import { Pool } from 'pg'
import { logger } from '../utils/logger'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

// Create PostgreSQL connection pool
export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

// Test database connection
export const connectDatabase = async (): Promise<void> => {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT NOW()')
    client.release()
    
    logger.info('Database connected successfully', {
      timestamp: result.rows[0].now,
      poolSize: pool.totalCount,
    })
  } catch (error) {
    logger.error('Database connection failed:', error)
    throw error
  }
}

// Initialize database tables
export const initializeDatabase = async (): Promise<void> => {
  try {
    const client = await pool.connect()

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        notification_preferences JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `)

    // Create watchlists table
    await client.query(`
      CREATE TABLE IF NOT EXISTS watchlists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)

    // Create watchlist_stocks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS watchlist_stocks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        watchlist_id UUID REFERENCES watchlists(id) ON DELETE CASCADE,
        ticker VARCHAR(10) NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        added_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(watchlist_id, ticker)
      );
    `)

    // Create price_alerts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        ticker VARCHAR(10) NOT NULL,
        alert_type VARCHAR(20) NOT NULL,
        threshold_value DECIMAL(10,2),
        threshold_percent DECIMAL(5,2),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `)

    // Create alert_history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_id UUID REFERENCES price_alerts(id) ON DELETE CASCADE,
        triggered_at TIMESTAMP DEFAULT NOW(),
        trigger_price DECIMAL(10,2) NOT NULL,
        delivered_via VARCHAR(20) NOT NULL,
        delivery_status VARCHAR(20) DEFAULT 'PENDING',
        ticker VARCHAR(10) NOT NULL,
        alert_type VARCHAR(20) NOT NULL,
        threshold DECIMAL(5,2) NOT NULL,
        current_price DECIMAL(10,2) NOT NULL,
        percent_change DECIMAL(5,2) NOT NULL,
        message TEXT NOT NULL
      );
    `)

    // Create stock_metadata table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_metadata (
        ticker VARCHAR(10) PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        industry VARCHAR(100),
        exchange VARCHAR(10) NOT NULL,
        last_updated TIMESTAMP DEFAULT NOW()
      );
    `)

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_watchlist_stocks_watchlist_id ON watchlist_stocks(watchlist_id);
      CREATE INDEX IF NOT EXISTS idx_watchlist_stocks_ticker ON watchlist_stocks(ticker);
      CREATE INDEX IF NOT EXISTS idx_price_alerts_user_ticker ON price_alerts(user_id, ticker);
      CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = true;
      CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON alert_history(alert_id);
      CREATE INDEX IF NOT EXISTS idx_alert_history_ticker ON alert_history(ticker);
      CREATE INDEX IF NOT EXISTS idx_stock_metadata_search ON stock_metadata USING gin(to_tsvector('english', company_name || ' ' || ticker));
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);
    `)

    // Create updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `)

    // Create triggers for updated_at
    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `)

    client.release()
    logger.info('Database tables initialized successfully')
  } catch (error) {
    logger.error('Database initialization failed:', error)
    throw error
  }
}

// Query helper functions
export const query = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now()
  try {
    const result = await pool.query(text, params)
    const duration = Date.now() - start
    
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      logger.warn('Slow query detected', {
        query: text.substring(0, 100) + '...',
        duration,
        rowCount: result.rowCount,
      })
    }
    
    return result
  } catch (error) {
    logger.error('Database query error', {
      query: text.substring(0, 100) + '...',
      params,
      error: error instanceof Error ? error.message : error,
    })
    throw error
  }
}

// Transaction helper
export const withTransaction = async <T>(
  callback: (client: any) => Promise<T>
): Promise<T> => {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Health check for database
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const result = await query('SELECT 1')
    return result.rowCount === 1
  } catch (error) {
    logger.error('Database health check failed:', error)
    return false
  }
}

// Close database connections gracefully
export const closeDatabaseConnections = async (): Promise<void> => {
  try {
    await pool.end()
    logger.info('Database connections closed successfully')
  } catch (error) {
    logger.error('Error closing database connections:', error)
    throw error
  }
}

// Handle pool errors
pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err)
})

pool.on('connect', () => {
  logger.debug('New database connection established')
})

pool.on('remove', () => {
  logger.debug('Database connection removed from pool')
})