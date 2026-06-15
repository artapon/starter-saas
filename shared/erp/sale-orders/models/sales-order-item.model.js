const { DataTypes } = require('sequelize')
const sequelize = require('../../../../server/config/database')
const { auditFields } = require('../../model-fields')

const SalesOrderItem = sequelize.define('SalesOrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: 'ID (รหัส)',
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Sales Order (ใบสั่งขาย)',
  },
  itemId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Item (รายการสินค้า)',
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Product (สินค้า)',
  },
  saleItemId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  salePackageId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  parentItemId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  storeId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Store / Warehouse (คลังสินค้า)',
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  itemCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'Quantity (จำนวน)',
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Unit Price (ราคาต่อหน่วย)',
  },
  taxRate:        { type: DataTypes.DECIMAL(5, 2),  allowNull: false, defaultValue: 0 , comment: 'Tax Rate (%) (อัตราภาษี (%))'},
  taxAmount:      { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  total:          { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 , comment: 'Total (ยอดรวม)'},
  ...auditFields,
}, {
  tableName: 'sales_order_items',
})

module.exports = SalesOrderItem
