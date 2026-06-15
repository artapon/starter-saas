const {
  DeliveryOrder, DeliveryOrderItem,
  Customer, Order, Product, SaleItem, SalePackage, SalePackageItem, Store, User,
} = require('../../../../server/models')
const { Op } = require('sequelize')
const sequelize = require('../../../../server/config/database')
const { getNext } = require('../../settings/services/sequence.service')
const { findByPkScoped } = require('../../../../server/core/tenant')

const customerAttrs = ['id', 'name', 'company', 'email', 'phone', 'address']
const orderAttrs    = ['id', 'orderNumber', 'orderDate', 'status']
const productAttrs  = ['id', 'name', 'sku']

const itemInclude = {
  model: DeliveryOrderItem,
  as: 'items',
  include: [
    { model: Product,     as: 'product',     attributes: productAttrs },
    { model: SaleItem,    as: 'saleItem',    attributes: ['id', 'name', 'code'] },
    { model: SalePackage, as: 'salePackage', attributes: ['id', 'name', 'code'] },
    { model: Store,       as: 'store',       attributes: ['id', 'name', 'code'] },
  ],
}

const nextRefNo = (userId) => getNext('DO', userId)

// ── List ──────────────────────────────────────────────────────────────────────
const list = async ({ page = 1, limit = 20, search = '', status = '', dateFrom = '', dateTo = '', organizationId }) => {
  const offset = (page - 1) * limit
  const where  = { organizationId: organizationId || null, dataFlag: { [Op.ne]: 2 } }
  if (search) where[Op.or] = [{ refNo: { [Op.like]: `%${search}%` } }]
  if (status) where.status = status
  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) where.date[Op.gte] = dateFrom
    if (dateTo)   where.date[Op.lte] = dateTo
  }

  const { count, rows } = await DeliveryOrder.findAndCountAll({
    where, limit, offset,
    order: [['createdAt', 'DESC']],
    include: [{ model: Customer, as: 'customer', attributes: customerAttrs }],
    distinct: true,
  })
  return { total: count, page, limit, deliveryOrders: rows }
}

// ── Get by id ─────────────────────────────────────────────────────────────────
const getById = async (id, organizationId) => {
  const doc = await findByPkScoped(DeliveryOrder, id, organizationId, {
    include: [
      itemInclude,
      { model: Customer, as: 'customer', attributes: customerAttrs },
      { model: Order,    as: 'salesOrder', attributes: orderAttrs },
      { model: User,     as: 'salesperson', attributes: ['id', 'name', 'email'] },
    ],
    order: [[{ model: DeliveryOrderItem, as: 'items' }, 'createdAt', 'ASC']],
  })
  if (!doc) throw { status: 404, message: 'Delivery Order not found' }

  const { Invoice } = require('../../../../server/models')
  const linkedInv = await Invoice.findOne({
    where: { deliveryOrderId: id, dataFlag: { [Op.ne]: 2 } },
    attributes: ['id', 'invoiceNumber', 'status'],
  })
  const json = doc.toJSON()
  json.linkedInvoice = linkedInv
  return json
}

// Expand a Sale Package row into its children, multiplying each child's qty by
// the parent qty. Packages don't ship as a unit — only the contents do.
async function expandPackageRow(item, organizationId, t) {
  const pkg = await SalePackage.findByPk(item.salePackageId, {
    include: [{ model: SalePackageItem, as: 'packageItems', include: [{ model: SaleItem, as: 'saleItem' }] }],
    transaction: t,
  })
  if (!pkg) return []
  const pkgQty = Number(item.qty) || 1
  return (pkg.packageItems || []).map(pi => {
    const si = pi.saleItem || {}
    const childQty = Number(pi.quantity) || 1
    return {
      saleItemId:    pi.saleItemId || null,
      salePackageId: null,
      productId:     si.productId || null,
      storeId:       item.storeId || null,
      productName:   si.name || 'Item',
      qty:           pkgQty * childQty,
      notes:         item.notes || null,
    }
  })
}

// Walk incoming items; for any row flagged isPackage / salePackageId, expand
// into one row per package child with qty = childQty × pkgQty.
async function normalizeItems(rawItems, organizationId, t) {
  const flat = []
  for (const raw of rawItems || []) {
    if (raw.isPackage || raw.salePackageId) {
      const children = await expandPackageRow(raw, organizationId, t)
      flat.push(...children)
    } else {
      flat.push({
        saleItemId:    raw.saleItemId    || null,
        salePackageId: null,
        productId:     raw.productId     || null,
        storeId:       raw.storeId       || null,
        productName:   (raw.productName || '').trim(),
        qty:           Number(raw.qty) || 0,
        notes:         raw.notes || null,
      })
    }
  }
  return flat
}

function validateItems(items) {
  for (const item of items) {
    if (!item.productName) throw { status: 400, message: 'Each item needs a product name' }
    if (!item.qty || Number(item.qty) <= 0) throw { status: 400, message: 'Quantity must be greater than 0' }
  }
}

// ── Create ────────────────────────────────────────────────────────────────────
const create = async ({
  date, deliveryDate, orderId, customerId,
  referenceNumber, paymentTerms, salespersonId, shippingAddress, billingAddress,
  address, notes, items = [], userId, organizationId,
}) => {
  if (!date)         throw { status: 400, message: 'Date is required' }
  if (!customerId)   throw { status: 400, message: 'Customer is required' }
  if (!items.length) throw { status: 400, message: 'At least one item is required' }

  const refNo = await nextRefNo(userId)
  const t = await sequelize.transaction()
  try {
    const lines = await normalizeItems(items, organizationId, t)
    validateItems(lines)

    const doc = await DeliveryOrder.create(
      {
        refNo, date, deliveryDate: deliveryDate || null,
        orderId:         orderId || null,
        customerId,
        referenceNumber: referenceNumber || null,
        paymentTerms:    paymentTerms    || null,
        salespersonId:   salespersonId   || null,
        shippingAddress: shippingAddress || address || null,
        billingAddress:  billingAddress  || null,
        address:         address || shippingAddress || null,
        notes:           notes || null,
        organizationId:  organizationId || null,
        createdBy:       userId || null,
        modifiedBy:      userId || null,
      },
      { transaction: t },
    )
    for (const line of lines) {
      await DeliveryOrderItem.create(
        { deliveryOrderId: doc.id, ...line, organizationId: organizationId || null },
        { transaction: t },
      )
    }
    await t.commit()
    return getById(doc.id)
  } catch (err) {
    await t.rollback()
    throw err
  }
}

// ── Update (draft only) ───────────────────────────────────────────────────────
const update = async (id, payload, userId, organizationId) => {
  const {
    date, deliveryDate, orderId, customerId,
    referenceNumber, paymentTerms, salespersonId, shippingAddress, billingAddress,
    address, notes, items,
  } = payload || {}

  const doc = await findByPkScoped(DeliveryOrder, id, organizationId)
  if (!doc) throw { status: 404, message: 'Delivery Order not found' }
  if (doc.status !== 'draft') throw { status: 400, message: 'Only draft delivery orders can be edited' }

  const t = await sequelize.transaction()
  try {
    const headerExtras = {}
    if (date              !== undefined) headerExtras.date              = date
    if (deliveryDate      !== undefined) headerExtras.deliveryDate      = deliveryDate || null
    if (orderId           !== undefined) headerExtras.orderId           = orderId || null
    if (customerId        !== undefined) headerExtras.customerId        = customerId
    if (referenceNumber   !== undefined) headerExtras.referenceNumber   = referenceNumber   || null
    if (paymentTerms      !== undefined) headerExtras.paymentTerms      = paymentTerms      || null
    if (salespersonId     !== undefined) headerExtras.salespersonId     = salespersonId     || null
    if (shippingAddress   !== undefined) {
      headerExtras.shippingAddress = shippingAddress || null
      headerExtras.address         = shippingAddress || null
    } else if (address    !== undefined) {
      headerExtras.address         = address || null
      headerExtras.shippingAddress = address || null
    }
    if (billingAddress    !== undefined) headerExtras.billingAddress    = billingAddress    || null
    if (notes             !== undefined) headerExtras.notes             = notes             || null
    headerExtras.modifiedBy = userId || null

    await doc.update(headerExtras, { transaction: t })

    if (Array.isArray(items)) {
      await DeliveryOrderItem.destroy({ where: { deliveryOrderId: id }, transaction: t })
      const lines = await normalizeItems(items, doc.organizationId, t)
      validateItems(lines)
      for (const line of lines) {
        await DeliveryOrderItem.create(
          { deliveryOrderId: id, ...line, organizationId: doc.organizationId || null },
          { transaction: t },
        )
      }
    }
    await t.commit()
    return getById(id)
  } catch (err) {
    await t.rollback()
    throw err
  }
}

// ── Status transitions ────────────────────────────────────────────────────────
const TRANSITIONS = {
  draft:     ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped:   ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
}

async function transition(id, userId, from, to, errorMsg, organizationId) {
  const doc = await findByPkScoped(DeliveryOrder, id, organizationId)
  if (!doc) throw { status: 404, message: 'Delivery Order not found' }
  if (doc.status !== from) throw { status: 400, message: errorMsg }
  await doc.update({ status: to, modifiedBy: userId || null })
  require('../../audit/audit.service').log({ userId, action: `delivery-order.${to}`, entityType: 'DeliveryOrder', entityId: id, summary: { from, to, refNo: doc.refNo } })
  return getById(id)
}

const confirm = (id, userId, organizationId) => transition(id, userId, 'draft',     'confirmed', 'Only draft delivery orders can be confirmed', organizationId)
const ship    = (id, userId, organizationId) => transition(id, userId, 'confirmed', 'shipped',   'Only confirmed delivery orders can be marked as shipped', organizationId)
const deliver = (id, userId, organizationId) => transition(id, userId, 'shipped',   'delivered', 'Only shipped delivery orders can be marked as delivered', organizationId)

const cancel = async (id, userId, organizationId) => {
  const doc = await findByPkScoped(DeliveryOrder, id, organizationId)
  if (!doc) throw { status: 404, message: 'Delivery Order not found' }
  if (!TRANSITIONS[doc.status]?.includes('cancelled')) throw { status: 400, message: 'Cannot cancel a delivered or already cancelled order' }
  const previous = doc.status
  await doc.update({ status: 'cancelled', modifiedBy: userId || null })
  require('../../audit/audit.service').log({ userId, action: 'delivery-order.cancelled', entityType: 'DeliveryOrder', entityId: id, summary: { from: previous, to: 'cancelled', refNo: doc.refNo } })
  return getById(id)
}

const remove = async (id, organizationId) => {
  const doc = await findByPkScoped(DeliveryOrder, id, organizationId)
  if (!doc)                   throw { status: 404, message: 'Delivery Order not found' }
  if (doc.status !== 'draft') throw { status: 400, message: 'Only draft delivery orders can be deleted' }
  await doc.destroy()
}

const createInvoice = async (id, userId, organizationId) => {
  const doc = await getById(id, organizationId)
  if (!['shipped', 'delivered'].includes(doc.status)) {
    throw { status: 400, message: 'Only shipped or delivered orders can be invoiced' }
  }

  const { Invoice, SalesOrderItem } = require('../../../../server/models')
  const existing = await Invoice.findOne({
    where: { deliveryOrderId: doc.id, dataFlag: { [Op.ne]: 2 } },
    attributes: ['id', 'invoiceNumber'],
  })
  if (existing) throw { status: 400, message: `Invoice ${existing.invoiceNumber} already exists for this delivery order. Cancel it first to create a new one.` }

  // Pull unit prices from the source Sales Order (DO items don't carry price).
  const priceMap = {}
  if (doc.orderId) {
    const orderItems = await SalesOrderItem.findAll({ where: { orderId: doc.orderId } })
    for (const oi of orderItems) {
      if (oi.productId) priceMap[oi.productId] = parseFloat(oi.unitPrice) || 0
      if (oi.productName) priceMap[`name:${oi.productName}`] = parseFloat(oi.unitPrice) || 0
      if (oi.saleItemId) priceMap[`sale:${oi.saleItemId}`] = parseFloat(oi.unitPrice) || 0
    }
  }

  const invoiceSvc = require('../../invoices/invoice.service')
  const invoice = await invoiceSvc.create({
    customerId:      doc.customerId,
    orderId:         doc.orderId || null,
    deliveryOrderId: doc.id,
    invoiceDate:     new Date(),
    notes:           `Auto-created from Delivery Order ${doc.refNo}`,
    items: doc.items.map(i => ({
      productName: i.productName,
      quantity:    parseFloat(i.qty) || 0,
      unitPrice:
        priceMap[i.productId] ??
        priceMap[`sale:${i.saleItemId}`] ??
        priceMap[`name:${i.productName}`] ??
        0,
    })),
    taxRate: 0,
    userId,
    organizationId,
  })
  return { id: invoice.id }
}

module.exports = { list, getById, create, update, confirm, ship, deliver, cancel, remove, createInvoice }
