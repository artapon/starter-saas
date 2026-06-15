module.exports = function ({ DeliveryOrder, DeliveryOrderItem, Customer, Order, Product, SaleItem, SalePackage, Store }) {
  DeliveryOrder.hasMany(DeliveryOrderItem, { foreignKey: 'deliveryOrderId', as: 'items', onDelete: 'CASCADE' })
  DeliveryOrderItem.belongsTo(DeliveryOrder, { foreignKey: 'deliveryOrderId', as: 'deliveryOrder' })

  DeliveryOrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' })

  DeliveryOrder.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' })
  DeliveryOrder.belongsTo(Order,    { foreignKey: 'orderId',    as: 'salesOrder' })

  if (SaleItem) {
    DeliveryOrderItem.belongsTo(SaleItem, { foreignKey: 'saleItemId', as: 'saleItem' })
  }
  if (SalePackage) {
    DeliveryOrderItem.belongsTo(SalePackage, { foreignKey: 'salePackageId', as: 'salePackage' })
  }
  if (Store) {
    DeliveryOrderItem.belongsTo(Store, { foreignKey: 'storeId', as: 'store' })
  }
}
