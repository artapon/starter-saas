const { Router } = require('express')
const controller = require('./invoice.controller')
const { authenticate } = require('../../../server/middleware/auth')
const { requirePermission } = require('../../../server/middleware/permission')
const { validate } = require('../../../server/middleware/validate')
// Plan-limit enforcement: gate the action with enforceLimit so an over-quota
// request never runs. erp.invoices.monthly is live-counted from the Invoices
// table (see billing.service LIVE_COUNTERS), so no meter() is needed here —
// add meter() only for metrics without a live counter.
const { enforceLimit } = require('../../../server/middleware/plan')
const { itemsRules, statusRules, whtRules } = require('./invoice.validators')

const router = Router()
router.use(authenticate)

router.get('/',                requirePermission('erp.invoices.list'),   (req, res) => controller.list(req, res))
router.get('/:id',             requirePermission('erp.invoices.list'),   (req, res) => controller.getById(req, res))
router.post('/',               requirePermission('erp.invoices.edit'),   enforceLimit('erp.invoices.monthly'), itemsRules, whtRules, validate, (req, res) => controller.create(req, res))
router.put('/:id',             requirePermission('erp.invoices.edit'),   (req, res) => controller.update(req, res))
router.patch('/:id/status',    requirePermission('erp.invoices.edit'),   statusRules, validate, (req, res) => controller.updateStatus(req, res))
router.post('/:id/create-receipt', requirePermission('erp.receipts.edit'), (req, res) => controller.createReceipt(req, res))
router.delete('/:id',          requirePermission('erp.invoices.delete'), (req, res) => controller.remove(req, res))

module.exports = { mountPath: '/invoices', router }
