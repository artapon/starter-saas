const { body } = require('express-validator')

const itemsRules = [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Item unit price must be a positive number'),
]

const statusRules = [
  body('status').isIn(['draft', 'confirmed', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid status'),
]

module.exports = { itemsRules, statusRules }
