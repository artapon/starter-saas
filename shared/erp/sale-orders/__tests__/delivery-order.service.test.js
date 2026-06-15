// Unit tests for orders/delivery-order.service.
//
// transition() / confirm / ship / deliver / cancel are the most interesting
// pieces — each enforces a specific prior-status precondition. The create /
// update paths run inside sequelize.transaction(); we test their input
// validation but not the full persistence body.

jest.mock('../../../../server/models', () => ({
  DeliveryOrder:     { findAndCountAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  DeliveryOrderItem: { destroy: jest.fn(), create: jest.fn() },
  Customer:          {},
  Order:             {},
  Product:           {},
  SaleItem:          {},
  SalePackage:       {},
  SalePackageItem:   {},
  Store:             {},
  User:              {},
  Invoice:           { findOne: jest.fn() },
  SalesOrderItem:    { findAll: jest.fn() },
}))

jest.mock('../../../../server/config/database', () => ({ transaction: jest.fn() }))
jest.mock('../../audit/audit.service', () => ({ log: jest.fn() }))
jest.mock('../../settings/services/sequence.service', () => ({ getNext: jest.fn(() => 'DO-1') }), { virtual: true })
jest.mock('../../invoices/invoice.service', () => ({ create: jest.fn() }), { virtual: true })

const { Op } = require('sequelize')
const { DeliveryOrder, Invoice, SalesOrderItem } = require('../../../../server/models')
const audit = require('../../audit/audit.service')
const invoiceSvc = require('../../invoices/invoice.service')
const service = require('../services/delivery-order.service')

describe('delivery-order.list', () => {
  beforeEach(() => {
    DeliveryOrder.findAndCountAll.mockResolvedValue({ count: 0, rows: [] })
  })

  test('paginates, scopes by org, excludes soft-deleted, distinct: true', async () => {
    DeliveryOrder.findAndCountAll.mockResolvedValueOnce({ count: 3, rows: [{ id: 'd1' }] })
    const out = await service.list({ page: 2, limit: 5, organizationId: 'o' })
    expect(out).toEqual({ total: 3, page: 2, limit: 5, deliveryOrders: [{ id: 'd1' }] })
    const args = DeliveryOrder.findAndCountAll.mock.calls[0][0]
    expect(args.offset).toBe(5)
    expect(args.where.organizationId).toBe('o')
    expect(args.where.dataFlag[Op.ne]).toBe(2)
    expect(args.distinct).toBe(true)
  })

  test('search applies LIKE on refNo', async () => {
    await service.list({ search: 'DO-5', organizationId: 'o' })
    const or = DeliveryOrder.findAndCountAll.mock.calls[0][0].where[Op.or]
    expect(or[0].refNo[Op.like]).toBe('%DO-5%')
  })

  test('dateFrom / dateTo build a gte/lte range on date', async () => {
    await service.list({ dateFrom: '2025-01-01', dateTo: '2025-01-31', organizationId: 'o' })
    const range = DeliveryOrder.findAndCountAll.mock.calls[0][0].where.date
    expect(range[Op.gte]).toBe('2025-01-01')
    expect(range[Op.lte]).toBe('2025-01-31')
  })
})

describe('delivery-order.getById', () => {
  test('throws 404 when missing', async () => {
    DeliveryOrder.findByPk.mockResolvedValue(null)
    await expect(service.getById('missing'))
      .rejects.toEqual({ status: 404, message: 'Delivery Order not found' })
  })

  test('joins linkedInvoice on the response', async () => {
    DeliveryOrder.findByPk.mockResolvedValue({
      id: 'd1', toJSON() { return { id: 'd1' } },
    })
    Invoice.findOne.mockResolvedValue({ id: 'inv', invoiceNumber: 'INV-9', status: 'sent' })
    const out = await service.getById('d1')
    expect(out.linkedInvoice).toEqual({ id: 'inv', invoiceNumber: 'INV-9', status: 'sent' })
  })
})

describe('delivery-order.create — validation', () => {
  test('rejects missing date / customer / empty items', async () => {
    await expect(service.create({ customerId: 'c', items: [{ qty: 1, productName: 'x' }] }))
      .rejects.toEqual({ status: 400, message: 'Date is required' })
    await expect(service.create({ date: '2025-01-01', items: [{ qty: 1, productName: 'x' }] }))
      .rejects.toEqual({ status: 400, message: 'Customer is required' })
    await expect(service.create({ date: '2025-01-01', customerId: 'c' }))
      .rejects.toEqual({ status: 400, message: 'At least one item is required' })
  })
})

describe('delivery-order — transitions', () => {
  test('confirm requires draft', async () => {
    DeliveryOrder.findByPk.mockResolvedValue({ id: 'd1', status: 'shipped' })
    await expect(service.confirm('d1', 'u'))
      .rejects.toEqual({ status: 400, message: 'Only draft delivery orders can be confirmed' })
  })

  test('ship requires confirmed', async () => {
    DeliveryOrder.findByPk.mockResolvedValue({ id: 'd1', status: 'draft' })
    await expect(service.ship('d1', 'u'))
      .rejects.toEqual({ status: 400, message: 'Only confirmed delivery orders can be marked as shipped' })
  })

  test('deliver requires shipped', async () => {
    DeliveryOrder.findByPk.mockResolvedValue({ id: 'd1', status: 'confirmed' })
    await expect(service.deliver('d1', 'u'))
      .rejects.toEqual({ status: 400, message: 'Only shipped delivery orders can be marked as delivered' })
  })

  test('confirm happy path: flips status and logs audit', async () => {
    const doc = { id: 'd1', refNo: 'DO-1', status: 'draft', update: jest.fn().mockResolvedValue() }
    DeliveryOrder.findByPk
      .mockResolvedValueOnce(doc)
      .mockResolvedValueOnce({ id: 'd1', toJSON() { return { id: 'd1' } } })
    Invoice.findOne.mockResolvedValue(null)
    await service.confirm('d1', 'u')
    expect(doc.update).toHaveBeenCalledWith({ status: 'confirmed', modifiedBy: 'u' })
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'delivery-order.confirmed',
      entityType: 'DeliveryOrder',
      entityId: 'd1',
    }))
  })

  test('cancel refuses delivered or already-cancelled', async () => {
    DeliveryOrder.findByPk.mockResolvedValue({ id: 'd1', status: 'delivered' })
    await expect(service.cancel('d1', 'u'))
      .rejects.toEqual({ status: 400, message: 'Cannot cancel a delivered or already cancelled order' })
  })

  test('cancel works from draft / confirmed / shipped', async () => {
    for (const status of ['draft', 'confirmed', 'shipped']) {
      const doc = { id: 'd1', refNo: 'DO-1', status, update: jest.fn().mockResolvedValue() }
      DeliveryOrder.findByPk
        .mockResolvedValueOnce(doc)
        .mockResolvedValueOnce({ id: 'd1', toJSON() { return { id: 'd1' } } })
      Invoice.findOne.mockResolvedValue(null)
      await service.cancel('d1', 'u')
      expect(doc.update).toHaveBeenCalledWith({ status: 'cancelled', modifiedBy: 'u' })
    }
  })
})

describe('delivery-order.remove', () => {
  test('refuses anything other than draft', async () => {
    DeliveryOrder.findByPk.mockResolvedValue({ id: 'd1', status: 'confirmed' })
    await expect(service.remove('d1'))
      .rejects.toEqual({ status: 400, message: 'Only draft delivery orders can be deleted' })
  })

  test('destroys a draft', async () => {
    const doc = { id: 'd1', status: 'draft', destroy: jest.fn().mockResolvedValue() }
    DeliveryOrder.findByPk.mockResolvedValue(doc)
    await service.remove('d1')
    expect(doc.destroy).toHaveBeenCalled()
  })
})

describe('delivery-order.createInvoice', () => {
  test('refuses when DO is draft / confirmed', async () => {
    DeliveryOrder.findOne.mockResolvedValue({ id: 'd1', status: 'draft', toJSON() { return { id: 'd1', status: 'draft', items: [] } } })
    Invoice.findOne.mockResolvedValue(null)
    await expect(service.createInvoice('d1', 'u', 'o'))
      .rejects.toEqual({ status: 400, message: 'Only shipped or delivered orders can be invoiced' })
  })

  test('refuses when invoice already exists, naming it in the error', async () => {
    DeliveryOrder.findOne.mockResolvedValue({ id: 'd1', status: 'shipped', items: [], toJSON() { return { id: 'd1', status: 'shipped', items: [] } } })
    Invoice.findOne
      .mockResolvedValueOnce({ id: 'inv', invoiceNumber: 'INV-7' }) // getById join
      .mockResolvedValueOnce({ id: 'inv', invoiceNumber: 'INV-7' }) // existence guard
    await expect(service.createInvoice('d1', 'u', 'o'))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('INV-7 already exists') })
    expect(invoiceSvc.create).not.toHaveBeenCalled()
  })

  test('happy path: pulls unit prices from the source SO and forwards items to invoice.create', async () => {
    DeliveryOrder.findOne.mockResolvedValue({
      id: 'd1', status: 'shipped',
      customerId: 'c', orderId: 'so-1',
      items: [
        { productId: 'p-1', productName: 'A', qty: 3 },
        { productId: 'p-2', productName: 'B', qty: 1 },
      ],
      toJSON() {
        return {
          id: 'd1', status: 'shipped', customerId: 'c', orderId: 'so-1', refNo: 'DO-1',
          items: this.items,
        }
      },
    })
    Invoice.findOne.mockResolvedValue(null)
    SalesOrderItem.findAll.mockResolvedValue([
      { productId: 'p-1', productName: 'A', unitPrice: '12.5' },
      { productId: 'p-2', productName: 'B', unitPrice: '7.0' },
    ])
    invoiceSvc.create.mockResolvedValue({ id: 'inv-new' })

    const out = await service.createInvoice('d1', 'u', 'org')
    expect(out).toEqual({ id: 'inv-new' })
    const payload = invoiceSvc.create.mock.calls[0][0]
    expect(payload.customerId).toBe('c')
    expect(payload.orderId).toBe('so-1')
    expect(payload.deliveryOrderId).toBe('d1')
    expect(payload.items).toEqual([
      { productName: 'A', quantity: 3, unitPrice: 12.5 },
      { productName: 'B', quantity: 1, unitPrice: 7   },
    ])
  })

  test('falls back to 0 unit price when no SO match found', async () => {
    DeliveryOrder.findOne.mockResolvedValue({
      id: 'd1', status: 'shipped',
      customerId: 'c', orderId: null,
      items: [{ productId: 'p-x', productName: 'X', qty: 2 }],
      toJSON() {
        return { id: 'd1', status: 'shipped', customerId: 'c', refNo: 'DO-1', items: this.items }
      },
    })
    Invoice.findOne.mockResolvedValue(null)
    invoiceSvc.create.mockResolvedValue({ id: 'inv-new' })

    await service.createInvoice('d1', 'u', 'org')
    const payload = invoiceSvc.create.mock.calls[0][0]
    expect(payload.items[0].unitPrice).toBe(0) // priceMap is empty
  })
})
