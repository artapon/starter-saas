/**
 * Order associations — Order, SalesOrderItem and their cross-domain links.
 */
module.exports = function associate({
  Order, SalesOrderItem,
  Customer, Product, Item, Store, SaleItem, SalePackage,
}) {
  // ── Order ↔ Customer ──────────────────────────────────────────────────────
  Order.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' })
  Customer.hasMany(Order,   { foreignKey: 'customerId', as: 'orders' })


  // ── Order ↔ SalesOrderItem ────────────────────────────────────────────────
  Order.hasMany(SalesOrderItem,    { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' })
  SalesOrderItem.belongsTo(Order,  { foreignKey: 'orderId', as: 'order' })

  // ── SalesOrderItem ↔ Product ──────────────────────────────────────────────
  SalesOrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' })
  Product.hasMany(SalesOrderItem,   { foreignKey: 'productId', as: 'orderItems' })

  // ── SalesOrderItem ↔ Item (master-data / stock cut) ───────────────────────
  SalesOrderItem.belongsTo(Item, { foreignKey: 'itemId', as: 'item' })
  Item.hasMany(SalesOrderItem,   { foreignKey: 'itemId', as: 'orderItems' })

  // ── SalesOrderItem ↔ Store ────────────────────────────────────────────────
  SalesOrderItem.belongsTo(Store, { foreignKey: 'storeId', as: 'store' })
  Store.hasMany(SalesOrderItem,   { foreignKey: 'storeId', as: 'orderItems' })

  // ── SalesOrderItem ↔ SaleItem ─────────────────────────────────────────────
  SalesOrderItem.belongsTo(SaleItem, { foreignKey: 'saleItemId', as: 'saleItem' })
  SaleItem.hasMany(SalesOrderItem,   { foreignKey: 'saleItemId', as: 'orderItems' })

  // ── SalesOrderItem ↔ SalePackage (package header row) ─────────────────────
  if (SalePackage) {
    SalesOrderItem.belongsTo(SalePackage, { foreignKey: 'salePackageId', as: 'salePackage' })
    SalePackage.hasMany(SalesOrderItem,   { foreignKey: 'salePackageId', as: 'orderItems' })
  }

  // ── SalesOrderItem self-reference (parent → children) ─────────────────────
  SalesOrderItem.belongsTo(SalesOrderItem, { foreignKey: 'parentItemId', as: 'parentItem' })
  SalesOrderItem.hasMany(SalesOrderItem,   { foreignKey: 'parentItemId', as: 'childItems' })
}
