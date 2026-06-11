/**
 * Plan enforcement middleware — gate routes on the caller's subscription plan.
 *
 *   requireFeature('ai-agent')                 → 403 if the plan lacks the feature
 *   enforceLimit('erp.invoices.monthly')       → 403 once the quota is reached
 *   meter('storageMb', { amount: n })          → counts a successful request
 *
 * Put `enforceLimit` before the handler so an over-quota request never runs
 * (see shared/erp/invoices/invoice.routes.js). Metrics listed in the billing
 * service's LIVE_COUNTERS (seats, erp.invoices.monthly, …) are counted straight
 * from the database and need no metering; add `meter` after the handler only
 * for metrics that have no live counter — it increments the UsageCounter on a
 * successful 2xx/3xx response.
 *
 * The org key is the caller's owning organization: a staff user carries
 * `organizationId`; a top-level org user *is* the org, so its own `id` is used.
 */
const billing = require('../modules/billing/billing.service')
const log = require('../core/logger').forLabel('plan')

const orgKeyOf = (req) => req?.user?.organizationId || req?.user?.id || null

const requireFeature = (featureKey) => async (req, res, next) => {
  try {
    const orgId = orgKeyOf(req)
    if (!orgId) return res.status(401).json({ success: false, message: 'Unauthorized' })
    if (await billing.hasFeature(orgId, featureKey)) return next()
    return res.status(403).json({
      success: false,
      code: 'FEATURE_NOT_IN_PLAN',
      message: 'Your plan does not include this feature. Upgrade to unlock it.',
      feature: featureKey,
    })
  } catch (err) {
    log.error('requireFeature failed', { error: err.message })
    return res.status(500).json({ success: false, message: 'Plan check failed' })
  }
}

const enforceLimit = (metric, { amount = 1 } = {}) => async (req, res, next) => {
  try {
    const orgId = orgKeyOf(req)
    if (!orgId) return res.status(401).json({ success: false, message: 'Unauthorized' })
    const result = await billing.checkLimit(orgId, metric, amount)
    if (result.allowed) return next()
    return res.status(403).json({
      success: false,
      code: 'LIMIT_REACHED',
      message: `You've reached your plan limit for this action (${result.used}/${result.limit}). Upgrade to continue.`,
      metric,
      limit: result.limit,
      used: result.used,
    })
  } catch (err) {
    log.error('enforceLimit failed', { error: err.message })
    return res.status(500).json({ success: false, message: 'Plan check failed' })
  }
}

const meter = (metric, { amount = 1 } = {}) => (req, res, next) => {
  const orgId = orgKeyOf(req)
  // Count only once the response is on its way out and only if it succeeded.
  res.on('finish', () => {
    if (!orgId || res.statusCode >= 400) return
    billing.increment(orgId, metric, amount).catch((err) =>
      log.error('meter increment failed', { metric, error: err.message }))
  })
  next()
}

module.exports = { requireFeature, enforceLimit, meter, orgKeyOf }
