<template>
  <AppLayout>
    <div class="space-y-5">

      <PageHeader :title="loading ? t('erp.deliveryOrders.editOrder') : (doc?.refNo || t('erp.deliveryOrders.editOrder'))"
        :back-to="`/erp/delivery-orders/${route.params.id}`"
        :breadcrumb="[
          { label: t('erp.deliveryOrders.title'), to: '/erp/delivery-orders' },
          { label: doc?.refNo || '…', to: `/erp/delivery-orders/${route.params.id}` },
          { label: t('common.edit') },
        ]">
        <template #badge>
          <StatusPill :label="t('erp.common.draft')" />
        </template>
        <template #actions>
          <KeyboardShortcuts :shortcuts="shortcuts" width="w-48" />
          <HeaderSaveActions
            :cancel-to="`/erp/delivery-orders/${route.params.id}`"
            :cancel-label="t('common.cancel')"
            :saving="saving"
            :saving-label="t('erp.common.saving')"
            :save-label="t('common.saveChanges')"
            :disabled="!canSave"
            :disabled-hint="t('erp.deliveryOrders.fillRequiredFields')"
            @save="save"
          />
        </template>
      </PageHeader>

      <LoadingSpinner v-if="loading" />

      <ErrorBanner v-else-if="loadError" :message="loadError" />

      <div v-else class="space-y-5">

        <FormCard :title="t('erp.deliveryOrders.info')" :icon="TruckIcon" icon-color="primary" :padded="false">
          <div class="px-6 py-5 grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-5">

            <div ref="refNoRef">
              <FormField name="referenceNumber" :label="t('erp.deliveryOrders.referenceNumber')" :errors="mergedErrors"
                v-model="form.referenceNumber" placeholder="e.g. PO-2025-001" />
            </div>

            <div class="lg:col-span-2">
              <FieldLabel :text="t('erp.deliveryOrders.customer')" required />
              <SearchSelect v-model="form.customerId" :options="customers" :invalid="!!mergedErrors.customerId" placeholder="— Select customer —">
                <template #option="{ option }">{{ option.name }}<span v-if="option.company" class="text-[#9BA7B0]"> · {{ option.company }}</span></template>
                <template #singleLabel="{ option }">{{ option.name }}<span v-if="option.company" class="text-[#9BA7B0]"> · {{ option.company }}</span></template>
              </SearchSelect>
              <FieldError name="customerId" :errors="mergedErrors" />
              <CustomerChip :customer="selectedCustomer" />
            </div>

            <FormField name="date" :label="t('erp.common.date')" :errors="mergedErrors" required>
              <template #default="{ hasError }">
                <DateInput v-model="form.date" :class="['input', hasError && 'input-error']" />
              </template>
            </FormField>

            <FormField name="deliveryDate" :label="t('erp.deliveryOrders.deliveryDate')" :errors="mergedErrors">
              <template #default>
                <DateInput v-model="form.deliveryDate" class="input" />
              </template>
            </FormField>

            <div>
              <FieldLabel :text="t('erp.deliveryOrders.referenceSO')" />
              <SearchSelect v-model="form.orderId" :options="orders" label-key="orderNumber" placeholder="— None —" />
            </div>

            <FormField name="paymentTerms" :label="t('erp.deliveryOrders.paymentTerms')" :errors="mergedErrors">
              <template #default="{ id }">
                <select :id="id" v-model="form.paymentTerms" class="input">
                  <option value="">—</option>
                  <option v-for="opt in paymentTerms" :key="opt.id" :value="opt.code || opt.name">{{ opt.name }}</option>
                </select>
              </template>
            </FormField>

            <div>
              <FieldLabel :text="t('erp.deliveryOrders.salesperson')" />
              <SearchSelect v-model="form.salespersonId" :options="staff" placeholder="— Salesperson —">
                <template #option="{ option }">{{ option.name }}<span v-if="option.email" class="text-[#9BA7B0]"> · {{ option.email }}</span></template>
                <template #singleLabel="{ option }">{{ option.name }}</template>
              </SearchSelect>
            </div>

          </div>
        </FormCard>

        <FormCard :title="t('erp.deliveryOrders.addresses')" :icon="MapPinIcon" icon-color="primary" :padded="false">
          <template #actions>
            <button type="button" @click="syncAddressesFromCustomer"
              :disabled="!selectedCustomer?.address"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold
                     text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <ArrowPathIcon class="w-3.5 h-3.5" />
              {{ t('erp.deliveryOrders.useCustomerAddress') }}
            </button>
          </template>
          <div class="px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FormField name="shippingAddress" :label="t('erp.deliveryOrders.shippingAddress')" :errors="mergedErrors"
              v-model="form.shippingAddress" textarea :rows="3" input-class="resize-none" />
            <div>
              <div class="flex items-center justify-between">
                <FieldLabel :text="t('erp.deliveryOrders.billingAddress')" />
                <label class="flex items-center gap-1.5 text-[11px] text-[#637381] cursor-pointer select-none">
                  <input type="checkbox" v-model="billingSameAsShipping" class="" />
                  {{ t('erp.deliveryOrders.sameAsShipping') }}
                </label>
              </div>
              <textarea v-model="form.billingAddress" rows="3" :disabled="billingSameAsShipping"
                class="input resize-none disabled:bg-[#F7F9FC] disabled:text-[#9BA7B0]" />
            </div>
          </div>
        </FormCard>

        <FormCard :title="t('erp.deliveryOrders.lineItems')" :icon="ClipboardDocumentListIcon" icon-color="green"
          :subtitle="form.items.length ? `${form.items.length} item${form.items.length !== 1 ? 's' : ''}` : ''"
          :padded="false">
          <template #actions>
            <button @click="openBulkPicker" type="button"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold
                     text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200
                     transition-colors">
              <PlusIcon class="w-3.5 h-3.5" />
              {{ t('erp.deliveryOrders.addItem') }}
            </button>
          </template>

          <EmptyState v-if="!form.items.length"
            :icon="ClipboardDocumentListIcon"
            :title="t('erp.common.noItems')"
            :subtitle="t('erp.deliveryOrders.noItemsHint')"
            :action-label="t('erp.deliveryOrders.addFirstItem')"
            :error-message="errors.items"
            @action="openBulkPicker" />

          <div v-else>
            <div class="grid items-center gap-3 px-5 py-2.5 bg-[#F7F9FC] border-b border-[#E2E8F0]"
              style="grid-template-columns: 1.8rem 2.5fr 1.4fr 2fr 6rem 3fr 2rem">
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider text-center">#</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">{{ t('erp.deliveryOrders.saleItem') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">{{ t('erp.deliveryOrders.store') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">{{ t('erp.deliveryOrders.colProduct') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider text-right">{{ t('erp.deliveryOrders.colQty') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">{{ t('erp.deliveryOrders.colNotes') }}</div>
              <div></div>
            </div>

            <div class="divide-y divide-[#E2E8F0]">
              <div v-for="(line, idx) in form.items" :key="line.key || idx"
                class="grid items-center gap-3 px-5 py-3 transition-colors group border-l-2 border-l-transparent hover:bg-[#F7F9FC]"
                :class="[
                  dragFromIdx === idx ? 'opacity-40' : '',
                  dragOverIdx === idx && dragFromIdx !== idx ? 'border-t-2 border-t-primary-500' : '',
                ]"
                style="grid-template-columns: 1.8rem 2.5fr 1.4fr 2fr 6rem 3fr 2rem"
                @dragover="onDragOver($event, idx)"
                @drop="onDrop(idx)"
                @dragleave="onDragLeave(idx)">

                <div draggable="true"
                  @dragstart="onDragStart($event, idx)"
                  @dragend="onDragEnd"
                  class="text-[12px] font-semibold text-center select-none flex items-center justify-center
                         cursor-grab active:cursor-grabbing hover:bg-[#E2E8F0]/60 h-7
                         text-[#CBD5E1] group-hover:text-[#637381]">
                  <Bars3Icon class="w-4 h-4 hidden group-hover:block" />
                  <span class="group-hover:hidden">{{ idx + 1 }}</span>
                </div>

                <SearchSelectPopup
                  v-model="line.saleItemId"
                  :options="groupedItemOptions"
                  group-values="items"
                  group-label="label"
                  placeholder="— Item —"
                  search-placeholder="Search by code or name…"
                  @change="onPickerChange(line, idx)"
                />

                <div>
                  <SearchSelect v-if="line.hasProduct" v-model="line.storeId" :options="stores" placeholder="— Store —" />
                  <div v-else class="flex items-center justify-center h-9">
                    <span class="text-[12px] text-[#CBD5E1]">—</span>
                  </div>
                </div>

                <input v-model="line.productName" type="text" placeholder="Description…"
                  class="w-full px-2.5 py-2 border border-[#E2E8F0] text-[13px] text-[#1C2434]
                         focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
                         transition-all placeholder:text-[#CBD5E1]" />

                <input v-model.number="line.qty" type="number" min="0.001" step="any"
                  class="w-full px-2 py-2 border border-[#E2E8F0] text-[13px] text-right
                         text-[#1C2434] tabular-nums focus:outline-none focus:ring-2
                         focus:ring-primary-500/20 focus:border-primary-400 transition-all" />

                <input v-model="line.notes" type="text" placeholder="Notes…"
                  class="w-full px-2.5 py-2 border border-[#E2E8F0] text-[13px] text-[#637381]
                         focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
                         transition-all placeholder:text-[#CBD5E1]" />

                <button @click="removeLine(idx)" type="button"
                  class="w-7 h-7 flex items-center justify-center flex-shrink-0
                         text-[#CBD5E1] hover:text-red-500 hover:bg-red-50 transition-colors
                         opacity-0 group-hover:opacity-100">
                  <TrashIcon class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p v-if="errors.items" class="px-5 py-2.5 text-[11px] text-red-600 bg-[#FEE2E2] border-t border-[#FECACA]">
              {{ errors.items }}
            </p>
          </div>

          <SearchSelectPopup
            ref="bulkPickerRef"
            :model-value="''"
            :options="groupedItemOptions"
            group-values="items"
            group-label="label"
            multiple
            hide-trigger
            search-placeholder="Search by code or name…"
            @submit="onBulkAdd"
          />
        </FormCard>

        <ErrorBanner :message="globalError" />

        <FormCard :title="t('erp.deliveryOrders.deliverySummary')" :icon="CalculatorIcon" icon-color="slate" :padded="false">
          <div class="px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <FormField name="notes" :label="t('erp.common.notes')" :errors="mergedErrors"
              v-model="form.notes" textarea wrapper-class="flex flex-col text-left"
              input-class="resize-none flex-1 min-h-[8rem]" />
            <dl class="w-full space-y-2.5">
              <div class="flex items-center justify-between text-[13px]">
                <dt class="text-[#637381]">{{ t('erp.deliveryOrders.customer') }}</dt>
                <dd class="font-semibold text-[#1C2434] truncate ml-3">{{ selectedCustomer?.name || '—' }}</dd>
              </div>
              <div class="flex items-center justify-between pt-2.5 border-t border-[#E2E8F0]">
                <dt class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">{{ t('erp.deliveryOrders.totalItems') }}</dt>
                <dd class="text-base font-bold text-[#1C2434] tabular-nums">{{ form.items.length }}</dd>
              </div>
            </dl>
          </div>
        </FormCard>

      </div>
    </div>

    <div v-if="!loading && !loadError" class="sticky bottom-0 -mx-6 mt-6 px-6 py-3.5 bg-white/95 backdrop-blur border-t border-[#E2E8F0] shadow-[0_-4px_12px_rgba(15,23,42,0.05)] z-20
                flex items-center justify-between gap-3">
      <div class="flex items-center gap-4">
        <div>
          <p class="text-[10px] font-semibold text-[#9BA7B0] uppercase tracking-wider mb-0.5">{{ t('erp.deliveryOrders.totalItems') }}</p>
          <p class="text-2xl font-extrabold tabular-nums leading-none text-primary-600">{{ form.items.length }}</p>
        </div>
        <span v-if="dirty" class="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-600">
          <ExclamationTriangleIcon class="w-3.5 h-3.5" />
          {{ t('erp.deliveryOrders.unsavedChanges') }}
        </span>
      </div>
      <div class="flex items-center gap-2.5">
        <button @click="discard" type="button"
          class="px-4 py-2.5 text-sm font-medium text-[#637381] hover:text-[#1C2434] transition-colors">
          {{ t('erp.deliveryOrders.discard') }}
        </button>
        <button @click="save" :disabled="!canSave || saving" type="button"
          class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold
                 bg-primary-500 text-white hover:bg-primary-600 shadow-sm
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <ArrowPathIcon v-if="saving" class="w-4 h-4 animate-spin" />
          <CheckIcon v-else class="w-4 h-4" />
          {{ saving ? t('erp.common.saving') : t('common.saveChanges') }}
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="confirmOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
        <div class="w-full max-w-sm bg-white shadow-2xl overflow-hidden">
          <div class="px-5 py-4 flex items-start gap-3">
            <div class="w-9 h-9 bg-amber-100 flex items-center justify-center flex-shrink-0">
              <ExclamationTriangleIcon class="w-5 h-5 text-amber-600" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-[#1C2434]">{{ confirmTitle }}</p>
              <p v-if="confirmMessage" class="mt-1 text-[12px] text-[#637381] leading-snug">{{ confirmMessage }}</p>
            </div>
          </div>
          <div class="px-5 py-3 bg-[#F7F9FC] flex items-center justify-end gap-2">
            <button type="button" @click="confirmAnswer(false)"
              class="px-4 py-2 text-sm font-medium text-[#637381] hover:text-[#1C2434]">{{ t('common.cancel') }}</button>
            <button type="button" @click="confirmAnswer(true)"
              class="px-4 py-2 text-sm font-semibold bg-red-500 text-white hover:bg-red-600 shadow-sm">
              {{ confirmOkLabel }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import {
  PlusIcon, TrashIcon, CheckIcon,
  ArrowPathIcon, TruckIcon, ClipboardDocumentListIcon, CalculatorIcon,
  ExclamationTriangleIcon, Bars3Icon, MapPinIcon,
} from '@heroicons/vue/24/outline'
import AppLayout from '@/layouts/AppLayout.vue'
import SearchSelect from '@/components/SearchSelect.vue'
import SearchSelectPopup from '@/components/SearchSelectPopup.vue'
import KeyboardShortcuts from '@/components/KeyboardShortcuts.vue'
import { useFormShortcuts } from '@/composables/useShortcuts'
import PageHeader from '@/components/form/PageHeader.vue'
import FormCard from '@/components/form/FormCard.vue'
import FormField from '@/components/form/FormField.vue'
import FieldLabel from '@/components/form/FieldLabel.vue'
import FieldError from '@/components/form/FieldError.vue'
import ErrorBanner from '@/components/form/ErrorBanner.vue'
import StatusPill from '@/components/form/StatusPill.vue'
import HeaderSaveActions from '@/components/form/HeaderSaveActions.vue'
import CustomerChip from '@/components/form/CustomerChip.vue'
import EmptyState from '@/components/form/EmptyState.vue'
import LoadingSpinner from '@/components/form/LoadingSpinner.vue'
import { useFieldErrors } from '@/composables/useFieldErrors'
import api from '@/api'
import { parseApiError } from '@/utils/apiError'

const { t }    = useI18n()
const route    = useRoute()
const router   = useRouter()

const { shortcuts } = useFormShortcuts({
  save: () => save(),
  cancel: () => discard(),
  enabled: () => !confirmOpen.value,
  cancelLabel: 'Back to detail',
  extra: [
    { combo: 'ctrl+a', handler: () => openBulkPicker(), hint: { key: 'Ctrl+A', label: 'Add item' } },
  ],
})

const doc          = ref(null)
const customers    = ref([])
const orders       = ref([])
const saleItems    = ref([])
const salePackages = ref([])
const stores       = ref([])
const staff        = ref([])
const paymentTerms = ref([])
const loading      = ref(true)
const loadError    = ref('')
const saving       = ref(false)
const globalError  = ref('')
const errors       = ref({})
const { fieldErrors, setFromError, reset: resetErrors } = useFieldErrors()
const refNoRef     = ref(null)

const mergedErrors = computed(() => ({ ...errors.value, ...fieldErrors.value }))
const billingSameAsShipping = ref(false)

const form = ref({
  customerId: '', date: '', deliveryDate: '', orderId: '',
  referenceNumber: '', paymentTerms: '', salespersonId: '',
  shippingAddress: '', billingAddress: '',
  notes: '', items: [],
})

const dirty = ref(false)
let dirtyArmed = false
watch(form, () => { if (dirtyArmed) dirty.value = true }, { deep: true })

function onBeforeUnload(e) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = t('erp.deliveryOrders.unsavedChanges')
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload))

const confirmOpen     = ref(false)
const confirmTitle    = ref('')
const confirmMessage  = ref('')
const confirmOkLabel  = ref('OK')
let confirmResolver   = null
function confirmAsync({ title, message, okLabel } = {}) {
  confirmTitle.value   = title   || ''
  confirmMessage.value = message || ''
  confirmOkLabel.value = okLabel || 'OK'
  confirmOpen.value    = true
  return new Promise(resolve => { confirmResolver = resolve })
}
function confirmAnswer(ok) {
  confirmOpen.value = false
  if (confirmResolver) { confirmResolver(ok); confirmResolver = null }
}

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return await confirmAsync({
    title:   t('erp.deliveryOrders.unsavedChanges'),
    message: t('erp.deliveryOrders.unsavedChangesHint'),
    okLabel: t('erp.deliveryOrders.discard'),
  })
})

const selectedCustomer = computed(() =>
  form.value.customerId ? customers.value.find(c => c.id === form.value.customerId) : null
)

const groupedItemOptions = computed(() => {
  const groups = [{ label: t('erp.deliveryOrders.saleItems'), items: saleItems.value }]
  if (salePackages.value.length) {
    groups.push({
      label: t('erp.deliveryOrders.salePackages'),
      items: salePackages.value.map(p => ({ ...p, name: `📦 ${p.name}` })),
    })
  }
  return groups
})

let _localKeyCounter = 0
function newKey() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `k${Date.now()}-${++_localKeyCounter}`
}

onMounted(async () => {
  const id = route.params.id
  const [docRes, cRes, oRes, siRes, spRes, stRes, staffRes, ptRes] = await Promise.allSettled([
    api.get(`/erp/delivery-orders/${id}`),
    api.get('/erp/customers',     { params: { limit: 200 } }),
    api.get('/erp/sale-orders',        { params: { limit: 500, status: 'confirmed' } }),
    api.get('/erp/sale-items',    { params: { limit: 500, status: 'active' } }),
    api.get('/erp/sale-packages', { params: { limit: 200, status: 'active' } }),
    api.get('/erp/stores',        { params: { limit: 200 } }),
    api.get('/organizations/staff'),
    api.get('/erp/master-data/payment-terms'),
  ])
  if (cRes.status     === 'fulfilled') customers.value    = cRes.value.data.data.customers || []
  if (oRes.status     === 'fulfilled') orders.value       = oRes.value.data.data.orders    || []
  if (siRes.status    === 'fulfilled') saleItems.value    = siRes.value.data.data.items    || []
  if (spRes.status    === 'fulfilled') salePackages.value = spRes.value.data.data.items    || []
  if (stRes.status    === 'fulfilled') stores.value       = stRes.value.data.data.stores   || []
  if (staffRes.status === 'fulfilled') staff.value        = staffRes.value.data.data.staff || []
  if (ptRes.status    === 'fulfilled') paymentTerms.value = ptRes.value.data.data.values   || []

  if (docRes.status !== 'fulfilled') {
    loadError.value = parseApiError(docRes.reason, 'Failed to load delivery order')
    loading.value = false
    return
  }

  const d = docRes.value.data.data.deliveryOrder
  if (d.status !== 'draft') {
    router.replace(`/erp/delivery-orders/${id}`)
    return
  }
  doc.value = d

  billingSameAsShipping.value = !!d.shippingAddress && d.shippingAddress === d.billingAddress

  form.value = {
    customerId:      d.customerId      || '',
    date:            d.date            || '',
    deliveryDate:    d.deliveryDate    || '',
    orderId:         d.orderId         || '',
    referenceNumber: d.referenceNumber || '',
    paymentTerms:    d.paymentTerms    || '',
    salespersonId:   d.salespersonId   || '',
    shippingAddress: d.shippingAddress || d.address || '',
    billingAddress:  d.billingAddress  || '',
    notes:           d.notes           || '',
    items: (d.items || []).map(it => {
      const si = saleItems.value.find(s => s.id === it.saleItemId)
      const hasProduct = !!(it.productId || si?.productId)
      return {
        key:         newKey(),
        saleItemId:  it.saleItemId || '',
        productId:   it.productId  || '',
        storeId:     it.storeId    || '',
        hasProduct,
        productName: it.productName || '',
        qty:         Number(it.qty) || 0,
        notes:       it.notes || '',
      }
    }),
  }
  loading.value = false
  await nextTick()
  dirtyArmed = true
  refNoRef.value?.querySelector('input')?.focus()
})

watch(() => form.value.customerId, (id) => {
  const c = customers.value.find(x => x.id === id)
  if (!c) return
  if (!form.value.shippingAddress && c.address) form.value.shippingAddress = c.address
})

watch(billingSameAsShipping, (on) => {
  if (on) form.value.billingAddress = form.value.shippingAddress
})
watch(() => form.value.shippingAddress, (v) => {
  if (billingSameAsShipping.value) form.value.billingAddress = v
})

function syncAddressesFromCustomer() {
  const c = selectedCustomer.value
  if (!c?.address) return
  form.value.shippingAddress = c.address
  if (billingSameAsShipping.value) form.value.billingAddress = c.address
}

function removeLine(idx) {
  form.value.items.splice(idx, 1)
}

const dragFromIdx = ref(null)
const dragOverIdx = ref(null)
function onDragStart(e, idx) {
  dragFromIdx.value = idx
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(idx))
}
function onDragOver(e, idx) {
  if (dragFromIdx.value === null) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dragOverIdx.value = idx
}
function onDragLeave(idx) {
  if (dragOverIdx.value === idx) dragOverIdx.value = null
}
function onDrop(idx) {
  const from = dragFromIdx.value
  if (from === null || from === idx) { onDragEnd(); return }
  const [moved] = form.value.items.splice(from, 1)
  const insertAt = from < idx ? idx - 1 : idx
  form.value.items.splice(insertAt, 0, moved)
  onDragEnd()
}
function onDragEnd() {
  dragFromIdx.value = null
  dragOverIdx.value = null
}

const bulkPickerRef = ref(null)
function openBulkPicker() { bulkPickerRef.value?.open() }

function makeLineFromSaleItem(si) {
  return {
    key:         newKey(),
    saleItemId:  si.id,
    productId:   si.productId || '',
    storeId:     '',
    hasProduct:  !!si.productId,
    productName: si.name,
    qty:         1,
    notes:       '',
  }
}

async function linesFromPackage(packageId) {
  try {
    const { data } = await api.get(`/erp/sale-packages/${packageId}`)
    const pkg = data.data.package
    return (pkg.packageItems || []).map(pi => {
      const si = pi.saleItem || saleItems.value.find(s => s.id === pi.saleItemId) || {}
      return {
        key:         newKey(),
        saleItemId:  pi.saleItemId,
        productId:   si.productId || '',
        storeId:     '',
        hasProduct:  !!si.productId,
        productName: si.name || 'Item',
        qty:         Number(pi.quantity) || 1,
        notes:       '',
      }
    })
  } catch {
    return []
  }
}

async function onPickerChange(line, idx) {
  const id = line.saleItemId
  if (!id) return
  if (saleItems.value.some(s => s.id === id)) {
    const si = saleItems.value.find(s => s.id === id)
    if (si) {
      line.productName = si.name
      line.productId   = si.productId || ''
      line.hasProduct  = !!si.productId
      if (!line.hasProduct) line.storeId = ''
    }
    return
  }
  if (salePackages.value.some(p => p.id === id)) {
    const lines = await linesFromPackage(id)
    if (lines.length) form.value.items.splice(idx, 1, ...lines)
    else              form.value.items.splice(idx, 1)
  }
}

async function onBulkAdd(objects) {
  const newLines = []
  for (const obj of objects) {
    if (saleItems.value.some(s => s.id === obj.id)) {
      newLines.push(makeLineFromSaleItem(obj))
    } else if (salePackages.value.some(p => p.id === obj.id)) {
      const lines = await linesFromPackage(obj.id)
      newLines.push(...lines)
    }
  }
  if (!newLines.length) return
  form.value.items.push(...newLines)
  await nextTick()
}


const canSave = computed(() => {
  if (!form.value.customerId || !form.value.date) return false
  if (!form.value.items.length) return false
  for (const item of form.value.items) {
    if (!item.productName?.trim()) return false
    if (!item.qty || item.qty <= 0) return false
  }
  return true
})

function validate() {
  const e = {}
  if (!form.value.customerId) e.customerId = t('erp.deliveryOrders.customerRequired')
  if (!form.value.date)       e.date       = t('erp.deliveryOrders.dateRequired')
  if (!form.value.items.length) {
    e.items = 'Add at least one item'
  } else {
    for (const item of form.value.items) {
      if (!item.productName?.trim()) { e.items = 'All items need a product name'; break }
      if (!item.qty || item.qty <= 0) { e.items = 'All items need a valid quantity'; break }
    }
  }
  errors.value = e
  return Object.keys(e).length === 0
}

async function save() {
  globalError.value = ''
  resetErrors()
  if (!validate()) return
  saving.value = true
  try {
    await api.put(`/erp/delivery-orders/${route.params.id}`, {
      ...form.value,
      orderId:      form.value.orderId      || null,
      deliveryDate: form.value.deliveryDate || null,
      items: form.value.items.map(({ saleItemId, productId, storeId, productName, qty, notes }) => ({
        saleItemId: saleItemId || null,
        productId:  productId  || null,
        storeId:    storeId    || null,
        productName, qty, notes: notes || null,
      })),
    })
    dirty.value = false
    router.push(`/erp/delivery-orders/${route.params.id}`)
  } catch (err) {
    const had = setFromError(err)
    if (!had) globalError.value = parseApiError(err, 'Failed to update delivery order')
  } finally {
    saving.value = false
  }
}

async function discard() {
  if (dirty.value) {
    const ok = await confirmAsync({
      title:   t('erp.deliveryOrders.unsavedChanges'),
      message: t('erp.deliveryOrders.unsavedChangesHint'),
      okLabel: t('erp.deliveryOrders.discard'),
    })
    if (!ok) return
  }
  router.push(`/erp/delivery-orders/${route.params.id}`)
}
</script>
