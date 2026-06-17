const {
  Quotation, QuotationItem,
  Customer, Product, Item, SaleItem, SalePackage, Store, User,
  sequelize,
} = require('../../../server/models')
const { Op } = require('sequelize')
const { toFixed } = require('../../../server/utils/fmt')
const { getNext } = require('../settings/services/sequence.service')
const { findByPkScoped } = require('../../../server/core/tenant')

const itemIncludes = [
  { model: SaleItem,    as: 'saleItem',    attributes: ['id', 'name', 'code'] },
  { model: Product,     as: 'product',     attributes: ['id', 'name', 'sku'] },
  { model: SalePackage, as: 'salePackage', attributes: ['id', 'code'] },
]

const list = async ({ page = 1, limit = 20, search = '', status = '', dateFrom = '', dateTo = '', organizationId }) => {
  const offset = (page - 1) * limit
  const where = { organizationId: organizationId || null, dataFlag: { [Op.ne]: 2 } }
  if (status) where.status = status
  if (dateFrom || dateTo) {
    where.quotationDate = {}
    if (dateFrom) where.quotationDate[Op.gte] = dateFrom
    if (dateTo)   where.quotationDate[Op.lte] = dateTo
  }
  if (search) {
    where[Op.or] = [
      { refNo: { [Op.like]: `%${search}%` } },
      { '$customer.name$': { [Op.like]: `%${search}%` } },
    ]
  }

  const { count, rows } = await Quotation.findAndCountAll({
    where,
    include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'company'] }],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
    subQuery: false,
  })

  return { total: count, page, limit, quotations: rows }
}

const getById = async (id, organizationId) => {
  const q = await findByPkScoped(Quotation, id, organizationId, {
    include: [
      { model: Customer, as: 'customer' },
      { model: User,     as: 'salesperson', attributes: ['id', 'name', 'email'] },
      { model: QuotationItem, as: 'items', include: itemIncludes },
    ],
    order: [[{ model: QuotationItem, as: 'items' }, 'createdAt', 'ASC']],
  })
  if (!q) throw { status: 404, message: 'Quotation not found' }
  return q
}

// Per-line tax + order-level discount (after subtotal+tax), mirrors order.service.
const computeTotals = (items, { discountType, discountValue } = {}) => {
  const lines = items.map((i) => {
    const qty   = Number(i.quantity)  || 0
    const price = Number(i.unitPrice) || 0
    const rate  = Number(i.taxRate)   || 0
    const lineSubtotal = qty * price
    const taxAmount    = toFixed(lineSubtotal * (rate / 100), 2)
    return {
      ...i,
      taxRate: rate,
      taxAmount,
      total: toFixed(lineSubtotal + taxAmount, 2),
      lineSubtotal: toFixed(lineSubtotal, 2),
    }
  })
  // Package children carry no price — they were normalized to 0 upstream.
  const subtotal = lines.reduce((s, l) => s + Number(l.lineSubtotal), 0)
  const tax      = lines.reduce((s, l) => s + Number(l.taxAmount), 0)
  const grossTotal = subtotal + tax

  let discountAmount = 0
  if (discountType === 'percent')   discountAmount = grossTotal * (Number(discountValue) || 0) / 100
  else if (discountType === 'fixed') discountAmount = Math.min(Number(discountValue) || 0, grossTotal)
  discountAmount = toFixed(discountAmount, 2)

  return {
    subtotal: toFixed(subtotal, 2),
    tax:      toFixed(tax, 2),
    discountAmount,
    total:    toFixed(grossTotal - Number(discountAmount), 2),
    lines,
  }
}

// Persist `lines` to `quotation_items` resolving parentKey → parentItemId.
// Items must be supplied in tree-order (parent before its children) so each
// child can resolve its parent's freshly-minted UUID.
const persistQuotationItems = async ({ quotationId, lines, organizationId, t }) => {
  const keyToId = new Map()
  for (const item of lines) {
    const parentItemId = item.parentKey ? keyToId.get(item.parentKey) || null : null
    const row = await QuotationItem.create(
      {
        quotationId,
        saleItemId:    item.saleItemId    || null,
        salePackageId: item.salePackageId || null,
        productId:     item.productId     || null,
        parentItemId,
        storeId:       item.storeId       || null,
        productName:   item.productName   || 'Item',
        quantity:      Number(item.quantity)  || 1,
        unitPrice:     Number(item.unitPrice) || 0,
        discount:      Number(item.discount)  || 0,
        taxRate:       Number(item.taxRate)   || 0,
        taxAmount:     Number(item.taxAmount) || 0,
        total:         Number(item.total)     || 0,
        notes:         item.notes || null,
        organizationId: organizationId || null,
      },
      { transaction: t }
    )
    if (item.key) keyToId.set(item.key, row.id)
  }
}

const create = async ({
  customerId, quotationDate, validUntil, notes, items = [], currency, exchangeRate,
  referenceNumber, paymentTerms, salespersonId, shippingAddress, billingAddress,
  discountType, discountValue,
  userId, organizationId,
}) => {
  if (!items.length) throw { status: 400, message: 'Quotation must have at least one item' }

  const refNo = await getNext('QT', userId)
  const { subtotal, tax, total, discountAmount, lines } = computeTotals(items, { discountType, discountValue })
  const fx = await require('../settings/services/currency.service').getRateOn(currency, quotationDate, organizationId)
  const resolvedRate = exchangeRate != null && Number(exchangeRate) > 0 ? Number(exchangeRate) : fx

  let createdId
  await sequelize.transaction(async (t) => {
    const q = await Quotation.create({
      refNo,
      customerId:    customerId   || null,
      quotationDate: quotationDate || new Date(),
      validUntil:    validUntil   || null,
      notes,
      subtotal, tax, total,
      currency:      currency || null,
      exchangeRate:  resolvedRate,
      referenceNumber: referenceNumber || null,
      paymentTerms:    paymentTerms    || null,
      salespersonId:   salespersonId   || null,
      shippingAddress: shippingAddress || null,
      billingAddress:  billingAddress  || null,
      discountType:    discountType    || null,
      discountValue:   Number(discountValue) || 0,
      discountAmount,
      organizationId:  organizationId || null,
      createdBy:       userId || null,
      modifiedBy:      userId || null,
    }, { transaction: t })
    createdId = q.id

    await persistQuotationItems({ quotationId: q.id, lines, organizationId, t })
  })

  return getById(createdId)
}

const update = async (id, payload, userId, organizationId) => {
  const {
    customerId, quotationDate, validUntil, notes, currency, exchangeRate, items,
    referenceNumber, paymentTerms, salespersonId, shippingAddress, billingAddress,
    discountType, discountValue,
  } = payload || {}

  const q = await findByPkScoped(Quotation, id, organizationId)
  if (!q) throw { status: 404, message: 'Quotation not found' }
  if (q.status !== 'draft') throw { status: 400, message: 'Only draft quotations can be edited' }

  const headerExtras = {}
  if (currency !== undefined) headerExtras.currency = currency || null
  if (currency !== undefined || exchangeRate !== undefined) {
    const fx = await require('../settings/services/currency.service').getRateOn(currency, quotationDate || q.quotationDate, q.organizationId)
    headerExtras.exchangeRate = exchangeRate != null && Number(exchangeRate) > 0 ? Number(exchangeRate) : fx
  }
  if (referenceNumber !== undefined) headerExtras.referenceNumber = referenceNumber || null
  if (paymentTerms    !== undefined) headerExtras.paymentTerms    = paymentTerms    || null
  if (salespersonId   !== undefined) headerExtras.salespersonId   = salespersonId   || null
  if (shippingAddress !== undefined) headerExtras.shippingAddress = shippingAddress || null
  if (billingAddress  !== undefined) headerExtras.billingAddress  = billingAddress  || null

  await sequelize.transaction(async (t) => {
    if (items) {
      await QuotationItem.destroy({ where: { quotationId: id }, transaction: t })
      const dType  = discountType  !== undefined ? (discountType  || null) : q.discountType
      const dValue = discountValue !== undefined ? (Number(discountValue) || 0) : Number(q.discountValue) || 0
      const { subtotal, tax, total, discountAmount, lines } = computeTotals(items, { discountType: dType, discountValue: dValue })

      await q.update({
        customerId: customerId || null,
        quotationDate, validUntil: validUntil || null, notes,
        subtotal, tax, total,
        discountType:  dType,
        discountValue: dValue,
        discountAmount,
        ...headerExtras,
        modifiedBy: userId || null,
      }, { transaction: t })

      await persistQuotationItems({ quotationId: id, lines, organizationId: q.organizationId, t })
    } else {
      if (discountType !== undefined || discountValue !== undefined) {
        const dType  = discountType  !== undefined ? (discountType  || null) : q.discountType
        const dValue = discountValue !== undefined ? (Number(discountValue) || 0) : Number(q.discountValue) || 0
        const sub = Number(q.subtotal) || 0
        const tax = Number(q.tax) || 0
        let amt = 0
        if (dType === 'percent')      amt = (sub + tax) * dValue / 100
        else if (dType === 'fixed')   amt = Math.min(dValue, sub + tax)
        headerExtras.discountType   = dType
        headerExtras.discountValue  = dValue
        headerExtras.discountAmount = toFixed(amt, 2)
        headerExtras.total          = toFixed(sub + tax - amt, 2)
      }
      await q.update({
        customerId: customerId || null,
        quotationDate,
        validUntil: validUntil || null,
        notes,
        ...headerExtras,
        modifiedBy: userId || null,
      }, { transaction: t })
    }
  })

  return getById(id)
}

const VALID_TRANSITIONS = {
  draft:     ['sent'],
  sent:      ['accepted', 'rejected', 'draft'],
  accepted:  ['draft'],
  rejected:  ['draft'],
  converted: [],
}

const updateStatus = async (id, status, userId, organizationId) => {
  const q = await findByPkScoped(Quotation, id, organizationId)
  if (!q) throw { status: 404, message: 'Quotation not found' }
  const oldStatus = q.status
  if (oldStatus === status) return getById(id)

  const allowed = VALID_TRANSITIONS[oldStatus] || []
  if (!allowed.includes(status)) {
    throw { status: 400, message: `Cannot transition from '${oldStatus}' to '${status}'` }
  }
  await q.update({ status, modifiedBy: userId || null })

  try {
    require('../audit/audit.service').log({
      userId,
      action: `quotation.${status}`,
      entityType: 'Quotation',
      entityId: id,
      summary: { from: oldStatus, to: status, refNo: q.refNo, total: q.total },
    })
  } catch { /* audit failures shouldn't block the status change */ }

  return getById(id)
}

const convertToOrder = async (id, userId, organizationId) => {
  const q = await getById(id, organizationId)
  if (q.status !== 'accepted') throw { status: 400, message: 'Only accepted quotations can be converted to an order' }
  if (q.convertedToOrderId) throw { status: 400, message: 'This quotation has already been converted to an order' }

  // Build items list in tree-order (parents before children) so the receiver
  // can resolve `parentKey` → newly-minted parent id.
  const topLevel = q.items.filter(it => !it.parentItemId)
  const childrenByParent = new Map()
  for (const it of q.items.filter(it => it.parentItemId)) {
    const arr = childrenByParent.get(it.parentItemId) || []
    arr.push(it)
    childrenByParent.set(it.parentItemId, arr)
  }
  const ordered = []
  for (const parent of topLevel) {
    ordered.push(parent)
    for (const child of (childrenByParent.get(parent.id) || [])) ordered.push(child)
  }

  const orderSvc = require('../sale-orders/services/sale-order.service')
  const orderResult = await orderSvc.create({
    customerId:      q.customerId,
    orderDate:       q.quotationDate,
    notes:           q.notes,
    currency:        q.currency,
    exchangeRate:    q.exchangeRate,
    referenceNumber: q.referenceNumber,
    paymentTerms:    q.paymentTerms,
    salespersonId:   q.salespersonId,
    shippingAddress: q.shippingAddress,
    billingAddress:  q.billingAddress,
    discountType:    q.discountType,
    discountValue:   Number(q.discountValue) || 0,
    items: ordered.map(it => ({
      key:           it.id,
      parentKey:     it.parentItemId || '',
      salePackageId: it.salePackageId || null,
      saleItemId:    it.saleItemId    || null,
      productId:     it.productId     || null,
      storeId:       it.storeId       || null,
      productName:   it.productName,
      quantity:      Number(it.quantity)  || 1,
      unitPrice:     Number(it.unitPrice) || 0,
      taxRate:       Number(it.taxRate)   || 0,
    })),
    userId,
    organizationId,
  })

  // Mark quotation as converted + link to the new order.
  const dbRow = await Quotation.findByPk(id)
  await dbRow.update({
    status: 'converted',
    convertedToOrderId: orderResult.id,
    modifiedBy: userId || null,
  })

  return { quotation: await getById(id), orderId: orderResult.id }
}

const remove = async (id, organizationId) => {
  const q = await findByPkScoped(Quotation, id, organizationId)
  if (!q) throw { status: 404, message: 'Quotation not found' }
  if (q.status !== 'draft') throw { status: 400, message: 'Only draft quotations can be deleted' }
  await q.destroy()
}

module.exports = { list, getById, create, update, updateStatus, convertToOrder, remove }
