const { DataTypes } = require('sequelize')
const sequelize = require('../../../../server/config/database')
const { auditFields } = require('../../model-fields')

const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true , comment: 'ID (รหัส)'},
  invoiceNumber: { type: DataTypes.STRING, allowNull: false , comment: 'Invoice Number (เลขที่ใบแจ้งหนี้)'},
  customerId:      { type: DataTypes.UUID, allowNull: true , comment: 'Customer (ลูกค้า)'},
  orderId:         { type: DataTypes.UUID, allowNull: true , comment: 'Sales Order (ใบสั่งขาย)'},
  deliveryOrderId: { type: DataTypes.UUID, allowNull: true , comment: 'Delivery Order (ใบส่งสินค้า)'},
  status: {
    type: DataTypes.ENUM('draft', 'sent', 'paid', 'cancelled'),
    defaultValue: 'draft',
    comment: 'Status (สถานะ)',
  },
  invoiceDate: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW , comment: 'Invoice Date (วันที่ใบแจ้งหนี้)'},
  dueDate:     { type: DataTypes.DATEONLY, allowNull: true , comment: 'Due Date (วันครบกำหนด)'},
  subtotal:    { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 , comment: 'Subtotal (ยอดก่อนภาษี)'},
  tax:         { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 , comment: 'Tax (ภาษี)'},
  total:       { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 , comment: 'Total (ยอดรวม)'},
  // Sum of all confirmed receive-payments, credit-notes, and other applications
  // against this invoice. balanceDue = total - amountPaid (virtual below).
  amountPaid:  { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 , comment: 'Amount Paid (จำนวนเงินที่ชำระ)'},
  notes:        { type: DataTypes.TEXT, allowNull: true , comment: 'Notes (หมายเหตุ)'},
  currency:     { type: DataTypes.STRING(3), allowNull: true , comment: 'Currency (สกุลเงิน)'},
  exchangeRate: { type: DataTypes.DECIMAL(20, 8), allowNull: false, defaultValue: 1 , comment: 'Exchange Rate (อัตราแลกเปลี่ยน)'},

  // Sales-order parity: header extras
  referenceNumber: { type: DataTypes.STRING, allowNull: true , comment: 'Reference Number (เลขที่อ้างอิง)'},
  paymentTerms:    { type: DataTypes.STRING(20), allowNull: true , comment: 'Payment Terms (เงื่อนไขการชำระเงิน)'},
  salespersonId:   { type: DataTypes.UUID, allowNull: true , comment: 'Salesperson (พนักงานขาย)'},
  shippingAddress: { type: DataTypes.TEXT, allowNull: true , comment: 'Shipping Address (ที่อยู่จัดส่ง)'},
  billingAddress:  { type: DataTypes.TEXT, allowNull: true , comment: 'Billing Address (ที่อยู่ใบกำกับ)'},

  // Order-level discount applied to subtotal+tax
  discountType:   { type: DataTypes.ENUM('percent', 'fixed'), allowNull: true , comment: 'Discount Type (ประเภทส่วนลด)'},
  discountValue:  { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 , comment: 'Discount Value (มูลค่าส่วนลด)'},
  discountAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 , comment: 'Discount Amount (จำนวนส่วนลด)'},

  // Withholding tax (WHT / หัก ณ ที่จ่าย). The type is picked from the
  // "WHT Type" master data; whtRate is its dataValue (%). whtAmount is withheld
  // from the invoice total, so the net payable = total - whtAmount (see netTotal).
  whtCode:        { type: DataTypes.STRING, allowNull: true , comment: 'WHT Type Code (รหัสภาษีหัก ณ ที่จ่าย)'},
  whtRate:        { type: DataTypes.DECIMAL(5, 2),  allowNull: false, defaultValue: 0 , comment: 'WHT Rate (%) (อัตราภาษีหัก ณ ที่จ่าย)'},
  whtAmount:      { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 , comment: 'WHT Amount (ภาษีหัก ณ ที่จ่าย)'},

  ...auditFields,

  balanceDue: {
    type: DataTypes.VIRTUAL,
    get() {
      return Math.max(0, Number(this.getDataValue('total') || 0) - Number(this.getDataValue('amountPaid') || 0))
    },
    comment: 'Balance Due (ยอดคงค้าง)',
  },
  // Net payable after withholding tax: total - whtAmount.
  netTotal: {
    type: DataTypes.VIRTUAL,
    get() {
      return Number(this.getDataValue('total') || 0) - Number(this.getDataValue('whtAmount') || 0)
    },
    comment: 'Net Total (ยอดสุทธิหลังหัก ณ ที่จ่าย)',
  },
}, {
  indexes: [
    // Per-organization uniqueness on the document number (NULL organizationId
    // rows stay distinct) so two tenants can each have INV-2026-0001.
    { unique: true, name: 'idx_invoices_number_org', fields: ['invoiceNumber', 'organizationId'] },
  ],
})

module.exports = Invoice
