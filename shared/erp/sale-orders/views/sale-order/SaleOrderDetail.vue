<template>
  <AppLayout>
    <div class="space-y-5">

      <!-- Top action bar (hidden on print) -->
      <div class="flex items-start gap-3 print:hidden">
        <button type="button" @click="goBack"
          class="mt-0.5 p-2 text-[#9BA7B0] hover:text-[#1C2434] hover:bg-white
                 border border-transparent hover:border-[#E2E8F0] transition-all flex-shrink-0">
          <ArrowLeftIcon class="w-[18px] h-[18px]" />
        </button>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2.5 flex-wrap">
            <h1 class="text-xl font-bold text-[#1C2434]">
              {{ loading ? '…' : (order?.orderNumber || t('erp.orders.detail')) }}
            </h1>
            <span v-if="order && !loading"
              class="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold capitalize"
              :class="statusBadge(order.status)">
              <span class="w-1.5 h-1.5" :class="statusDot(order.status)"></span>
              {{ order.status }}
            </span>
            <span v-if="order && !loading"
              class="inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold"
              :class="order.saleType === 'cash' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'">
              {{ order.saleType === 'cash' ? t('erp.orders.saleTypeCash') : t('erp.orders.saleTypeCredit') }}
            </span>
            <DocCurrencyBadge v-if="order" :currency="order.currency" :exchange-rate="order.exchangeRate" :total="order.total" />
          </div>
          <nav class="flex items-center gap-1.5 mt-1">
            <RouterLink to="/erp/sale-orders" class="text-[12px] text-[#9BA7B0] hover:text-[#637381] transition-colors">
              Orders
            </RouterLink>
            <ChevronRightIcon class="w-3 h-3 text-[#CBD5E1]" />
            <span class="text-[12px] text-[#637381]">{{ order?.orderNumber || '…' }}</span>
          </nav>
        </div>
        <!-- Quick actions -->
        <div v-if="order && !loading" class="flex items-center gap-2 flex-shrink-0">
          <KeyboardShortcuts :shortcuts="shortcuts" width="w-56" />
          <button @click="onPrint" type="button"
            :title="`${t('erp.orders.printDocument')} (P)`"
            class="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold
                   text-[#637381] bg-white border border-[#E2E8F0] hover:bg-[#F7F9FC] hover:text-[#1C2434] transition-colors">
            <PrinterIcon class="w-4 h-4" />
            {{ t('common.print') }}
          </button>
          <RouterLink v-if="order.status === 'draft'" v-can="'erp.orders.edit'" :to="`/erp/sale-orders/${order.id}/edit`"
            :title="`${t('common.edit')} (E)`"
            class="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold
                   text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 transition-colors">
            <PencilSquareIcon class="w-4 h-4" />
            {{ t('common.edit') }}
          </RouterLink>
          <button v-if="order.status === 'draft'" v-can="'erp.orders.delete'" @click="confirmDelete" type="button"
            :title="`Delete (Del)`"
            class="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold
                   text-red-600 bg-white border border-red-200 hover:bg-red-50 transition-colors">
            <TrashIcon class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20 print:hidden">
        <div class="w-7 h-7 border-2 border-primary-500 border-t-transparent animate-spin"></div>
      </div>

      <!-- Not found -->
      <div v-else-if="notFound"
        class="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3.5 print:hidden">
        <ExclamationCircleIcon class="w-5 h-5 flex-shrink-0 mt-0.5" />
        <span>{{ t('erp.common.notFound') }}
          <RouterLink to="/erp/sale-orders" class="underline ml-1">{{ t('erp.common.backToList') }}</RouterLink>
        </span>
      </div>

      <template v-else>
        <!-- Compact workflow strip (hidden on print) -->
        <div class="bg-white border border-[#E2E8F0] shadow-card px-5 py-3 print:hidden">
          <div class="flex items-center gap-1 flex-wrap">
            <template v-for="(step, i) in FLOW_STEPS" :key="step.key">
              <div class="flex items-center gap-2 px-2.5 py-1"
                :class="stepChipClass(step.key)">
                <CheckIcon v-if="stepState(step.key) === 'completed'" class="w-3.5 h-3.5" />
                <span v-else-if="stepState(step.key) === 'current'" class="w-2 h-2 bg-current"></span>
                <span v-else class="text-[10px] font-bold opacity-50">{{ i + 1 }}</span>
                <span class="text-[12px] font-semibold">{{ step.label }}</span>
              </div>
              <ChevronRightIcon v-if="i < FLOW_STEPS.length - 1" class="w-3 h-3 text-[#CBD5E1] flex-shrink-0" />
            </template>
            <span v-if="isCancelled" class="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600">
              <XMarkIcon class="w-3.5 h-3.5" />
              <span class="text-[12px] font-semibold">Cancelled</span>
            </span>
          </div>
        </div>

        <!-- ── Action panels (above the printable document) ─────── -->

        <!-- Status transitions -->
        <div v-can="'erp.orders.edit'" v-if="forwardTransitions.length || cancelTransitions.length"
          class="bg-white border border-[#E2E8F0] shadow-card px-5 py-4 print:hidden
                 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">
              {{ t('erp.orders.nextAction') }}
            </p>
            <p class="text-[13px] text-[#637381] mt-0.5">
              {{ t('erp.orders.nextActionHint') }}
            </p>
          </div>
          <div class="flex items-center gap-2.5">
            <button v-for="s in forwardTransitions" :key="s"
              @click="changeStatus(s)" :disabled="updatingStatus"
              class="px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50
                     flex items-center gap-2"
              :class="forwardBtnClass(s)">
              <ArrowPathIcon v-if="updatingStatus" class="w-4 h-4 animate-spin" />
              <template v-else>{{ transitionLabel(s) }}</template>
            </button>
            <button v-for="s in cancelTransitions" :key="s"
              @click="changeStatus(s)" :disabled="updatingStatus"
              class="px-4 py-2 text-sm font-medium border border-red-200 text-red-600
                     hover:bg-red-50 transition-colors disabled:opacity-50">
              {{ t('erp.orders.cancelOrder') }}
            </button>
          </div>
        </div>
        <p v-if="statusError" class="text-xs text-red-600 print:hidden">{{ statusError }}</p>

        <!-- Conversion actions (confirmed / shipped / delivered) -->
        <div v-if="['confirmed', 'shipped', 'delivered'].includes(order.status)"
          class="bg-white border border-[#E2E8F0] shadow-card px-5 py-4 print:hidden
                 flex items-center flex-wrap gap-3">
          <p class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider mr-2">
            {{ t('erp.orders.convertActions') }}
          </p>
          <button v-can="'erp.orders.edit'" @click="convertToDeliveryOrder"
            :disabled="converting || !!order.linkedDeliveryOrder"
            :title="order.linkedDeliveryOrder ? `Already linked to ${order.linkedDeliveryOrder.refNo}` : ''"
            class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-50 text-primary-600 border border-primary-200
                   hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <TruckIcon class="w-4 h-4" />
            {{ converting === 'do' ? t('erp.common.saving') : t('erp.orders.createDeliveryOrder') }}
          </button>
          <RouterLink v-if="order.linkedDeliveryOrder" :to="`/erp/delivery-orders/${order.linkedDeliveryOrder.id}`"
            class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100">
            → {{ order.linkedDeliveryOrder.refNo }}
          </RouterLink>

          <!-- Cash → Receipt, Credit → Invoice happen on the Delivery Order. -->
          <span class="self-center text-xs text-[#9BA7B0]">
            {{ order.saleType === 'cash' ? t('erp.orders.cashNextHint') : t('erp.orders.creditNextHint') }}
          </span>

          <span v-if="convertError" class="self-center text-xs text-red-600">{{ convertError }}</span>
        </div>

        <!-- Printable document (extracted report view) -->
        <SaleOrderReport :order="order" />

        <ActivityTimeline v-if="order" ref-type="Order" :ref-id="order.id" class="print:hidden" />
      </template>
    </div>

    <!-- Confirm dialog -->
    <Teleport to="body">
      <div v-if="confirmOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
        <div class="w-full max-w-sm bg-white shadow-2xl overflow-hidden">
          <div class="px-5 py-4 flex items-start gap-3">
            <div class="w-9 h-9 bg-amber-100 flex items-center justify-center flex-shrink-0">
              <ExclamationCircleIcon class="w-5 h-5 text-amber-600" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-[#1C2434]">{{ confirmTitle }}</p>
              <p v-if="confirmMessage" class="mt-1 text-[12px] text-[#637381] leading-snug">{{ confirmMessage }}</p>
            </div>
          </div>
          <div class="px-5 py-3 bg-[#F7F9FC] flex items-center justify-end gap-2">
            <button type="button" @click="confirmAnswer(false)"
              class="px-4 py-2 text-sm font-medium text-[#637381] hover:text-[#1C2434] inline-flex items-center gap-1.5">
              {{ t('common.cancel') }}
              <kbd class="px-1 py-0.5 border border-[#E2E8F0] bg-white font-mono text-[10px] text-[#9BA7B0]">Esc</kbd>
            </button>
            <button type="button" @click="confirmAnswer(true)"
              class="px-4 py-2 text-sm font-semibold bg-red-500 text-white hover:bg-red-600 shadow-sm inline-flex items-center gap-1.5">
              {{ confirmOkLabel }}
              <kbd class="px-1 py-0.5 border border-red-400 bg-red-600 font-mono text-[10px] text-red-100">Enter</kbd>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ActivityTimeline from '@/components/ActivityTimeline.vue'
import DocCurrencyBadge from '@/components/DocCurrencyBadge.vue'
import {
  ArrowLeftIcon, ChevronRightIcon,
  CheckIcon, XMarkIcon, TrashIcon, PencilSquareIcon,
  ArrowPathIcon, ExclamationCircleIcon, TruckIcon, PrinterIcon,
} from '@heroicons/vue/24/outline'
import AppLayout from '@/layouts/AppLayout.vue'
import KeyboardShortcuts from '@/components/KeyboardShortcuts.vue'
import { useDetailShortcuts } from '@/composables/useShortcuts'
import api from '@/api'
import SaleOrderReport from '@shared/reporting/templates/erp/sale-order/SaleOrderReport.vue'

const { t }  = useI18n()
const route  = useRoute()
const router = useRouter()

const order          = ref(null)
const loading        = ref(true)
const notFound       = ref(false)
const updatingStatus = ref(false)
const statusError    = ref('')
const converting     = ref('')
const convertError   = ref('')

const { shortcuts } = useDetailShortcuts({
  enabled:   () => !loading.value && !notFound.value && !confirmOpen.value,
  canEdit:   () => order.value?.status === 'draft',
  edit:      () => router.push(`/erp/sale-orders/${order.value.id}/edit`),
  print:     onPrint,
  remove:    confirmDelete,
  canRemove: () => order.value?.status === 'draft',
  back:      () => goBack(),
})

// Back arrow + Esc return to wherever the user came from (e.g. the editor via
// "Preview Print"), falling back to the list when opened directly by URL.
function goBack() {
  if (window.history.state?.back) router.back()
  else router.push('/erp/sale-orders')
}

// ── Custom confirm modal ────────────────────────────────────────────────
const confirmOpen    = ref(false)
const confirmTitle   = ref('')
const confirmMessage = ref('')
const confirmOkLabel = ref('OK')
let confirmResolver  = null
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

function onPrint() { window.print() }

async function convertToDeliveryOrder() {
  convertError.value = ''
  converting.value = 'do'
  try {
    const { data } = await api.post(`/erp/sale-orders/${order.value.id}/create-delivery-order`)
    router.push(`/erp/delivery-orders/${data.data.id}`)
  } catch (err) {
    convertError.value = err.response?.data?.message || 'Failed to create delivery order'
  } finally { converting.value = '' }
}

// ── Workflow ──────────────────────────────────────────────
const FLOW_STEPS = [
  { key: 'draft',     label: 'Draft' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped',   label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
]

const COMPLETED_BEFORE = {
  draft:     [],
  confirmed: ['draft'],
  shipped:   ['draft', 'confirmed'],
  delivered: ['draft', 'confirmed', 'shipped'],
  cancelled: [],
}

const TRANSITIONS = {
  draft:     ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped:   ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
}

const availableTransitions = computed(() => TRANSITIONS[order.value?.status] || [])
const forwardTransitions   = computed(() => availableTransitions.value.filter(s => s !== 'cancelled'))
const cancelTransitions    = computed(() => availableTransitions.value.filter(s => s === 'cancelled'))
const isCancelled          = computed(() => order.value?.status === 'cancelled')

function stepState(key) {
  const cur = order.value?.status
  if (!cur || cur === key) return cur === key ? 'current' : 'upcoming'
  return (COMPLETED_BEFORE[cur] || []).includes(key) ? 'completed' : 'upcoming'
}
function stepChipClass(key) {
  const s = stepState(key)
  if (s === 'completed') return 'bg-green-50 text-green-700'
  if (s === 'current')   return 'bg-primary-50 text-primary-700 ring-1 ring-primary-200'
  return 'bg-[#F7F9FC] text-[#9BA7B0]'
}

const FORWARD_BTN = {
  confirmed: 'bg-blue-600 text-white hover:bg-blue-700',
  shipped:   'bg-amber-500 text-white hover:bg-amber-600',
  delivered: 'bg-green-600 text-white hover:bg-green-700',
}
function forwardBtnClass(s) { return FORWARD_BTN[s] || 'bg-primary-500 text-white hover:bg-primary-600' }

const TRANSITION_LABELS = {
  confirmed: 'Confirm Order',
  shipped:   'Mark as Shipped',
  delivered: 'Mark as Delivered',
}
function transitionLabel(s) { return TRANSITION_LABELS[s] || s }

// ── Status badge ──────────────────────────────────────────
const STATUS_BADGE = {
  draft:     'bg-[#F1F5F9] text-[#637381]',
  confirmed: 'bg-blue-50 text-blue-700',
  shipped:   'bg-amber-50 text-amber-700',
  delivered: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-600',
}
const STATUS_DOT = {
  draft:     'bg-slate-400',
  confirmed: 'bg-blue-500',
  shipped:   'bg-amber-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
}
function statusBadge(s) { return STATUS_BADGE[s] || STATUS_BADGE.draft }
function statusDot(s)   { return STATUS_DOT[s]   || STATUS_DOT.draft }

// ── Data ──────────────────────────────────────────────────
onMounted(fetchOrder)

async function fetchOrder() {
  loading.value = true
  try {
    const { data } = await api.get(`/erp/sale-orders/${route.params.id}`)
    order.value = data.data.order
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

async function changeStatus(status) {
  statusError.value    = ''
  updatingStatus.value = true
  try {
    const { data } = await api.patch(`/erp/sale-orders/${order.value.id}/status`, { status })
    order.value = data.data.order
  } catch (err) {
    statusError.value = err.response?.data?.message || 'Failed to update status'
  } finally {
    updatingStatus.value = false
  }
}

async function confirmDelete() {
  const ok = await confirmAsync({
    title:   `Delete ${order.value.orderNumber}?`,
    message: 'This cannot be undone.',
    okLabel: 'Delete',
  })
  if (!ok) return
  try {
    await api.delete(`/erp/sale-orders/${order.value.id}`)
    router.push('/erp/sale-orders')
  } catch (err) {
    statusError.value = err.response?.data?.message || 'Delete failed'
  }
}

// Confirm-modal keys are handled separately so they take over while the dialog is open.
function onConfirmKeydown(e) {
  if (!confirmOpen.value) return
  if (e.key === 'Enter')  { e.preventDefault(); confirmAnswer(true) }
  if (e.key === 'Escape') { e.preventDefault(); confirmAnswer(false) }
}
onMounted(() => window.addEventListener('keydown', onConfirmKeydown))
onUnmounted(() => window.removeEventListener('keydown', onConfirmKeydown))
</script>

<style>
@page {
  size: A4;
  margin: 12mm;
}
@media print {
  aside, header, nav.print\:hidden { display: none !important; }
  body { background: white !important; }
  .shadow-card { box-shadow: none !important; }
  article {
    width: 186mm !important;
    max-width: 186mm !important;
    margin: 0 auto !important;
    overflow: visible !important;
  }
  article table { table-layout: fixed; width: 100% !important; }
}
</style>
