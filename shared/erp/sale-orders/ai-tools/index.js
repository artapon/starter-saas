// AI tools for the sales-order controller (mirrors sale-order.controller.js +
// sale-order.service.js).
//
// Sales orders are line-item workflow documents (draft → confirmed → shipped →
// delivered, or cancelled). Only drafts are editable — every other status is
// read-only on the document page and rejected by the service. So, like the
// quotations / invoices / purchasing modules, the agent gets read-only lookups
// + navigation only; no create/edit/status tools. The user authors and
// progresses orders on the (validating) document pages.

const navTargets = {
  orders_list:  { path: '/erp/sale-orders',        label: 'Orders' },
  order_create: { path: '/erp/sale-orders/create', label: 'New Order' },
}

const orderSvc = () => require('../services/sale-order.service')
const orgOf = (user) => user?.organizationId || user?.id || null

const STATUSES = ['draft', 'confirmed', 'shipped', 'delivered', 'cancelled']

const slim = (o) => ({
  id:          o.id,
  orderNumber: o.orderNumber,
  date:        o.orderDate,
  status:      o.status,
  customer:    o.customer?.name || null,
  total:       o.total != null ? Number(o.total) : null,
  currency:    o.currency || null,
})

// Resolve a free-text term (order number) to one order.
async function resolveOrder(search, user) {
  const term = (search || '').trim()
  if (!term) return { error: 'Provide a sales-order number to identify it.' }

  const { orders } = await orderSvc().list({ search: term, limit: 10, organizationId: orgOf(user) })
  if (!orders.length) return { error: `No sales order matches "${term}".` }
  if (orders.length === 1) return { order: orders[0] }

  const lc = term.toLowerCase()
  const exact = orders.filter((o) => o.orderNumber && o.orderNumber.toLowerCase() === lc)
  if (exact.length === 1) return { order: exact[0] }

  const refs = orders.map((o) => o.orderNumber).join(', ')
  return { error: `Multiple sales orders match "${term}": ${refs}. Use the exact order number.` }
}

const tools = [
  {
    name: 'list_sale_orders',
    kind: 'server',
    description: 'List or search sales orders. Use when the user asks what orders exist or their status '
      + '(e.g. "draft orders", "confirmed sales orders").',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Optional order-number filter (LIKE match on the order number).' },
        status: { type: 'string', enum: STATUSES, description: 'Optional status filter.' },
        limit:  { type: 'number', description: 'Max rows to return (default 10, max 50).' },
      },
    },
    async handler(args, { user }) {
      const { total, orders } = await orderSvc().list({
        search: args.search || '',
        status: args.status || '',
        limit:  Math.min(Math.max(Number(args.limit) || 10, 1), 50),
        organizationId: orgOf(user),
      })
      return {
        result: { total, orders: orders.map(slim) },
        action: { type: 'navigate', target: 'orders_list', path: '/erp/sale-orders', label: 'Orders' },
      }
    },
  },

  {
    name: 'get_sale_order',
    kind: 'server',
    description: 'Look up a single sales order\'s full details (header, customer, line items, totals) by '
      + 'order number.',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Order number identifying the sales order.' },
      },
      required: ['search'],
    },
    async handler(args, { user }) {
      const { order, error } = await resolveOrder(args.search, user)
      if (error) return { result: error }
      const o = await orderSvc().getById(order.id, orgOf(user))
      const items = (o.items || []).map((i) => ({
        product:   i.product?.name || i.saleItem?.name || i.productName || null,
        qty:       Number(i.quantity || 0),
        unitPrice: Number(i.unitPrice || 0),
        total:     Number(i.total || 0),
      }))
      return {
        result: {
          ...slim(o),
          saleType:    o.saleType || null,
          salesperson: o.salesperson?.name || null,
          reference:   o.referenceNumber || null,
          paymentTerms: o.paymentTerms || null,
          notes:       o.notes || null,
          subtotal:    o.subtotal != null ? Number(o.subtotal) : null,
          tax:         o.tax != null ? Number(o.tax) : null,
          whtAmount:   o.whtAmount != null ? Number(o.whtAmount) : null,
          netTotal:    o.netTotal != null ? Number(o.netTotal) : null,
          deliveryOrder: o.linkedDeliveryOrder?.refNo || null,
          invoice:     o.linkedInvoice?.invoiceNumber || null,
          items,
        },
        action: { type: 'navigate', target: 'order_detail', path: `/erp/sale-orders/${o.id}`, label: o.orderNumber },
      }
    },
  },
]

module.exports = { tools, navTargets, resolveOrder, slim }
