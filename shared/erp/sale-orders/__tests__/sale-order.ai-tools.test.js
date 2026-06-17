// Unit tests for the Sales-Orders AI tool handlers (read-only lookups). The
// handlers lazily `require` the order service, so we mock that module path and
// drive each tool's handler directly with a fake user ctx.
jest.mock('../services/sale-order.service', () => ({
  list: jest.fn(), getById: jest.fn(),
}))

const orderSvc = require('../services/sale-order.service')
const { tools, navTargets } = require('../ai-tools')

const USER = { id: 'u1', organizationId: 'o1' }
const ctx  = { user: USER }
const byName = Object.fromEntries(tools.map((t) => [t.name, t]))

beforeEach(() => jest.clearAllMocks())

describe('sale-orders ai-tools — registry', () => {
  test('exposes the read-only toolset and nav targets', () => {
    expect(Object.keys(byName).sort()).toEqual(['get_sale_order', 'list_sale_orders'])
    expect(navTargets).toHaveProperty('orders_list')
    expect(navTargets).toHaveProperty('order_create')
  })

  test('every tool is server-kind with a handler and object params', () => {
    for (const t of tools) {
      expect(t.kind).toBe('server')
      expect(typeof t.handler).toBe('function')
      expect(t.parameters.type).toBe('object')
    }
  })

  test('exposes no write/workflow tools', () => {
    const names = Object.keys(byName).join(' ')
    expect(names).not.toMatch(/create|update|delete|status|confirm|ship|deliver|cancel/)
  })
})

describe('list_sale_orders', () => {
  test('passes filters, clamps the limit, slims rows', async () => {
    orderSvc.list.mockResolvedValue({ total: 1, orders: [
      { id: 'so1', orderNumber: 'ORD-00001', orderDate: '2026-01-01', status: 'confirmed', customer: { name: 'Acme' }, total: '120.00', currency: 'USD' },
    ] })
    const { result, action } = await byName.list_sale_orders.handler({ status: 'confirmed', limit: 999 }, ctx)
    expect(orderSvc.list).toHaveBeenCalledWith(expect.objectContaining({
      status: 'confirmed', limit: 50, organizationId: 'o1',
    }))
    expect(result.orders[0]).toMatchObject({ orderNumber: 'ORD-00001', customer: 'Acme', total: 120 })
    expect(action.path).toBe('/erp/sale-orders')
  })

  test('defaults the limit to 10 when unspecified', async () => {
    orderSvc.list.mockResolvedValue({ total: 0, orders: [] })
    await byName.list_sale_orders.handler({}, ctx)
    expect(orderSvc.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }))
  })
})

describe('get_sale_order', () => {
  test('resolves by order number then returns header + items', async () => {
    orderSvc.list.mockResolvedValue({ orders: [{ id: 'so1', orderNumber: 'ORD-00001' }] })
    orderSvc.getById.mockResolvedValue({
      id: 'so1', orderNumber: 'ORD-00001', status: 'confirmed', customer: { name: 'Acme' }, total: 120,
      subtotal: 100, tax: 20, saleType: 'credit', salesperson: { name: 'Sam' },
      whtAmount: 0, netTotal: 120,
      linkedDeliveryOrder: { refNo: 'DO-1' }, linkedInvoice: null,
      items: [
        { product: { name: 'Widget' }, quantity: 2, unitPrice: 50, total: 100 },
        { productName: 'Service', quantity: 1, unitPrice: 20, total: 20 },
      ],
    })
    const { result, action } = await byName.get_sale_order.handler({ search: 'ORD-00001' }, ctx)
    expect(orderSvc.getById).toHaveBeenCalledWith('so1', 'o1')
    expect(result).toMatchObject({ id: 'so1', salesperson: 'Sam', subtotal: 100, tax: 20, deliveryOrder: 'DO-1', invoice: null })
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ product: 'Widget', qty: 2, total: 100 })
    expect(action.path).toBe('/erp/sale-orders/so1')
  })

  test('reports when nothing matches', async () => {
    orderSvc.list.mockResolvedValue({ orders: [] })
    const { result } = await byName.get_sale_order.handler({ search: 'ghost' }, ctx)
    expect(result).toMatch(/No sales order matches/)
    expect(orderSvc.getById).not.toHaveBeenCalled()
  })

  test('asks to narrow on ambiguous number', async () => {
    orderSvc.list.mockResolvedValue({ orders: [{ id: 'so1', orderNumber: 'ORD-1' }, { id: 'so2', orderNumber: 'ORD-10' }] })
    const { result } = await byName.get_sale_order.handler({ search: 'ORD-' }, ctx)
    expect(result).toMatch(/Multiple sales orders match/)
    expect(orderSvc.getById).not.toHaveBeenCalled()
  })
})
