const { Router } = require('express')
const { validate } = require('../../../../server/middleware/validate')
const { authenticate } = require('../../../../server/middleware/auth')
const { requirePermission } = require('../../../../server/middleware/permission')
const controller = require('../controllers/delivery-order.controller')
const { createRules } = require('../validators/delivery-order.validators')

const router = Router()
router.use(authenticate)

router.get('/',              requirePermission('erp.orders.list'),   controller.list)
router.get('/:id',           requirePermission('erp.orders.list'),   controller.getById)
router.post('/',             requirePermission('erp.orders.edit'),   createRules, validate, controller.create)
router.put('/:id',           requirePermission('erp.orders.edit'),   controller.update)
router.post('/:id/confirm',  requirePermission('erp.orders.edit'),   controller.confirm)
router.post('/:id/ship',     requirePermission('erp.orders.edit'),   controller.ship)
router.post('/:id/deliver',  requirePermission('erp.orders.edit'),   controller.deliver)
router.post('/:id/cancel',   requirePermission('erp.orders.edit'),   controller.cancel)
router.post('/:id/create-invoice', requirePermission('erp.invoices.edit'), controller.createInvoice)
router.delete('/:id',        requirePermission('erp.orders.delete'), controller.remove)

module.exports = { mountPath: '/delivery-orders', router }
