<template>
  <!-- Notify icon — rendered inline only when the selected customer has
       outstanding receivables. Clicking re-opens the breakdown modal. -->
  <button
    v-if="hasOutstanding"
    type="button"
    @click="open = true"
    :title="t('erp.orders.arAlertTitle')"
    class="relative mt-2.5 self-stretch inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold
           text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
    <ExclamationTriangleIcon class="w-4 h-4" />
    {{ t('erp.orders.arOutstanding') }}: {{ fmtMoney(aging.summary.total) }}
    <!-- pulsing notification dot -->
    <span class="absolute -top-1.5 -right-1.5 flex h-3 w-3">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
    </span>
  </button>

  <!-- Breakdown modal -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0" enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="open && aging" class="fixed inset-0 z-[70] flex items-center justify-center bg-[#1C2434]/40 backdrop-blur-sm px-4"
        @click.self="open = false">
        <div class="w-full max-w-2xl bg-white border border-[#E2E8F0] shadow-2xl max-h-[85vh] flex flex-col">

          <!-- Header -->
          <div class="px-6 pt-5 pb-4 border-b border-[#E2E8F0] flex items-start gap-3">
            <div class="flex items-center justify-center w-9 h-9 bg-red-50 text-red-600 border border-red-200 flex-shrink-0">
              <ExclamationTriangleIcon class="w-5 h-5" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-[15px] font-semibold text-[#1C2434]">{{ t('erp.orders.arAlertTitle') }}</h3>
              <p class="text-[13px] text-[#637381] mt-0.5 truncate">
                <span class="font-medium text-[#374151]">{{ aging.customer?.name }}</span>
                <span v-if="aging.customer?.company" class="text-[#9BA7B0]"> · {{ aging.customer.company }}</span>
              </p>
            </div>
            <button type="button" @click="open = false"
              class="w-8 h-8 hover:bg-[#F1F5F9] text-[#637381] flex items-center justify-center flex-shrink-0">
              <XMarkIcon class="w-4 h-4" />
            </button>
          </div>

          <div class="overflow-y-auto">
            <!-- Outstanding total + aging buckets -->
            <div class="px-6 py-4 bg-[#F7F9FC] border-b border-[#E2E8F0]">
              <div class="flex items-end justify-between gap-3">
                <div>
                  <p class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">{{ t('erp.orders.arOutstanding') }}</p>
                  <p class="text-2xl font-extrabold text-red-700 tabular-nums leading-tight">{{ fmtMoney(aging.summary.total) }}</p>
                </div>
                <p class="text-[11px] text-[#9BA7B0]">{{ t('erp.orders.arAsOf') }} {{ fmtDate(asOfDate) }}</p>
              </div>
              <div class="mt-3 grid grid-cols-5 gap-2">
                <div v-for="b in BUCKETS" :key="b.key"
                  class="px-2 py-2 bg-white border border-[#E2E8F0] text-center">
                  <p class="text-[10px] font-semibold uppercase tracking-wide" :class="b.cls">{{ t(b.label) }}</p>
                  <p class="text-[12px] font-bold tabular-nums mt-1"
                    :class="aging.summary[b.key] > 0 ? b.cls : 'text-[#CBD5E1]'">
                    {{ aging.summary[b.key] > 0 ? fmtMoney(aging.summary[b.key]) : '—' }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Outstanding invoices -->
            <table class="w-full text-[13px]">
              <thead>
                <tr class="bg-white border-b border-[#E2E8F0] text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">
                  <th class="px-6 py-2.5 text-left">{{ t('erp.arAging.colInvoice') }}</th>
                  <th class="px-3 py-2.5 text-left">{{ t('erp.arAging.colDueDate') }}</th>
                  <th class="px-3 py-2.5 text-center">{{ t('erp.arAging.colOverdue') }}</th>
                  <th class="px-6 py-2.5 text-right">{{ t('erp.arAging.colTotal') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E2E8F0]">
                <tr v-for="inv in aging.invoices" :key="inv.id" class="hover:bg-[#F7F9FC]">
                  <td class="px-6 py-2.5 font-medium text-[#1C2434]">{{ inv.invoiceNumber }}</td>
                  <td class="px-3 py-2.5 text-[#637381] tabular-nums">{{ fmtDate(inv.dueDate) }}</td>
                  <td class="px-3 py-2.5 text-center">
                    <span v-if="inv.daysOverdue > 0"
                      class="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold"
                      :class="overdueBadge(inv.bucket)">
                      {{ t('erp.orders.arDaysOverdue', { days: inv.daysOverdue }) }}
                    </span>
                    <span v-else class="text-[11px] text-[#9BA7B0]">{{ t('erp.orders.arNotOverdue') }}</span>
                  </td>
                  <td class="px-6 py-2.5 text-right font-semibold tabular-nums"
                    :class="inv.bucket === 'days91plus' ? 'text-red-700' : 'text-[#1C2434]'">
                    {{ fmtMoney(inv.total) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Footer -->
          <div class="px-6 py-3.5 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
            <RouterLink to="/erp/accounting/ar-aging"
              class="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary-600 hover:text-primary-700">
              <ChartBarIcon class="w-4 h-4" />
              {{ t('erp.orders.arViewReport') }}
            </RouterLink>
            <button type="button" @click="open = false"
              class="px-4 py-2 text-[13px] font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors">
              {{ t('common.close') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { ExclamationTriangleIcon, XMarkIcon, ChartBarIcon } from '@heroicons/vue/24/outline'
import api from '@/api'
import { fmtMoney, fmtDate } from '@/utils/fmt'

const props = defineProps({
  customerId: { type: String, default: '' },
})

const { t } = useI18n()

const aging    = ref(null)
const asOfDate = ref('')
const open     = ref(false)

const BUCKETS = [
  { key: 'current',    label: 'erp.arAging.bucketCurrent', cls: 'text-[#637381]' },
  { key: 'days1_30',   label: 'erp.arAging.bucket1_30',    cls: 'text-amber-600' },
  { key: 'days31_60',  label: 'erp.arAging.bucket31_60',   cls: 'text-orange-600' },
  { key: 'days61_90',  label: 'erp.arAging.bucket61_90',   cls: 'text-red-500' },
  { key: 'days91plus', label: 'erp.arAging.bucket91plus',  cls: 'text-red-700' },
]

const hasOutstanding = computed(() => !!aging.value && Number(aging.value.summary?.total) > 0)

function overdueBadge(bucket) {
  return {
    days1_30:   'bg-amber-50 text-amber-700',
    days31_60:  'bg-orange-50 text-orange-700',
    days61_90:  'bg-red-50 text-red-600',
    days91plus: 'bg-red-100 text-red-800',
  }[bucket] || 'bg-slate-100 text-slate-600'
}

async function load(customerId) {
  aging.value = null
  open.value = false
  if (!customerId) return
  try {
    const { data } = await api.get(`/erp/sale-orders/customers/${customerId}/ar-aging`)
    const report = data.data.report
    asOfDate.value = report.asOfDate
    const entry = report.customers.find(c => c.customer?.id === customerId) || report.customers[0] || null
    aging.value = entry
    // The breakdown opens only when the notify icon is clicked.
  } catch {
    // No AR access or request failed — show nothing.
    aging.value = null
  }
}

watch(() => props.customerId, (id) => load(id), { immediate: true })
</script>
