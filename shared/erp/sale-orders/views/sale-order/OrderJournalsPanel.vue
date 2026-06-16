<template>
  <div>
    <!-- No saved order yet (create page, before first draft save) -->
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

    <!-- Posted journal entries -->
    <div v-else-if="journals.length" class="divide-y divide-[#E2E8F0]">
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
        <JournalLinesTable :lines="j.lines" :total-debit="totalDebit(j)" :total-credit="totalCredit(j)" />
      </div>
    </div>

    <!-- Projected preview: saved order, nothing posted to the GL yet -->
    <div v-else-if="preview" class="px-5 py-4">
      <div class="flex items-start gap-2 mb-3 px-3 py-2.5 bg-amber-50 border border-amber-200 text-[12px] text-amber-800 leading-snug">
        <InformationCircleIcon class="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
        <span>{{ t('erp.orders.journalsPreviewHint') }}</span>
      </div>
      <div class="border border-dashed border-[#CBD5E1]">
        <div class="flex items-center justify-between gap-3 px-3 py-2 bg-[#F7F9FC] border-b border-[#E2E8F0]">
          <span class="inline-flex items-center gap-2 text-[12px] font-semibold text-[#637381]">
            <span class="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wide">{{ t('erp.orders.journalsPreviewBadge') }}</span>
            {{ t('erp.orders.journalsPreviewTitle') }}
          </span>
          <span class="text-[12px] text-[#637381] tabular-nums">{{ fmtDate(preview.date) }}</span>
        </div>
        <JournalLinesTable :lines="preview.lines" :total-debit="totalDebit(preview)" :total-credit="totalCredit(preview)" framed />
      </div>
    </div>

    <!-- Posted, but nothing related to this order -->
    <EmptyState v-else :icon="BookOpenIcon"
      :title="t('erp.orders.journalsNone')"
      :subtitle="t('erp.orders.journalsNoneHint')" />
  </div>
</template>

<script setup>
import { ref, watch, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { BookOpenIcon, InformationCircleIcon } from '@heroicons/vue/24/outline'
import EmptyState from '@/components/form/EmptyState.vue'
import ErrorBanner from '@/components/form/ErrorBanner.vue'
import api from '@/api'
import { fmtMoney, fmtDate } from '@/utils/fmt'
import { parseApiError } from '@/utils/apiError'

const { t } = useI18n()

const props = defineProps({
  // Null/empty on the create page until the first draft is saved.
  orderId: { type: String, default: '' },
  // Parent flips this true when the Journals tab is first shown so we only
  // fetch once it's actually needed.
  active:  { type: Boolean, default: false },
})

const journals = ref([])
const preview  = ref(null)
const loading  = ref(false)
const error    = ref('')

async function load() {
  if (!props.orderId) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get(`/erp/sale-orders/${props.orderId}/journals`)
    journals.value = data.data?.journals || []
    preview.value  = data.data?.preview  || null
  } catch (err) {
    error.value = parseApiError(err, 'Failed to load journal entries')
  } finally {
    loading.value = false
  }
}

// Lazy-load whenever the tab becomes active (and a saved order exists), so the
// preview reflects the latest saved totals — e.g. after re-saving a draft.
watch(
  () => [props.active, props.orderId],
  () => { if (props.active && props.orderId) load() },
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

// Small functional component for the debit/credit lines table, shared by the
// posted entries and the preview. `framed` drops the outer border so it can
// sit inside the dashed preview frame.
const cell = 'grid grid-cols-[1fr_7rem_7rem] gap-3 px-3 py-2'
const head = (text, right = false) =>
  h('div', { class: `text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider${right ? ' text-right' : ''}` }, text)
const JournalLinesTable = (p) => {
  const rows = (p.lines || []).map((l, i) =>
    h('div', { key: i, class: `${cell} border-b border-[#E2E8F0] last:border-b-0` }, [
      h('div', { class: 'text-[13px] text-[#1C2434] truncate' }, [
        l.account?.code ? h('span', { class: 'text-[#9BA7B0] tabular-nums' }, l.account.code) : null,
        h('span', { class: l.account?.code ? 'ml-1.5' : '' }, l.account ? l.account.name : (l.description || '—')),
      ]),
      h('div', { class: 'text-[13px] text-[#1C2434] tabular-nums text-right' }, Number(l.debit)  ? fmtMoney(l.debit)  : ''),
      h('div', { class: 'text-[13px] text-[#1C2434] tabular-nums text-right' }, Number(l.credit) ? fmtMoney(l.credit) : ''),
    ]),
  )
  return h('div', { class: p.framed ? '' : 'border border-[#E2E8F0]' }, [
    h('div', { class: `${cell} bg-[#F7F9FC] border-b border-[#E2E8F0]` }, [
      head(t('erp.orders.journalAccount')),
      head(t('erp.orders.journalDebit'), true),
      head(t('erp.orders.journalCredit'), true),
    ]),
    ...rows,
    h('div', { class: `${cell} bg-[#F7F9FC] border-t border-[#E2E8F0]` }, [
      h('div'),
      h('div', { class: 'text-[13px] font-bold text-[#1C2434] tabular-nums text-right' }, fmtMoney(p.totalDebit)),
      h('div', { class: 'text-[13px] font-bold text-[#1C2434] tabular-nums text-right' }, fmtMoney(p.totalCredit)),
    ]),
  ])
}
</script>
