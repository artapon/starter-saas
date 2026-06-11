const { DataTypes } = require('sequelize')
const sequelize = require('../../../../../server/config/database')
const { auditFields } = require('../../../model-fields')

const StockIssue = sequelize.define('StockIssue', {
  id:      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true , comment: 'ID (รหัส)'},
  refNo:   { type: DataTypes.STRING, allowNull: false , comment: 'Reference No. (เลขอ้างอิง)'},
  date:    { type: DataTypes.DATEONLY, allowNull: false , comment: 'Date (วันที่)'},
  storeId: { type: DataTypes.UUID, allowNull: true , comment: 'Store / Warehouse (คลังสินค้า)'},
  reason:  { type: DataTypes.STRING, allowNull: true , comment: 'Reason (เหตุผล)'},
  notes:   { type: DataTypes.TEXT, allowNull: true , comment: 'Notes (หมายเหตุ)'},
  status:  { type: DataTypes.STRING, defaultValue: 'draft' , comment: 'Status (สถานะ)'},
  ...auditFields,
}, {
  indexes: [
    // Per-organization uniqueness on the document number (NULL organizationId distinct).
    { unique: true, name: 'idx_stock_issues_refno_org', fields: ['refNo', 'organizationId'] },
  ],
})

module.exports = StockIssue
