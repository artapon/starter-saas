<template>
  <div>
    <!-- No saved order yet (create page) -->
    <EmptyState v-if="!orderId" :icon="BookOpenIcon"
      :title="t('erp.orders.journals')"
      :subtitle="t('erp.orders.journalsCreateHint')" />

    <!-- Loading -->
    <div v-else-if="loading" class="flex items-center justify-center py-16">
      <div class="w-6 h-6 border-2 border-primary-500 border-t-transparent animate-spin"></div>
    </div>

    <!-- Load error -->
    <div v-else-if="error" class="px-5 py-4">
      <ErrorBanner :message="error" />
    </div>

    <!-- Posted, but nothing yet -->
    <EmptyState v-else-if="!journals.length" :icon="BookOpenIcon"
      :title="t('erp.orders.journalsNone')"
      :subtitle="t('erp.orders.journalsNoneHint')" />

    <!-- Journal entries -->
    <div v-else class="divide-y divide-[#E2E8F0]">
      <div v-for="j in journals" :key="j.id" class="px-5 py-4">
        <!-- Entry header -->
        <div class="flex items-center justify-between gap-3 mb-2.5">
          <div class="flex items-center gap-2 min-w-0">
            <RouterLink :to="`/erp/accounting/journals/${j.id}`"
              :title="t('erp.orders.viewJournal')"
              class="text-[13px] font-semibold text-primary-600 hover:text-primary-700">
              {{ j.refNo }}
            </RouterLink>
            <span class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide capitalize"
              :class="statusBadge(j.status)">{{ j.status }}</span>
            <span v-if="j.sourceLabel" class="text-[12px] text-[#9BA7B0] truncate">· {{ j.sourceLabel }}</span>
          </div>
          <span class="text-[12px] text-[#637381] tabular-nums flex-shrink-0">{{ fmtDate(j.date) }}</span>
        </div>

        <!-- Lines -->
        <div class="border border-[#E2E8F0]">
          <div class="grid grid-cols-[1fr_7rem_7rem] gap-3 px-3 py-2 bg-[#F7F9FC] border-b border-[#E2E8F0]">
            <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">{{ t('erp.orders.journalAccount') }}</div>
            <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider text-right">{{ t('erp.orders.journalDebit') }}</div>
            <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider text-right">{{ t('erp.orders.journalCredit') }}</div>
          </div>
          <div v-for="l in j.lines" :key="l.id"
            class="grid grid-cols-[1fr_7rem_7rem] gap-3 px-3 py-2 border-b border-[#E2E8F0] last:border-b-0">
            <div class="text-[13px] text-[#1C2434] truncate">
              <span v-if="l.account" class="text-[#9BA7B0] tabular-nums">{{ l.account.code }}</span>
              <span class="ml-1.5">{{ l.account ? l.account.name : (l.description || '—') }}</span>
            </div>
            <div class="text-[13px] text-[#1C2434] tabular-nums text-right">{{ Number(l.debit) ? fmtMoney(l.debit) : '' }}</div>
            <div class="text-[13px] text-[#1C2434] tabular-nums text-right">{{ Number(l.credit) ? fmtMoney(l.credit) : '' }}</div>
          </div>
          <!-- Totals -->
          <div class="grid grid-cols-[1fr_7rem_7rem] gap-3 px-3 py-2 bg-[#F7F9FC] border-t border-[#E2E8F0]">
            <div></div>
            <div class="text-[13px] font-bold text-[#1C2434] tabular-nums text-right">{{ fmtMoney(totalDebit(j)) }}</div>
            <div class="text-[13px] font-bold text-[#1C2434] tabular-nums text-right">{{ fmtMoney(totalCredit(j)) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { BookOpenIcon } from '@heroicons/vue/24/outline'
import EmptyState from '@/components/form/EmptyState.vue'
import ErrorBanner from '@/components/form/ErrorBanner.vue'
import api from '@/api'
import { fmtMoney, fmtDate } from '@/utils/fmt'
import { parseApiError } from '@/utils/apiError'

const { t } = useI18n()

const props = defineProps({
  // Null/empty on the create page (no order saved yet).
  orderId: { type: String, default: '' },
  // Parent flips this true when the Journals tab is first shown so we only
  // fetch once it's actually needed.
  active:  { type: Boolean, default: false },
})

const journals = ref([])
const loading  = ref(false)
const error    = ref('')
let loadedFor  = ''

async function load() {
  if (!props.orderId) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get(`/erp/sale-orders/${props.orderId}/journals`)
    journals.value = data.data?.journals || []
    loadedFor = props.orderId
  } catch (err) {
    error.value = parseApiError(err, 'Failed to load journal entries')
  } finally {
    loading.value = false
  }
}

// Lazy-load: fetch the first time the tab becomes active for a given order.
watch(
  () => [props.active, props.orderId],
  () => { if (props.active && props.orderId && loadedFor !== props.orderId) load() },
  { immediate: true },
)

const totalDebit  = (j) => (j.lines || []).reduce((s, l) => s + (Number(l.debit)  || 0), 0)
const totalCredit = (j) => (j.lines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0)

function statusBadge(status) {
  return {
    posted: 'bg-emerald-50 text-emerald-700',
    draft:  'bg-amber-50 text-amber-700',
    voided: 'bg-[#F1F5F9] text-[#9BA7B0] line-through',
  }[status] || 'bg-[#F1F5F9] text-[#637381]'
}
</script>
