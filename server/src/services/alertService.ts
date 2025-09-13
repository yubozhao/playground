import { CronJob } from 'cron'
import { query } from '../config/database'
import { stockDataService } from './stockDataService'
import { getWebSocketHandler } from '../websocket/socketHandler'
import { logger, logAlert } from '../utils/logger'
import nodemailer from 'nodemailer'

interface AlertRule {
  id: string
  userId: string
  ticker: string
  alertType: 'ABOVE' | 'BELOW' | 'PERCENT_CHANGE'
  thresholdValue?: number
  thresholdPercent?: number
}

interface PriceAlert {
  userId: string
  ticker: string
  alertType: 'PRICE_UP' | 'PRICE_DOWN'
  threshold: number
  currentPrice: number
  percentChange: number
  message: string
}

class AlertService {
  private cronJob: CronJob | null = null
  private emailTransporter: nodemailer.Transporter | null = null
  private processingAlerts = false

  constructor() {
    this.initializeEmailTransporter()
  }

  private initializeEmailTransporter() {
    const sendGridApiKey = process.env.SENDGRID_API_KEY
    const fromEmail = process.env.FROM_EMAIL || 'alerts@stockdashboard.com'

    if (sendGridApiKey) {
      this.emailTransporter = nodemailer.createTransporter({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: sendGridApiKey,
        },
      })
      logger.info('Email transporter initialized with SendGrid')
    } else {
      logger.warn('SENDGRID_API_KEY not configured, email alerts will be disabled')
    }
  }

  // Start alert processing service
  public start() {
    if (this.cronJob) {
      logger.warn('Alert service is already running')
      return
    }

    // Run every 15 seconds during market hours
    this.cronJob = new CronJob(
      '*/15 * * * * *', // Every 15 seconds
      () => {
        this.processAlerts().catch(error => {
          logger.error('Error in alert processing:', error)
        })
      },
      null,
      true,
      'America/New_York'
    )

    logger.info('Alert processing service started')
  }

  // Stop alert processing service
  public stop() {
    if (this.cronJob) {
      this.cronJob.stop()
      this.cronJob = null
      logger.info('Alert processing service stopped')
    }
  }

  // Main alert processing logic
  private async processAlerts() {
    if (this.processingAlerts) {
      return // Skip if already processing
    }

    this.processingAlerts = true

    try {
      // Get all active alerts
      const alertRules = await this.getActiveAlertRules()
      
      if (alertRules.length === 0) {
        this.processingAlerts = false
        return
      }

      // Get unique tickers
      const tickers = [...new Set(alertRules.map(rule => rule.ticker))]
      
      // Get current prices for all tickers
      const currentQuotes = await stockDataService.getBatchStockQuotes(tickers)
      
      // Process each alert rule
      const alertsToTrigger: PriceAlert[] = []
      
      for (const rule of alertRules) {
        const quote = currentQuotes[rule.ticker]
        if (!quote) continue

        const alert = await this.checkAlertCondition(rule, quote)
        if (alert) {
          alertsToTrigger.push(alert)
        }
      }

      // Trigger all alerts
      for (const alert of alertsToTrigger) {
        await this.triggerAlert(alert)
      }

      logAlert('Alert processing completed', {
        totalRules: alertRules.length,
        triggeredAlerts: alertsToTrigger.length,
      })

    } catch (error) {
      logger.error('Error processing alerts:', error)
    } finally {
      this.processingAlerts = false
    }
  }

  // Get all active alert rules from database
  private async getActiveAlertRules(): Promise<AlertRule[]> {
    const result = await query(`
      SELECT id, user_id, ticker, alert_type, threshold_value, threshold_percent
      FROM price_alerts
      WHERE is_active = true
    `)

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      ticker: row.ticker,
      alertType: row.alert_type,
      thresholdValue: row.threshold_value,
      thresholdPercent: row.threshold_percent,
    }))
  }

  // Check if alert condition is met
  private async checkAlertCondition(
    rule: AlertRule, 
    quote: any
  ): Promise<PriceAlert | null> {
    try {
      switch (rule.alertType) {
        case 'ABOVE':
          if (rule.thresholdValue && quote.price >= rule.thresholdValue) {
            return {
              userId: rule.userId,
              ticker: rule.ticker,
              alertType: 'PRICE_UP',
              threshold: rule.thresholdValue,
              currentPrice: quote.price,
              percentChange: quote.changePercent,
              message: `${rule.ticker} has reached $${quote.price}, above your target of $${rule.thresholdValue}`
            }
          }
          break

        case 'BELOW':
          if (rule.thresholdValue && quote.price <= rule.thresholdValue) {
            return {
              userId: rule.userId,
              ticker: rule.ticker,
              alertType: 'PRICE_DOWN',
              threshold: rule.thresholdValue,
              currentPrice: quote.price,
              percentChange: quote.changePercent,
              message: `${rule.ticker} has dropped to $${quote.price}, below your target of $${rule.thresholdValue}`
            }
          }
          break

        case 'PERCENT_CHANGE':
          if (rule.thresholdPercent) {
            const absChangePercent = Math.abs(quote.changePercent)
            if (absChangePercent >= rule.thresholdPercent) {
              return {
                userId: rule.userId,
                ticker: rule.ticker,
                alertType: quote.changePercent >= 0 ? 'PRICE_UP' : 'PRICE_DOWN',
                threshold: rule.thresholdPercent,
                currentPrice: quote.price,
                percentChange: quote.changePercent,
                message: `${rule.ticker} is ${quote.changePercent >= 0 ? 'up' : 'down'} ${absChangePercent.toFixed(2)}% to $${quote.price}`
              }
            }
          }
          break
      }

      return null
    } catch (error) {
      logger.error(`Error checking alert condition for rule ${rule.id}:`, error)
      return null
    }
  }

  // Trigger alert (WebSocket + Email)
  private async triggerAlert(alert: PriceAlert) {
    try {
      // Store alert in history
      const historyResult = await query(`
        INSERT INTO alert_history (
          alert_id, trigger_price, delivered_via, delivery_status,
          ticker, alert_type, threshold, current_price, percent_change, message
        ) VALUES (
          (SELECT id FROM price_alerts WHERE user_id = $1 AND ticker = $2 LIMIT 1),
          $3, $4, $5, $6, $7, $8, $9, $10, $11
        ) RETURNING id
      `, [
        alert.userId,
        alert.ticker,
        alert.currentPrice,
        'WEBSOCKET',
        'DELIVERED',
        alert.ticker,
        alert.alertType,
        alert.threshold,
        alert.currentPrice,
        alert.percentChange,
        alert.message
      ])

      // Send WebSocket notification
      const wsHandler = getWebSocketHandler()
      if (wsHandler) {
        await wsHandler.broadcastAlert(alert)
      }

      // Send email notification
      await this.sendEmailAlert(alert)

      logAlert('Alert triggered successfully', {
        userId: alert.userId,
        ticker: alert.ticker,
        alertType: alert.alertType,
        currentPrice: alert.currentPrice,
      })

    } catch (error) {
      logger.error('Error triggering alert:', error)
      
      // Update delivery status to failed
      try {
        await query(`
          INSERT INTO alert_history (
            alert_id, trigger_price, delivered_via, delivery_status,
            ticker, alert_type, threshold, current_price, percent_change, message
          ) VALUES (
            (SELECT id FROM price_alerts WHERE user_id = $1 AND ticker = $2 LIMIT 1),
            $3, $4, $5, $6, $7, $8, $9, $10, $11
          )
        `, [
          alert.userId,
          alert.ticker,
          alert.currentPrice,
          'FAILED',
          'FAILED',
          alert.ticker,
          alert.alertType,
          alert.threshold,
          alert.currentPrice,
          alert.percentChange,
          alert.message
        ])
      } catch (historyError) {
        logger.error('Error saving failed alert to history:', historyError)
      }
    }
  }

  // Send email alert
  private async sendEmailAlert(alert: PriceAlert) {
    if (!this.emailTransporter) {
      return
    }

    try {
      // Get user email
      const userResult = await query('SELECT email FROM users WHERE id = $1', [alert.userId])
      if (userResult.rows.length === 0) {
        return
      }

      const userEmail = userResult.rows[0].email
      const subject = `Stock Alert: ${alert.ticker} ${alert.alertType === 'PRICE_UP' ? '📈' : '📉'}`
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${alert.alertType === 'PRICE_UP' ? '#10b981' : '#ef4444'};">
            Stock Price Alert
          </h2>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0;">${alert.ticker}</h3>
            <p style="margin: 5px 0; font-size: 16px;">${alert.message}</p>
            
            <div style="margin-top: 15px;">
              <strong>Current Price:</strong> $${alert.currentPrice.toFixed(2)}<br>
              <strong>Change:</strong> 
              <span style="color: ${alert.percentChange >= 0 ? '#10b981' : '#ef4444'};">
                ${alert.percentChange >= 0 ? '+' : ''}${alert.percentChange.toFixed(2)}%
              </span>
            </div>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            This alert was triggered at ${new Date().toLocaleString()}
          </p>
          
          <p style="color: #6b7280; font-size: 12px;">
            You are receiving this email because you have configured price alerts in your Stock Dashboard.
            To manage your alerts, log into your dashboard.
          </p>
        </div>
      `

      await this.emailTransporter.sendMail({
        from: process.env.FROM_EMAIL || 'alerts@stockdashboard.com',
        to: userEmail,
        subject,
        html,
      })

      // Update delivery status
      await query(`
        UPDATE alert_history 
        SET delivered_via = 'EMAIL', delivery_status = 'DELIVERED'
        WHERE ticker = $1 AND trigger_price = $2
        AND triggered_at > NOW() - INTERVAL '1 minute'
      `, [alert.ticker, alert.currentPrice])

      logAlert('Email alert sent', {
        userId: alert.userId,
        email: userEmail,
        ticker: alert.ticker,
      })

    } catch (error) {
      logger.error('Error sending email alert:', error)
    }
  }

  // Get alert statistics
  public async getAlertStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_alerts,
          SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_alerts,
          COUNT(DISTINCT ticker) as unique_tickers
        FROM price_alerts
      `)

      const historyResult = await query(`
        SELECT 
          COUNT(*) as triggered_today,
          SUM(CASE WHEN delivery_status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_today
        FROM alert_history
        WHERE triggered_at >= CURRENT_DATE
      `)

      return {
        totalAlerts: parseInt(result.rows[0].total_alerts),
        activeAlerts: parseInt(result.rows[0].active_alerts),
        uniqueTickers: parseInt(result.rows[0].unique_tickers),
        triggeredToday: parseInt(historyResult.rows[0].triggered_today),
        deliveredToday: parseInt(historyResult.rows[0].delivered_today),
      }
    } catch (error) {
      logger.error('Error getting alert stats:', error)
      return null
    }
  }
}

// Export singleton instance
export const alertService = new AlertService()
export default alertService