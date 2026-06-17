import {
  BuildingOffice2Icon,
  CubeIcon,
  ShoppingCartIcon,
  CreditCardIcon,
  BookOpenIcon,
  ShoppingBagIcon,
  Cog6ToothIcon,
} from '@heroicons/vue/24/outline'

// Auto-load every ERP submodule's index.js. Routes are flat-merged below;
// the nav tree is hand-curated because submodules feed into multiple slots
// (e.g. stock → Inventory + Purchasing, accounting → 4 different groups).
const submodules = import.meta.glob('./*/index.js', { eager: true })
const m = (slug) => submodules[`./${slug}/index.js`] || {}

const routes = Object.values(submodules).flatMap((mod) => mod.routes || [])

export default {
  slug: 'erp',
  isCore: false,
  order: 30,
  routes,
  navItem: {
    label: 'nav.erp',
    icon: BuildingOffice2Icon,
    children: [
      ...(m('dashboard').navChildren || []),
      ...(m('alert').navChildren || []),
      ...(m('customers').navChildren || []),
      ...(m('vendors').navChildren   || []),
      {
        label: 'nav.inventory',
        icon: CubeIcon,
        children: [
          ...(m('products').navChildren           || []),
          ...(m('inventory').navChildren          || []),
          ...(m('stock').inventoryNavChildren     || []),
        ],
      },
      {
        label: 'nav.sales',
        icon: ShoppingCartIcon,
        children: [
          ...(m('sale').navChildren        || []),
          ...(m('pricing').navChildren     || []),
          ...(m('quotations').navChildren  || []),
          ...(m('sale-orders').navChildren  || []),
        ],
      },
      {
        label: 'nav.billing',
        icon: CreditCardIcon,
        children: [
          m('accounting').receivePaymentsNavItem,
          ...(m('invoices').navChildren            || []),
          ...(m('receipts').navChildren            || []),
          ...(m('accounting').billingDocNavChildren || []),
        ].filter(Boolean),
      },
      {
        label: 'nav.accounting',
        icon: BookOpenIcon,
        children: [
          ...(m('accounting').navChildren || []),
        ],
      },
      {
        label: 'nav.purchasing',
        icon: ShoppingBagIcon,
        children: [
          m('stock').goodReceiveNavItem,
          ...(m('purchasing').navChildren || []),
          m('accounting').vendorBillsNavItem,
          m('accounting').makePaymentsNavItem,
        ].filter(Boolean),
      },
      {
        label: 'nav.settings',
        icon: Cog6ToothIcon,
        children: [
          ...(m('settings').navChildren || []),
        ],
      },
    ],
  },
}
