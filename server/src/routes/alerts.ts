import { Router } from 'express'
import Joi from 'joi'
import { query } from '../config/database'
import { authenticate } from '../middleware/auth'
import { asyncHandler, sendSuccess, sendPaginatedResponse, ValidationError, NotFoundError } from '../middleware/errorHandler'

const router = Router()

// Get all alerts for user
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT id, ticker, alert_type, threshold_value, threshold_percent, is_active, created_at
    FROM price_alerts 
    WHERE user_id = $1
    ORDER BY created_at DESC
  `, [req.user!.id])

  sendSuccess(res, result.rows)
}))

// Create new alert
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const schema = Joi.object({
    ticker: Joi.string().min(1).max(10).required(),
    alertType: Joi.string().valid('ABOVE', 'BELOW', 'PERCENT_CHANGE').required(),
    thresholdValue: Joi.number().min(0).when('alertType', {
      is: Joi.string().valid('ABOVE', 'BELOW'),
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    thresholdPercent: Joi.number().min(0).max(100).when('alertType', {
      is: 'PERCENT_CHANGE',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    isActive: Joi.boolean().default(true),
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    throw new ValidationError('Validation failed', error.details)
  }

  const { ticker, alertType, thresholdValue, thresholdPercent, isActive } = value

  const result = await query(`
    INSERT INTO price_alerts (user_id, ticker, alert_type, threshold_value, threshold_percent, is_active) 
    VALUES ($1, $2, $3, $4, $5, $6) 
    RETURNING id, ticker, alert_type, threshold_value, threshold_percent, is_active, created_at
  `, [req.user!.id, ticker.toUpperCase(), alertType, thresholdValue, thresholdPercent, isActive])

  sendSuccess(res, result.rows[0], 'Alert created successfully', 201)
}))

// Update alert
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const schema = Joi.object({
    isActive: Joi.boolean().optional(),
    thresholdValue: Joi.number().min(0).optional(),
    thresholdPercent: Joi.number().min(0).max(100).optional(),
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    throw new ValidationError('Validation failed', error.details)
  }

  const { id } = req.params
  const { isActive, thresholdValue, thresholdPercent } = value

  const result = await query(`
    UPDATE price_alerts 
    SET is_active = COALESCE($3, is_active),
        threshold_value = COALESCE($4, threshold_value),
        threshold_percent = COALESCE($5, threshold_percent)
    WHERE id = $1 AND user_id = $2
    RETURNING id, ticker, alert_type, threshold_value, threshold_percent, is_active, created_at
  `, [id, req.user!.id, isActive, thresholdValue, thresholdPercent])

  if (result.rows.length === 0) {
    throw new NotFoundError('Alert not found')
  }

  sendSuccess(res, result.rows[0])
}))

// Delete alert
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params

  const result = await query(`
    DELETE FROM price_alerts 
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `, [id, req.user!.id])

  if (result.rows.length === 0) {
    throw new NotFoundError('Alert not found')
  }

  sendSuccess(res, null, 'Alert deleted successfully')
}))

// Get alert history
router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))
  const offset = (page - 1) * limit

  // Get total count
  const countResult = await query(`
    SELECT COUNT(*) 
    FROM alert_history ah
    JOIN price_alerts pa ON ah.alert_id = pa.id
    WHERE pa.user_id = $1
  `, [req.user!.id])

  const totalItems = parseInt(countResult.rows[0].count)

  // Get paginated results
  const result = await query(`
    SELECT ah.id, ah.triggered_at, ah.trigger_price, ah.delivered_via, ah.delivery_status,
           ah.ticker, ah.alert_type, ah.threshold, ah.current_price, ah.percent_change, ah.message
    FROM alert_history ah
    JOIN price_alerts pa ON ah.alert_id = pa.id
    WHERE pa.user_id = $1
    ORDER BY ah.triggered_at DESC
    LIMIT $2 OFFSET $3
  `, [req.user!.id, limit, offset])

  sendPaginatedResponse(res, result.rows, totalItems, page, limit)
}))

export default router