const { DataTypes } = require('sequelize')
const sequelize = require('../../../../../server/config/database')
const { auditFields } = require('../../../model-fields')

const GoodReceive = sequelize.define('GoodReceive', {
  id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true , comment: 'ID (รหัส)'},
  refNo:    { type: DataTypes.STRING, allowNull: false , comment: 'Reference No. (เลขอ้างอิง)'},
  date:     { type: DataTypes.DATEONLY, allowNull: false , comment: 'Date (วันที่)'},
  supplier: { type: DataTypes.STRING, allowNull: true },
  notes:    { type: DataTypes.TEXT, allowNull: true , comment: 'Notes (หมายเหตุ)'},
  storeId:  { type: DataTypes.UUID, allowNull: true , comment: 'Store / Warehouse (คลังสินค้า)'},
  purchaseOrderId: { type: DataTypes.UUID, allowNull: true , comment: 'Purchase Order (ใบสั่งซื้อ)'},
  status:   { type: DataTypes.STRING, defaultValue: 'draft' , comment: 'Status (สถานะ)'},

  docType:          { type: DataTypes.STRING, allowNull: true, defaultValue: 'invoice' },
  invoiceNo:        { type: DataTypes.STRING, allowNull: true },
  invoiceDate:      { type: DataTypes.DATEONLY, allowNull: true , comment: 'Invoice Date (วันที่ใบแจ้งหนี้)'},
  deliveryNo:       { type: DataTypes.STRING, allowNull: true },
  invoiceDiscount:  { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
  invoiceNetAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
  ...auditFields,
}, {
  indexes: [
    // Per-organization uniqueness on the document number (NULL organizationId distinct).
    { unique: true, name: 'idx_good_receives_refno_org', fields: ['refNo', 'organizationId'] },
  ],
})

module.exports = GoodReceive
