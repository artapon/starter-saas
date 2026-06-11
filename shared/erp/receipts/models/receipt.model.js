const { DataTypes } = require('sequelize')
const sequelize = require('../../../../server/config/database')
const { auditFields } = require('../../model-fields')

const Receipt = sequelize.define('Receipt', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: 'ID (รหัส)',
  },
  receiptNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Receipt Number (เลขที่ใบเสร็จ)',
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Customer (ลูกค้า)',
  },
  invoiceId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Invoice (ใบแจ้งหนี้)',
  },
  receiptDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'bank_transfer', 'cheque', 'credit_card', 'other'),
    defaultValue: 'cash',
    comment: 'Payment Method (วิธีการชำระ)',
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Amount (จำนวนเงิน)',
  },
  reference: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('draft', 'confirmed', 'cancelled'),
    defaultValue: 'draft',
    comment: 'Status (สถานะ)',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notes (หมายเหตุ)',
  },
  currency:       { type: DataTypes.STRING(3), allowNull: true , comment: 'Currency (สกุลเงิน)'},
  exchangeRate:   { type: DataTypes.DECIMAL(20, 8), allowNull: false, defaultValue: 1 , comment: 'Exchange Rate (อัตราแลกเปลี่ยน)'},
  ...auditFields,
}, {
  indexes: [
    // Per-organization uniqueness on the document number (NULL organizationId distinct).
    { unique: true, name: 'idx_receipts_number_org', fields: ['receiptNumber', 'organizationId'] },
  ],
})

module.exports = Receipt
