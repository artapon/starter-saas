const { DataTypes } = require('sequelize')
const sequelize = require('../../../../server/config/database')
const { auditFields } = require('../../model-fields')

const VendorBill = sequelize.define('VendorBill', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true , comment: 'ID (รหัส)'},
  billNumber:       { type: DataTypes.STRING, allowNull: false , comment: 'Bill Number (เลขที่บิล)'},
  vendorId:         { type: DataTypes.UUID, allowNull: true , comment: 'Vendor (ผู้ขาย)'},
  purchaseOrderId:  { type: DataTypes.UUID, allowNull: true , comment: 'Purchase Order (ใบสั่งซื้อ)'},
  goodReceiveId:    { type: DataTypes.UUID, allowNull: true , comment: 'Good Receive (ใบรับสินค้า)'},
  vendorInvoiceNo:  { type: DataTypes.STRING, allowNull: true , comment: 'Vendor Invoice No. (เลขที่ใบกำกับผู้ขาย)'},
  billDate:         { type: DataTypes.DATEONLY, allowNull: false , comment: 'Bill Date (วันที่บิล)'},
  dueDate:          { type: DataTypes.DATEONLY, allowNull: true , comment: 'Due Date (วันครบกำหนด)'},
  status:           { type: DataTypes.ENUM('draft', 'approved', 'paid', 'cancelled'), defaultValue: 'draft' , comment: 'Status (สถานะ)'},
  subtotal:         { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 , comment: 'Subtotal (ยอดก่อนภาษี)'},
  tax:              { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 , comment: 'Tax (ภาษี)'},
  total:            { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 , comment: 'Total (ยอดรวม)'},
  // Sum of confirmed vendor-payment allocations against this bill.
  amountPaid:       { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 , comment: 'Amount Paid (จำนวนที่จ่ายแล้ว)'},
  balanceDue: {
    type: DataTypes.VIRTUAL,
    get() {
      return Math.max(0, Number(this.getDataValue('total') || 0) - Number(this.getDataValue('amountPaid') || 0))
    },
    comment: 'Balance Due (ยอดคงค้าง)',
  },
  notes:            { type: DataTypes.TEXT, allowNull: true , comment: 'Notes (หมายเหตุ)'},
  currency:         { type: DataTypes.STRING(3), allowNull: true , comment: 'Currency (สกุลเงิน)'},
  exchangeRate:     { type: DataTypes.DECIMAL(20, 8), allowNull: false, defaultValue: 1 , comment: 'Exchange Rate (อัตราแลกเปลี่ยน)'},
  ...auditFields,
}, {
  tableName: 'vendor_bills',
  indexes: [
    // Per-organization uniqueness on the document number (NULL organizationId distinct).
    { unique: true, name: 'idx_vendor_bills_number_org', fields: ['billNumber', 'organizationId'] },
  ],
})

module.exports = VendorBill
