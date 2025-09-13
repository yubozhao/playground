import { Router } from 'express'
import Joi from 'joi'
import { query, withTransaction } from '../config/database'
import { authenticate } from '../middleware/auth'
import { asyncHandler, sendSuccess, ValidationError, NotFoundError } from '../middleware/errorHandler'
import { cacheHelpers, cacheKeys } from '../config/redis'

const router = Router()

// Get all watchlists for user
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT w.id, w.name, w.category, w.created_at,
           COALESCE(json_agg(
             json_build_object(
               'id', ws.id,
               'ticker', ws.ticker,
               'companyName', ws.company_name,
               'addedAt', ws.added_at
             ) ORDER BY ws.added_at DESC
           ) FILTER (WHERE ws.id IS NOT NULL), '[]') as stocks
    FROM watchlists w
    LEFT JOIN watchlist_stocks ws ON w.id = ws.watchlist_id
    WHERE w.user_id = $1
    GROUP BY w.id, w.name, w.category, w.created_at
    ORDER BY w.created_at ASC
  `, [req.user!.id])

  sendSuccess(res, result.rows)
}))

// Create new watchlist
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    category: Joi.string().max(100).optional(),
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    throw new ValidationError('Validation failed', error.details)
  }

  const { name, category } = value

  const result = await query(`
    INSERT INTO watchlists (user_id, name, category) 
    VALUES ($1, $2, $3) 
    RETURNING id, name, category, created_at
  `, [req.user!.id, name, category])

  // Clear user watchlists cache
  await cacheHelpers.del(cacheKeys.userWatchlists(req.user!.id))

  sendSuccess(res, { ...result.rows[0], stocks: [] }, 'Watchlist created successfully', 201)
}))

// Update watchlist
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    category: Joi.string().max(100).optional(),
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    throw new ValidationError('Validation failed', error.details)
  }

  const { id } = req.params
  const { name, category } = value

  const result = await query(`
    UPDATE watchlists 
    SET name = COALESCE($3, name),
        category = COALESCE($4, category)
    WHERE id = $1 AND user_id = $2
    RETURNING id, name, category, created_at
  `, [id, req.user!.id, name, category])

  if (result.rows.length === 0) {
    throw new NotFoundError('Watchlist not found')
  }

  // Clear user watchlists cache
  await cacheHelpers.del(cacheKeys.userWatchlists(req.user!.id))

  sendSuccess(res, result.rows[0])
}))

// Delete watchlist
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params

  const result = await query(`
    DELETE FROM watchlists 
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `, [id, req.user!.id])

  if (result.rows.length === 0) {
    throw new NotFoundError('Watchlist not found')
  }

  // Clear user watchlists cache
  await cacheHelpers.del(cacheKeys.userWatchlists(req.user!.id))

  sendSuccess(res, null, 'Watchlist deleted successfully')
}))

// Add stock to watchlist
router.post('/:id/stocks', authenticate, asyncHandler(async (req, res) => {
  const schema = Joi.object({
    ticker: Joi.string().min(1).max(10).required(),
    companyName: Joi.string().min(1).max(255).optional(),
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    throw new ValidationError('Validation failed', error.details)
  }

  const { id } = req.params
  const { ticker, companyName } = value

  await withTransaction(async (client) => {
    // Verify watchlist belongs to user
    const watchlistResult = await client.query(
      'SELECT id FROM watchlists WHERE id = $1 AND user_id = $2',
      [id, req.user!.id]
    )

    if (watchlistResult.rows.length === 0) {
      throw new NotFoundError('Watchlist not found')
    }

    // Add stock to watchlist
    await client.query(`
      INSERT INTO watchlist_stocks (watchlist_id, ticker, company_name) 
      VALUES ($1, $2, $3)
      ON CONFLICT (watchlist_id, ticker) DO NOTHING
    `, [id, ticker.toUpperCase(), companyName || ticker.toUpperCase()])
  })

  // Clear user watchlists cache
  await cacheHelpers.del(cacheKeys.userWatchlists(req.user!.id))

  sendSuccess(res, null, 'Stock added to watchlist', 201)
}))

// Remove stock from watchlist
router.delete('/:id/stocks/:ticker', authenticate, asyncHandler(async (req, res) => {
  const { id, ticker } = req.params

  const result = await query(`
    DELETE FROM watchlist_stocks 
    WHERE watchlist_id = $1 AND ticker = $2 AND watchlist_id IN (
      SELECT id FROM watchlists WHERE user_id = $3
    )
    RETURNING id
  `, [id, ticker.toUpperCase(), req.user!.id])

  if (result.rows.length === 0) {
    throw new NotFoundError('Stock not found in watchlist')
  }

  // Clear user watchlists cache
  await cacheHelpers.del(cacheKeys.userWatchlists(req.user!.id))

  sendSuccess(res, null, 'Stock removed from watchlist')
}))

export default router