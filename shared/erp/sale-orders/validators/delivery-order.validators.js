const { body } = require('express-validator')

// Package-row payloads carry `salePackageId` and no `productName` — they're
// expanded to flat children server-side. Skip the productName check for those.
const createRules = [
  body('customerId').notEmpty().withMessage('Customer is required'),
  body('date').notEmpty().withMessage('Date is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.qty').isNumeric().withMessage('Item quantity must be a number'),
]

module.exports = { createRules }
