const { DataTypes } = require('sequelize')
const sequelize = require('../../../../server/config/database')
const { auditFields } = require('../../model-fields')

const InvoiceItem = sequelize.define('InvoiceItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true , comment: 'ID (รหัส)'},
  invoiceId:   { type: DataTypes.UUID, allowNull: false , comment: 'Invoice (ใบแจ้งหนี้)'},
  // Sales-order parity: product/sale linkage + package parent-child + store
  saleItemId:    { type: DataTypes.UUID, allowNull: true },
  salePackageId: { type: DataTypes.UUID, allowNull: true },
  parentItemId:  { type: DataTypes.UUID, allowNull: true },
  productId:     { type: DataTypes.UUID, allowNull: true , comment: 'Product (สินค้า)'},
  storeId:       { type: DataTypes.UUID, allowNull: true , comment: 'Store / Warehouse (คลังสินค้า)'},
  productName: { type: DataTypes.STRING, allowNull: false },
  // Snapshot of the source code (SaleItem.code / SalePackage.code / Product.sku)
  // captured at line-creation. Keeps the printed doc stable even if the source
  // entity is later renamed or deleted, and survives legacy items where the
  // ID associations weren't populated.
  itemCode:    { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.STRING, allowNull: true , comment: 'Description (คำอธิบาย)'},
  quantity:    { type: DataTypes.DECIMAL(10, 3), allowNull: false, defaultValue: 1 , comment: 'Quantity (จำนวน)'},
  unitPrice:   { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 , comment: 'Unit Price (ราคาต่อหน่วย)'},
  taxRate:       { type: DataTypes.DECIMAL(5, 2),  allowNull: false, defaultValue: 0, comment: 'Tax Rate (%) (อัตราภาษี (%))' },
  taxAmount:     { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  discountValue:  { type: DataTypes.DECIMAL(5, 2),  allowNull: false, defaultValue: 0, comment: 'Line Discount % (ส่วนลดบรรทัด %)' },
  discountAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  total:         { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, comment: 'Total (ยอดรวม)' },
  ...auditFields,
}, {
  tableName: 'invoice_items',
})

module.exports = InvoiceItem
