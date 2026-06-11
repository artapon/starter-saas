/**
 * Billing service — plan resolution, subscription lifecycle, usage metering and
 * quota checks. The single source of truth for "what can this org do".
 *
 * An *organization* is a top-level User (organizationId === null); every billing
 * row is keyed by that user's id. Staff users (organizationId set) inherit their
 * organization's plan — resolve the owning org id with `orgKeyOf` upstream.
 */
const { Op } = require('sequelize')
const { Plan, Subscription, UsageCounter, SubscriptionInvoice, PlanChangeRequest, User, Invoice } = require('../../models')
const config = require('../../config/config')
const log = require('../../core/logger').forLabel('billing')

const ACTIVE_STATUSES = ['active', 'trialing']

// ── Period helpers ────────────────────────────────────────────────────────────

const monthKey = (d = new Date()) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`

// Monthly metrics reset each calendar month; everything else accumulates for life.
const periodForMetric = (metric) => (metric.endsWith('.monthly') ? monthKey() : 'lifetime')

const addInterval = (from, interval) => {
  const d = new Date(from)
  if (interval === 'year') d.setUTCFullYear(d.getUTCFullYear() + 1)
  else d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

// ── Effective-plan cache (per org, short TTL) ─────────────────────────────────
const CACHE_TTL_MS = 60 * 1000
const planCache = new Map()   // orgId → { plan, expires }
const accessCache = new Map() // orgId → { locked, expires }
const invalidate = (orgId) => {
  if (orgId) { planCache.delete(orgId); accessCache.delete(orgId) }
  else { planCache.clear(); accessCache.clear() }
}

// ── Plan resolution ───────────────────────────────────────────────────────────

const isActive = (sub) => {
  if (!sub || sub.suspended) return false
  if (!ACTIVE_STATUSES.includes(sub.status)) return false
  if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) return false
  return true
}

// The plan an org falls back to with no (active) subscription.
async function getDefaultPlan() {
  const bySlug = await Plan.findOne({ where: { slug: config.billing.defaultPlanSlug, isActive: true } })
  if (bySlug) return bySlug
  return Plan.findOne({ where: { isActive: true }, order: [['price', 'ASC'], ['order', 'ASC']] })
}

async function getSubscription(orgId) {
  return Subscription.findOne({ where: { organizationId: orgId }, include: [{ model: Plan, as: 'plan' }] })
}

// The plan whose features/limits apply right now. Never null in normal operation
// (a default plan should always be seeded); returns null only on an empty catalog.
async function getEffectivePlan(orgId) {
  const cached = planCache.get(orgId)
  if (cached && cached.expires > Date.now()) return cached.plan

  const sub = await getSubscription(orgId)
  const plan = isActive(sub) ? sub.plan : await getDefaultPlan()
  planCache.set(orgId, { plan, expires: Date.now() + CACHE_TTL_MS })
  return plan
}

// ── Access gate (hard lockout) ────────────────────────────────────────────────
// A subscription locks the org out of the app entirely when it is suspended or
// is in any state other than active/trialing (canceled, expired, past_due).
// An org with no subscription row is NOT locked out — it predates billing or is
// admin-managed, and falls back to the default plan as before.
const isLockedOut = (sub) => {
  if (!sub) return false
  if (sub.suspended) return true
  return !ACTIVE_STATUSES.includes(sub.status)
}

// Cached per-org lockout decision (short TTL; invalidated on any subscription
// change) so it can be consulted on every authenticated request cheaply.
async function isOrgLocked(orgId) {
  if (!orgId) return false
  const cached = accessCache.get(orgId)
  if (cached && cached.expires > Date.now()) return cached.locked
  const sub = await Subscription.findOne({ where: { organizationId: orgId } })
  const locked = isLockedOut(sub)
  accessCache.set(orgId, { locked, expires: Date.now() + CACHE_TTL_MS })
  return locked
}

// Whether this caller is in billing-only mode (locked out of everything except
// the billing pages). System admins (role 'admin' — the platform operator) are
// always exempt so a misconfigured subscription can never lock them out.
async function isUserLocked(user) {
  if (!user || user.role === 'admin') return false
  return isOrgLocked(user.organizationId || user.id)
}

// ── Limits & metering ──────────────────────────────────────────────────────────

// A limit is unlimited when the key is absent, null, or negative.
const isUnlimited = (limit) => limit === undefined || limit === null || Number(limit) < 0

// First instant of the current calendar month (UTC — same clock as monthKey).
const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))

// Live-counted metrics: the database is authoritative because rows appear and
// disappear outside the meter middleware (demo seed, AI agent, document
// conversions, deletes). Monthly metrics count rows created this calendar
// month; `dataFlag != 2` mirrors the ERP soft-delete filter the list views use.
// Metrics not listed here fall back to the UsageCounter row.
const LIVE_COUNTERS = {
  seats: (orgId) => User.count({ where: { organizationId: orgId } }),
  'erp.invoices.monthly': (orgId) => Invoice.count({
    where: { organizationId: orgId, dataFlag: { [Op.ne]: 2 }, createdAt: { [Op.gte]: monthStart() } },
  }),
}

async function usedFor(orgId, metric, period = periodForMetric(metric)) {
  const live = LIVE_COUNTERS[metric]
  if (live) return live(orgId)
  const row = await UsageCounter.findOne({ where: { organizationId: orgId, metric, period } })
  return row ? row.count : 0
}

// Evaluate a quota against the current usage (live count where available).
async function checkLimit(orgId, metric, amount = 1) {
  const plan = await getEffectivePlan(orgId)
  const limit = plan?.limits?.[metric]
  if (isUnlimited(limit)) return { allowed: true, unlimited: true, limit: null, used: null, remaining: null }

  const used = await usedFor(orgId, metric)
  const remaining = Number(limit) - used
  return { allowed: used + amount <= Number(limit), unlimited: false, limit: Number(limit), used, remaining }
}

const hasFeature = async (orgId, key) => {
  const plan = await getEffectivePlan(orgId)
  return !!plan?.features?.[key]
}

// Atomic-ish increment (findOrCreate + increment). Returns the new count.
async function increment(orgId, metric, amount = 1) {
  const period = periodForMetric(metric)
  const [row] = await UsageCounter.findOrCreate({
    where: { organizationId: orgId, metric, period },
    defaults: { count: 0 },
  })
  await row.increment('count', { by: amount })
  await row.reload()
  return row.count
}

// Throws a 403 when the org is at its seat cap. Called from the staff-creation
// path so a plan downgrade can't be bypassed by adding more users.
async function assertSeatAvailable(orgId) {
  const { allowed, limit } = await checkLimit(orgId, 'seats', 1)
  if (!allowed) {
    throw {
      status: 403,
      code: 'LIMIT_REACHED',
      message: `Seat limit reached (${limit}). Upgrade your plan to add more team members.`,
    }
  }
}

// ── Usage summary (for the billing dashboard) ──────────────────────────────────

async function getUsage(orgId) {
  const plan = await getEffectivePlan(orgId)
  const limits = plan?.limits || {}
  const out = []
  for (const metric of Object.keys(limits)) {
    out.push({
      metric,
      limit: isUnlimited(limits[metric]) ? null : Number(limits[metric]),
      used: await usedFor(orgId, metric),
    })
  }
  return out
}

// The metrics whose current usage exceeds `plan`'s limits (empty = within plan).
// Used to block a downgrade that the org's existing usage wouldn't fit into.
async function exceededLimits(orgId, plan) {
  const limits = plan?.limits || {}
  const offenders = []
  for (const metric of Object.keys(limits)) {
    if (isUnlimited(limits[metric])) continue
    const limit = Number(limits[metric])
    const used = await usedFor(orgId, metric)
    if (used > limit) offenders.push({ metric, limit, used })
  }
  return offenders
}

// Throw a 400 if current usage doesn't fit the target plan.
function assertWithinPlan(offenders, plan) {
  if (!offenders.length) return
  const detail = offenders.map((o) => `${o.metric} (${o.used}/${o.limit})`).join(', ')
  throw {
    status: 400,
    code: 'USAGE_OVER_LIMIT',
    message: `Current usage exceeds the "${plan.name}" plan limits: ${detail}. Reduce usage before switching to this plan.`,
  }
}

// ── Subscription lifecycle ──────────────────────────────────────────────────────

// Create or switch an organization's subscription to `planId`. For the manual
// provider this takes effect immediately and records an invoice for the period.
async function subscribe(orgId, planId, { provider = config.billing.provider } = {}) {
  const plan = await Plan.findByPk(planId)
  if (!plan || !plan.isActive) throw { status: 400, message: 'Plan not found or inactive' }

  const now = new Date()
  const trialing = plan.trialDays > 0
  const trialEndsAt = trialing ? new Date(now.getTime() + plan.trialDays * 86400000) : null
  const periodStart = now
  const periodEnd = trialing ? trialEndsAt : addInterval(now, plan.interval)

  const existing = await Subscription.findOne({ where: { organizationId: orgId } })
  const fields = {
    organizationId: orgId,
    planId: plan.id,
    status: trialing ? 'trialing' : 'active',
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    trialEndsAt,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    // Subscribing to a plan reactivates the org — clear any prior suspension so
    // the new plan actually takes effect (isActive treats suspended as inactive).
    suspended: false,
    provider,
  }
  const sub = existing ? await existing.update(fields) : await Subscription.create(fields)

  // Record a billing-history row. A free or trialing period is a zero/void
  // invoice; a paid manual plan is marked paid immediately (no gateway charge).
  if (Number(plan.price) > 0 && !trialing) {
    await SubscriptionInvoice.create({
      organizationId: orgId,
      planId: plan.id,
      amount: plan.price,
      currency: plan.currency,
      status: provider === 'manual' ? 'paid' : 'open',
      paidAt: provider === 'manual' ? now : null,
      periodStart,
      periodEnd,
      provider,
    })
  }

  invalidate(orgId)
  log.info(`Org ${orgId} subscribed to plan "${plan.slug}" (${fields.status})`)
  return getSubscription(orgId)
}

// Put a brand-new organization on the default plan. Best-effort: if the catalog
// is empty (plans not seeded yet) it simply no-ops so org creation never fails.
async function ensureDefaultSubscription(orgId) {
  const existing = await Subscription.findOne({ where: { organizationId: orgId } })
  if (existing) return existing
  const plan = await getDefaultPlan()
  if (!plan) return null
  return subscribe(orgId, plan.id)
}

// Cancel — at period end by default (keeps access until paid-through), or now.
async function cancel(orgId, { atPeriodEnd = true } = {}) {
  const sub = await Subscription.findOne({ where: { organizationId: orgId } })
  if (!sub) throw { status: 404, message: 'No active subscription' }
  if (atPeriodEnd) {
    await sub.update({ cancelAtPeriodEnd: true, canceledAt: new Date() })
  } else {
    await sub.update({ status: 'canceled', cancelAtPeriodEnd: true, canceledAt: new Date(), currentPeriodEnd: new Date() })
  }
  invalidate(orgId)
  return getSubscription(orgId)
}

// ── Admin: plan catalog CRUD ────────────────────────────────────────────────────

const listPlans = ({ includeInactive = false } = {}) =>
  Plan.findAll({ where: includeInactive ? {} : { isActive: true }, order: [['order', 'ASC'], ['price', 'ASC']] })

const listPublicPlans = () =>
  Plan.findAll({ where: { isActive: true, isPublic: true }, order: [['order', 'ASC'], ['price', 'ASC']] })

const getPlan = async (id) => {
  const plan = await Plan.findByPk(id)
  if (!plan) throw { status: 404, message: 'Plan not found' }
  return plan
}

async function createPlan(data) {
  const exists = await Plan.findOne({ where: { slug: data.slug } })
  if (exists) throw { status: 409, message: `Plan slug "${data.slug}" already exists` }
  const plan = await Plan.create(data)
  invalidate()
  return plan
}

async function updatePlan(id, data) {
  const plan = await getPlan(id)
  if (data.slug && data.slug !== plan.slug) {
    const clash = await Plan.findOne({ where: { slug: data.slug, id: { [Op.ne]: id } } })
    if (clash) throw { status: 409, message: `Plan slug "${data.slug}" already exists` }
  }
  await plan.update(data)
  invalidate()
  return plan
}

async function deletePlan(id) {
  const plan = await getPlan(id)
  const inUse = await Subscription.count({ where: { planId: id } })
  if (inUse > 0) throw { status: 409, message: 'Plan has active subscriptions — deactivate it instead' }
  await plan.destroy()
  invalidate()
}

// ── Admin: subscriptions overview ────────────────────────────────────────────────

const listSubscriptions = () =>
  Subscription.findAll({
    include: [
      { model: Plan, as: 'plan', attributes: ['id', 'slug', 'name', 'price', 'currency', 'interval'] },
      { model: User, as: 'organization', attributes: ['id', 'name', 'email'] },
    ],
    order: [['updatedAt', 'DESC']],
  })

// One organization's subscription with its plan and owning org, for the admin
// management screen. Returns null when the org has no subscription row yet.
const getSubscriptionDetail = (orgId) =>
  Subscription.findOne({
    where: { organizationId: orgId },
    include: [
      { model: Plan, as: 'plan' },
      { model: User, as: 'organization', attributes: ['id', 'name', 'email', 'companyName'] },
    ],
  })

// Admin override — assign a plan and/or force status, dates and suspension,
// bypassing trial/payment. Only the keys provided are touched.
async function adminSetSubscription(orgId, { planId, status, suspended, currentPeriodStart, currentPeriodEnd } = {}) {
  // Only (re)subscribe when the plan actually changes — re-running subscribe()
  // would reset the period and mint a fresh invoice on every save otherwise.
  const current = await Subscription.findOne({ where: { organizationId: orgId } })
  if (planId && (!current || current.planId !== planId)) {
    // Admins can't push an org onto a plan its current usage exceeds either.
    const plan = await Plan.findByPk(planId)
    if (!plan || !plan.isActive) throw { status: 400, message: 'Plan not found or inactive' }
    assertWithinPlan(await exceededLimits(orgId, plan), plan)
    await subscribe(orgId, planId)
  }

  const sub = await Subscription.findOne({ where: { organizationId: orgId } })
  if (sub) {
    const fields = {}
    if (status !== undefined) fields.status = status
    if (suspended !== undefined) fields.suspended = !!suspended
    if (currentPeriodStart !== undefined) fields.currentPeriodStart = currentPeriodStart
    if (currentPeriodEnd !== undefined) fields.currentPeriodEnd = currentPeriodEnd
    if (Object.keys(fields).length) await sub.update(fields)
  }
  invalidate(orgId)
  return getSubscription(orgId)
}

// Suspend / resume an organization. Suspending blocks plan access immediately
// (isActive falls through to the default plan) without altering the lifecycle.
async function setSuspended(orgId, suspended) {
  const sub = await Subscription.findOne({ where: { organizationId: orgId } })
  if (!sub) throw { status: 404, message: 'No subscription' }
  await sub.update({ suspended: !!suspended })
  invalidate(orgId)
  log.info(`Org ${orgId} subscription ${suspended ? 'suspended' : 'resumed'}`)
  return getSubscription(orgId)
}

const listInvoices = (orgId) =>
  SubscriptionInvoice.findAll({
    where: { organizationId: orgId },
    include: [{ model: Plan, as: 'plan', attributes: ['slug', 'name'] }],
    order: [['createdAt', 'DESC']],
  })

// ── Plan-change requests (tenant requests → admin approves) ──────────────────────
// Tenants can't self-activate a plan; they file a request that an admin approves
// (which activates the subscription immediately, manual provider) or rejects.
const PENDING = 'pending'

const PLAN_ATTRS = ['id', 'slug', 'name', 'price', 'currency', 'interval']

const getPlanChangeRequest = (id) =>
  PlanChangeRequest.findByPk(id, {
    include: [
      { model: Plan, as: 'plan', attributes: PLAN_ATTRS },
      { model: User, as: 'organization', attributes: ['id', 'name', 'email'] },
    ],
  })

// The org's current open request, if any (drives the tenant's billing UI).
const getPendingRequest = (orgId) =>
  PlanChangeRequest.findOne({
    where: { organizationId: orgId, status: PENDING },
    include: [{ model: Plan, as: 'plan', attributes: PLAN_ATTRS }],
  })

// File (or update) the org's single open request.
async function requestPlanChange(orgId, planId, { note = null } = {}) {
  const plan = await Plan.findByPk(planId)
  if (!plan || !plan.isActive) throw { status: 400, message: 'Plan not found or inactive' }
  // Block requesting a plan the org's current usage already exceeds.
  assertWithinPlan(await exceededLimits(orgId, plan), plan)
  const existing = await PlanChangeRequest.findOne({ where: { organizationId: orgId, status: PENDING } })
  if (existing) {
    await existing.update({ planId, note })
    return getPlanChangeRequest(existing.id)
  }
  const req = await PlanChangeRequest.create({ organizationId: orgId, planId, note, status: PENDING })
  log.info(`Org ${orgId} requested plan "${plan.slug}"`)
  return getPlanChangeRequest(req.id)
}

const listPlanChangeRequests = ({ status } = {}) =>
  PlanChangeRequest.findAll({
    where: status ? { status } : {},
    include: [
      { model: Plan, as: 'plan', attributes: PLAN_ATTRS },
      { model: User, as: 'organization', attributes: ['id', 'name', 'email'] },
    ],
    order: [['createdAt', 'DESC']],
  })

async function approvePlanChangeRequest(id, adminUserId) {
  const req = await PlanChangeRequest.findByPk(id)
  if (!req) throw { status: 404, message: 'Request not found' }
  if (req.status !== PENDING) throw { status: 400, message: 'Request is not pending' }
  // Re-validate at approval time — usage may have grown since the request.
  const plan = await Plan.findByPk(req.planId)
  if (!plan || !plan.isActive) throw { status: 400, message: 'Plan not found or inactive' }
  assertWithinPlan(await exceededLimits(req.organizationId, plan), plan)
  // Activate immediately via the manual provider — records a paid invoice for
  // paid plans and clears any billing-only lockout (subscribe invalidates cache).
  await subscribe(req.organizationId, req.planId)
  await req.update({ status: 'approved', decidedBy: adminUserId || null, decidedAt: new Date() })
  log.info(`Plan request ${id} approved by ${adminUserId}`)
  return getPlanChangeRequest(id)
}

async function rejectPlanChangeRequest(id, adminUserId, { note = null } = {}) {
  const req = await PlanChangeRequest.findByPk(id)
  if (!req) throw { status: 404, message: 'Request not found' }
  if (req.status !== PENDING) throw { status: 400, message: 'Request is not pending' }
  await req.update({ status: 'rejected', decidedBy: adminUserId || null, decidedAt: new Date(), decisionNote: note })
  return getPlanChangeRequest(id)
}

module.exports = {
  // resolution
  getEffectivePlan, getSubscription, getDefaultPlan, isActive,
  // access gate
  isLockedOut, isOrgLocked, isUserLocked,
  // limits / metering
  checkLimit, hasFeature, increment, assertSeatAvailable, getUsage, periodForMetric, exceededLimits,
  // lifecycle
  subscribe, cancel, ensureDefaultSubscription,
  // admin
  listPlans, listPublicPlans, getPlan, createPlan, updatePlan, deletePlan,
  listSubscriptions, getSubscriptionDetail, adminSetSubscription, setSuspended, listInvoices,
  // plan-change requests
  requestPlanChange, getPendingRequest, listPlanChangeRequests,
  approvePlanChangeRequest, rejectPlanChangeRequest,
  // cache (exposed for tests)
  _invalidate: invalidate,
}
