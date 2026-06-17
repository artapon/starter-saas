<template>
  <AppLayout>
    <div class="space-y-6">

      <div class="flex items-center justify-between gap-4">
        <h1 class="text-2xl font-bold text-[#1C2434]">{{ t('erp.orderItems.title') }}</h1>
      </div>

      <div class="bg-white border border-[#E2E8F0] overflow-hidden">
        <DataTable :columns="columns" :data="items" :loading="loading" :total="total"
          v-model:page="page" v-model:global-filter="search" :page-size="limit"
          searchable :search-placeholder="t('erp.orderItems.colProduct')">
          <template #empty>
            <p class="text-center text-sm text-[#9BA7B0]">{{ t('erp.common.noRecords') }}</p>
          </template>
        </DataTable>
      </div>

    </div>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div v-if="editModal.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="bg-white shadow-xl w-full max-w-md p-6 space-y-5">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-[#1C2434]">{{ t('erp.orderItems.editItem') }}</h2>
            <button @click="closeEdit" class="text-[#9BA7B0] hover:text-[#637381] text-lg leading-none">&times;</button>
          </div>

          <div class="space-y-4">
            <!-- Link toggle -->
            <div>
              <label class="block text-sm font-medium text-[#374151] mb-1">{{ t('erp.orderItems.itemMasterLink') }}</label>
              <SearchSelect v-model="editForm.productId" :options="masterItems" placeholder="Custom item (no link)" @change="onEditProductSelected">
                <template #option="{ option }">{{ option.name }}{{ option.sku ? ` — ${option.sku}` : '' }}</template>
                <template #singleLabel="{ option }">{{ option.name }}{{ option.sku ? ` — ${option.sku}` : '' }}</template>
              </SearchSelect>
              <p v-if="editForm.productId" class="mt-1 text-xs text-green-600">Linked to Item Master</p>
              <p v-else class="mt-1 text-xs text-[#9BA7B0]">Not linked — custom description</p>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-[#374151] mb-1">{{ t('erp.orderItems.description') }}</label>
              <input v-model="editForm.productName" type="text" class="w-full px-3 py-2 border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Item description" />
            </div>

            <!-- Qty + Price -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-[#374151] mb-1">{{ t('erp.orderItems.quantity') }}</label>
                <input v-model.number="editForm.quantity" type="number" min="1" class="w-full px-3 py-2 border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right" />
              </div>
              <div>
                <label class="block text-sm font-medium text-[#374151] mb-1">{{ t('erp.orderItems.unitPrice') }}</label>
                <input v-model.number="editForm.unitPrice" type="number" min="0" step="0.01" class="w-full px-3 py-2 border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right" />
              </div>
            </div>

            <div class="text-right text-sm text-[#637381]">
              Line total: <span class="font-semibold text-[#1C2434]">{{ fmtMoney((editForm.quantity || 0) * (editForm.unitPrice || 0)) }}</span>
            </div>

            <div v-if="editModal.error" class="bg-red-50 text-red-700 text-sm px-3 py-2">{{ editModal.error }}</div>
          </div>

          <div class="flex justify-end gap-3 pt-1">
            <button @click="closeEdit" class="px-4 py-2 text-sm border hover:bg-[#F7F9FC] transition">{{ t('common.cancel') }}</button>
            <button @click="saveEdit" :disabled="editModal.saving" class="px-5 py-2 text-sm bg-primary-500 text-white hover:bg-primary-700 disabled:opacity-50 transition">
              {{ editModal.saving ? t('erp.common.saving') : t('common.saveChanges') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirm Modal -->
    <Teleport to="body">
      <div v-if="deleteModal.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="bg-white shadow-xl w-full max-w-sm p-6 space-y-4">
          <h2 class="text-base font-semibold text-[#1C2434]">{{ t('erp.orderItems.deleteItem') }}</h2>
          <p class="text-sm text-[#637381]">Remove <span class="font-medium">{{ deleteModal.item?.productName }}</span> from order <span class="font-mono font-medium">{{ deleteModal.item?.order?.orderNumber }}</span>? This will recalculate the order total.</p>
          <div v-if="deleteModal.error" class="bg-red-50 text-red-700 text-sm px-3 py-2">{{ deleteModal.error }}</div>
          <div class="flex justify-end gap-3">
            <button @click="deleteModal.open = false" class="px-4 py-2 text-sm border hover:bg-[#F7F9FC] transition">{{ t('common.cancel') }}</button>
            <button @click="doDelete" :disabled="deleteModal.saving" class="px-5 py-2 text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition">
              {{ deleteModal.saving ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </AppLayout>
</template>

<script setup>
import { h, ref, reactive, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { createColumnHelper } from '@tanstack/vue-table'
import AppLayout from '@/layouts/AppLayout.vue'
import DataTable from '@/components/DataTable.vue'
import SearchSelect from '@/components/SearchSelect.vue'
import api from '@/api'
import { fmtMoney } from '@/utils/fmt'

const { t } = useI18n()

const items        = ref([])
const total        = ref(0)
const page         = ref(1)
const limit        = 50
const search       = ref('')
const loading      = ref(false)

const masterItems  = ref([])

const editModal  = reactive({ open: false, item: null, saving: false, error: '' })
const editForm   = reactive({ productId: '', productName: '', quantity: 1, unitPrice: 0 })

const deleteModal = reactive({ open: false, item: null, saving: false, error: '' })

const STATUS_CLASSES = {
  draft:     'bg-[#F1F5F9] text-[#637381]',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped:   'bg-yellow-100 text-yellow-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
}
const statusClass = (s) => STATUS_CLASSES[s] || 'bg-[#F1F5F9] text-[#637381]'

const ch = createColumnHelper()

const columns = [
  ch.display({
    id: 'product',
    header: () => t('erp.orderItems.colProduct'),
    cell: ({ row }) => {
      const item = row.original
      return h('div', {}, [
        h('div', { class: 'font-medium text-[#1C2434]' }, item.productName),
        item.product?.sku && h('div', { class: 'text-xs text-[#637381] font-mono' }, item.product.sku),
      ].filter(Boolean))
    },
  }),
  ch.display({
    id: 'orderNo',
    header: () => t('erp.orderItems.colOrderNo'),
    cell: ({ row }) => {
      const item = row.original
      return h('div', {}, [
        h(RouterLink, {
          to: `/erp/sale-orders/${item.order?.id}`,
          class: 'text-primary-500 hover:underline font-mono',
        }, () => item.order?.orderNumber),
        h('div', { class: 'text-[10px] text-[#9BA7B0]' }, item.order?.orderDate),
      ])
    },
  }),
  ch.accessor('quantity', {
    header: () => t('erp.orderItems.colQty'),
    meta: { thClass: 'text-right', tdClass: 'text-right' },
    cell: info => h('span', { class: 'text-[#374151] font-medium' }, info.getValue()),
  }),
  ch.accessor('unitPrice', {
    header: () => t('erp.orderItems.colPrice'),
    meta: { thClass: 'text-right', tdClass: 'text-right' },
    cell: info => h('span', { class: 'text-[#637381]' }, fmtMoney(info.getValue())),
  }),
  ch.display({
    id: 'stockLink',
    header: () => t('erp.orderItems.colStockLink'),
    cell: ({ row }) => {
      const item = row.original
      if (item.product) {
        return h('div', { class: 'flex items-center gap-2' }, [
          h('span', { class: 'w-2 h-2 bg-green-500' }),
          h('span', { class: 'text-xs text-[#637381]' }, 'Linked to Master'),
        ])
      }
      return h('div', { class: 'flex items-center gap-2 opacity-50' }, [
        h('span', { class: 'w-2 h-2 bg-slate-300' }),
        h('span', { class: 'text-xs text-[#9BA7B0]' }, 'Custom Item'),
      ])
    },
  }),
  ch.display({
    id: 'orderStatus',
    header: () => t('erp.orderItems.colOrderStatus'),
    cell: ({ row }) => {
      const s = row.original.order?.status
      return h('span', { class: `px-2 py-0.5 text-[10px] font-medium capitalize ${statusClass(s)}` }, s)
    },
  }),
  ch.display({
    id: 'actions',
    header: () => t('erp.orderItems.colActions'),
    meta: { thClass: 'text-right', tdClass: 'text-right' },
    cell: ({ row }) => {
      const item = row.original
      if (item.order?.status === 'draft') {
        return h('div', { class: 'flex items-center justify-end gap-2' }, [
          h('button', { onClick: () => openEdit(item), class: 'text-xs text-primary-500 hover:underline' }, 'Edit'),
          h('button', { onClick: () => confirmDelete(item), class: 'text-xs text-red-500 hover:underline' }, 'Delete'),
        ])
      }
      return h('span', { class: 'text-xs text-[#CBD5E1]' }, '—')
    },
  }),
]

async function fetchItems() {
  loading.value = true
  try {
    const { data } = await api.get('/erp/sale-orders/items', { params: { page: page.value, limit, search: search.value } })
    items.value = data.data.items
    total.value  = data.data.total
  } finally {
    loading.value = false
  }
}

async function fetchMasterItems() {
  try {
    const { data } = await api.get('/erp/item-master', { params: { limit: 500, status: 'active' } })
    masterItems.value = data.data.products
  } catch {
    masterItems.value = []
  }
}

watch([page, search], fetchItems)
onMounted(() => { fetchItems(); fetchMasterItems() })

function openEdit(item) {
  editForm.productId   = item.productId || ''
  editForm.productName = item.productName
  editForm.quantity    = item.quantity
  editForm.unitPrice   = Number(item.unitPrice)
  editModal.item  = item
  editModal.error = ''
  editModal.open  = true
}

function closeEdit() {
  editModal.open = false
}

function onEditProductSelected() {
  const product = masterItems.value.find(p => p.id === editForm.productId)
  if (product) {
    editForm.productName = product.name
    editForm.unitPrice   = Number(product.price)
  } else {
    editForm.productName = ''
  }
}

async function saveEdit() {
  if (!editForm.productName?.trim()) { editModal.error = 'Description is required'; return }
  if (!editForm.quantity || editForm.quantity < 1) { editModal.error = 'Quantity must be at least 1'; return }
  editModal.saving = true
  editModal.error  = ''
  try {
    await api.put(`/erp/sale-orders/items/${editModal.item.id}`, {
      productId:   editForm.productId || null,
      productName: editForm.productName,
      quantity:    editForm.quantity,
      unitPrice:   editForm.unitPrice,
    })
    closeEdit()
    fetchItems()
  } catch (err) {
    const d = err.response?.data
    editModal.error = d?.message || 'Failed to update item'
  } finally {
    editModal.saving = false
  }
}

function confirmDelete(item) {
  deleteModal.item  = item
  deleteModal.error = ''
  deleteModal.open  = true
}

async function doDelete() {
  deleteModal.saving = true
  deleteModal.error  = ''
  try {
    await api.delete(`/erp/sale-orders/items/${deleteModal.item.id}`)
    deleteModal.open = false
    fetchItems()
  } catch (err) {
    const d = err.response?.data
    deleteModal.error = d?.message || 'Failed to delete item'
  } finally {
    deleteModal.saving = false
  }
}
</script>
