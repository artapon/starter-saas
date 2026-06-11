const { ok, serverError } = require('../../../../server/core/response')
const service = require('./stock-movement.service')

module.exports = {
  async list(req, res) {
    try {
      const { page, limit, search, productId, storeId, type, dateFrom, dateTo } = req.query
      const result = await service.list({
        page: +page || 1, limit: +limit || 20,
        search: search || '', productId: productId || '', storeId: storeId || '',
        type: type || '', dateFrom: dateFrom || '', dateTo: dateTo || '',
      })
      return ok(res, result)
    } catch (err) {
      return serverError(res)
    }
  },
}
