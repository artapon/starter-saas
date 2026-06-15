const { Order, SalesOrderItem, Customer, Product, Item, SaleItem, SalePackage, Store, StoreStock, StockMovement, User, sequelize } = require('../../../../server/models')
const { Op } = require('sequelize')
const { toFixed } = require('../../../../server/utils/fmt')
const { findByPkScoped } = require('../../../../server/core/tenant')

const generateOrderNumber = async () => {
  const count = await Order.count()
  const pad = String(count + 1).padStart(5, '0')
  return `ORD-${pad}`
}

const list = async ({ page = 1, limit = 20, search = '', status = '', organizationId }) => {
  const offset = (page - 1) * limit
  const where = { organizationId: organizationId || null, dataFlag: { [Op.ne]: 2 } }
  if (search) where.orderNumber = { [Op.like]: `%${search}%` }
  if (status) where.status = status

  const { count, rows } = await Order.findAndCountAll({
    where,
    include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'company'] }],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  })

  return { total: count, page, limit, orders: rows }
}

const getById = async (id, organizationId) => {
  const order = await findByPkScoped(Order, id, organizationId, {
    include: [
      { model: Customer, as: 'customer' },
      { model: User, as: 'salesperson', attributes: ['id', 'name', 'email'] },
      { model: SalesOrderItem, as: 'items', include: [
        { model: Product,     as: 'product',     attributes: ['id', 'name', 'sku'] },
        { model: SaleItem,    as: 'saleItem',    attributes: ['id', 'code', 'name'] },
        { model: SalePackage, as: 'salePackage', attributes: ['id', 'code'] },
      ] },
    ],
    // Insert order keeps package headers immediately followed by their children
    // (the service writes them in that sequence).
    order: [[{ model: SalesOrderItem, as: 'items' }, 'createdAt', 'ASC']],
  })
  if (!order) throw { status: 404, message: 'Order not found' }

  // Surface linked targets so the UI can disable conversion buttons
  const { DeliveryOrder, Invoice } = require('../../../../server/models')
  const [linkedDO, linkedInv] = await Promise.all([
    DeliveryOrder.findOne({ where: { orderId: id, dataFlag: { [Op.ne]: 2 } }, attributes: ['id', 'refNo', 'status'] }),
    Invoice.findOne({       where: { orderId: id, dataFlag: { [Op.ne]: 2 } }, attributes: ['id', 'invoiceNumber', 'status'] }),
  ])
  const json = order.toJSON()
  json.linkedDeliveryOrder = linkedDO
  json.linkedInvoice       = linkedInv
  return json
}

// Compute per-line + order-level totals from incoming items.
// Discount is applied as a flat reduction to the total (after tax), shown
// as its own line in the summary — matches the "10% off your order" pattern.
const computeTotals = (items, { discountType, discountValue } = {}) => {
  const lines = items.map((i) => {
    const qty   = Number(i.quantity)  || 0
    const price = Number(i.unitPrice) || 0
    const rate  = Number(i.taxRate)   || 0
    const lineSubtotal = qty * price
    const taxAmount    = toFixed(lineSubtotal * (rate / 100), 2)
    return { ...i, taxRate: rate, taxAmount, total: toFixed(lineSubtotal + taxAmount, 2), lineSubtotal: toFixed(lineSubtotal, 2) }
  })
  const subtotal = lines.reduce((s, l) => s + Number(l.lineSubtotal), 0)
  const tax      = lines.reduce((s, l) => s + Number(l.taxAmount), 0)
  const grossTotal = subtotal + tax

  let discountAmount = 0
  if (discountType === 'percent') discountAmount = grossTotal * (Number(discountValue) || 0) / 100
  else if (discountType === 'fixed') discountAmount = Math.min(Number(discountValue) || 0, grossTotal)
  discountAmount = toFixed(discountAmount, 2)

  return {
    subtotal: toFixed(subtotal, 2),
    tax: toFixed(tax, 2),
    discountAmount,
    total: toFixed(grossTotal - Number(discountAmount), 2),
    lines,
  }
}

// Persist `lines` to `sales_order_items` resolving parentKey → parentItemId.
// Items must be supplied in tree-order (parent before its children) so that
// each child can resolve its parent's freshly-minted UUID.
const persistOrderItems = async ({ orderId, lines, organizationId, t }) => {
  const keyToId = new Map()
  for (const item of lines) {
    const product    = item.productId ? await Product.findByPk(item.productId, { transaction: t }) : null
    const masterItem = item.itemId    ? await Item.findByPk(item.itemId,       { transaction: t }) : null
    if (item.productId && !item.storeId) throw { status: 400, message: `Store is required for item "${item.productName || 'Unknown'}"` }

    const parentItemId = item.parentKey ? keyToId.get(item.parentKey) || null : null
    const row = await SalesOrderItem.create(
      {
        orderId,
        itemId:         item.itemId    || null,
        productId:      item.productId || null,
        saleItemId:     item.saleItemId || null,
        salePackageId:  item.salePackageId || null,
        parentItemId,
        storeId:        item.storeId   || null,
        productName:    item.productName || masterItem?.title || product?.name || 'Unknown',
        quantity:       item.quantity,
        unitPrice:      item.unitPrice,
        taxRate:        item.taxRate,
        taxAmount:      item.taxAmount,
        total:          item.total,
        organizationId: organizationId || null,
      },
      { transaction: t }
    )
    if (item.key) keyToId.set(item.key, row.id)
  }
}

const create = async ({
  customerId, orderDate, notes, items = [], currency, exchangeRate,
  referenceNumber, expectedDeliveryDate, paymentTerms, salespersonId,
  shippingAddress, billingAddress,
  discountType, discountValue,
  userId, organizationId,
}) => {
  if (!items.length) throw { status: 400, message: 'Order must have at least one item' }

  const orderNumber = await generateOrderNumber()
  const { subtotal, tax, total, discountAmount, lines } = computeTotals(items, { discountType, discountValue })
  const fx = await require('../../settings/services/currency.service').getRateOn(currency, orderDate, organizationId)
  const resolvedRate = exchangeRate != null && Number(exchangeRate) > 0 ? Number(exchangeRate) : fx

  let createdId
  await sequelize.transaction(async (t) => {
    const order = await Order.create(
      {
        orderNumber, customerId: customerId || null, orderDate: orderDate || new Date(),
        notes, subtotal, tax, total,
        currency: currency || null, exchangeRate: resolvedRate,
        referenceNumber:      referenceNumber || null,
        expectedDeliveryDate: expectedDeliveryDate || null,
        paymentTerms:         paymentTerms || null,
        salespersonId:        salespersonId || null,
        shippingAddress:      shippingAddress || null,
        billingAddress:       billingAddress || null,
        discountType:         discountType || null,
        discountValue:        Number(discountValue) || 0,
        discountAmount,
        organizationId: organizationId || null,
        createdBy: userId || null, modifiedBy: userId || null,
      },
      { transaction: t }
    )
    createdId = order.id
    await persistOrderItems({ orderId: order.id, lines, organizationId, t })
  })

  // Fetch the fully-populated order AFTER the transaction has committed
  return getById(createdId)
}

const updateStatus = async (id, status, userId, organizationId) => {
  const order = await findByPkScoped(Order, id, organizationId, {
    include: [{
      model: SalesOrderItem, as: 'items',
      include: [{ model: SaleItem, as: 'saleItem', attributes: ['id', 'productId'] }],
    }]
  })
  if (!order) throw { status: 404, message: 'Order not found' }
  const oldStatus = order.status

  if (oldStatus === status) return getById(id)

  const resolveProductId = (item) => item.productId || item.saleItem?.productId || null
  // Package headers carry no stock — their children do.
  const isPackageHeader = (item) => !!item.salePackageId && !item.parentItemId
  // Child qty is "per package" — multiply by the parent's qty for stock moves.
  const itemsById = new Map((order.items || []).map(i => [i.id, i]))
  const effectiveQty = (item) => {
    const base = Number(item.quantity) || 0
    if (!item.parentItemId) return base
    const parent = itemsById.get(item.parentItemId)
    return base * (Number(parent?.quantity) || 1)
  }

  await sequelize.transaction(async (t) => {
    // Cut stock when moving to confirmed
    if (status === 'confirmed' && ['draft', 'cancelled'].includes(oldStatus)) {
      const storeIds = [...new Set(order.items.map(i => i.storeId).filter(Boolean))]
      const { checkStoreLock } = require('../../stock/stock-count/stock-count.service')
      await checkStoreLock(storeIds)
      for (const item of order.items) {
        if (isPackageHeader(item)) continue
        const qty = effectiveQty(item)
        const productId = resolveProductId(item)
        if (productId) {
          const product = await Product.findByPk(productId, { transaction: t })
          if (product) {
            const before = parseFloat(product.stock)
            const after  = before - qty
            await product.update({ stock: after }, { transaction: t })

            if (item.storeId) {
              const [storeStock] = await StoreStock.findOrCreate({
                where: { productId, storeId: item.storeId },
                defaults: { stock: 0 },
                transaction: t,
              })
              await storeStock.update({ stock: storeStock.stock - qty }, { transaction: t })
            }

            await StockMovement.create({
              productId,
              storeId:     item.storeId || null,
              type:        'sale',
              qty:         -qty,
              stockBefore: before,
              stockAfter:  after,
              refType:     'SalesOrder',
              refId:       order.id,
              refNo:       order.orderNumber,
              notes:       `Sales Order ${order.orderNumber}`,
            }, { transaction: t })
          }
        }
        if (item.itemId) {
          const masterItem = await Item.findByPk(item.itemId, { transaction: t })
          if (masterItem) await masterItem.update({ stock: masterItem.stock - qty }, { transaction: t })
        }
      }
    }

    // Return stock when cancelled (if was previously confirmed/shipped/delivered)
    if (status === 'cancelled' && ['confirmed', 'shipped', 'delivered'].includes(oldStatus)) {
      const storeIds = [...new Set(order.items.map(i => i.storeId).filter(Boolean))]
      const { checkStoreLock } = require('../../stock/stock-count/stock-count.service')
      await checkStoreLock(storeIds)
      for (const item of order.items) {
        if (isPackageHeader(item)) continue
        const qty = effectiveQty(item)
        const productId = resolveProductId(item)
        if (productId) {
          const product = await Product.findByPk(productId, { transaction: t })
          if (product) {
            const before = parseFloat(product.stock)
            const after  = before + qty
            await product.update({ stock: after }, { transaction: t })

            if (item.storeId) {
              const [storeStock] = await StoreStock.findOrCreate({
                where: { productId, storeId: item.storeId },
                defaults: { stock: 0 },
                transaction: t,
              })
              await storeStock.update({ stock: storeStock.stock + qty }, { transaction: t })
            }

            await StockMovement.create({
              productId,
              storeId:     item.storeId || null,
              type:        'sale_cancel',
              qty,
              stockBefore: before,
              stockAfter:  after,
              refType:     'SalesOrder',
              refId:       order.id,
              refNo:       order.orderNumber,
              notes:       `Cancelled Sales Order ${order.orderNumber}`,
            }, { transaction: t })
          }
        }
        if (item.itemId) {
          const masterItem = await Item.findByPk(item.itemId, { transaction: t })
          if (masterItem) await masterItem.update({ stock: masterItem.stock + qty }, { transaction: t })
        }
      }
    }

    await order.update({ status }, { transaction: t })
  })

  require('../../audit/audit.service').log({
    userId,
    action: `order.${status}`,
    entityType: 'Order',
    entityId: id,
    summary: { from: oldStatus, to: status, orderNumber: order.orderNumber, total: order.total },
  })

  return getById(id)
}

const update = async (id, payload, userId, organizationId) => {
  const {
    customerId, orderDate, notes, currency, exchangeRate, items,
    referenceNumber, expectedDeliveryDate, paymentTerms, salespersonId,
    shippingAddress, billingAddress,
    discountType, discountValue,
  } = payload || {}

  const order = await findByPkScoped(Order, id, organizationId)
  if (!order) throw { status: 404, message: 'Order not found' }
  if (order.status !== 'draft') throw { status: 400, message: 'Only draft orders can be edited' }

  const headerExtras = {}
  if (currency !== undefined) headerExtras.currency = currency || null
  if (currency !== undefined || exchangeRate !== undefined) {
    const fx = await require('../../settings/services/currency.service').getRateOn(currency, orderDate || order.orderDate, order.organizationId)
    headerExtras.exchangeRate = exchangeRate != null && Number(exchangeRate) > 0 ? Number(exchangeRate) : fx
  }
  // Optional header-only fields — only overwrite the column when the client
  // explicitly sent the key so a partial update doesn't blank things.
  if (referenceNumber      !== undefined) headerExtras.referenceNumber      = referenceNumber      || null
  if (expectedDeliveryDate !== undefined) headerExtras.expectedDeliveryDate = expectedDeliveryDate || null
  if (paymentTerms         !== undefined) headerExtras.paymentTerms         = paymentTerms         || null
  if (salespersonId        !== undefined) headerExtras.salespersonId        = salespersonId        || null
  if (shippingAddress      !== undefined) headerExtras.shippingAddress      = shippingAddress      || null
  if (billingAddress       !== undefined) headerExtras.billingAddress       = billingAddress       || null

  await sequelize.transaction(async (t) => {
    if (items) {
      await SalesOrderItem.destroy({ where: { orderId: id }, transaction: t })

      // Use the request's discount when provided, otherwise keep the current.
      const dType  = discountType  !== undefined ? (discountType  || null) : order.discountType
      const dValue = discountValue !== undefined ? (Number(discountValue) || 0) : Number(order.discountValue) || 0
      const { subtotal, tax, total, discountAmount, lines } = computeTotals(items, { discountType: dType, discountValue: dValue })

      await order.update({
        customerId: customerId || null, orderDate, notes,
        subtotal, tax, total,
        discountType: dType, discountValue: dValue, discountAmount,
        ...headerExtras, modifiedBy: userId || null,
      }, { transaction: t })
      await persistOrderItems({ orderId: id, lines, organizationId: order.organizationId, t })
    } else {
      // No item change — still allow header-only updates including discount.
      if (discountType !== undefined || discountValue !== undefined) {
        const dType  = discountType  !== undefined ? (discountType  || null) : order.discountType
        const dValue = discountValue !== undefined ? (Number(discountValue) || 0) : Number(order.discountValue) || 0
        const sub = Number(order.subtotal) || 0
        const tax = Number(order.tax) || 0
        let amt = 0
        if (dType === 'percent') amt = (sub + tax) * dValue / 100
        else if (dType === 'fixed') amt = Math.min(dValue, sub + tax)
        headerExtras.discountType   = dType
        headerExtras.discountValue  = dValue
        headerExtras.discountAmount = toFixed(amt, 2)
        headerExtras.total          = toFixed(sub + tax - amt, 2)
      }
      await order.update({ customerId: customerId || null, orderDate, notes, ...headerExtras, modifiedBy: userId || null }, { transaction: t })
    }
  })

  return getById(id)
}

const remove = async (id, organizationId) => {
  const order = await findByPkScoped(Order, id, organizationId)
  if (!order) throw { status: 404, message: 'Order not found' }
  if (order.status !== 'draft') throw { status: 400, message: 'Only draft orders can be deleted' }
  await order.destroy()
}

const listItems = async ({ page = 1, limit = 50, search = '' }) => {
  const offset = (page - 1) * limit
  const where = {}
  if (search) {
    where[Op.or] = [
      { productName: { [Op.like]: `%${search}%` } },
    ]
  }

  const { count, rows } = await SalesOrderItem.findAndCountAll({
    where,
    include: [
      { model: Order, as: 'order', attributes: ['orderNumber', 'status', 'orderDate'] },
      { model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'stock'] }
    ],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  })

  return { total: count, items: rows }
}

const getItemById = async (id, organizationId) => {
  const item = await findByPkScoped(SalesOrderItem, id, organizationId, {
    include: [
      { model: Order, as: 'order', attributes: ['id', 'orderNumber', 'status', 'orderDate'] },
      { model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'stock'] },
    ],
  })
  if (!item) throw { status: 404, message: 'Order item not found' }
  return item
}

const recalcOrderTotals = async (orderId, t) => {
  const items = await SalesOrderItem.findAll({ where: { orderId }, transaction: t })
  const subtotal = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0)
  const tax      = items.reduce((sum, i) => sum + Number(i.taxAmount || 0), 0)
  const total    = subtotal + tax
  const order = await Order.findByPk(orderId, { transaction: t })
  await order.update({ subtotal: toFixed(subtotal, 2), tax: toFixed(tax, 2), total: toFixed(total, 2) }, { transaction: t })
}

const updateItem = async (id, { productId, productName, quantity, unitPrice, taxRate }, organizationId) => {
  const item = await findByPkScoped(SalesOrderItem, id, organizationId, {
    include: [{ model: Order, as: 'order', attributes: ['id', 'status'] }],
  })
  if (!item) throw { status: 404, message: 'Order item not found' }
  if (item.order.status !== 'draft') throw { status: 400, message: 'Only items on draft orders can be edited' }

  return sequelize.transaction(async (t) => {
    const resolvedProductId = productId || null
    let resolvedName = productName

    if (resolvedProductId && !resolvedName) {
      const product = await Product.findByPk(resolvedProductId, { transaction: t })
      resolvedName = product?.name || 'Unknown'
    }

    const qty   = quantity ?? item.quantity
    const price = unitPrice ?? item.unitPrice
    const rate  = taxRate ?? Number(item.taxRate || 0)
    const lineSubtotal = (Number(qty) || 0) * (Number(price) || 0)
    const taxAmount    = toFixed(lineSubtotal * (Number(rate) / 100), 2)
    const lineTotal    = toFixed(lineSubtotal + taxAmount, 2)

    await item.update(
      {
        productId: resolvedProductId,
        productName: resolvedName || item.productName,
        quantity: qty,
        unitPrice: price,
        taxRate: rate,
        taxAmount,
        total: lineTotal,
      },
      { transaction: t }
    )

    await recalcOrderTotals(item.orderId, t)
    return getItemById(id)
  })
}

const deleteItem = async (id, organizationId) => {
  const item = await findByPkScoped(SalesOrderItem, id, organizationId, {
    include: [{ model: Order, as: 'order', attributes: ['id', 'status'] }],
  })
  if (!item) throw { status: 404, message: 'Order item not found' }
  if (item.order.status !== 'draft') throw { status: 400, message: 'Only items on draft orders can be deleted' }

  return sequelize.transaction(async (t) => {
    const orderId = item.orderId
    await item.destroy({ transaction: t })
    await recalcOrderTotals(orderId, t)
  })
}

const createDeliveryOrder = async (id, userId, organizationId) => {
  const order = await getById(id, organizationId)
  if (!['confirmed', 'shipped', 'delivered'].includes(order.status)) {
    throw { status: 400, message: 'Only confirmed orders can generate a delivery order' }
  }
  const { DeliveryOrder, DeliveryOrderItem } = require('../../../../server/models')

  const existing = await DeliveryOrder.findOne({
    where: { orderId: order.id, dataFlag: { [Op.ne]: 2 } },
    attributes: ['id', 'refNo'],
  })
  if (existing) throw { status: 400, message: `Delivery order ${existing.refNo} already exists for this sales order. Cancel it first to create a new one.` }
  const { getNext } = require('../../settings/services/sequence.service')

  const refNo = await getNext('DO', userId)
  const today = new Date().toISOString().slice(0, 10)

  let createdId
  await sequelize.transaction(async (t) => {
    const shippingAddr = order.shippingAddress || order.customer?.address || null
    const doc = await DeliveryOrder.create({
      refNo,
      date: today,
      orderId: order.id,
      customerId: order.customerId || null,
      // Carry across the SO header context.
      referenceNumber: order.referenceNumber || null,
      paymentTerms:    order.paymentTerms    || null,
      salespersonId:   order.salespersonId   || null,
      shippingAddress: shippingAddr,
      billingAddress:  order.billingAddress  || null,
      address:         shippingAddr,
      notes: `Auto-created from Sales Order ${order.orderNumber}`,
      organizationId: organizationId || null,
      createdBy: userId || null,
      modifiedBy: userId || null,
    }, { transaction: t })
    createdId = doc.id

    // DO ships physical items, so skip package headers and use the children's
    // (per-package) qty multiplied by their parent's qty.
    const itemsByDOId = new Map((order.items || []).map(i => [i.id, i]))
    for (const item of order.items) {
      if (item.salePackageId && !item.parentItemId) continue
      let qty = Number(item.quantity) || 0
      if (item.parentItemId) {
        const parent = itemsByDOId.get(item.parentItemId)
        qty *= Number(parent?.quantity) || 1
      }
      await DeliveryOrderItem.create({
        deliveryOrderId: doc.id,
        productId:       item.productId || null,
        saleItemId:      item.saleItemId || null,
        storeId:         item.storeId   || null,
        productName:     item.productName,
        qty,
        notes:           null,
        organizationId:  organizationId || null,
      }, { transaction: t })
    }
  })

  return { id: createdId }
}

const createInvoice = async (id, userId, organizationId) => {
  const order = await getById(id, organizationId)
  if (!['confirmed', 'shipped', 'delivered'].includes(order.status)) {
    throw { status: 400, message: 'Only confirmed orders can generate an invoice' }
  }
  const { Invoice } = require('../../../../server/models')
  const existing = await Invoice.findOne({
    where: { orderId: order.id, dataFlag: { [Op.ne]: 2 } },
    attributes: ['id', 'invoiceNumber'],
  })
  if (existing) throw { status: 400, message: `Invoice ${existing.invoiceNumber} already exists for this sales order. Cancel it first to create a new one.` }

  // Preserve the SO's per-line tax and package parent/child structure on the
  // invoice. Package children inherit qty/price/tax from the SO (children carry
  // 0; the parent is the priced row), and the invoice keeps them in tree order
  // so `parentKey` resolves to the new parent's id.
  const topLevel = (order.items || []).filter(it => !it.parentItemId)
  const childrenByParent = new Map()
  for (const it of (order.items || []).filter(it => it.parentItemId)) {
    const arr = childrenByParent.get(it.parentItemId) || []
    arr.push(it)
    childrenByParent.set(it.parentItemId, arr)
  }
  const ordered = []
  for (const parent of topLevel) {
    ordered.push(parent)
    for (const child of (childrenByParent.get(parent.id) || [])) ordered.push(child)
  }

  const invoiceSvc = require('../../invoices/invoice.service')
  const invoice = await invoiceSvc.create({
    customerId:      order.customerId,
    orderId:         order.id,
    invoiceDate:     new Date(),
    notes:           `Auto-created from Sales Order ${order.orderNumber}`,
    currency:        order.currency,
    exchangeRate:    order.exchangeRate,
    referenceNumber: order.referenceNumber,
    paymentTerms:    order.paymentTerms,
    salespersonId:   order.salespersonId,
    shippingAddress: order.shippingAddress,
    billingAddress:  order.billingAddress,
    discountType:    order.discountType,
    discountValue:   Number(order.discountValue) || 0,
    items: ordered.map(it => ({
      key:           it.id,
      parentKey:     it.parentItemId || '',
      salePackageId: it.salePackageId || null,
      saleItemId:    it.saleItemId    || null,
      productId:     it.productId     || null,
      storeId:       it.storeId       || null,
      productName:   it.productName,
      // Snapshot the code so the invoice keeps showing it even if the source is
      // later deleted/renamed. Prefer the stored item snapshot, fall back to
      // the loaded associations.
      itemCode:      it.itemCode || it.saleItem?.code || it.salePackage?.code || it.product?.sku || null,
      quantity:      Number(it.quantity)  || 1,
      unitPrice:     Number(it.unitPrice) || 0,
      taxRate:       Number(it.taxRate)   || 0,
    })),
    userId,
    organizationId,
  })
  return { id: invoice.id }
}

module.exports = { list, getById, create, update, updateStatus, remove, listItems, getItemById, updateItem, deleteItem, createDeliveryOrder, createInvoice }
