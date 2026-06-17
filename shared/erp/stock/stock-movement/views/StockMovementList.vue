<template>
  <AppLayout>
    <div class="space-y-5">

      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-[#1C2434]">{{ t('erp.stockMovement.title') }}</h1>
          <p class="text-sm text-[#637381] mt-0.5">{{ subtitle }}</p>
        </div>
        <KeyboardShortcuts :shortcuts="shortcuts" />
      </div>

      <div class="bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
        <DataTable ref="dataTableRef" :columns="columns" :data="tableRows" :loading="loading" :total="displayTotal"
          v-model:page="page" v-model:global-filter="search" :page-size="limit"
          :selected-row-index="selectedRowIndex"
          :row-clickable="!groupBy" @row-click="openDocument"
          searchable :search-placeholder="t('erp.stockMovement.searchPh', 'Search by ref no…')">

          <template #toolbar>
            <div class="flex items-center border border-[#E2E8F0] bg-white">
              <span class="pl-3 pr-1.5 text-xs font-medium text-[#9BA7B0] whitespace-nowrap hidden sm:inline">
                {{ t('erp.stockMovement.groupBy') }}
              </span>
              <button v-for="opt in groupOptions" :key="opt.id" @click="groupBy = opt.id"
                :class="['px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  groupBy === opt.id ? 'bg-primary-50 text-primary-600' : 'text-[#637381] hover:bg-slate-50']">
                {{ opt.name }}
              </button>
            </div>
            <button @click="showFilters = !showFilters"
              :class="['flex items-center gap-1.5 px-3 py-2 text-sm font-medium border transition-colors whitespace-nowrap',
                (activeFilterCount > 0 || showFilters)
                  ? 'bg-primary-50 border-primary-200 text-primary-600'
                  : 'bg-white border-[#E2E8F0] text-[#637381] hover:bg-slate-50']">
              <AdjustmentsHorizontalIcon class="w-4 h-4" />
              {{ t('common.filters') }}
              <span v-if="activeFilterCount" class="min-w-[18px] h-[18px] bg-primary-500 text-white text-[10px] flex items-center justify-center font-bold leading-none">
                {{ activeFilterCount }}
              </span>
            </button>
          </template>

          <template #filters>
            <Transition
              enter-active-class="transition-all duration-150 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition-all duration-100 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1">
              <div v-if="showFilters" class="border-b border-[#E2E8F0] bg-slate-50">
                <div class="px-5 py-4">
                  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div>
                      <label class="block text-xs font-medium text-[#637381] mb-1.5">{{ t('erp.stockMovement.colProduct') }}</label>
                      <SearchSelect v-model="filterProduct" :options="products" :placeholder="t('erp.stockMovement.allProducts')" @change="onFilterChange" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-[#637381] mb-1.5">{{ t('erp.stockMovement.colStore') }}</label>
                      <SearchSelect v-model="filterStore" :options="stores" :placeholder="t('erp.stockMovement.allStores')" @change="onFilterChange" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-[#637381] mb-1.5">{{ t('erp.stockMovement.colType') }}</label>
                      <SearchSelect v-model="filterType" :options="typeOptions" :placeholder="t('erp.stockMovement.allTypes')" @change="onFilterChange" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-[#637381] mb-1.5">{{ t('common.dateFrom') }}</label>
                      <DateInput v-model="filterDateFrom" @change="onFilterChange" class="input text-sm" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-[#637381] mb-1.5">{{ t('common.dateTo') }}</label>
                      <DateInput v-model="filterDateTo" @change="onFilterChange" class="input text-sm" />
                    </div>
                  </div>
                  <div class="mt-3 flex justify-end">
                    <button @click="clearFilters" class="text-xs text-[#9BA7B0] hover:text-red-500 transition-colors font-medium">
                      {{ t('common.resetFilters') }}
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </template>

          <template #active-filters>
            <div v-if="activeFilterCount > 0" class="px-5 py-2.5 border-b border-[#E2E8F0] flex items-center gap-2 flex-wrap bg-primary-50/40">
              <span class="text-xs font-medium text-[#637381]">{{ t('common.activeFilters') }}:</span>
              <span v-for="chip in activeFilterChips" :key="chip.key"
                class="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-white border border-[#E2E8F0] text-xs font-medium text-[#374151]">
                {{ chip.label }}: <span class="font-semibold ml-0.5">{{ chip.value }}</span>
                <button @click="chip.clear(); onFilterChange()" class="ml-1 p-0.5 text-[#9BA7B0] hover:text-red-500 transition-colors">
                  <XMarkIcon class="w-3 h-3" />
                </button>
              </span>
              <button @click="clearFilters" class="ml-auto text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                {{ t('common.clearAll') }}
              </button>
            </div>
          </template>

          <template #empty>
            <div class="flex flex-col items-center gap-3 py-4">
              <div class="w-10 h-10 bg-[#F1F5F9] flex items-center justify-center">
                <ArrowsRightLeftIcon class="w-5 h-5 text-[#9BA7B0]" />
              </div>
              <div class="text-center">
                <p class="text-sm font-medium text-[#637381]">{{ t('erp.stockMovement.noFound') }}</p>
                <p v-if="activeFilterCount > 0" class="text-xs text-[#9BA7B0] mt-1">{{ t('common.tryAdjustingFilters') }}</p>
              </div>
              <button v-if="activeFilterCount > 0" @click="clearFilters"
                class="text-xs text-primary-500 hover:text-primary-700 font-medium underline">
                {{ t('common.clearAll') }}
              </button>
            </div>
          </template>
        </DataTable>
      </div>

    </div>
  </AppLayout>
</template>

<script setup>
import { h, ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { createColumnHelper } from '@tanstack/vue-table'
import {
  ArrowsRightLeftIcon,
  AdjustmentsHorizontalIcon, XMarkIcon,
} from '@heroicons/vue/24/outline'
import AppLayout from '@/layouts/AppLayout.vue'
import DataTable from '@/components/DataTable.vue'
import KeyboardShortcuts from '@/components/KeyboardShortcuts.vue'
import SearchSelect from '@/components/SearchSelect.vue'
import api from '@/api'
import { fmtDateTime, fmtQty } from '@/utils/fmt'

const { t } = useI18n()

const dataTableRef     = ref(null)
const selectedRowIndex = ref(-1)

const shortcuts = [
  { key: '↑ / ↓', label: 'Move row selection' },
  { key: '↵',     label: 'Open source document' },
  { key: 'Esc',    label: 'Deselect row' },
]

function onKeydown(e) {
  const el = document.activeElement
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedRowIndex.value = Math.min(selectedRowIndex.value + 1, tableRows.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedRowIndex.value = Math.max(selectedRowIndex.value - 1, 0)
  } else if (e.key === 'Enter' && !groupBy.value && selectedRowIndex.value >= 0) {
    openDocument(tableRows.value[selectedRowIndex.value])
  } else if (e.key === 'Escape') {
    selectedRowIndex.value = -1
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

const MOVEMENT_TYPES = [
  'receive', 'sale', 'issue', 'adjust', 'count',
  'transfer_in', 'transfer_out', 'customer_return', 'vendor_return',
]
const typeLabel   = (type) => t(`erp.movementTypes.${type}`, type?.replace('_', ' '))
const typeOptions = computed(() => MOVEMENT_TYPES.map(id => ({ id, name: typeLabel(id) })))

const route          = useRoute()
const router         = useRouter()
const rows           = ref([])
const groupBy        = ref('')
const groupRows      = ref([])
const products       = ref([])
const stores         = ref([])
const total          = ref(0)
const page           = ref(1)
const limit          = 20
const search         = ref('')
const filterProduct  = ref(route.query.productId || '')
const filterStore    = ref('')
const filterType     = ref('')
const filterDateFrom = ref('')
const filterDateTo   = ref('')
const showFilters    = ref(!!route.query.productId)
const loading        = ref(false)

const groupOptions = computed(() => [
  { id: '',        name: t('erp.stockMovement.groupNone') },
  { id: 'type',    name: t('erp.stockMovement.colType') },
  { id: 'product', name: t('erp.stockMovement.colProduct') },
  { id: 'store',   name: t('erp.stockMovement.colStore') },
])

// Grouped mode aggregates server-side and paginates the groups client-side.
const tableRows    = computed(() => groupBy.value
  ? groupRows.value.slice((page.value - 1) * limit, page.value * limit)
  : rows.value)
const displayTotal = computed(() => groupBy.value ? groupRows.value.length : total.value)
const subtitle     = computed(() => groupBy.value
  ? `${groupRows.value.length} ${t('erp.stockMovement.groups')}`
  : `${total.value} movement${total.value !== 1 ? 's' : ''}`)

const activeFilterCount = computed(() =>
  [filterProduct.value, filterStore.value, filterType.value, filterDateFrom.value, filterDateTo.value].filter(Boolean).length)

const activeFilterChips = computed(() => [
  filterProduct.value && {
    key: 'product', label: t('erp.stockMovement.colProduct'),
    value: products.value.find(p => p.id === filterProduct.value)?.name || '…',
    clear: () => { filterProduct.value = '' },
  },
  filterStore.value && {
    key: 'store', label: t('erp.stockMovement.colStore'),
    value: stores.value.find(s => s.id === filterStore.value)?.name || '…',
    clear: () => { filterStore.value = '' },
  },
  filterType.value && {
    key: 'type', label: t('erp.stockMovement.colType'),
    value: typeLabel(filterType.value),
    clear: () => { filterType.value = '' },
  },
  filterDateFrom.value && {
    key: 'dateFrom', label: t('common.dateFrom'),
    value: filterDateFrom.value,
    clear: () => { filterDateFrom.value = '' },
  },
  filterDateTo.value && {
    key: 'dateTo', label: t('common.dateTo'),
    value: filterDateTo.value,
    clear: () => { filterDateTo.value = '' },
  },
].filter(Boolean))

// Stock-in types read green/cool, stock-out types read warm/red — matches the
// sign of the qty column so a row's colour story is consistent.
const TYPE_BADGE = {
  receive:         'bg-green-50 text-green-700',
  transfer_in:     'bg-green-50 text-green-700',
  customer_return: 'bg-teal-50 text-teal-700',
  sale:            'bg-red-50 text-red-700',
  issue:           'bg-orange-50 text-orange-700',
  transfer_out:    'bg-orange-50 text-orange-700',
  vendor_return:   'bg-rose-50 text-rose-700',
  adjust:          'bg-purple-50 text-purple-700',
  count:           'bg-blue-50 text-blue-700',
}
const typeBadge = (type) => TYPE_BADGE[type] || 'bg-[#F1F5F9] text-[#637381]'

// Detail-view route per source document type — clicking a row (or pressing
// Enter on it) opens the document the movement came from.
const REF_ROUTE = {
  GoodReceive:   '/erp/good-receive',
  StockAdjust:   '/erp/stock-adjust',
  StockRequest:  '/erp/stock-request',
  StockIssue:    '/erp/stock-issue',
  StockReturn:   '/erp/stock-return',
  StockCount:    '/erp/stock-count',
  DeliveryOrder: '/erp/delivery-orders',
  SalesOrder:    '/erp/sale-orders',
}
const refPath = (m) => (m?.refId && REF_ROUTE[m.refType]) ? `${REF_ROUTE[m.refType]}/${m.refId}` : null

function openDocument(movement) {
  const path = refPath(movement)
  if (path) router.push(path)
}

const ch = createColumnHelper()

const movementColumns = [
  ch.accessor('createdAt', {
    header: () => t('erp.stockMovement.colDate'),
    cell: info => h('span', { class: 'text-[#637381] text-xs whitespace-nowrap' }, fmtDateTime(info.getValue())),
  }),
  ch.accessor('refNo', {
    header: () => t('erp.stockMovement.colRef'),
    cell: info => {
      const linked = !!refPath(info.row.original)
      return h('span', {
        class: `font-mono text-xs font-semibold whitespace-nowrap ${linked ? 'text-primary-600 group-hover:underline' : 'text-[#1C2434]'}`,
      }, info.getValue() || '—')
    },
  }),
  ch.accessor('type', {
    header: () => t('erp.stockMovement.colType'),
    cell: info => {
      const v = info.getValue()
      return h('span', {
        class: `inline-flex items-center px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${typeBadge(v)}`,
      }, typeLabel(v))
    },
  }),
  ch.accessor('product', {
    header: () => t('erp.stockMovement.colProduct'),
    cell: info => {
      const p = info.getValue()
      return h('div', { class: 'min-w-0' }, [
        h('p', { class: 'font-medium text-[#1C2434] truncate' }, p?.name || '—'),
        p?.sku ? h('p', { class: 'text-xs text-[#9BA7B0] font-mono mt-0.5' }, p.sku) : null,
      ])
    },
  }),
  ch.accessor('store', {
    header: () => t('erp.stockMovement.colStore'),
    cell: info => h('span', { class: 'text-[#637381]' }, info.getValue()?.name || '—'),
  }),
  ch.accessor('qty', {
    header: () => t('erp.stockMovement.colQty'),
    meta: { thClass: 'text-right', tdClass: 'text-right' },
    cell: info => {
      const qty = info.getValue()
      return h('span', {
        class: `font-semibold tabular-nums ${qty > 0 ? 'text-green-700' : 'text-red-600'}`,
      }, `${qty > 0 ? '+' : ''}${fmtQty(qty)}`)
    },
  }),
  ch.accessor('stockAfter', {
    header: () => t('erp.stockMovement.colBalance', 'Balance'),
    meta: { thClass: 'text-right', tdClass: 'text-right' },
    cell: info => h('span', { class: 'tabular-nums whitespace-nowrap' }, [
      h('span', { class: 'text-[#9BA7B0]' }, fmtQty(info.row.original.stockBefore)),
      h('span', { class: 'text-[#9BA7B0] mx-1.5' }, '→'),
      h('span', { class: 'font-semibold text-[#1C2434]' }, fmtQty(info.getValue())),
    ]),
  }),
]

// First column of the grouped view — what the rows are grouped by.
const GROUP_KEY_COLUMN = {
  type: () => ch.accessor('type', {
    header: () => t('erp.stockMovement.colType'),
    cell: info => h('span', {
      class: `inline-flex items-center px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${typeBadge(info.getValue())}`,
    }, typeLabel(info.getValue())),
  }),
  product: () => ch.accessor('name', {
    header: () => t('erp.stockMovement.colProduct'),
    cell: info => {
      const r = info.row.original
      return h('div', { class: 'min-w-0' }, [
        h('p', { class: 'font-medium text-[#1C2434] truncate' }, r.name || '—'),
        r.sku ? h('p', { class: 'text-xs text-[#9BA7B0] font-mono mt-0.5' }, r.sku) : null,
      ])
    },
  }),
  store: () => ch.accessor('name', {
    header: () => t('erp.stockMovement.colStore'),
    cell: info => h('span', { class: 'font-medium text-[#1C2434]' }, info.getValue() || '—'),
  }),
}

const qtyCell = (value, { positive = false, muted = 'text-[#9BA7B0]' } = {}) => {
  if (!value) return h('span', { class: `tabular-nums ${muted}` }, '0')
  const color = value > 0 ? 'text-green-700' : 'text-red-600'
  return h('span', { class: `tabular-nums font-semibold ${color}` }, `${positive && value > 0 ? '+' : ''}${fmtQty(value)}`)
}

const groupedColumns = computed(() => [
  GROUP_KEY_COLUMN[groupBy.value]?.(),
  ch.accessor('count', {
    header: () => t('erp.stockMovement.colMovements'),
    meta: { thClass: 'text-right', tdClass: 'text-right' },
    cell: info => h('span', { class: 'tabular-nums text-[#637381]' }, fmtQty(info.getValue())),
  }),
  ch.accessor('qtyIn', {
    header: () => t('erp.stockMovement.colIn'),
    meta: { thClass: 'text-right', tdClass: 'text-right' },
    cell: info => qtyCell(info.getValue(), { positive: true }),
  }),
  ch.accessor('qtyOut', {
    header: () => t('erp.stockMovement.colOut'),
    meta: { thClass: 'text-right', tdClass: 'text-right' },
    cell: info => qtyCell(info.getValue()),
  }),
  ch.accessor('qtyNet', {
    header: () => t('erp.stockMovement.colNet'),
    meta: { thClass: 'text-right', tdClass: 'text-right' },
    cell: info => qtyCell(info.getValue(), { positive: true, muted: 'text-[#637381] font-semibold' }),
  }),
].filter(Boolean))

const columns = computed(() => groupBy.value ? groupedColumns.value : movementColumns)

function filterParams() {
  return {
    search: search.value || undefined,
    productId: filterProduct.value || undefined,
    storeId: filterStore.value || undefined,
    type: filterType.value || undefined,
    dateFrom: filterDateFrom.value || undefined,
    dateTo: filterDateTo.value || undefined,
  }
}

async function load() {
  loading.value = true
  try {
    if (groupBy.value) {
      const { data } = await api.get('/erp/stock-movements/summary', {
        params: { ...filterParams(), groupBy: groupBy.value },
      })
      groupRows.value = data.data.groups
    } else {
      const { data } = await api.get('/erp/stock-movements', {
        params: { ...filterParams(), page: page.value, limit },
      })
      rows.value  = data.data.movements
      total.value = data.data.total
    }
    selectedRowIndex.value = -1
  } finally { loading.value = false }
}

async function loadLookups() {
  try {
    const [prodRes, storeRes] = await Promise.all([
      api.get('/erp/item-master', { params: { limit: 200 } }),
      api.get('/erp/item-master/stores-lookup'),
    ])
    products.value = prodRes.data.data.products
    stores.value   = storeRes.data.data.stores
  } catch (err) { console.error(err.message) }
}

function onFilterChange() { page.value = 1; load() }
function clearFilters() {
  filterProduct.value = ''; filterStore.value = ''; filterType.value = ''
  filterDateFrom.value = ''; filterDateTo.value = ''
  page.value = 1; load()
}

watch([page, search], load)
// Reset to page 1 on group change; load directly when already there since the
// page watcher won't fire.
watch(groupBy, () => { if (page.value === 1) load(); else page.value = 1 })
onMounted(() => { load(); loadLookups() })
</script>
