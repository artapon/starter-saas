const { Op } = require('sequelize')
const { StockMovement, Product, Store } = require('../../../../server/models')

const list = async ({ page = 1, limit = 20, search = '', productId = '', storeId = '', type = '', dateFrom = '', dateTo = '' }) => {
  const offset = (page - 1) * limit
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
  const { count, rows } = await StockMovement.findAndCountAll({
    where, limit, offset,
    order: [['createdAt', 'DESC']],
    include: [
      { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
      { model: Store,   as: 'store',   attributes: ['id', 'name', 'code'] },
    ],
    distinct: true,
  })
  return { total: count, page, limit, movements: rows }
}

module.exports = { list }
