// Unit tests for modules/billing.service — plan resolution, quota checks, seat
// enforcement, metering and the cancel lifecycle. Models are mocked so the suite
// is pure logic with no database. Run from server/ (see server/jest.config.js).

jest.mock('../../../models', () => ({
  Plan:                { findByPk: jest.fn(), findOne: jest.fn(), findAll: jest.fn(), create: jest.fn() },
  Subscription:        { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn(), count: jest.fn(), findAll: jest.fn() },
  UsageCounter:        { findOne: jest.fn(), findOrCreate: jest.fn() },
  SubscriptionInvoice: { create: jest.fn(), findAll: jest.fn() },
  PlanChangeRequest:   { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn(), findAll: jest.fn() },
  User:                { count: jest.fn() },
  Invoice:             { count: jest.fn() },
}))

const { Op } = require('sequelize')
const { Plan, Subscription, UsageCounter, PlanChangeRequest, User, Invoice } = require('../../../models')
const service = require('../billing.service')

const future = new Date(Date.now() + 30 * 86400000)
const PRO  = { id: 'pro',  slug: 'pro',  limits: { seats: 5, 'erp.invoices.monthly': 100, storageMb: 1024 }, features: { 'ai-agent': true } }
const FREE = { id: 'free', slug: 'free', limits: { seats: 2, 'erp.invoices.monthly': 20 }, features: { 'ai-agent': false } }

beforeEach(() => service._invalidate())

describe('getEffectivePlan', () => {
  test('returns the subscription plan when the subscription is active', async () => {
    Subscription.findOne.mockResolvedValue({ status: 'active', currentPeriodEnd: future, plan: PRO })
    await expect(service.getEffectivePlan('org-active')).resolves.toBe(PRO)
  })

  test('falls back to the default plan when there is no subscription', async () => {
    Subscription.findOne.mockResolvedValue(null)
    Plan.findOne.mockResolvedValue(FREE) // getDefaultPlan by configured slug
    await expect(service.getEffectivePlan('org-none')).resolves.toBe(FREE)
  })

  test('falls back to default when the subscription is expired', async () => {
    Subscription.findOne.mockResolvedValue({ status: 'active', currentPeriodEnd: new Date(Date.now() - 1000), plan: PRO })
    Plan.findOne.mockResolvedValue(FREE)
    await expect(service.getEffectivePlan('org-expired')).resolves.toBe(FREE)
  })
})

describe('checkLimit', () => {
  beforeEach(() => {
    Subscription.findOne.mockResolvedValue({ status: 'active', currentPeriodEnd: future, plan: PRO })
  })

  test('allows when usage + amount is within the limit', async () => {
    Invoice.count.mockResolvedValue(99)
    await expect(service.checkLimit('o', 'erp.invoices.monthly', 1))
      .resolves.toMatchObject({ allowed: true, limit: 100, used: 99 })
  })

  test('blocks when usage + amount would exceed the limit', async () => {
    Invoice.count.mockResolvedValue(100)
    await expect(service.checkLimit('o', 'erp.invoices.monthly', 1))
      .resolves.toMatchObject({ allowed: false, used: 100 })
  })

  test('invoices are live-counted: org-scoped, soft-deletes excluded, current month only', async () => {
    Invoice.count.mockResolvedValue(3)
    await service.checkLimit('o', 'erp.invoices.monthly', 1)
    const { where } = Invoice.count.mock.calls.at(-1)[0]
    expect(where.organizationId).toBe('o')
    expect(where.dataFlag[Op.ne]).toBe(2)
    const since = where.createdAt[Op.gte]
    const now = new Date()
    expect(since.toISOString()).toBe(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString())
  })

  test('metrics without a live counter fall back to the usage counter', async () => {
    UsageCounter.findOne.mockResolvedValue({ count: 512 })
    await expect(service.checkLimit('o', 'storageMb', 1))
      .resolves.toMatchObject({ allowed: true, limit: 1024, used: 512 })
    expect(UsageCounter.findOne).toHaveBeenCalledWith(
      { where: { organizationId: 'o', metric: 'storageMb', period: 'lifetime' } })
  })

  test('treats a -1 limit as unlimited', async () => {
    Subscription.findOne.mockResolvedValue({ status: 'active', currentPeriodEnd: future, plan: { limits: { seats: -1 } } })
    await expect(service.checkLimit('o', 'seats', 1)).resolves.toMatchObject({ allowed: true, unlimited: true })
  })

  test('treats an absent limit key as unlimited', async () => {
    await expect(service.checkLimit('o', 'unknown.metric', 1)).resolves.toMatchObject({ allowed: true, unlimited: true })
  })

  test('seats use the live staff count, not the usage counter', async () => {
    User.count.mockResolvedValue(5)
    await expect(service.checkLimit('o', 'seats', 1)).resolves.toMatchObject({ allowed: false, limit: 5, used: 5 })
    expect(User.count).toHaveBeenCalledWith({ where: { organizationId: 'o' } })
  })
})

describe('assertSeatAvailable', () => {
  test('throws 403 LIMIT_REACHED when at the seat cap', async () => {
    Subscription.findOne.mockResolvedValue({ status: 'active', currentPeriodEnd: future, plan: { limits: { seats: 2 } } })
    User.count.mockResolvedValue(2)
    await expect(service.assertSeatAvailable('o')).rejects.toMatchObject({ status: 403, code: 'LIMIT_REACHED' })
  })

  test('passes when a seat is free', async () => {
    Subscription.findOne.mockResolvedValue({ status: 'active', currentPeriodEnd: future, plan: { limits: { seats: 5 } } })
    User.count.mockResolvedValue(2)
    await expect(service.assertSeatAvailable('o')).resolves.toBeUndefined()
  })
})

describe('increment', () => {
  test('upserts the counter and increments it', async () => {
    const row = { count: 6, increment: jest.fn().mockResolvedValue(), reload: jest.fn().mockResolvedValue() }
    UsageCounter.findOrCreate.mockResolvedValue([row, true])
    const result = await service.increment('o', 'erp.invoices.monthly', 1)
    expect(UsageCounter.findOrCreate).toHaveBeenCalled()
    expect(row.increment).toHaveBeenCalledWith('count', { by: 1 })
    expect(result).toBe(6)
  })
})

describe('hasFeature', () => {
  test('reflects the plan feature flag', async () => {
    Subscription.findOne.mockResolvedValue({ status: 'active', currentPeriodEnd: future, plan: PRO })
    await expect(service.hasFeature('o', 'ai-agent')).resolves.toBe(true)
  })

  test('is false for a feature the plan does not include', async () => {
    Subscription.findOne.mockResolvedValue({ status: 'active', currentPeriodEnd: future, plan: FREE })
    await expect(service.hasFeature('o', 'ai-agent')).resolves.toBe(false)
  })
})

describe('suspended subscriptions', () => {
  test('a suspended subscription falls back to the default plan', async () => {
    Subscription.findOne.mockResolvedValue({ status: 'active', currentPeriodEnd: future, suspended: true, plan: PRO })
    Plan.findOne.mockResolvedValue(FREE)
    await expect(service.getEffectivePlan('org-suspended')).resolves.toBe(FREE)
  })

  test('setSuspended flips the flag and returns the subscription', async () => {
    const sub = { update: jest.fn().mockResolvedValue() }
    Subscription.findOne.mockResolvedValue(sub)
    await service.setSuspended('o', true)
    expect(sub.update).toHaveBeenCalledWith({ suspended: true })
  })

  test('setSuspended throws 404 when there is no subscription', async () => {
    Subscription.findOne.mockResolvedValue(null)
    await expect(service.setSuspended('o', true)).rejects.toMatchObject({ status: 404 })
  })
})

describe('access gate', () => {
  test('isLockedOut: only active/trialing are allowed; suspended always locks', () => {
    expect(service.isLockedOut(null)).toBe(false)                              // no row → not locked
    expect(service.isLockedOut({ status: 'active' })).toBe(false)
    expect(service.isLockedOut({ status: 'trialing' })).toBe(false)
    expect(service.isLockedOut({ status: 'active', suspended: true })).toBe(true)
    expect(service.isLockedOut({ status: 'canceled' })).toBe(true)
    expect(service.isLockedOut({ status: 'past_due' })).toBe(true)
    expect(service.isLockedOut({ status: 'expired' })).toBe(true)
  })

  test('isUserLocked exempts system admins without hitting the DB', async () => {
    Subscription.findOne.mockReset()
    await expect(service.isUserLocked({ role: 'admin', id: 'a1' })).resolves.toBe(false)
    expect(Subscription.findOne).not.toHaveBeenCalled()
  })

  test('isUserLocked is true when the org is locked out', async () => {
    Subscription.findOne.mockResolvedValue({ status: 'canceled' })
    await expect(service.isUserLocked({ role: 'user', id: 'org-locked' })).resolves.toBe(true)
  })

  test('isUserLocked is false for an active subscription', async () => {
    Subscription.findOne.mockResolvedValue({ status: 'active' })
    await expect(service.isUserLocked({ role: 'user', id: 'org-ok' })).resolves.toBe(false)
  })
})

describe('adminSetSubscription', () => {
  test('does not re-subscribe when the plan is unchanged', async () => {
    const sub = { planId: 'pro', update: jest.fn().mockResolvedValue() }
    Subscription.findOne.mockResolvedValue(sub)
    await service.adminSetSubscription('o', { planId: 'pro', status: 'past_due' })
    expect(Plan.findByPk).not.toHaveBeenCalled() // subscribe() would have looked the plan up
    expect(sub.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'past_due' }))
  })

  test('applies suspended and date overrides', async () => {
    const sub = { planId: 'pro', update: jest.fn().mockResolvedValue() }
    Subscription.findOne.mockResolvedValue(sub)
    await service.adminSetSubscription('o', { suspended: true, currentPeriodEnd: future })
    expect(sub.update).toHaveBeenCalledWith(expect.objectContaining({ suspended: true, currentPeriodEnd: future }))
  })

  test('blocks an admin downgrade that current usage exceeds', async () => {
    Subscription.findOne.mockResolvedValue({ planId: 'pro', update: jest.fn().mockResolvedValue() })
    Plan.findByPk.mockResolvedValue({ id: 'free', name: 'Free', isActive: true, limits: { seats: 2 } })
    User.count.mockResolvedValue(5)
    await expect(service.adminSetSubscription('o', { planId: 'free' }))
      .rejects.toMatchObject({ status: 400, code: 'USAGE_OVER_LIMIT' })
  })
})

describe('plan-change requests', () => {
  test('requestPlanChange creates a pending request when none is open', async () => {
    Plan.findByPk.mockResolvedValue({ id: 'p1', slug: 'pro', isActive: true })
    PlanChangeRequest.findOne.mockResolvedValue(null)
    PlanChangeRequest.create.mockResolvedValue({ id: 'r1' })
    PlanChangeRequest.findByPk.mockResolvedValue({ id: 'r1', status: 'pending' })
    await service.requestPlanChange('org1', 'p1', { note: 'please' })
    expect(PlanChangeRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org1', planId: 'p1', status: 'pending', note: 'please' }))
  })

  test('requestPlanChange reuses the existing open request', async () => {
    Plan.findByPk.mockResolvedValue({ id: 'p2', slug: 'ent', isActive: true })
    const existing = { id: 'r9', update: jest.fn().mockResolvedValue() }
    PlanChangeRequest.findOne.mockResolvedValue(existing)
    PlanChangeRequest.findByPk.mockResolvedValue({ id: 'r9' })
    await service.requestPlanChange('org1', 'p2', { note: 'switch' })
    expect(existing.update).toHaveBeenCalledWith({ planId: 'p2', note: 'switch' })
    expect(PlanChangeRequest.create).not.toHaveBeenCalled()
  })

  test('requestPlanChange rejects an inactive plan', async () => {
    Plan.findByPk.mockResolvedValue({ id: 'p3', isActive: false })
    await expect(service.requestPlanChange('org1', 'p3')).rejects.toMatchObject({ status: 400 })
  })

  test('requestPlanChange is blocked when usage exceeds the target plan limits', async () => {
    Plan.findByPk.mockResolvedValue({ id: 'p4', name: 'Free', isActive: true, limits: { seats: 2 } })
    User.count.mockResolvedValue(5) // 5 seats in use > limit of 2
    await expect(service.requestPlanChange('org1', 'p4'))
      .rejects.toMatchObject({ status: 400, code: 'USAGE_OVER_LIMIT' })
    expect(PlanChangeRequest.create).not.toHaveBeenCalled()
  })

  test('approve activates the plan (subscribe) and marks the request approved', async () => {
    const req = { id: 'r1', status: 'pending', organizationId: 'org1', planId: 'p1', update: jest.fn().mockResolvedValue() }
    PlanChangeRequest.findByPk.mockResolvedValue(req)
    // subscribe() path: free plan, no existing subscription → no invoice.
    Plan.findByPk.mockResolvedValue({ id: 'p1', slug: 'free', price: 0, currency: 'USD', interval: 'month', trialDays: 0, isActive: true })
    Subscription.findOne.mockResolvedValue(null)
    Subscription.create.mockResolvedValue({})
    await service.approvePlanChangeRequest('r1', 'admin1')
    expect(Subscription.create).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org1', planId: 'p1' }))
    expect(req.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved', decidedBy: 'admin1' }))
  })

  test('approve refuses a non-pending request', async () => {
    PlanChangeRequest.findByPk.mockResolvedValue({ id: 'r1', status: 'approved' })
    await expect(service.approvePlanChangeRequest('r1', 'admin1')).rejects.toMatchObject({ status: 400 })
  })

  test('reject marks the request rejected with a note', async () => {
    const req = { id: 'r2', status: 'pending', update: jest.fn().mockResolvedValue() }
    PlanChangeRequest.findByPk.mockResolvedValue(req)
    await service.rejectPlanChangeRequest('r2', 'admin1', { note: 'nope' })
    expect(req.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected', decisionNote: 'nope', decidedBy: 'admin1' }))
  })
})

describe('cancel', () => {
  test('flags cancelAtPeriodEnd by default', async () => {
    const sub = { update: jest.fn().mockResolvedValue() }
    Subscription.findOne.mockResolvedValue(sub)
    await service.cancel('o')
    expect(sub.update).toHaveBeenCalledWith(expect.objectContaining({ cancelAtPeriodEnd: true }))
  })

  test('throws 404 when there is no subscription', async () => {
    Subscription.findOne.mockResolvedValue(null)
    await expect(service.cancel('o')).rejects.toMatchObject({ status: 404 })
  })
})
