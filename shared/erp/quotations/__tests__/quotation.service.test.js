// Unit tests for quotation.service.
//
// The transactional create/update bodies are deliberately not unit-tested.
// What matters here is the unusual transition matrix (back-to-draft is
// allowed from sent/accepted/rejected, but converted is terminal) and the
// tree-ordered hand-off from convertToOrder() to orders.create.

jest.mock('../../../../server/models', () => ({
  Quotation:     { findAndCountAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  QuotationItem: { destroy: jest.fn(), create: jest.fn() },
  Customer:      {},
  Product:       {},
  Item:          {},
  SaleItem:      {},
  SalePackage:   {},
  Store:         {},
  User:          {},
  sequelize:     { transaction: jest.fn() },
}))

jest.mock('../../audit/audit.service', () => ({ log: jest.fn() }))
jest.mock('../../settings/services/currency.service', () => ({ getRateOn: jest.fn(() => 1) }), { virtual: true })
jest.mock('../../settings/services/sequence.service', () => ({ getNext: jest.fn(() => 'QT-1') }), { virtual: true })

// sale-order.service is require()d from convertToOrder; use the resolved path
// from the caller's perspective (../sale-orders/services/sale-order.service).
jest.mock('../../sale-orders/services/sale-order.service', () => ({ create: jest.fn() }))

const { Op } = require('sequelize')
const { Quotation } = require('../../../../server/models')
const audit = require('../../audit/audit.service')
const orderSvc = require('../../sale-orders/services/sale-order.service')
const service = require('../quotation.service')

describe('quotation.list', () => {
  beforeEach(() => {
    Quotation.findAndCountAll.mockResolvedValue({ count: 0, rows: [] })
  })

  test('paginates, scopes by org, excludes soft-deleted, uses subQuery: false', async () => {
    Quotation.findAndCountAll.mockResolvedValueOnce({ count: 4, rows: [{ id: 'q1' }] })
    const out = await service.list({ page: 2, limit: 2, organizationId: 'o' })
    expect(out).toEqual({ total: 4, page: 2, limit: 2, quotations: [{ id: 'q1' }] })
    const args = Quotation.findAndCountAll.mock.calls[0][0]
    expect(args.offset).toBe(2)
    expect(args.where.organizationId).toBe('o')
    expect(args.where.dataFlag[Op.ne]).toBe(2)
    // subQuery: false is necessary because we filter by the joined $customer.name$
    expect(args.subQuery).toBe(false)
  })

  test('search filters across refNo and joined customer.name', async () => {
    await service.list({ search: 'acme', organizationId: 'o' })
    const or = Quotation.findAndCountAll.mock.calls[0][0].where[Op.or]
    expect(or).toHaveLength(2)
    expect(or[0].refNo[Op.like]).toBe('%acme%')
    expect(or[1]['$customer.name$'][Op.like]).toBe('%acme%')
  })

  test('dateFrom / dateTo build gte/lte on quotationDate', async () => {
    await service.list({ dateFrom: '2025-01-01', dateTo: '2025-01-31', organizationId: 'o' })
    const range = Quotation.findAndCountAll.mock.calls[0][0].where.quotationDate
    expect(range[Op.gte]).toBe('2025-01-01')
    expect(range[Op.lte]).toBe('2025-01-31')
  })
})

describe('quotation.getById', () => {
  test('throws 404 when missing', async () => {
    Quotation.findByPk.mockResolvedValue(null)
    await expect(service.getById('missing')).rejects.toEqual({ status: 404, message: 'Quotation not found' })
  })
})

describe('quotation.updateStatus — transitions', () => {
  test('no-op when target == current', async () => {
    Quotation.findByPk
      .mockResolvedValueOnce({ id: 'q1', status: 'sent' })
      .mockResolvedValueOnce({ id: 'q1', status: 'sent' })
    await service.updateStatus('q1', 'sent', 'u')
    expect(audit.log).not.toHaveBeenCalled()
  })

  test('throws 404 when missing', async () => {
    Quotation.findByPk.mockResolvedValue(null)
    await expect(service.updateStatus('missing', 'sent', 'u'))
      .rejects.toEqual({ status: 404, message: 'Quotation not found' })
  })

  test('rejects illegal transition (draft → accepted)', async () => {
    Quotation.findByPk.mockResolvedValue({ id: 'q1', status: 'draft' })
    await expect(service.updateStatus('q1', 'accepted', 'u'))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining("from 'draft' to 'accepted'") })
  })

  test('terminal: converted has no exits', async () => {
    Quotation.findByPk.mockResolvedValue({ id: 'q1', status: 'converted' })
    await expect(service.updateStatus('q1', 'draft', 'u'))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining("from 'converted' to 'draft'") })
  })

  test('allows the back-to-draft path from sent / accepted / rejected', async () => {
    for (const from of ['sent', 'accepted', 'rejected']) {
      const q = { id: 'q1', status: from, refNo: 'QT-1', total: 100, update: jest.fn().mockResolvedValue() }
      Quotation.findByPk
        .mockResolvedValueOnce(q)
        .mockResolvedValueOnce({ id: 'q1', status: 'draft' })
      await service.updateStatus('q1', 'draft', 'u')
      expect(q.update).toHaveBeenCalledWith({ status: 'draft', modifiedBy: 'u' })
    }
  })

  test('draft → sent flips status and writes audit log', async () => {
    const q = { id: 'q1', status: 'draft', refNo: 'QT-1', total: 100, update: jest.fn().mockResolvedValue() }
    Quotation.findByPk
      .mockResolvedValueOnce(q)
      .mockResolvedValueOnce({ id: 'q1', status: 'sent' })
    await service.updateStatus('q1', 'sent', 'u')
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'quotation.sent',
      entityType: 'Quotation',
      entityId: 'q1',
      summary: expect.objectContaining({ from: 'draft', to: 'sent', refNo: 'QT-1' }),
    }))
  })

  test('audit failure does NOT block the status change', async () => {
    audit.log.mockImplementation(() => { throw new Error('audit boom') })
    const q = { id: 'q1', status: 'draft', refNo: 'QT-1', total: 100, update: jest.fn().mockResolvedValue() }
    Quotation.findByPk
      .mockResolvedValueOnce(q)
      .mockResolvedValueOnce({ id: 'q1', status: 'sent' })
    await expect(service.updateStatus('q1', 'sent', 'u')).resolves.toBeDefined()
    expect(q.update).toHaveBeenCalled()
  })
})

describe('quotation.convertToOrder', () => {
  test('refuses non-accepted status', async () => {
    Quotation.findOne.mockResolvedValue({ id: 'q1', status: 'sent', items: [] })
    await expect(service.convertToOrder('q1', 'u', 'o'))
      .rejects.toEqual({ status: 400, message: 'Only accepted quotations can be converted to an order' })
  })

  test('refuses when already converted', async () => {
    Quotation.findOne.mockResolvedValue({ id: 'q1', status: 'accepted', convertedToOrderId: 'order-old', items: [] })
    await expect(service.convertToOrder('q1', 'u', 'o'))
      .rejects.toEqual({ status: 400, message: 'This quotation has already been converted to an order' })
  })

  test('happy path: items handed off in tree order (parent → child → sibling), quotation marked converted + linked', async () => {
    const q = {
      id: 'q1', status: 'accepted', convertedToOrderId: null,
      customerId: 'c', quotationDate: '2025-01-01', notes: 'hi',
      currency: 'USD', exchangeRate: 35,
      referenceNumber: 'PO-1', paymentTerms: 'Net 30', salespersonId: 'sp',
      shippingAddress: 'ship', billingAddress: 'bill',
      discountType: 'percent', discountValue: 5,
      items: [
        // parent
        { id: 'p',  productId: 'prod-A', productName: 'A', quantity: 2, unitPrice: 10, taxRate: 7, parentItemId: null, salePackageId: null },
        // child of p
        { id: 'c1', productId: 'prod-B', productName: 'B', quantity: 1, unitPrice: 0,  taxRate: 0, parentItemId: 'p', salePackageId: null },
        // sibling top-level
        { id: 'q',  productId: 'prod-C', productName: 'C', quantity: 3, unitPrice: 5,  taxRate: 0, parentItemId: null, salePackageId: null },
      ],
    }
    const dbRow = { id: 'q1', update: jest.fn().mockResolvedValue() }
    Quotation.findOne.mockResolvedValueOnce(q) // initial getById (org-scoped)
    Quotation.findByPk
      .mockResolvedValueOnce(dbRow)     // dbRow for update
      .mockResolvedValueOnce({ id: 'q1', status: 'converted', convertedToOrderId: 'order-new' }) // final getById
    orderSvc.create.mockResolvedValue({ id: 'order-new' })

    const out = await service.convertToOrder('q1', 'u', 'org')
    expect(out.orderId).toBe('order-new')

    const payload = orderSvc.create.mock.calls[0][0]
    expect(payload.customerId).toBe('c')
    expect(payload.currency).toBe('USD')
    expect(payload.discountType).toBe('percent')
    expect(payload.discountValue).toBe(5)
    // Tree order: parent p, child c1, sibling q
    expect(payload.items.map(i => i.key)).toEqual(['p', 'c1', 'q'])
    expect(payload.items[1].parentKey).toBe('p')  // child resolves parent
    expect(payload.items[2].parentKey).toBe('')   // top-level has no parent

    // Quotation persisted as converted + linked to new order
    expect(dbRow.update).toHaveBeenCalledWith({
      status: 'converted',
      convertedToOrderId: 'order-new',
      modifiedBy: 'u',
    })
  })

  test('forwards organizationId + userId to orders.create', async () => {
    const q = {
      id: 'q1', status: 'accepted', convertedToOrderId: null,
      items: [{ id: 'p', productName: 'A', quantity: 1, unitPrice: 10, taxRate: 0, parentItemId: null }],
    }
    Quotation.findOne.mockResolvedValueOnce(q)
    Quotation.findByPk
      .mockResolvedValueOnce({ id: 'q1', update: jest.fn().mockResolvedValue() })
      .mockResolvedValueOnce({ id: 'q1', status: 'converted' })
    orderSvc.create.mockResolvedValue({ id: 'order-new' })
    await service.convertToOrder('q1', 'user-1', 'org-1')
    const payload = orderSvc.create.mock.calls[0][0]
    expect(payload.userId).toBe('user-1')
    expect(payload.organizationId).toBe('org-1')
  })
})

describe('quotation.update guards', () => {
  test('throws 404 when missing', async () => {
    Quotation.findByPk.mockResolvedValue(null)
    await expect(service.update('missing', {}, 'u'))
      .rejects.toEqual({ status: 404, message: 'Quotation not found' })
  })

  test('refuses anything other than draft', async () => {
    Quotation.findByPk.mockResolvedValue({ id: 'q1', status: 'sent' })
    await expect(service.update('q1', { notes: 'x' }, 'u'))
      .rejects.toEqual({ status: 400, message: 'Only draft quotations can be edited' })
  })
})

describe('quotation.remove', () => {
  test('throws 404 when missing', async () => {
    Quotation.findByPk.mockResolvedValue(null)
    await expect(service.remove('missing')).rejects.toEqual({ status: 404, message: 'Quotation not found' })
  })

  test('refuses anything other than draft', async () => {
    Quotation.findByPk.mockResolvedValue({ id: 'q1', status: 'accepted' })
    await expect(service.remove('q1'))
      .rejects.toEqual({ status: 400, message: 'Only draft quotations can be deleted' })
  })

  test('destroys a draft', async () => {
    const q = { id: 'q1', status: 'draft', destroy: jest.fn().mockResolvedValue() }
    Quotation.findByPk.mockResolvedValue(q)
    await service.remove('q1')
    expect(q.destroy).toHaveBeenCalled()
  })
})
