const { DataTypes } = require('sequelize')
const sequelize = require('../../../../server/config/database')
const { auditFields } = require('../../model-fields')

const DeliveryOrderItem = sequelize.define('DeliveryOrderItem', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true , comment: 'ID (รหัส)'},
  deliveryOrderId:  { type: DataTypes.UUID, allowNull: false , comment: 'Delivery Order (ใบส่งสินค้า)'},
  productId:        { type: DataTypes.UUID, allowNull: true , comment: 'Product (สินค้า)'},
  // Source tracking so DOs created from a SO with packages remember provenance.
  saleItemId:       { type: DataTypes.UUID, allowNull: true },
  salePackageId:    { type: DataTypes.UUID, allowNull: true },
  storeId:          { type: DataTypes.UUID, allowNull: true , comment: 'Store / Warehouse (คลังสินค้า)'},
  productName:      { type: DataTypes.STRING, allowNull: false },
  qty:              { type: DataTypes.DECIMAL(10, 3), allowNull: false, defaultValue: 1 , comment: 'Quantity (จำนวน)'},
  notes:            { type: DataTypes.TEXT, allowNull: true , comment: 'Notes (หมายเหตุ)'},
  ...auditFields,
}, { tableName: 'DeliveryOrderItems', timestamps: true })

module.exports = DeliveryOrderItem
