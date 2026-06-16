/**
 * RBAC for AI-agent tools.
 *
 * The chat endpoint is gated by a single `ai-agent.use` permission, but each
 * tool drives the *same* services the REST controllers expose — so without a
 * per-tool check, `ai-agent.use` would let a user create/update/delete records
 * they could never touch through the UI/API (a privilege-escalation hole).
 *
 * This map mirrors the permission each tool's REST counterpart requires (see
 * the module route files). `execute()` enforces it against the caller's
 * resolved permission set before running the handler. Tools absent from the map
 * (client navigation, dashboard summaries) carry no extra requirement beyond
 * `ai-agent.use`.
 */
const TOOL_PERMISSIONS = {
  // customers
  create_customer:        'erp.customers.edit',
  list_customers:         'erp.customers.list',
  get_customer:           'erp.customers.list',
  update_customer:        'erp.customers.edit',
  delete_customer:        'erp.customers.delete',
  create_customer_group:  'erp.customer-groups.edit',
  list_customer_groups:   'erp.customer-groups.list',

  // vendors
  create_vendor:          'erp.vendors.edit',
  list_vendors:           'erp.vendors.list',
  get_vendor:             'erp.vendors.list',
  update_vendor:          'erp.vendors.edit',
  delete_vendor:          'erp.vendors.delete',

  // products
  create_product:           'erp.products.edit',
  list_products:            'erp.products.list',
  get_product:              'erp.products.list',
  update_product:           'erp.products.edit',
  delete_product:           'erp.products.delete',
  create_product_category:  'erp.products.edit',
  list_product_categories:  'erp.products.list',

  // inventory — units of measure
  create_uom:             'erp.uom.edit',
  list_uoms:              'erp.uom.list',
  get_uom:                'erp.uom.list',
  update_uom:             'erp.uom.edit',
  delete_uom:             'erp.uom.delete',
  create_uom_conversion:  'erp.uom.edit',
  list_uom_conversions:   'erp.uom.list',
  update_uom_conversion:  'erp.uom.edit',
  delete_uom_conversion:  'erp.uom.delete',

  // inventory — stores
  create_store:           'erp.stores.edit',
  list_stores:            'erp.stores.list',
  get_store:              'erp.stores.list',
  update_store:           'erp.stores.edit',
  delete_store:           'erp.stores.delete',

  // pricing
  create_pricing:         'erp.pricing.manage',
  list_pricings:          'erp.pricing.list',
  get_pricing:            'erp.pricing.list',
  update_pricing:         'erp.pricing.manage',
  delete_pricing:         'erp.pricing.manage',

  // sale packages
  create_sale_package:    'erp.sale-packages.manage',
  list_sale_packages:     'erp.sale-packages.list',
  get_sale_package:       'erp.sale-packages.list',
  update_sale_package:    'erp.sale-packages.manage',
  delete_sale_package:    'erp.sale-packages.manage',

  // sale items
  create_sale_item:       'erp.sale-items.manage',
  list_sale_items:        'erp.sale-items.list',
  get_sale_item:          'erp.sale-items.list',
  update_sale_item:       'erp.sale-items.manage',
  delete_sale_item:       'erp.sale-items.manage',

  // sales orders (read-only tools)
  list_sale_orders:       'erp.orders.list',
  get_sale_order:         'erp.orders.list',

  // quotations (read-only tools)
  list_quotations:        'erp.quotations.list',
  get_quotation:          'erp.quotations.list',

  // receipts (read-only tools)
  list_receipts:          'erp.receipts.list',
  get_receipt:            'erp.receipts.list',

  // purchasing (read-only tools)
  list_purchase_requisitions: 'erp.purchasing.list',
  get_purchase_requisition:   'erp.purchasing.list',
  list_purchase_orders:       'erp.purchasing.list',
  get_purchase_order:         'erp.purchasing.list',

  // stock (read-only tools)
  list_stock_adjustments: 'erp.stock.list',
  get_stock_adjustment:   'erp.stock.list',
  list_stock_counts:      'erp.stock.list',
  get_stock_count:        'erp.stock.list',
  list_stock_returns:     'erp.stock.list',
  get_stock_return:       'erp.stock.list',
  list_stock_issues:      'erp.stock.list',
  get_stock_issue:        'erp.stock.list',
  list_stock_transfers:   'erp.stock.list',
  get_stock_transfer:     'erp.stock.list',
  list_good_receives:     'erp.stock.list',
  get_good_receive:       'erp.stock.list',
  get_stock_balance:      'erp.stock.list',
  get_product_stock:      'erp.stock.list',
  get_stock_movements:    'erp.stock.list',

  // accounting (read-only tools)
  list_accounts:          'erp.accounting.list',
  list_journals:          'erp.accounting.list',
  get_journal:            'erp.accounting.list',
  trial_balance_report:   'erp.accounting.list',
  general_ledger_report:  'erp.accounting.list',
  ar_aging_report:        'erp.accounting.list',
  balance_sheet:          'erp.accounting.list',
  income_statement:       'erp.accounting.list',

  // tax periods
  list_tax_periods:       'erp.tax-periods.list',
  vat_report:             'erp.tax-periods.list',

  // audit
  list_audit_logs:        'erp.audit.list',
  get_entity_history:     'erp.audit.list',

  // alerts
  create_alert:           'erp.alerts.manage',
  list_alerts:            'erp.alerts.list',
  get_alert:              'erp.alerts.list',
  update_alert:           'erp.alerts.manage',
  delete_alert:           'erp.alerts.manage',
}

// The permission a tool requires, or null when it carries no extra requirement
// beyond `ai-agent.use` (client navigation, dashboard summaries).
const requiredPermission = (toolName) => TOOL_PERMISSIONS[toolName] || null

// Does the caller's resolved permission set satisfy a tool's requirement?
// `perms` may be an array or a Set; the wildcard '*' (system admin) passes
// everything. A null/absent requirement always passes; a present requirement
// with no permission context fails closed.
const isAllowed = (perms, toolName) => {
  const slug = requiredPermission(toolName)
  if (!slug) return true
  if (!perms) return false
  const has = (p) => (perms instanceof Set ? perms.has(p) : Array.isArray(perms) && perms.includes(p))
  return has('*') || has(slug)
}

module.exports = { TOOL_PERMISSIONS, requiredPermission, isAllowed }
