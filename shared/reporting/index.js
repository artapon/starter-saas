import {
  ChartPieIcon, PresentationChartLineIcon,
  BookOpenIcon, TableCellsIcon, ScaleIcon, DocumentChartBarIcon,
  ClipboardDocumentListIcon, ChartBarIcon, ArchiveBoxIcon, ArrowsRightLeftIcon,
} from '@heroicons/vue/24/outline'

export const routes = [
  {
    path: '/reporting/erp-summary',
    name: 'reporting-erp-summary',
    component: () => import('./summary/views/ERPSummary.vue'),
    meta: { requiresAuth: true, title: 'nav.reportingOverview' },
  },
  // ── Reports (views live here; backend data endpoints stay in /api/erp/accounting/*)
  // Paths are kept stable so AI-tool deep-links and cross-report navigation keep working.
  {
    path: '/erp/accounting/reports/trial-balance',
    name: 'erp-accounting-trial-balance',
    component: () => import('./ledger-reports/views/TrialBalanceReport.vue'),
    meta: { requiresAuth: true, title: 'Trial Balance' },
  },
  {
    path: '/erp/accounting/reports/general-ledger',
    name: 'erp-accounting-general-ledger',
    component: () => import('./ledger-reports/views/GeneralLedgerReport.vue'),
    meta: { requiresAuth: true, title: 'General Ledger' },
  },
  {
    path: '/erp/accounting/financial-statements/balance-sheet',
    name: 'erp-accounting-balance-sheet',
    component: () => import('./financial-statements/views/BalanceSheetReport.vue'),
    meta: { requiresAuth: true, title: 'Statement of Financial Position' },
  },
  {
    path: '/erp/accounting/financial-statements/income-statement',
    name: 'erp-accounting-income-statement',
    component: () => import('./financial-statements/views/IncomeStatementReport.vue'),
    meta: { requiresAuth: true, title: 'Income Statement' },
  },
  {
    path: '/erp/accounting/financial-statements/changes-in-equity',
    name: 'erp-accounting-changes-in-equity',
    component: () => import('./financial-statements/views/ChangesInEquityReport.vue'),
    meta: { requiresAuth: true, title: 'Statement of Changes in Equity' },
  },
  {
    path: '/erp/accounting/financial-statements/cash-flow',
    name: 'erp-accounting-cash-flow',
    component: () => import('./cash-flow/views/CashFlowReport.vue'),
    meta: { requiresAuth: true, title: 'Cash Flow Statement' },
  },
  {
    path: '/erp/accounting/financial-statements/notes',
    name: 'erp-accounting-notes',
    component: () => import('./financial-statements/views/NotesReport.vue'),
    meta: { requiresAuth: true, title: 'Notes to Financial Statements' },
  },
  {
    path: '/erp/accounting/ar-aging',
    name: 'erp-accounting-ar-aging',
    component: () => import('./ar-aging/views/ARAgingReport.vue'),
    meta: { requiresAuth: true, title: 'AR Aging Report' },
  },
  {
    path: '/erp/accounting/ap-aging',
    name: 'erp-accounting-ap-aging',
    component: () => import('./ap-aging/views/APAgingReport.vue'),
    meta: { requiresAuth: true, title: 'AP Aging Report' },
  },
]

export default {
  slug: 'reporting',
  isCore: false,
  order: 40,
  routes,
  navItem: {
    label: 'nav.reporting',
    icon: ChartPieIcon,
    children: [
      // Flat children render in the mega menu's quick-links rail
      { label: 'nav.reportingOverview', to: '/reporting/erp-summary', icon: PresentationChartLineIcon, permission: 'erp.products.list' },
      {
        label: 'nav.accounting',
        icon: BookOpenIcon,
        children: [
          { label: 'nav.trialBalance',    to: '/erp/accounting/reports/trial-balance',                    icon: TableCellsIcon,            permission: 'erp.accounting.list' },
          { label: 'nav.generalLedger',   to: '/erp/accounting/reports/general-ledger',                   icon: BookOpenIcon,              permission: 'erp.accounting.list' },
          { label: 'nav.balanceSheet',    to: '/erp/accounting/financial-statements/balance-sheet',        icon: ScaleIcon,                 permission: 'erp.accounting.list' },
          { label: 'nav.incomeStatement', to: '/erp/accounting/financial-statements/income-statement',     icon: PresentationChartLineIcon, permission: 'erp.accounting.list' },
          { label: 'nav.changesInEquity', to: '/erp/accounting/financial-statements/changes-in-equity',    icon: DocumentChartBarIcon,      permission: 'erp.accounting.list' },
          { label: 'nav.cashFlow',        to: '/erp/accounting/financial-statements/cash-flow',            icon: ArrowsRightLeftIcon,       permission: 'erp.accounting.list' },
          { label: 'nav.notes',           to: '/erp/accounting/financial-statements/notes',                icon: ClipboardDocumentListIcon, permission: 'erp.accounting.list' },
          { label: 'nav.arAging',         to: '/erp/accounting/ar-aging',                                 icon: ChartBarIcon,              permission: 'erp.accounting.list' },
          { label: 'nav.apAging',         to: '/erp/accounting/ap-aging',                                 icon: ChartBarIcon,              permission: 'erp.accounting.list' },
        ],
      },
      {
        label: 'nav.inventory',
        icon: ArchiveBoxIcon,
        children: [
          { label: 'nav.stockBalance',  to: '/erp/stock-balance',   icon: ChartBarIcon,        permission: 'erp.stock.list' },
          { label: 'nav.stockMovement', to: '/erp/stock-movements', icon: ArrowsRightLeftIcon, permission: 'erp.stock.list' },
        ],
      },
    ],
  },
}
