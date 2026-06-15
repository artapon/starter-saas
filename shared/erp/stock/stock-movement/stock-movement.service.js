const { Op, fn, col, literal } = require('sequelize')
const { StockMovement, Product, Store } = require('../../../../server/models')

const buildWhere = ({ search = '', productId = '', storeId = '', type = '', dateFrom = '', dateTo = '' }) => {
  const where = {}
  if (search)    where.refNo     = { [Op.like]: `%${search}%` }
  if (productId) where.productId = productId
  if (storeId)   where.storeId   = storeId
  if (type)      where.type      = type
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt[Op.gte] = new Date(`${dateFrom}T00:00:00`)
    if (dateTo)   where.createdAt[Op.lte] = new Date(`${dateTo}T23:59:59.999`)
  }
  return where
}

const list = async ({ page = 1, limit = 20, ...filters }) => {
  const offset = (page - 1) * limit
  const { count, rows } = await StockMovement.findAndCountAll({
    where: buildWhere(filters), limit, offset,
    order: [['createdAt', 'DESC']],
    include: [
      { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
      { model: Store,   as: 'store',   attributes: ['id', 'name', 'code'] },
    ],
    distinct: true,
  })
  return { total: count, page, limit, movements: rows }
}

// Per-group qty rollups. `qty` is unqualified in the CASE literals — safe while
// neither joined table (product / store) carries a `qty` column.
const AGGREGATES = [
  [fn('COUNT', col('StockMovement.id')), 'count'],
  [literal('SUM(CASE WHEN qty > 0 THEN qty ELSE 0 END)'), 'qtyIn'],
  [literal('SUM(CASE WHEN qty < 0 THEN qty ELSE 0 END)'), 'qtyOut'],
  [fn('SUM', col('qty')), 'qtyNet'],
]

const GROUPS = {
  type: {
    attributes: ['type'],
    include:    [],
    group:      ['StockMovement.type'],
    mapKey:     r => ({ key: r.type, type: r.type }),
  },
  product: {
    attributes: ['productId', [col('product.name'), 'name'], [col('product.sku'), 'sku']],
    include:    [{ model: Product, as: 'product', attributes: [] }],
    group:      ['StockMovement.productId', 'product.id', 'product.name', 'product.sku'],
    mapKey:     r => ({ key: r.productId, name: r.name, sku: r.sku }),
  },
  store: {
    attributes: ['storeId', [col('store.name'), 'name']],
    include:    [{ model: Store, as: 'store', attributes: [] }],
    group:      ['StockMovement.storeId', 'store.id', 'store.name'],
    mapKey:     r => ({ key: r.storeId, name: r.name }),
  },
}

const summary = async ({ groupBy = 'type', ...filters }) => {
  const cfg = GROUPS[groupBy]
  if (!cfg) throw { status: 400, message: 'groupBy must be one of: type, product, store' }
  const rows = await StockMovement.findAll({
    where:      buildWhere(filters),
    attributes: [...cfg.attributes, ...AGGREGATES],
    include:    cfg.include,
    group:      cfg.group,
    raw:        true,
  })
  const groups = rows
    .map(r => ({
      ...cfg.mapKey(r),
      count:  Number(r.count)        || 0,
      qtyIn:  Number(r.qtyIn  ?? 0)  || 0,
      qtyOut: Number(r.qtyOut ?? 0)  || 0,
      qtyNet: Number(r.qtyNet ?? 0)  || 0,
    }))
    .sort((a, b) => b.count - a.count)
  return { groupBy, groups }
}

module.exports = { list, summary }
