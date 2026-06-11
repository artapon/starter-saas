const { DataTypes } = require('sequelize')
const sequelize = require('../../../../server/config/database')
const { auditFields } = require('../../model-fields')

const Quotation = sequelize.define('Quotation', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true , comment: 'ID (รหัส)'},
  refNo: { type: DataTypes.STRING, allowNull: false , comment: 'Reference No. (เลขอ้างอิง)'},
  customerId: { type: DataTypes.UUID, allowNull: true , comment: 'Customer (ลูกค้า)'},
  quotationDate: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  validUntil: { type: DataTypes.DATEONLY, allowNull: true },
  status: {
    type: DataTypes.ENUM('draft', 'sent', 'accepted', 'rejected', 'converted'),
    defaultValue: 'draft',
    comment: 'Status (สถานะ)',
  },
  subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 , comment: 'Subtotal (ยอดก่อนภาษี)'},
  taxRate:  { type: DataTypes.DECIMAL(5, 2),  defaultValue: 0 , comment: 'Tax Rate (%) (อัตราภาษี (%))'},
  tax:      { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 , comment: 'Tax (ภาษี)'},
  total:    { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 , comment: 'Total (ยอดรวม)'},
  notes:          { type: DataTypes.TEXT, allowNull: true , comment: 'Notes (หมายเหตุ)'},
  currency:       { type: DataTypes.STRING(3), allowNull: true , comment: 'Currency (สกุลเงิน)'},
  exchangeRate:   { type: DataTypes.DECIMAL(20, 8), allowNull: false, defaultValue: 1 , comment: 'Exchange Rate (อัตราแลกเปลี่ยน)'},

  // Sales-order parity: header-level extras
  referenceNumber: { type: DataTypes.STRING, allowNull: true , comment: 'Reference Number (เลขที่อ้างอิง)'},
  paymentTerms:    { type: DataTypes.STRING(20), allowNull: true , comment: 'Payment Terms (เงื่อนไขการชำระเงิน)'},
  salespersonId:   { type: DataTypes.UUID, allowNull: true , comment: 'Salesperson (พนักงานขาย)'},
  shippingAddress: { type: DataTypes.TEXT, allowNull: true , comment: 'Shipping Address (ที่อยู่จัดส่ง)'},
  billingAddress:  { type: DataTypes.TEXT, allowNull: true , comment: 'Billing Address (ที่อยู่ใบกำกับ)'},

  // Order-level discount (applied to subtotal+tax)
  discountType:   { type: DataTypes.ENUM('percent', 'fixed'), allowNull: true , comment: 'Discount Type (ประเภทส่วนลด)'},
  discountValue:  { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 , comment: 'Discount Value (มูลค่าส่วนลด)'},
  discountAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 , comment: 'Discount Amount (จำนวนส่วนลด)'},

  // Set when the quotation is converted to a Sales Order
  convertedToOrderId: { type: DataTypes.UUID, allowNull: true },

  ...auditFields,
}, {
  tableName: 'quotations',
  indexes: [
    // Per-organization uniqueness on the document number (NULL organizationId distinct).
    { unique: true, name: 'idx_quotations_refno_org', fields: ['refNo', 'organizationId'] },
  ],
})

module.exports = Quotation
