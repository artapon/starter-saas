const { Router } = require('express')
const controller = require('../controllers/sale-order.controller')
const { authenticate } = require('../../../../server/middleware/auth')
const { requirePermission } = require('../../../../server/middleware/permission')
const { validate } = require('../../../../server/middleware/validate')
const { itemsRules, statusRules } = require('../validators/sale-order.validators')

const router = Router()

router.use(authenticate)

router.get('/',                  requirePermission('erp.orders.list'),   (req, res) => controller.list(req, res))
router.get('/items',             requirePermission('erp.orders.list'),   (req, res) => controller.listItems(req, res))
router.get('/items/:itemId',     requirePermission('erp.orders.list'),   (req, res) => controller.getItemById(req, res))
router.put('/items/:itemId',     requirePermission('erp.orders.edit'),   (req, res) => controller.updateItem(req, res))
router.delete('/items/:itemId',  requirePermission('erp.orders.delete'), (req, res) => controller.deleteItem(req, res))
router.get('/:id',               requirePermission('erp.orders.list'),   (req, res) => controller.getById(req, res))
router.get('/:id/journals',      requirePermission('erp.orders.list'),   (req, res) => controller.listJournals(req, res))
router.post('/',           requirePermission('erp.orders.edit'),   itemsRules, validate, (req, res) => controller.create(req, res))
router.put('/:id',         requirePermission('erp.orders.edit'),   (req, res) => controller.update(req, res))
router.patch('/:id/status',requirePermission('erp.orders.edit'),   statusRules, validate, (req, res) => controller.updateStatus(req, res))
router.post('/:id/create-delivery-order', requirePermission('erp.orders.edit'), (req, res) => controller.createDeliveryOrder(req, res))
router.post('/:id/create-invoice',        requirePermission('erp.invoices.edit'), (req, res) => controller.createInvoice(req, res))
router.delete('/:id',      requirePermission('erp.orders.delete'), (req, res) => controller.remove(req, res))

module.exports = { mountPath: '/sale-orders', router }
