// Hybrid audit capture — the automatic half.
//
// Mounted on the whole /api/erp surface, this records one coarse audit row per
// successful mutation (create/update/delete) so the *entire* ERP is covered
// without touching ~46 services. Rich, business-specific events (invoice.send,
// po.approve, …) are still emitted explicitly by services via audit.log(); a
// handler can set `res.locals.skipAudit = true` to suppress the coarse row when
// it has already logged a precise one.

const audit = require('./audit.service')

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Resource path (segments before any id, joined by '/') → entity type. Covers
// the ambiguous/nested cases (purchasing/orders is a PurchaseOrder, not the
// sales Order). Anything not listed falls back to a singularized PascalCase of
// the last resource segment.
const ENTITY_MAP = {
  'customers':                       'Customer',
  'customer-groups':                 'CustomerGroup',
  'vendors':                         'Vendor',
  'item-master':                     'Product',
  'product-categories':              'ProductCategory',
  'orders':                          'Order',
  'sale-orders':                     'Order',
  'delivery-orders':                 'DeliveryOrder',
  'quotations':                      'Quotation',
  'invoices':                        'Invoice',
  'receipts':                        'Receipt',
  'pricing':                         'Pricing',
  'stores':                          'Store',
  'uom':                             'Uom',
  'uom-conversion':                  'UomConversion',
  'sale-items':                      'SaleItem',
  'sale-packages':                   'SalePackage',
  'attachments':                     'Attachment',
  'alerts':                          'Alert',
  'good-receive':                    'GoodReceive',
  'stock-adjust':                    'StockAdjust',
  'stock-issue':                     'StockIssue',
  'stock-return':                    'StockReturn',
  'stock-request':                   'StockRequest',
  'stock-count':                     'StockCount',
  'stock-movements':                 'StockMovement',
  'sequences':                       'Sequence',
  'master-data':                     'MasterData',
  'purchasing/orders':               'PurchaseOrder',
  'purchasing/requisitions':         'PurchaseRequisition',
  'purchasing/bills':                'VendorBill',
  'accounting/chart-of-accounts':    'ChartOfAccount',
  'accounting/journals':             'Journal',
  'accounting/fiscal-years':         'FiscalYear',
  'accounting/tax-periods':          'TaxPeriod',
  'billing/billing-notes':           'BillingNote',
  'billing/debit-notes':             'DebitNote',
  'billing/credit-notes':            'CreditNote',
  'billing/receive-payments':        'ReceivePayment',
  'settings/approval-thresholds':    'ApprovalThreshold',
  'settings/currencies':             'Currency',
  'settings/general':                'GeneralSetting',
  'settings/demo-data':              'DemoData',
}

const SENSITIVE_KEY_RE = /pass|token|secret|otp|pin/i

// Shallow-redact obviously-sensitive fields before a payload is stored. Debug
// capture is opt-in, but we still don't want credentials landing in the table.
const redactPayload = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body
  const out = {}
  for (const [k, v] of Object.entries(body)) {
    out[k] = SENSITIVE_KEY_RE.test(k) ? '[redacted]' : v
  }
  return out
}

const isId = (s) => UUID_RE.test(s) || /^\d+$/.test(s)

// 'customer-groups' → 'CustomerGroup' (naive singularize + PascalCase).
const pascalSingular = (seg) =>
  seg.split('-').map((w) => {
    let s = w
    if (/ies$/i.test(s)) s = s.replace(/ies$/i, 'y')
    else if (/sses$/i.test(s)) s = s.replace(/es$/i, '')
    else if (/s$/i.test(s) && !/ss$/i.test(s)) s = s.replace(/s$/i, '')
    return s.charAt(0).toUpperCase() + s.slice(1)
  }).join('')

// 'PurchaseOrder' → 'purchase-order'
const kebab = (pascal) =>
  pascal.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/**
 * Parse the path after /api/erp into { action, entityType, entityId }.
 * Returns null when nothing meaningful can be derived.
 */
const describe = (method, urlPath, body) => {
  const clean = urlPath.split('?')[0].replace(/^\/api\/erp\/?/, '')
  const segs = clean.split('/').filter(Boolean)
  if (!segs.length) return null

  const firstIdIdx = segs.findIndex(isId)
  const resourceSegs = firstIdIdx === -1 ? segs : segs.slice(0, firstIdIdx)
  if (!resourceSegs.length) return null

  // Trailing non-id segment after the id is an explicit verb (…/:id/confirm).
  let verb = null
  if (firstIdIdx !== -1) {
    const tail = segs.slice(firstIdIdx + 1).filter((s) => !isId(s))
    if (tail.length) verb = tail[tail.length - 1]
  }
  if (!verb) {
    verb = method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update'
  }

  const resourceKey = resourceSegs.join('/')
  const entityType  = ENTITY_MAP[resourceKey]
    || ENTITY_MAP[resourceSegs[resourceSegs.length - 1]]
    || pascalSingular(resourceSegs[resourceSegs.length - 1])

  // Entity id: a UUID in the path, else (for creates) the id of the row the
  // response just returned.
  let entityId = firstIdIdx !== -1 && UUID_RE.test(segs[firstIdIdx]) ? segs[firstIdIdx] : null
  if (!entityId) {
    const bodyId = body?.data?.id
    if (typeof bodyId === 'string' && UUID_RE.test(bodyId)) entityId = bodyId
  }

  return { action: `${kebab(entityType)}.${verb}`, entityType, entityId }
}

const auditCapture = (req, res, next) => {
  if (!MUTATING.has(req.method)) return next()

  // Capture the JSON response body so creates can recover the new row's id.
  const originalJson = res.json.bind(res)
  let captured
  res.json = (body) => { captured = body; return originalJson(body) }

  res.on('finish', async () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return
    if (!req.user) return
    if (res.locals && res.locals.skipAudit) return

    const info = describe(req.method, req.originalUrl || req.url, captured)
    if (!info) return

    const summary = { method: req.method }
    // Debug mode (ERP → Settings → General → Audit Log) additionally stores the
    // request payload. Best-effort: a failure here must not drop the audit row.
    try {
      const general = require('../settings/services/general.service')
      if (await general.isAuditDebug(req.user.organizationId || req.user.id)) {
        summary.payload = redactPayload(req.body)
      }
    } catch { /* debug enrichment is optional */ }

    audit.log({
      user:       req.user,
      action:     info.action,
      entityType: info.entityType,
      entityId:   info.entityId,
      method:     req.method,
      ip:         req.ip,
      summary,
    })
  })

  next()
}

module.exports = { auditCapture, describe }
