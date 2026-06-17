import { ShoppingCartIcon, TruckIcon } from '@heroicons/vue/24/outline'

export const routes = [
  {
    path: '/erp/sale-orders',
    name: 'erp-sale-orders',
    component: () => import('./views/sale-order/SaleOrdersList.vue'),
    meta: { requiresAuth: true, title: 'Sales Order' },
  },
  {
    path: '/erp/sale-orders/create',
    name: 'erp-sale-orders-create',
    component: () => import('./views/sale-order/SaleOrderCreate.vue'),
    meta: { requiresAuth: true, title: 'New Order' },
  },
  {
    path: '/erp/sale-orders/:id/edit',
    name: 'erp-sale-orders-edit',
    component: () => import('./views/sale-order/SaleOrderEdit.vue'),
    meta: { requiresAuth: true, title: 'Edit Order' },
  },
  {
    path: '/erp/sale-orders/:id',
    name: 'erp-sale-orders-detail',
    component: () => import('./views/sale-order/SaleOrderDetail.vue'),
    meta: { requiresAuth: true, title: 'Order Detail' },
  },
  {
    path: '/erp/delivery-orders',
    name: 'erp-delivery-orders',
    component: () => import('./views/delivery-order/DeliveryOrderList.vue'),
    meta: { requiresAuth: true, title: 'Delivery Orders' },
  },
  {
    path: '/erp/delivery-orders/create',
    name: 'erp-delivery-orders-create',
    component: () => import('./views/delivery-order/DeliveryOrderCreate.vue'),
    meta: { requiresAuth: true, title: 'New Delivery Order' },
  },
  {
    path: '/erp/delivery-orders/:id/edit',
    name: 'erp-delivery-orders-edit',
    component: () => import('./views/delivery-order/DeliveryOrderEdit.vue'),
    meta: { requiresAuth: true, title: 'Edit Delivery Order' },
  },
  {
    path: '/erp/delivery-orders/:id',
    name: 'erp-delivery-orders-detail',
    component: () => import('./views/delivery-order/DeliveryOrderDetail.vue'),
    meta: { requiresAuth: true, title: 'Delivery Order Detail' },
  },
]

export const navChildren = [
  { label: 'nav.salesOrder',     to: '/erp/sale-orders',      icon: ShoppingCartIcon, permission: 'erp.orders.list' },
  { label: 'nav.deliveryOrders', to: '/erp/delivery-orders',  icon: TruckIcon,        permission: 'erp.orders.list' },
]
