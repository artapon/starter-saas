// Unit tests for orders/order.service.
//
// Same strategy as invoice.service: pin down the bits that can be exercised
// in isolation (list filters, getById join, transition gates, guard rails,
// audit emission). The transactional stock-cut logic in updateStatus and the
// items-tree persistence in create/update are not unit-tested here — they
// would need a fragile full sequelize.transaction stand-in.

jest.mock('../../../../server/models', () => ({
  Order:           { findAndCountAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), count: jest.fn() },
  SalesOrderItem:  { findAndCountAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), destroy: jest.fn() },
  Customer:        {},
  Product:         { findByPk: jest.fn() },
  Item:            {},
  SaleItem:        {},
  SalePackage:     {},
  Store:           {},
  StoreStock:      { findOrCreate: jest.fn() },
  StockMovement:   {},
  User:            {},
  Invoice:         { findOne: jest.fn() },
  DeliveryOrder:   { findOne: jest.fn() },
  DeliveryOrderItem: {},
  sequelize:       { transaction: jest.fn() },
}))

jest.mock('../../audit/audit.service', () => ({ log: jest.fn() }))
jest.mock('../../settings/services/currency.service', () => ({ getRateOn: jest.fn(() => 1) }), { virtual: true })
jest.mock('../../settings/services/sequence.service', () => ({ getNext: jest.fn(() => 'DO-1') }), { virtual: true })
jest.mock('../../stock/stock-count/stock-count.service', () => ({ checkStoreLock: jest.fn() }), { virtual: true })
jest.mock('../../invoices/invoice.service', () => ({ create: jest.fn() }), { virtual: true })

const { Op } = require('sequelize')
const { Order, SalesOrderItem, Invoice, DeliveryOrder } = require('../../../../server/models')
const audit = require('../../audit/audit.service')
const invoiceSvc = require('../../invoices/invoice.service')
const service = require('../services/order.service')

describe('order.list', () => {
  beforeEach(() => {
    Order.findAndCountAll.mockResolvedValue({ count: 0, rows: [] })
  })

  test('paginates, scopes by org, excludes soft-deleted', async () => {
    Order.findAndCountAll.mockResolvedValueOnce({ count: 6, rows: [{ id: 'o1' }] })
    const out = await service.list({ page: 2, limit: 3, organizationId: 'org' })
    expect(out).toEqual({ total: 6, page: 2, limit: 3, orders: [{ id: 'o1' }] })
    const args = Order.findAndCountAll.mock.calls[0][0]
    expect(args.offset).toBe(3)
    expect(args.where.organizationId).toBe('org')
    expect(args.where.dataFlag[Op.ne]).toBe(2)
  })

  test('search applies LIKE on orderNumber', async () => {
    await service.list({ search: 'ORD-1', organizationId: 'org' })
    expect(Order.findAndCountAll.mock.calls[0][0].where.orderNumber[Op.like]).toBe('%ORD-1%')
  })
})

describe('order.getById', () => {
  test('throws 404 when missing', async () => {
    Order.findByPk.mockResolvedValue(null)
    await expect(service.getById('missing')).rejects.toEqual({ status: 404, message: 'Order not found' })
  })

  test('joins linkedDeliveryOrder and linkedInvoice via Promise.all', async () => {
    const ord = { id: 'o1', orderNumber: 'ORD-1', toJSON() { return { id: 'o1', orderNumber: 'ORD-1' } } }
    Order.findByPk.mockResolvedValue(ord)
    DeliveryOrder.findOne.mockResolvedValue({ id: 'do', refNo: 'DO-1', status: 'draft' })
    Invoice.findOne.mockResolvedValue({ id: 'inv', invoiceNumber: 'INV-1', status: 'sent' })
    const out = await service.getById('o1')
    expect(out.linkedDeliveryOrder).toEqual({ id: 'do', refNo: 'DO-1', status: 'draft' })
    expect(out.linkedInvoice).toEqual({ id: 'inv', invoiceNumber: 'INV-1', status: 'sent' })
  })
})

describe('order.updateStatus — gate + audit', () => {
  test('no-op when target == current status', async () => {
    Order.findByPk
      .mockResolvedValueOnce({ id: 'o1', status: 'confirmed', items: [] })
      .mockResolvedValueOnce({ id: 'o1', status: 'confirmed', toJSON() { return { id: 'o1' } } })
    Invoice.findOne.mockResolvedValue(null)
    DeliveryOrder.findOne.mockResolvedValue(null)
    await service.updateStatus('o1', 'confirmed', 'u')
    expect(audit.log).not.toHaveBeenCalled()
  })

  test('throws 404 when missing', async () => {
    Order.findByPk.mockResolvedValue(null)
    await expect(service.updateStatus('missing', 'confirmed', 'u'))
      .rejects.toEqual({ status: 404, message: 'Order not found' })
  })
})

describe('order.update', () => {
  test('refuses anything other than draft', async () => {
    Order.findByPk.mockResolvedValue({ id: 'o1', status: 'confirmed' })
    await expect(service.update('o1', { notes: 'x' }, 'u'))
      .rejects.toEqual({ status: 400, message: 'Only draft orders can be edited' })
  })

  test('throws 404 when missing', async () => {
    Order.findByPk.mockResolvedValue(null)
    await expect(service.update('missing', {}, 'u'))
      .rejects.toEqual({ status: 404, message: 'Order not found' })
  })
})

describe('order.remove', () => {
  test('refuses anything other than draft', async () => {
    Order.findByPk.mockResolvedValue({ id: 'o1', status: 'confirmed' })
    await expect(service.remove('o1'))
      .rejects.toEqual({ status: 400, message: 'Only draft orders can be deleted' })
  })

  test('destroys a draft', async () => {
    const ord = { id: 'o1', status: 'draft', destroy: jest.fn().mockResolvedValue() }
    Order.findByPk.mockResolvedValue(ord)
    await service.remove('o1')
    expect(ord.destroy).toHaveBeenCalled()
  })
})

describe('order.listItems / getItemById', () => {
  test('listItems paginates with offset, no org scoping (admin-style view)', async () => {
    SalesOrderItem.findAndCountAll.mockResolvedValue({ count: 0, rows: [] })
    await service.listItems({ page: 2, limit: 10 })
    expect(SalesOrderItem.findAndCountAll.mock.calls[0][0].offset).toBe(10)
  })

  test('listItems search applies LIKE on productName', async () => {
    SalesOrderItem.findAndCountAll.mockResolvedValue({ count: 0, rows: [] })
    await service.listItems({ search: 'Widget' })
    const or = SalesOrderItem.findAndCountAll.mock.calls[0][0].where[Op.or]
    expect(or[0].productName[Op.like]).toBe('%Widget%')
  })

  test('getItemById throws 404 when missing', async () => {
    SalesOrderItem.findByPk.mockResolvedValue(null)
    await expect(service.getItemById('missing'))
      .rejects.toEqual({ status: 404, message: 'Order item not found' })
  })
})

describe('order.createDeliveryOrder', () => {
  test('refuses when order is in draft/cancelled', async () => {
    Order.findOne.mockResolvedValue({ id: 'o1', status: 'draft', toJSON() { return { id: 'o1', status: 'draft' } } })
    DeliveryOrder.findOne.mockResolvedValue(null)
    Invoice.findOne.mockResolvedValue(null)
    await expect(service.createDeliveryOrder('o1', 'u', 'org'))
      .rejects.toEqual({ status: 400, message: 'Only confirmed orders can generate a delivery order' })
  })

  test('refuses when a delivery order already exists, naming it in the error', async () => {
    Order.findOne.mockResolvedValue({ id: 'o1', status: 'confirmed', items: [], toJSON() { return { id: 'o1', status: 'confirmed' } } })
    // First call: getById's linkedDeliveryOrder join. Second: existence guard.
    DeliveryOrder.findOne
      .mockResolvedValueOnce({ id: 'do', refNo: 'DO-9' })
      .mockResolvedValueOnce({ id: 'do', refNo: 'DO-9' })
    Invoice.findOne.mockResolvedValue(null)
    await expect(service.createDeliveryOrder('o1', 'u', 'org'))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('DO-9 already exists') })
  })
})

describe('order.createInvoice', () => {
  test('refuses when order is in draft', async () => {
    Order.findOne.mockResolvedValue({ id: 'o1', status: 'draft', toJSON() { return { id: 'o1', status: 'draft' } } })
    DeliveryOrder.findOne.mockResolvedValue(null)
    Invoice.findOne.mockResolvedValue(null)
    await expect(service.createInvoice('o1', 'u', 'org'))
      .rejects.toEqual({ status: 400, message: 'Only confirmed orders can generate an invoice' })
  })

  test('refuses when an invoice already exists, naming it in the error', async () => {
    Order.findOne.mockResolvedValue({ id: 'o1', status: 'confirmed', items: [], toJSON() { return { id: 'o1', status: 'confirmed' } } })
    Invoice.findOne
      .mockResolvedValueOnce({ id: 'inv', invoiceNumber: 'INV-7' }) // getById join
      .mockResolvedValueOnce({ id: 'inv', invoiceNumber: 'INV-7' }) // existence guard
    DeliveryOrder.findOne.mockResolvedValue(null)
    await expect(service.createInvoice('o1', 'u', 'org'))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('INV-7 already exists') })
    expect(invoiceSvc.create).not.toHaveBeenCalled()
  })

  test('happy path: passes order header + items in tree order to invoice.create', async () => {
    const orderItems = [
      // top-level row
      { id: 'p',  productId: 'prod-A', productName: 'A', quantity: 2, unitPrice: 10, taxRate: 7, parentItemId: null, salePackageId: null },
      // child of p (parent listed first; ordering depends on toJSON)
      { id: 'c1', productId: 'prod-B', productName: 'B', quantity: 1, unitPrice: 0,  taxRate: 0, parentItemId: 'p', salePackageId: null, saleItem: { code: 'SI-B' } },
      // another top-level
      { id: 'q',  productId: 'prod-C', productName: 'C', quantity: 3, unitPrice: 5,  taxRate: 0, parentItemId: null, salePackageId: null, product: { sku: 'C-SKU' } },
    ]
    const ord = {
      id: 'o1', status: 'confirmed', items: orderItems,
      customerId: 'cust', currency: 'USD', exchangeRate: 35,
      referenceNumber: 'PO-1', paymentTerms: 'Net 30', salespersonId: 'sp',
      shippingAddress: '1 Ship St', billingAddress: '1 Bill St',
      discountType: null, discountValue: 0,
      orderNumber: 'ORD-1',
      toJSON() { return { ...this } },
    }
    Order.findOne.mockResolvedValue(ord)
    Invoice.findOne.mockResolvedValue(null)
    DeliveryOrder.findOne.mockResolvedValue(null)
    invoiceSvc.create.mockResolvedValue({ id: 'inv-new' })

    const out = await service.createInvoice('o1', 'u', 'org')
    expect(out).toEqual({ id: 'inv-new' })
    const payload = invoiceSvc.create.mock.calls[0][0]
    expect(payload.customerId).toBe('cust')
    expect(payload.orderId).toBe('o1')
    expect(payload.currency).toBe('USD')
    // Tree order: parent 'p' then its child 'c1', then sibling 'q'
    expect(payload.items.map(i => i.key)).toEqual(['p', 'c1', 'q'])
    // child's parentKey resolves to its parent's id
    expect(payload.items[1].parentKey).toBe('p')
    // itemCode snapshots: child uses saleItem.code; standalone uses product.sku
    expect(payload.items[1].itemCode).toBe('SI-B')
    expect(payload.items[2].itemCode).toBe('C-SKU')
  })
})
