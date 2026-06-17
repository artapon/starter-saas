const {
  Invoice, InvoiceItem,
  Customer, Order, SaleItem, SalePackage, SalePackageItem, Product, Store, User,
  sequelize,
} = require('../../../server/models')
const { Op } = require('sequelize')
const { toFixed } = require('../../../server/utils/fmt')
const { findByPkScoped } = require('../../../server/core/tenant')

const itemIncludes = [
  { model: SaleItem,    as: 'saleItem',    attributes: ['id', 'name', 'code'] },
  { model: SalePackage, as: 'salePackage', attributes: ['id', 'name', 'code'] },
  { model: Product,     as: 'product',     attributes: ['id', 'name', 'sku'] },
  { model: Store,       as: 'store',       attributes: ['id', 'name', 'code'] },
]

const generateInvoiceNumber = async () => {
  const count = await Invoice.count()
  return `INV-${String(count + 1).padStart(5, '0')}`
}

const list = async ({ page = 1, limit = 20, search = '', status = '', dateFrom = '', dateTo = '', organizationId }) => {
  const offset = (page - 1) * limit
  const where = { organizationId: organizationId || null, dataFlag: { [Op.ne]: 2 } }
  if (search) where.invoiceNumber = { [Op.like]: `%${search}%` }
  if (status) where.status = status
  if (dateFrom || dateTo) {
    where.invoiceDate = {}
    if (dateFrom) where.invoiceDate[Op.gte] = dateFrom
    if (dateTo)   where.invoiceDate[Op.lte] = dateTo
  }

  const { count, rows } = await Invoice.findAndCountAll({
    where,
    include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'company'] }],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  })

  return { total: count, page, limit, invoices: rows }
}

const getById = async (id, organizationId) => {
  const invoice = await findByPkScoped(Invoice, id, organizationId, {
    include: [
      { model: Customer, as: 'customer' },
      { model: Order,    as: 'order',    attributes: ['id', 'orderNumber'] },
      { model: User,     as: 'salesperson', attributes: ['id', 'name', 'email'] },
      { model: InvoiceItem, as: 'items', include: itemIncludes },
    ],
    order: [[{ model: InvoiceItem, as: 'items' }, 'createdAt', 'ASC']],
  })
  if (!invoice) throw { status: 404, message: 'Invoice not found' }

  const { Receipt, DeliveryOrder } = require('../../../server/models')
  const [linkedReceipt, sourceDO] = await Promise.all([
    Receipt.findOne({ where: { invoiceId: id, dataFlag: { [Op.ne]: 2 } }, attributes: ['id', 'receiptNumber', 'status', 'amount'] }),
    invoice.deliveryOrderId
      ? DeliveryOrder.findByPk(invoice.deliveryOrderId, { attributes: ['id', 'refNo'] })
      : null,
  ])
  const json = invoice.toJSON()
  json.linkedReceipt = linkedReceipt
  json.deliveryOrder = sourceDO
  return json
}

// Per-line tax + order-level discount, mirrors order.service.computeTotals.
const computeTotals = (items, { discountType, discountValue, whtRate } = {}) => {
  const lines = items.map((i) => {
    const qty     = Number(i.quantity)      || 0
    const price   = Number(i.unitPrice)     || 0
    const rate    = Number(i.taxRate)       || 0
    const discPct = Number(i.discountValue) || 0
    const lineGross          = qty * price
    const lineDiscountAmount = toFixed(lineGross * (discPct / 100), 2)
    const lineSubtotal       = toFixed(lineGross - Number(lineDiscountAmount), 2)
    const taxAmount          = toFixed(Number(lineSubtotal) * (rate / 100), 2)
    return {
      ...i,
      taxRate: rate,
      discountValue:  discPct,
      discountAmount: lineDiscountAmount,
      taxAmount,
      total: toFixed(Number(lineSubtotal) + Number(taxAmount), 2),
      lineSubtotal,
    }
  })
  const subtotal = lines.reduce((s, l) => s + Number(l.lineSubtotal), 0)
  const tax      = lines.reduce((s, l) => s + Number(l.taxAmount), 0)
  const grossTotal = subtotal + tax

  let discountAmount = 0
  if (discountType === 'percent')   discountAmount = grossTotal * (Number(discountValue) || 0) / 100
  else if (discountType === 'fixed') discountAmount = Math.min(Number(discountValue) || 0, grossTotal)
  discountAmount = toFixed(discountAmount, 2)
  const total = toFixed(grossTotal - Number(discountAmount), 2)

  // Withholding tax is computed on the invoice amount (subtotal + tax) and
  // withheld from the total, so net payable = total - whtAmount.
  const rate = Number(whtRate) || 0
  const whtAmount = toFixed(grossTotal * rate / 100, 2)

  return {
    subtotal: toFixed(subtotal, 2),
    tax:      toFixed(tax, 2),
    discountAmount,
    total,
    whtRate: rate,
    whtAmount,
    netTotal: toFixed(total - Number(whtAmount), 2),
    lines,
  }
}

// Persist `lines` to `invoice_items` resolving parentKey → parentItemId.
// Items must be supplied in tree-order (parent before its children).
const persistInvoiceItems = async ({ invoiceId, lines, organizationId, t }) => {
  const keyToId = new Map()
  for (const item of lines) {
    const parentItemId = item.parentKey ? keyToId.get(item.parentKey) || null : null

    // Snapshot the code from whichever source the line came from so the printed
    // doc keeps showing it even if the source is later deleted/renamed. Prefer
    // the explicit `itemCode` from the client; fall back to looking it up.
    let itemCode = item.itemCode != null ? String(item.itemCode) : ''
    if (!itemCode) {
      if (item.salePackageId) {
        const pkg = await SalePackage.findByPk(item.salePackageId, { attributes: ['code'], transaction: t })
        itemCode = pkg?.code || ''
      } else if (item.saleItemId) {
        const si = await SaleItem.findByPk(item.saleItemId, { attributes: ['code'], transaction: t })
        itemCode = si?.code || ''
      }
      if (!itemCode && item.productId) {
        const p = await Product.findByPk(item.productId, { attributes: ['sku'], transaction: t })
        itemCode = p?.sku || ''
      }
    }

    const row = await InvoiceItem.create(
      {
        invoiceId,
        saleItemId:    item.saleItemId    || null,
        salePackageId: item.salePackageId || null,
        productId:     item.productId     || null,
        parentItemId,
        storeId:       item.storeId       || null,
        productName:   item.productName   || 'Item',
        itemCode:      itemCode           || null,
        description:   item.description   || null,
        quantity:       Number(item.quantity)       || 1,
        unitPrice:      Number(item.unitPrice)      || 0,
        taxRate:        Number(item.taxRate)        || 0,
        taxAmount:      Number(item.taxAmount)      || 0,
        discountValue:  Number(item.discountValue)  || 0,
        discountAmount: Number(item.discountAmount) || 0,
        total:          Number(item.total)          || 0,
        organizationId: organizationId || null,
      },
      { transaction: t }
    )
    if (item.key) keyToId.set(item.key, row.id)
  }
}

const create = async ({
  customerId, orderId, deliveryOrderId, invoiceDate, dueDate, notes, items = [],
  currency, exchangeRate,
  referenceNumber, paymentTerms, salespersonId, shippingAddress, billingAddress,
  discountType, discountValue,
  whtCode, whtRate,
  // Legacy: invoices used to take a single taxRate; if present and items lack
  // per-line tax, apply it uniformly so old callers keep working.
  taxRate,
  userId, organizationId,
}) => {
  if (!items.length) throw { status: 400, message: 'Invoice must have at least one item' }
  await require('../accounting/services/tax-period.service').assertOpen(invoiceDate || new Date(), organizationId)

  const invoiceNumber = await generateInvoiceNumber()

  // Backfill per-line taxRate from legacy single-taxRate when items omit it.
  const itemsWithTax = items.map(i => ({
    ...i,
    taxRate: i.taxRate != null ? Number(i.taxRate) : Number(taxRate || 0),
  }))
  const { subtotal, tax, total, discountAmount, whtAmount, lines } = computeTotals(itemsWithTax, { discountType, discountValue, whtRate })
  const fx = await require('../settings/services/currency.service').getRateOn(currency, invoiceDate, organizationId)
  const resolvedRate = exchangeRate != null && Number(exchangeRate) > 0 ? Number(exchangeRate) : fx

  let createdId
  await sequelize.transaction(async (t) => {
    const invoice = await Invoice.create(
      {
        invoiceNumber,
        customerId:      customerId      || null,
        orderId:         orderId         || null,
        deliveryOrderId: deliveryOrderId || null,
        currency:        currency || null,
        exchangeRate:    resolvedRate,
        invoiceDate:     invoiceDate || new Date(),
        dueDate:         dueDate     || null,
        notes,
        subtotal, tax, total,
        referenceNumber: referenceNumber || null,
        paymentTerms:    paymentTerms    || null,
        salespersonId:   salespersonId   || null,
        shippingAddress: shippingAddress || null,
        billingAddress:  billingAddress  || null,
        discountType:    discountType    || null,
        discountValue:   Number(discountValue) || 0,
        discountAmount,
        whtCode:         whtCode || null,
        whtRate:         Number(whtRate) || 0,
        whtAmount,
        organizationId: organizationId || null,
        createdBy: userId || null, modifiedBy: userId || null,
      },
      { transaction: t }
    )
    createdId = invoice.id

    await persistInvoiceItems({ invoiceId: invoice.id, lines, organizationId, t })
  })

  return getById(createdId)
}

const update = async (id, payload, userId, organizationId) => {
  const {
    customerId, orderId, invoiceDate, dueDate, notes, items, taxRate,
    currency, exchangeRate,
    referenceNumber, paymentTerms, salespersonId, shippingAddress, billingAddress,
    discountType, discountValue,
    whtCode, whtRate,
  } = payload || {}

  const invoice = await findByPkScoped(Invoice, id, organizationId)
  if (!invoice) throw { status: 404, message: 'Invoice not found' }
  if (invoice.status !== 'draft') throw { status: 400, message: 'Only draft invoices can be edited' }
  await require('../accounting/services/tax-period.service').assertOpen(invoiceDate || invoice.invoiceDate, invoice.organizationId)

  const headerExtras = {}
  if (currency !== undefined) headerExtras.currency = currency || null
  if (currency !== undefined || exchangeRate !== undefined) {
    const fx = await require('../settings/services/currency.service').getRateOn(currency, invoiceDate || invoice.invoiceDate, invoice.organizationId)
    headerExtras.exchangeRate = exchangeRate != null && Number(exchangeRate) > 0 ? Number(exchangeRate) : fx
  }
  if (referenceNumber !== undefined) headerExtras.referenceNumber = referenceNumber || null
  if (paymentTerms    !== undefined) headerExtras.paymentTerms    = paymentTerms    || null
  if (salespersonId   !== undefined) headerExtras.salespersonId   = salespersonId   || null
  if (shippingAddress !== undefined) headerExtras.shippingAddress = shippingAddress || null
  if (billingAddress  !== undefined) headerExtras.billingAddress  = billingAddress  || null
  if (whtCode         !== undefined) headerExtras.whtCode         = whtCode         || null

  await sequelize.transaction(async (t) => {
    if (items) {
      await InvoiceItem.destroy({ where: { invoiceId: id }, transaction: t })

      const itemsWithTax = items.map(i => ({
        ...i,
        taxRate: i.taxRate != null ? Number(i.taxRate) : Number(taxRate || 0),
      }))
      const dType  = discountType  !== undefined ? (discountType  || null) : invoice.discountType
      const dValue = discountValue !== undefined ? (Number(discountValue) || 0) : Number(invoice.discountValue) || 0
      const wRate  = whtRate       !== undefined ? (Number(whtRate) || 0)     : Number(invoice.whtRate) || 0
      const { subtotal, tax, total, discountAmount, whtAmount, lines } = computeTotals(itemsWithTax, { discountType: dType, discountValue: dValue, whtRate: wRate })

      await invoice.update({
        customerId: customerId || null,
        orderId: orderId || null,
        invoiceDate, dueDate, notes,
        subtotal, tax, total,
        discountType: dType, discountValue: dValue, discountAmount,
        whtRate: wRate, whtAmount,
        ...headerExtras, modifiedBy: userId || null,
      }, { transaction: t })

      await persistInvoiceItems({ invoiceId: id, lines, organizationId: invoice.organizationId, t })
    } else {
      if (discountType !== undefined || discountValue !== undefined || whtRate !== undefined) {
        const dType  = discountType  !== undefined ? (discountType  || null) : invoice.discountType
        const dValue = discountValue !== undefined ? (Number(discountValue) || 0) : Number(invoice.discountValue) || 0
        const wRate  = whtRate       !== undefined ? (Number(whtRate) || 0)     : Number(invoice.whtRate) || 0
        const sub = Number(invoice.subtotal) || 0
        const tx  = Number(invoice.tax) || 0
        let amt = 0
        if (dType === 'percent')      amt = (sub + tx) * dValue / 100
        else if (dType === 'fixed')   amt = Math.min(dValue, sub + tx)
        amt = toFixed(amt, 2)
        headerExtras.discountType   = dType
        headerExtras.discountValue  = dValue
        headerExtras.discountAmount = amt
        headerExtras.total          = toFixed(sub + tx - amt, 2)
        headerExtras.whtRate        = wRate
        headerExtras.whtAmount      = toFixed((sub + tx) * wRate / 100, 2)
      }
      await invoice.update({
        customerId: customerId || null, orderId: orderId || null,
        invoiceDate, dueDate, notes,
        ...headerExtras, modifiedBy: userId || null,
      }, { transaction: t })
    }
  })

  return getById(id)
}

const updateStatus = async (id, status, userId, organizationId) => {
  const invoice = await findByPkScoped(Invoice, id, organizationId)
  if (!invoice) throw { status: 404, message: 'Invoice not found' }
  if (invoice.status === status) return getById(id)

  const TRANSITIONS = {
    draft:     ['sent', 'cancelled'],
    sent:      ['paid', 'cancelled'],
    paid:      [],
    cancelled: [],
  }
  if (!TRANSITIONS[invoice.status]?.includes(status)) {
    throw { status: 400, message: `Cannot transition from "${invoice.status}" to "${status}"` }
  }

  const previousStatus = invoice.status
  await invoice.update({ status })
  const autoJournal = require('../accounting/services/auto-journal.service')
  if (status === 'sent') {
    try {
      const full = await getById(id)
      await autoJournal.postInvoice(full, userId)
      await autoJournal.postInvoiceCOGS(full, userId) // relieve inventory at cost
    } catch (err) {
      await invoice.update({ status: previousStatus })
      throw err
    }
  }
  if (status === 'cancelled' && ['sent', 'paid'].includes(previousStatus)) {
    try {
      await autoJournal.reverseInvoice(invoice, userId, `cancelled from "${previousStatus}"`)
      await autoJournal.reverseInvoiceCOGS(invoice, userId, `cancelled from "${previousStatus}"`)
    } catch (err) {
      await invoice.update({ status: previousStatus })
      throw err
    }
  }
  const audit = require('../audit/audit.service')
  audit.log({ userId, action: `invoice.${status}`, entityType: 'Invoice', entityId: id, summary: { from: previousStatus, to: status, invoiceNumber: invoice.invoiceNumber } })
  return getById(id)
}

const remove = async (id, organizationId) => {
  const invoice = await findByPkScoped(Invoice, id, organizationId)
  if (!invoice) throw { status: 404, message: 'Invoice not found' }
  if (invoice.status !== 'draft') throw { status: 400, message: 'Only draft invoices can be deleted' }
  await invoice.destroy()
}

const createReceipt = async (id, userId, organizationId) => {
  const invoice = await getById(id, organizationId)
  if (!['sent', 'paid'].includes(invoice.status)) {
    throw { status: 400, message: 'Only sent or paid invoices can record a payment' }
  }
  const { Receipt } = require('../../../server/models')
  const existing = await Receipt.findOne({
    where: { invoiceId: invoice.id, dataFlag: { [Op.ne]: 2 } },
    attributes: ['id', 'receiptNumber'],
  })
  if (existing) throw { status: 400, message: `Receipt ${existing.receiptNumber} already exists for this invoice. Cancel it first to record another payment.` }

  const receiptSvc = require('../receipts/receipt.service')
  const receipt = await receiptSvc.create({
    customerId:    invoice.customerId,
    invoiceId:     invoice.id,
    receiptDate:   new Date(),
    paymentMethod: 'cash',
    amount:        parseFloat(invoice.total) || 0,
    notes:         `Auto-created from Invoice ${invoice.invoiceNumber}`,
    userId,
    organizationId,
  })
  return { id: receipt.id }
}

module.exports = { list, getById, create, update, updateStatus, remove, createReceipt }
