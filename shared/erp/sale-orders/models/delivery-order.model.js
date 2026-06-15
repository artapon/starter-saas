const { DataTypes } = require('sequelize')
const sequelize = require('../../../../server/config/database')
const { auditFields } = require('../../model-fields')

const DeliveryOrder = sequelize.define('DeliveryOrder', {
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true , comment: 'ID (รหัส)'},
  refNo:          { type: DataTypes.STRING, allowNull: false , comment: 'Reference No. (เลขอ้างอิง)'},
  date:           { type: DataTypes.DATEONLY, allowNull: false , comment: 'Date (วันที่)'},
  deliveryDate:   { type: DataTypes.DATEONLY, allowNull: true , comment: 'Delivery Date (วันที่กำหนดส่ง)'},
  orderId:        { type: DataTypes.UUID, allowNull: true , comment: 'Sales Order (ใบสั่งขาย)'},
  customerId:     { type: DataTypes.UUID, allowNull: true , comment: 'Customer (ลูกค้า)'},

  // Legacy: kept for old rows; new code reads shippingAddress and falls back to this.
  address:        { type: DataTypes.TEXT, allowNull: true , comment: 'Address (ที่อยู่)'},

  // Sales-order parity
  referenceNumber: { type: DataTypes.STRING, allowNull: true , comment: 'Reference Number (เลขที่อ้างอิง)'},
  paymentTerms:    { type: DataTypes.STRING(20), allowNull: true , comment: 'Payment Terms (เงื่อนไขการชำระเงิน)'},
  salespersonId:   { type: DataTypes.UUID, allowNull: true , comment: 'Salesperson (พนักงานขาย)'},
  shippingAddress: { type: DataTypes.TEXT, allowNull: true , comment: 'Shipping Address (ที่อยู่จัดส่ง)'},
  billingAddress:  { type: DataTypes.TEXT, allowNull: true , comment: 'Billing Address (ที่อยู่ใบกำกับ)'},

  notes:          { type: DataTypes.TEXT, allowNull: true , comment: 'Notes (หมายเหตุ)'},
  status:         { type: DataTypes.ENUM('draft', 'confirmed', 'shipped', 'delivered', 'cancelled'), defaultValue: 'draft' , comment: 'Status (สถานะ)'},
  ...auditFields,
}, { tableName: 'DeliveryOrders', timestamps: true })

module.exports = DeliveryOrder
