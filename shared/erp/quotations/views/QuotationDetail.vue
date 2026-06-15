<template>
  <AppLayout>
    <div class="space-y-5">

      <!-- Top action bar (hidden on print) -->
      <div class="flex items-start gap-3 print:hidden">
        <RouterLink to="/erp/quotations"
          class="mt-0.5 p-2 text-[#9BA7B0] hover:text-[#1C2434] hover:bg-white
                 border border-transparent hover:border-[#E2E8F0] transition-all flex-shrink-0">
          <ArrowLeftIcon class="w-[18px] h-[18px]" />
        </RouterLink>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2.5 flex-wrap">
            <h1 class="text-xl font-bold text-[#1C2434]">
              {{ loading ? '…' : (quotation?.refNo || t('erp.quotations.detail')) }}
            </h1>
            <span v-if="quotation && !loading"
              class="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold capitalize"
              :class="statusBadge(quotation.status)">
              <span class="w-1.5 h-1.5" :class="statusDot(quotation.status)"></span>
              {{ t('erp.quotations.' + quotation.status) }}
            </span>
            <DocCurrencyBadge v-if="quotation" :currency="quotation.currency" :exchange-rate="quotation.exchangeRate" :total="quotation.total" />
          </div>
          <nav class="flex items-center gap-1.5 mt-1">
            <RouterLink to="/erp/quotations" class="text-[12px] text-[#9BA7B0] hover:text-[#637381] transition-colors">
              {{ t('erp.quotations.title') }}
            </RouterLink>
            <ChevronRightIcon class="w-3 h-3 text-[#CBD5E1]" />
            <span class="text-[12px] text-[#637381]">{{ quotation?.refNo || '…' }}</span>
          </nav>
        </div>
        <!-- Quick actions -->
        <div v-if="quotation && !loading" class="flex items-center gap-2 flex-shrink-0">
          <KeyboardShortcuts :shortcuts="shortcuts" width="w-56" />
          <button @click="onPrint" type="button"
            :title="t('erp.quotations.printDocument')"
            class="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold
                   text-[#637381] bg-white border border-[#E2E8F0] hover:bg-[#F7F9FC] hover:text-[#1C2434] transition-colors">
            <PrinterIcon class="w-4 h-4" />
            {{ t('common.print') }}
          </button>
          <RouterLink v-if="quotation.status === 'draft'" v-can="'erp.quotations.edit'" :to="`/erp/quotations/${quotation.id}/edit`"
            class="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold
                   text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 transition-colors">
            <PencilSquareIcon class="w-4 h-4" />
            {{ t('common.edit') }}
          </RouterLink>
          <button v-if="quotation.status === 'draft'" v-can="'erp.quotations.delete'" @click="confirmDelete" type="button"
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
        <span>{{ t('erp.quotations.notFound') }}
          <RouterLink to="/erp/quotations" class="underline ml-1">{{ t('erp.common.backToList') }}</RouterLink>
        </span>
      </div>

      <template v-else>
        <!-- Compact workflow strip -->
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
            <span v-if="isRejected" class="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600">
              <XMarkIcon class="w-3.5 h-3.5" />
              <span class="text-[12px] font-semibold">{{ t('erp.quotations.rejected') }}</span>
            </span>
          </div>
        </div>

        <!-- Printable document (extracted report view) -->
        <QuotationReport :quotation="quotation" :payment-terms="paymentTerms" />

        <!-- Status transitions -->
        <div v-can="'erp.quotations.edit'" v-if="forwardTransitions.length || cancelTransitions.length"
          class="bg-white border border-[#E2E8F0] shadow-card px-5 py-4 print:hidden
                 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">
              {{ t('erp.quotations.nextAction') }}
            </p>
            <p class="text-[13px] text-[#637381] mt-0.5">
              {{ t('erp.quotations.nextActionHint') }}
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
              {{ t('erp.quotations.markRejected') }}
            </button>
          </div>
        </div>
        <p v-if="statusError" class="text-xs text-red-600 print:hidden">{{ statusError }}</p>

        <!-- Convert to Sales Order (accepted only) / linked-order indicator -->
        <div v-if="quotation.status === 'accepted' || quotation.convertedToOrderId"
          class="bg-white border border-[#E2E8F0] shadow-card px-5 py-4 print:hidden
                 flex items-center flex-wrap gap-3">
          <p class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider mr-2">
            {{ t('erp.quotations.convertActions') }}
          </p>
          <button v-can="'erp.orders.edit'" v-if="quotation.status === 'accepted' && !quotation.convertedToOrderId"
            @click="convertToOrder"
            :disabled="converting"
            class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-50 text-primary-600 border border-primary-200
                   hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <ArrowRightIcon class="w-4 h-4" />
            {{ converting ? t('erp.common.saving') : t('erp.quotations.convertToOrder') }}
          </button>
          <RouterLink v-if="quotation.convertedToOrderId" :to="`/erp/sale-orders/${quotation.convertedToOrderId}`"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100">
            <ArrowRightIcon class="w-3.5 h-3.5" />
            {{ t('erp.quotations.viewOrder') }}
          </RouterLink>
          <span v-if="convertError" class="self-center text-xs text-red-600">{{ convertError }}</span>
        </div>

        <ActivityTimeline v-if="quotation" ref-type="Quotation" :ref-id="quotation.id" class="print:hidden" />
      </template>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ActivityTimeline from '@/components/ActivityTimeline.vue'
import DocCurrencyBadge from '@/components/DocCurrencyBadge.vue'
import KeyboardShortcuts from '@/components/KeyboardShortcuts.vue'
import { useDetailShortcuts } from '@/composables/useShortcuts'
import {
  ArrowLeftIcon, ChevronRightIcon, ArrowRightIcon,
  CheckIcon, XMarkIcon, TrashIcon, PencilSquareIcon,
  ArrowPathIcon, ExclamationCircleIcon, PrinterIcon,
} from '@heroicons/vue/24/outline'
import AppLayout from '@/layouts/AppLayout.vue'
import QuotationReport from '@shared/reporting/templates/erp/quotation/QuotationReport.vue'
import api from '@/api'

const { t }    = useI18n()
const route    = useRoute()
const router   = useRouter()

const quotation      = ref(null)
const loading        = ref(true)
const notFound       = ref(false)
const updatingStatus = ref(false)
const statusError    = ref('')
const converting     = ref(false)
const convertError   = ref('')

const { shortcuts } = useDetailShortcuts({
  enabled: () => !loading.value && !!quotation.value,
  canEdit: () => quotation.value?.status === 'draft',
  edit:  () => router.push(`/erp/quotations/${quotation.value.id}/edit`),
  print: onPrint,
  back:  () => router.push('/erp/quotations'),
})

function onPrint() { window.print() }

// ── Workflow ──────────────────────────────────────────────
const FLOW_STEPS = [
  { key: 'draft',     label: 'Draft' },
  { key: 'sent',      label: 'Sent' },
  { key: 'accepted',  label: 'Accepted' },
  { key: 'converted', label: 'Converted' },
]
const COMPLETED_BEFORE = {
  draft:     [],
  sent:      ['draft'],
  accepted:  ['draft', 'sent'],
  converted: ['draft', 'sent', 'accepted'],
  rejected:  ['draft', 'sent'],
}
const TRANSITIONS = {
  draft:     ['sent'],
  sent:      ['accepted', 'rejected'],
  accepted:  [],
  converted: [],
  rejected:  ['draft'],
}

const availableTransitions = computed(() => TRANSITIONS[quotation.value?.status] || [])
const forwardTransitions   = computed(() => availableTransitions.value.filter(s => s !== 'rejected'))
const cancelTransitions    = computed(() => availableTransitions.value.filter(s => s === 'rejected'))
const isRejected           = computed(() => quotation.value?.status === 'rejected')

function stepState(key) {
  const cur = quotation.value?.status
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
  sent:      'bg-blue-600 text-white hover:bg-blue-700',
  accepted:  'bg-green-600 text-white hover:bg-green-700',
}
function forwardBtnClass(s) { return FORWARD_BTN[s] || 'bg-primary-500 text-white hover:bg-primary-600' }

const TRANSITION_LABELS = {
  sent:      'Mark as Sent',
  accepted:  'Mark as Accepted',
  rejected:  'Mark as Rejected',
  draft:     'Back to Draft',
}
function transitionLabel(s) { return TRANSITION_LABELS[s] || s }

const STATUS_BADGE = {
  draft:     'bg-[#F1F5F9] text-[#637381]',
  sent:      'bg-blue-50 text-blue-700',
  accepted:  'bg-green-50 text-green-700',
  rejected:  'bg-red-50 text-red-600',
  converted: 'bg-purple-50 text-purple-700',
}
const STATUS_DOT = {
  draft:     'bg-slate-400',
  sent:      'bg-blue-500',
  accepted:  'bg-green-500',
  rejected:  'bg-red-500',
  converted: 'bg-purple-500',
}
function statusBadge(s) { return STATUS_BADGE[s] || STATUS_BADGE.draft }
function statusDot(s)   { return STATUS_DOT[s]   || STATUS_DOT.draft }

// ── Data ──────────────────────────────────────────────────
onMounted(fetchQuotation)

async function fetchQuotation() {
  loading.value = true
  try {
    const { data } = await api.get(`/erp/quotations/${route.params.id}`)
    quotation.value = data.data.quotation
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
    const { data } = await api.patch(`/erp/quotations/${quotation.value.id}/status`, { status })
    quotation.value = data.data.quotation
  } catch (err) {
    statusError.value = err.response?.data?.message || 'Failed to update status'
  } finally {
    updatingStatus.value = false
  }
}

async function convertToOrder() {
  convertError.value = ''
  converting.value   = true
  try {
    const { data } = await api.post(`/erp/quotations/${quotation.value.id}/convert`)
    if (data.data?.orderId) {
      router.push(`/erp/sale-orders/${data.data.orderId}`)
    } else {
      await fetchQuotation()
    }
  } catch (err) {
    convertError.value = err.response?.data?.message || 'Failed to convert'
  } finally {
    converting.value = false
  }
}

async function confirmDelete() {
  if (!confirm(`Delete quotation ${quotation.value.refNo}? This cannot be undone.`)) return
  try {
    await api.delete(`/erp/quotations/${quotation.value.id}`)
    router.push('/erp/quotations')
  } catch (err) {
    statusError.value = err.response?.data?.message || 'Delete failed'
  }
}

// Payment-terms labels come from master-data; passed to the report view.
const paymentTerms = ref([])
onMounted(async () => {
  try {
    const { data } = await api.get('/erp/master-data/payment-terms')
    paymentTerms.value = data.data.values || []
  } catch { /* lookup failed — labels fall back to raw stored value */ }
})
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
  /* Pin the document to the A4 printable width (210mm − 2×12mm margins)
     so the table never overflows the page. */
  article {
    width: 186mm !important;
    max-width: 186mm !important;
    margin: 0 auto !important;
    overflow: visible !important;
  }
  article table { table-layout: fixed; width: 100% !important; }
}
</style>
