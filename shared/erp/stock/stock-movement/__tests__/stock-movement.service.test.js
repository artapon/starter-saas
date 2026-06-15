// Unit tests for stock/stock-movement.service.
//
// A read-only ledger view: the only function is list(), so all the behaviour
// is query shaping — pagination math, the optional filters (refNo search,
// product/store/type, createdAt date range) that are only applied when
// truthy, the product/store eager-loads, distinct, and the
// {total,page,limit,movements} envelope.

jest.mock('../../../../../server/models', () => ({
  StockMovement: { findAndCountAll: jest.fn(), findAll: jest.fn() },
  Product:       {},
  Store:         {},
}))

const { Op } = require('sequelize')
const { StockMovement } = require('../../../../../server/models')
const service = require('../stock-movement.service')

describe('stock-movement.list', () => {
  beforeEach(() => {
    StockMovement.findAndCountAll.mockResolvedValue({ count: 0, rows: [] })
  })

  test('defaults: page 1 / limit 20, no filters, newest first, eager-loads + distinct', async () => {
    StockMovement.findAndCountAll.mockResolvedValueOnce({ count: 5, rows: [{ id: 'm1' }] })
    const out = await service.list({})
    expect(out).toEqual({ total: 5, page: 1, limit: 20, movements: [{ id: 'm1' }] })
    const args = StockMovement.findAndCountAll.mock.calls[0][0]
    expect(args.offset).toBe(0)
    expect(args.limit).toBe(20)
    expect(args.where).toEqual({}) // no filters supplied
    expect(args.order).toEqual([['createdAt', 'DESC']])
    expect(args.distinct).toBe(true)
    expect(args.include[0]).toMatchObject({ as: 'product' })
    expect(args.include[1]).toMatchObject({ as: 'store' })
  })

  test('computes offset from page/limit', async () => {
    await service.list({ page: 3, limit: 10 })
    expect(StockMovement.findAndCountAll.mock.calls[0][0].offset).toBe(20) // (3-1)*10
  })

  test('applies productId / storeId / type filters when provided', async () => {
    await service.list({ productId: 'p1', storeId: 's1', type: 'issue' })
    expect(StockMovement.findAndCountAll.mock.calls[0][0].where).toEqual({
      productId: 'p1', storeId: 's1', type: 'issue',
    })
  })

  test('omits a filter key entirely when its value is falsy', async () => {
    await service.list({ productId: 'p1', storeId: '', type: '' })
    expect(StockMovement.findAndCountAll.mock.calls[0][0].where).toEqual({ productId: 'p1' })
  })

  test('search filters by refNo substring', async () => {
    await service.list({ search: 'GR-2026' })
    const where = StockMovement.findAndCountAll.mock.calls[0][0].where
    expect(where.refNo[Op.like]).toBe('%GR-2026%')
  })

  test('dateFrom/dateTo bound createdAt to start / end of day', async () => {
    await service.list({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })
    const createdAt = StockMovement.findAndCountAll.mock.calls[0][0].where.createdAt
    expect(createdAt[Op.gte]).toEqual(new Date('2026-01-01T00:00:00'))
    expect(createdAt[Op.lte]).toEqual(new Date('2026-01-31T23:59:59.999'))
  })

  test('dateFrom alone applies only the lower bound', async () => {
    await service.list({ dateFrom: '2026-02-01' })
    const createdAt = StockMovement.findAndCountAll.mock.calls[0][0].where.createdAt
    expect(createdAt[Op.gte]).toEqual(new Date('2026-02-01T00:00:00'))
    expect(createdAt[Op.lte]).toBeUndefined()
  })
})

describe('stock-movement.summary', () => {
  beforeEach(() => {
    StockMovement.findAll.mockReset()
    StockMovement.findAll.mockResolvedValue([])
  })

  test('rejects an unknown groupBy', async () => {
    await expect(service.summary({ groupBy: 'refNo' }))
      .rejects.toMatchObject({ status: 400 })
    expect(StockMovement.findAll).not.toHaveBeenCalled()
  })

  test('groupBy=type groups on type with raw aggregate query', async () => {
    await service.summary({ groupBy: 'type' })
    const args = StockMovement.findAll.mock.calls[0][0]
    expect(args.group).toEqual(['StockMovement.type'])
    expect(args.include).toEqual([])
    expect(args.raw).toBe(true)
    // count + qtyIn/qtyOut/qtyNet rollups alongside the group key
    expect(args.attributes).toHaveLength(5)
  })

  test('groupBy=product joins product (no row attrs) and groups by its identity', async () => {
    await service.summary({ groupBy: 'product' })
    const args = StockMovement.findAll.mock.calls[0][0]
    expect(args.include[0]).toMatchObject({ as: 'product', attributes: [] })
    expect(args.group).toEqual(['StockMovement.productId', 'product.id', 'product.name', 'product.sku'])
  })

  test('groupBy=store joins store and groups by its identity', async () => {
    await service.summary({ groupBy: 'store' })
    const args = StockMovement.findAll.mock.calls[0][0]
    expect(args.include[0]).toMatchObject({ as: 'store', attributes: [] })
    expect(args.group).toEqual(['StockMovement.storeId', 'store.id', 'store.name'])
  })

  test('applies the same filters as list()', async () => {
    await service.summary({ groupBy: 'type', search: 'GR-', storeId: 's1', dateFrom: '2026-01-01' })
    const where = StockMovement.findAll.mock.calls[0][0].where
    expect(where.refNo[Op.like]).toBe('%GR-%')
    expect(where.storeId).toBe('s1')
    expect(where.createdAt[Op.gte]).toEqual(new Date('2026-01-01T00:00:00'))
  })

  test('numbers stringy aggregates, defaults null sums to 0, sorts by count desc', async () => {
    StockMovement.findAll.mockResolvedValueOnce([
      { type: 'sale',    count: '2', qtyIn: null, qtyOut: '-5', qtyNet: '-5' },
      { type: 'receive', count: '7', qtyIn: '90', qtyOut: null, qtyNet: '90' },
    ])
    const out = await service.summary({ groupBy: 'type' })
    expect(out.groupBy).toBe('type')
    expect(out.groups).toEqual([
      { key: 'receive', type: 'receive', count: 7, qtyIn: 90, qtyOut: 0,  qtyNet: 90 },
      { key: 'sale',    type: 'sale',    count: 2, qtyIn: 0,  qtyOut: -5, qtyNet: -5 },
    ])
  })
})
