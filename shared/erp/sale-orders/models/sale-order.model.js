const { DataTypes } = require('sequelize')
const sequelize = require('../../../../server/config/database')
const { auditFields } = require('../../model-fields')

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: 'ID (รหัส)',
  },
  orderNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Order Number (เลขที่ใบสั่งขาย)',
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Customer (ลูกค้า)',
  },
  status: {
    type: DataTypes.ENUM('draft', 'confirmed', 'shipped', 'delivered', 'cancelled'),
    defaultValue: 'draft',
    comment: 'Status (สถานะ)',
  },
  orderDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Order Date (วันที่สั่ง)',
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Subtotal (ยอดก่อนภาษี)',
  },
  tax: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Tax (ภาษี)',
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Total (ยอดรวม)',
  },
  notes:          { type: DataTypes.TEXT, allowNull: true , comment: 'Notes (หมายเหตุ)'},
  currency:       { type: DataTypes.STRING(3), allowNull: true , comment: 'Currency (สกุลเงิน)'},
  exchangeRate:   { type: DataTypes.DECIMAL(20, 8), allowNull: false, defaultValue: 1 , comment: 'Exchange Rate (อัตราแลกเปลี่ยน)'},

  // Customer's PO / internal reference number
  referenceNumber:      { type: DataTypes.STRING, allowNull: true , comment: 'Reference Number (เลขที่อ้างอิง)'},
  expectedDeliveryDate: { type: DataTypes.DATEONLY, allowNull: true , comment: 'Expected Delivery Date (วันที่ส่งที่คาดหวัง)'},
  paymentTerms:         { type: DataTypes.STRING(20), allowNull: true , comment: 'Payment Terms (เงื่อนไขการชำระเงิน)'},
  salespersonId:        { type: DataTypes.UUID, allowNull: true , comment: 'Salesperson (พนักงานขาย)'},
  shippingAddress:      { type: DataTypes.TEXT, allowNull: true , comment: 'Shipping Address (ที่อยู่จัดส่ง)'},
  billingAddress:       { type: DataTypes.TEXT, allowNull: true , comment: 'Billing Address (ที่อยู่ใบกำกับ)'},

  // Order-level discount applied before tax
  discountType:  { type: DataTypes.ENUM('percent', 'fixed'), allowNull: true , comment: 'Discount Type (ประเภทส่วนลด)'},
  discountValue: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 , comment: 'Discount Value (มูลค่าส่วนลด)'},
  discountAmount:{ type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 , comment: 'Discount Amount (จำนวนส่วนลด)'},
  ...auditFields,
}, {
  indexes: [
    // Per-organization uniqueness on the document number (NULL organizationId distinct).
    { unique: true, name: 'idx_orders_number_org', fields: ['orderNumber', 'organizationId'] },
  ],
})

module.exports = Order
