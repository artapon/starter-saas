const { Router } = require('express')
const controller = require('./stock-movement.controller')
const { authenticate } = require('../../../../server/middleware/auth')
const { requirePermission } = require('../../../../server/middleware/permission')

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('erp.stock.list'), (req, res) => controller.list(req, res))
router.get('/summary', requirePermission('erp.stock.list'), (req, res) => controller.summary(req, res))

module.exports = { mountPath: '/stock-movements', router }