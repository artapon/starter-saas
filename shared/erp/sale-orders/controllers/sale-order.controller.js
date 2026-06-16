const { ok, created, fail, serverError } = require('../../../../server/core/response')
const service = require('../services/sale-order.service')

module.exports = {
  async list(req, res) {
    try {
      const { page, limit, search, status } = req.query
      const orgId = req.user?.organizationId || req.user?.id
      const result = await service.list({ page: +page || 1, limit: +limit || 20, search: search || '', status: status || '', organizationId: orgId })
      return ok(res, result)
    } catch (err) {
      return serverError(res)
    }
  },

  async getById(req, res) {
    try {
      const orgId = req.user?.organizationId || req.user?.id
      const order = await service.getById(req.params.id, orgId)
      return ok(res, { order })
    } catch (err) {
      return fail(res, err.message, err.status || 400)
    }
  },

  // Outstanding receivables for a customer, surfaced on the order form so the
  // salesperson sees overdue invoices before taking a new order. Reuses the
  // accounting AR-aging service but is gated by the order-list permission.
  async customerArAging(req, res) {
    try {
      const orgId = req.user?.organizationId || req.user?.id
      const arAgingService = require('../../accounting/services/ar-aging.service')
      const report = await arAgingService.getReport({ customerId: req.params.customerId, organizationId: orgId })
      return ok(res, { report })
    } catch (err) {
      return fail(res, err.message, err.status || 400)
    }
  },

  async create(req, res) {
    try {
      const orgId = req.user?.organizationId || req.user?.id
      const order = await service.create({ ...req.body, userId: req.user?.id, organizationId: orgId })
      return created(res, { order }, 'Order created')
    } catch (err) {
      return fail(res, err.message, err.status || 400)
    }
  },

  async update(req, res) {
    try {
      const orgId = req.user?.organizationId || req.user?.id
      const order = await service.update(req.params.id, req.body, req.user?.id, orgId)
      return ok(res, { order }, 'Order updated')
    } catch (err) {
      return fail(res, err.message, err.status || 400)
    }
  },

  async updateStatus(req, res) {
    try {
      const orgId = req.user?.organizationId || req.user?.id
      const order = await service.updateStatus(req.params.id, req.body.status, req.user?.id, orgId)
      return ok(res, { order }, 'Order status updated')
    } catch (err) {
      return fail(res, err.message, err.status || 400)
    }
  },

  async remove(req, res) {
    try {
      const orgId = req.user?.organizationId || req.user?.id
      await service.remove(req.params.id, orgId)
      return ok(res, null, 'Order deleted')
    } catch (err) {
      return fail(res, err.message, err.status || 400)
    }
  },

  async listItems(req, res) {
    try {
      const { page, limit, search } = req.query
      const result = await service.listItems({ page: +page || 1, limit: +limit || 50, search: search || '' })
      return ok(res, result)
    } catch (err) {
      return serverError(res)
    }
  },

  async getItemById(req, res) {
    try {
      const orgId = req.user?.organizationId || req.user?.id
      const item = await service.getItemById(req.params.itemId, orgId)
      return ok(res, { item })
    } catch (err) {
      return fail(res, err.message, err.status || 400)
    }
  },

  async updateItem(req, res) {
    try {
      const orgId = req.user?.organizationId || req.user?.id
      const item = await service.updateItem(req.params.itemId, req.body, orgId, req.user?.id)
      return ok(res, { item }, 'Order item updated')
    } catch (err) {
      return fail(res, err.message, err.status || 400)
    }
  },

  async deleteItem(req, res) {
    try {
      const orgId = req.user?.organizationId || req.user?.id
      await service.deleteItem(req.params.itemId, orgId)
      return ok(res, null, 'Order item deleted')
    } catch (err) {
      return fail(res, err.message, err.status || 400)
    }
  },

  async createDeliveryOrder(req, res) {
    try {
      const orgId = req.user?.organizationId || req.user?.id
      const result = await service.createDeliveryOrder(req.params.id, req.user?.id, orgId)
      return created(res, result, 'Delivery order created')
    } catch (err) {
      return fail(res, err.message, err.status || 400)
    }
  },

  async createInvoice(req, res) {
    try {
      const orgId = req.user?.organizationId || req.user?.id
      const result = await service.createInvoice(req.params.id, req.user?.id, orgId)
      return created(res, result, 'Invoice created')
    } catch (err) {
      return fail(res, err.message, err.status || 400)
    }
  },

  async listJournals(req, res) {
    try {
      const orgId = req.user?.organizationId || req.user?.id
      const result = await service.listJournals(req.params.id, orgId)
      return ok(res, result)
    } catch (err) {
      return fail(res, err.message, err.status || 400)
    }
  },
}
