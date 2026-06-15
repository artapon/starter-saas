// Unit tests for the automatic audit-capture middleware.
//
//   1. describe() derives { action, entityType, entityId } from method + path
//      (incl. the nested/ambiguous routes and trailing-action verbs).
//   2. auditCapture() logs exactly once per successful mutation, and skips
//      GETs, non-2xx responses, unauthenticated requests, and res.locals.skipAudit.

const EventEmitter = require('events')

jest.mock('../audit.service', () => ({ log: jest.fn() }))
jest.mock('../../settings/services/general.service', () => ({ isAuditDebug: jest.fn().mockResolvedValue(false) }))
const audit = require('../audit.service')
const general = require('../../settings/services/general.service')
const { auditCapture, describe: describeAction } = require('../audit.middleware')

const UUID = '11111111-1111-1111-1111-111111111111'

// The finish handler is async (it may consult the debug setting), so let any
// pending microtasks/IO callbacks run before asserting.
const tick = () => new Promise((r) => setImmediate(r))

describe('describe() — action/entity derivation', () => {
  const cases = [
    ['POST',   '/api/erp/customers',                     'customer.create',        'Customer'],
    ['PUT',    `/api/erp/sale-orders/${UUID}`,                'order.update',           'Order'],
    ['PATCH',  `/api/erp/sale-orders/${UUID}`,                'order.update',           'Order'],
    ['DELETE', `/api/erp/item-master/${UUID}`,           'product.delete',         'Product'],
    ['POST',   '/api/erp/customer-groups',               'customer-group.create',  'CustomerGroup'],
    ['POST',   '/api/erp/purchasing/orders',             'purchase-order.create',  'PurchaseOrder'],
    ['POST',   '/api/erp/purchasing/requisitions',       'purchase-requisition.create', 'PurchaseRequisition'],
    ['POST',   '/api/erp/accounting/chart-of-accounts',  'chart-of-account.create', 'ChartOfAccount'],
    ['POST',   '/api/erp/settings/currencies',           'currency.create',        'Currency'],
    ['POST',   `/api/erp/sale-orders/${UUID}/confirm`,        'order.confirm',          'Order'],
    ['POST',   '/api/erp/widgets',                       'widget.create',          'Widget'], // fallback
  ]
  test.each(cases)('%s %s → %s / %s', (method, path, action, entityType) => {
    const info = describeAction(method, path, null)
    expect(info.action).toBe(action)
    expect(info.entityType).toBe(entityType)
  })

  test('entityId comes from a UUID in the path', () => {
    expect(describeAction('PUT', `/api/erp/sale-orders/${UUID}`, null).entityId).toBe(UUID)
  })

  test('entityId falls back to the created row id in the response body', () => {
    const info = describeAction('POST', '/api/erp/customers', { data: { id: UUID } })
    expect(info.entityId).toBe(UUID)
  })

  test('entityId is null when neither path nor body carries a UUID', () => {
    expect(describeAction('POST', '/api/erp/customers', { data: { id: 42 } }).entityId).toBeNull()
  })

  test('ignores the query string', () => {
    expect(describeAction('POST', '/api/erp/customers?foo=bar', null).action).toBe('customer.create')
  })
})

// Build a fake (req,res) pair where res is an EventEmitter so we can fire
// 'finish' the way Express does after the handler responds.
function harness({ method = 'POST', url = '/api/erp/customers', user = { id: 'u' }, status = 201, body = {} } = {}) {
  const req = { method, originalUrl: url, url, user, ip: '10.0.0.1', body }
  const res = new EventEmitter()
  res.statusCode = status
  res.locals = {}
  res.json = (body) => body // replaced by the middleware
  const next = jest.fn()
  return { req, res, next }
}

describe('auditCapture()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    general.isAuditDebug.mockResolvedValue(false)
  })

  test('logs once on a successful mutation, with derived fields', async () => {
    const { req, res, next } = harness()
    auditCapture(req, res, next)
    expect(next).toHaveBeenCalled()
    res.json({ data: { id: UUID } }) // handler responds
    res.emit('finish')
    await tick()
    expect(audit.log).toHaveBeenCalledTimes(1)
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      user: req.user, action: 'customer.create', entityType: 'Customer',
      entityId: UUID, method: 'POST', ip: '10.0.0.1', summary: { method: 'POST' },
    }))
  })

  test('debug mode stores the (redacted) request payload', async () => {
    general.isAuditDebug.mockResolvedValue(true)
    const { req, res, next } = harness({ body: { name: 'Acme', password: 'hunter2' } })
    auditCapture(req, res, next)
    res.json({ data: { id: UUID } })
    res.emit('finish')
    await tick()
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      summary: { method: 'POST', payload: { name: 'Acme', password: '[redacted]' } },
    }))
  })

  test('skips GET (non-mutating)', async () => {
    const { req, res, next } = harness({ method: 'GET' })
    auditCapture(req, res, next)
    res.emit('finish')
    await tick()
    expect(audit.log).not.toHaveBeenCalled()
  })

  test('skips non-2xx responses', async () => {
    const { req, res, next } = harness({ status: 400 })
    auditCapture(req, res, next)
    res.emit('finish')
    await tick()
    expect(audit.log).not.toHaveBeenCalled()
  })

  test('skips unauthenticated requests', async () => {
    const { req, res, next } = harness({ user: null })
    auditCapture(req, res, next)
    res.emit('finish')
    await tick()
    expect(audit.log).not.toHaveBeenCalled()
  })

  test('skips when res.locals.skipAudit is set', async () => {
    const { req, res, next } = harness()
    auditCapture(req, res, next)
    res.locals.skipAudit = true
    res.emit('finish')
    await tick()
    expect(audit.log).not.toHaveBeenCalled()
  })
})
