<template>
  <AppLayout>
    <div class="space-y-6">

      <!-- Heading -->
      <div>
        <h1 class="text-xl font-semibold text-[#1C2434]">{{ t('erp.settings.generalTitle') }}</h1>
        <p class="text-sm text-[#637381] mt-0.5">{{ t('erp.settings.generalDesc') }}</p>
      </div>

      <!-- Tab bar -->
      <div class="flex border-b border-[#E2E8F0]">
        <button v-for="tab in TABS" :key="tab.key" @click="activeTab = tab.key"
          class="relative px-5 py-3 text-sm font-medium transition-colors"
          :class="activeTab === tab.key
            ? 'text-primary-600'
            : 'text-[#637381] hover:text-[#1C2434]'">
          {{ tab.label }}
          <span v-if="activeTab === tab.key"
            class="absolute bottom-0 inset-x-0 h-0.5 bg-primary-500"></span>
        </button>
      </div>

      <!-- ── General tab ──────────────────────────────────────────────── -->
      <template v-if="activeTab === 'general'">

        <div class="bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-[#E2E8F0]">
            <h2 class="text-sm font-semibold text-[#374151]">{{ t('erp.settings.generalSection') }}</h2>
            <p class="text-xs text-[#9BA7B0] mt-0.5">{{ t('erp.settings.generalSectionDesc') }}</p>
          </div>

          <div class="px-6 py-5">
            <div class="max-w-sm">
              <label class="block text-xs font-semibold text-[#637381] uppercase tracking-wide mb-1.5">
                {{ t('erp.settings.sortOrderLabel') }}
              </label>
              <div class="flex border border-[#E2E8F0] overflow-hidden text-sm">
                <button type="button" @click="generalForm.sortOrder = 'DESC'"
                  :class="generalForm.sortOrder === 'DESC'
                    ? 'flex-1 py-2.5 bg-primary-500 text-white font-medium'
                    : 'flex-1 py-2.5 bg-white text-[#637381] hover:bg-[#F7F9FC]'">
                  DESC
                </button>
                <button type="button" @click="generalForm.sortOrder = 'ASC'"
                  :class="generalForm.sortOrder === 'ASC'
                    ? 'flex-1 py-2.5 bg-primary-500 text-white font-medium'
                    : 'flex-1 py-2.5 bg-white text-[#637381] hover:bg-[#F7F9FC]'">
                  ASC
                </button>
              </div>
              <p class="mt-1.5 text-xs text-[#9BA7B0]">
                {{ generalForm.sortOrder === 'DESC' ? t('erp.settings.sortOrderDesc') : t('erp.settings.sortOrderAsc') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Feedback + save -->
        <div v-if="generalError"
          class="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          <ExclamationCircleIcon class="w-4 h-4 flex-shrink-0" />
          {{ generalError }}
        </div>
        <div v-if="generalSaved"
          class="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
          <CheckCircleIcon class="w-4 h-4 flex-shrink-0" />
          {{ t('erp.settings.savedOk') }}
        </div>
        <div class="flex justify-end">
          <button @click="saveGeneral" :disabled="generalSaving"
            class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold
                   bg-primary-500 text-white hover:bg-primary-700
                   disabled:opacity-50 transition-colors shadow-sm">
            <CheckIcon v-if="!generalSaving" class="w-4 h-4" />
            {{ generalSaving ? t('erp.common.saving') : t('erp.settings.saveSettings') }}
          </button>
        </div>

      </template>

      <!-- ── Currency tab ─────────────────────────────────────────────── -->
      <template v-if="activeTab === 'currency'">

        <div class="bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-[#E2E8F0]">
            <h2 class="text-sm font-semibold text-[#374151]">{{ t('erp.settings.currency') }}</h2>
            <p class="text-xs text-[#9BA7B0] mt-0.5">{{ t('erp.settings.currencyDesc') }}</p>
          </div>

          <div class="px-6 py-5 space-y-5">

            <!-- Live Preview -->
            <div class="bg-[#F7F9FC] border border-[#E2E8F0] px-5 py-4 flex items-center justify-between">
              <span class="text-xs font-semibold text-[#9BA7B0] uppercase tracking-wide">{{ t('erp.settings.preview') }}</span>
              <div class="text-right space-y-0.5">
                <div class="text-2xl font-bold text-[#1C2434] tabular-nums font-mono">{{ previewLarge }}</div>
                <div class="text-sm text-[#637381] tabular-nums font-mono">{{ previewSmall }}</div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-5">

              <!-- Symbol -->
              <div>
                <label class="block text-xs font-semibold text-[#637381] uppercase tracking-wide mb-1.5">
                  {{ t('erp.settings.symbol') }}
                </label>
                <input v-model="currencyForm.symbol" type="text" maxlength="5" placeholder="e.g. ฿ or $"
                  class="input w-full" />
              </div>

              <!-- Position -->
              <div>
                <label class="block text-xs font-semibold text-[#637381] uppercase tracking-wide mb-1.5">
                  {{ t('erp.settings.symbolPosition') }}
                </label>
                <div class="flex border border-[#E2E8F0] overflow-hidden text-sm">
                  <button type="button" @click="currencyForm.position = 'prefix'"
                    :class="currencyForm.position === 'prefix'
                      ? 'flex-1 py-2 bg-primary-500 text-white font-medium'
                      : 'flex-1 py-2 bg-white text-[#637381] hover:bg-[#F7F9FC]'">
                    {{ t('erp.settings.prefix') }} &nbsp;<span class="font-mono opacity-70">$1,234</span>
                  </button>
                  <button type="button" @click="currencyForm.position = 'suffix'"
                    :class="currencyForm.position === 'suffix'
                      ? 'flex-1 py-2 bg-primary-500 text-white font-medium'
                      : 'flex-1 py-2 bg-white text-[#637381] hover:bg-[#F7F9FC]'">
                    {{ t('erp.settings.suffix') }} &nbsp;<span class="font-mono opacity-70">1,234 ฿</span>
                  </button>
                </div>
              </div>

              <!-- Thousand Separator -->
              <div>
                <label class="block text-xs font-semibold text-[#637381] uppercase tracking-wide mb-1.5">
                  {{ t('erp.settings.thousandSep') }}
                </label>
                <SearchSelect v-model="currencyForm.thousandSep" :options="thousandSepOptions" :allow-empty="false" />
              </div>

              <!-- Decimal Separator -->
              <div>
                <label class="block text-xs font-semibold text-[#637381] uppercase tracking-wide mb-1.5">
                  {{ t('erp.settings.decimalSep') }}
                </label>
                <SearchSelect v-model="currencyForm.decimalSep" :options="decimalSepOptions" :allow-empty="false" />
              </div>

              <!-- Decimal Places -->
              <div>
                <label class="block text-xs font-semibold text-[#637381] uppercase tracking-wide mb-1.5">
                  {{ t('erp.settings.decimalPlaces') }}
                </label>
                <SearchSelect v-model="currencyForm.precision" :options="precisionOptions" :allow-empty="false" />
              </div>

            </div>
          </div>
        </div>

        <!-- Feedback + save -->
        <div v-if="currencyError"
          class="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          <ExclamationCircleIcon class="w-4 h-4 flex-shrink-0" />
          {{ currencyError }}
        </div>
        <div v-if="currencySaved"
          class="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
          <CheckCircleIcon class="w-4 h-4 flex-shrink-0" />
          {{ t('erp.settings.savedOk') }}
        </div>
        <div class="flex justify-end">
          <button @click="saveCurrency" :disabled="currencySaving"
            class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold
                   bg-primary-500 text-white hover:bg-primary-700
                   disabled:opacity-50 transition-colors shadow-sm">
            <CheckIcon v-if="!currencySaving" class="w-4 h-4" />
            {{ currencySaving ? t('erp.common.saving') : t('erp.settings.saveSettings') }}
          </button>
        </div>

      </template>

      <!-- ── Date & Calendar tab ────────────────────────────────────────── -->
      <template v-if="activeTab === 'date'">

        <div class="bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">

          <!-- Calendar system -->
          <div class="px-6 py-4 border-b border-[#E2E8F0]">
            <h2 class="text-sm font-semibold text-[#374151]">{{ t('erp.settings.calendarSystem') }}</h2>
            <p class="text-xs text-[#9BA7B0] mt-0.5">{{ t('erp.settings.calendarSystemDesc') }}</p>
          </div>

          <div class="px-6 py-5 space-y-3">

            <!-- CE option -->
            <label
              class="flex items-start gap-4 p-4 border-2 cursor-pointer transition-colors"
              :class="calendarForm.system === 'CE'
                ? 'border-primary-500 bg-primary-50'
                : 'border-[#E2E8F0] hover:border-[#CBD5E1]'">
              <input type="radio" name="calendarSystem" value="CE" v-model="calendarForm.system"
                class="mt-0.5 accent-primary-500 flex-shrink-0" />
              <div>
                <p class="text-sm font-semibold text-[#1C2434]">{{ t('erp.settings.calendarCE') }}</p>
                <p class="text-xs text-[#637381] mt-0.5">{{ t('erp.settings.calendarCEDesc') }}</p>
                <p class="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-xs font-mono text-[#374151]">
                  {{ previewDateFor('CE') }}
                </p>
              </div>
            </label>

            <!-- BE option -->
            <label
              class="flex items-start gap-4 p-4 border-2 cursor-pointer transition-colors"
              :class="calendarForm.system === 'BE'
                ? 'border-primary-500 bg-primary-50'
                : 'border-[#E2E8F0] hover:border-[#CBD5E1]'">
              <input type="radio" name="calendarSystem" value="BE" v-model="calendarForm.system"
                class="mt-0.5 accent-primary-500 flex-shrink-0" />
              <div>
                <p class="text-sm font-semibold text-[#1C2434]">{{ t('erp.settings.calendarBE') }}</p>
                <p class="text-xs text-[#637381] mt-0.5">{{ t('erp.settings.calendarBEDesc') }}</p>
                <p class="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-xs font-mono text-[#374151]">
                  {{ previewDateFor('BE') }}
                </p>
              </div>
            </label>

          </div>

          <!-- Date format -->
          <div class="px-6 py-5 border-t border-[#E2E8F0] space-y-3">
            <div>
              <h3 class="text-sm font-semibold text-[#374151]">{{ t('erp.settings.dateFormat') }}</h3>
              <p class="text-xs text-[#9BA7B0] mt-0.5">{{ t('erp.settings.dateFormatDesc') }}</p>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <label v-for="opt in DATE_FORMAT_OPTIONS" :key="opt"
                class="flex items-center gap-3 p-3 border-2 cursor-pointer transition-colors"
                :class="calendarForm.dateFormat === opt
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-[#E2E8F0] hover:border-[#CBD5E1]'">
                <input type="radio" name="dateFormat" :value="opt" v-model="calendarForm.dateFormat"
                  class="accent-primary-500 flex-shrink-0" />
                <div>
                  <p class="text-xs font-semibold text-[#374151] font-mono">{{ opt }}</p>
                  <p class="text-xs text-[#9BA7B0] font-mono">{{ previewFmt(opt) }}</p>
                </div>
              </label>
            </div>
          </div>

        </div>

        <!-- Feedback + save -->
        <div v-if="calendarError"
          class="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          <ExclamationCircleIcon class="w-4 h-4 flex-shrink-0" />
          {{ calendarError }}
        </div>
        <div v-if="calendarSaved"
          class="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
          <CheckCircleIcon class="w-4 h-4 flex-shrink-0" />
          {{ t('erp.settings.savedOk') }}
        </div>
        <div class="flex justify-end">
          <button @click="saveCalendar" :disabled="calendarSaving"
            class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold
                   bg-primary-500 text-white hover:bg-primary-700
                   disabled:opacity-50 transition-colors shadow-sm">
            <CheckIcon v-if="!calendarSaving" class="w-4 h-4" />
            {{ calendarSaving ? t('erp.common.saving') : t('erp.settings.saveSettings') }}
          </button>
        </div>

      </template>

      <!-- ── Tax tab ──────────────────────────────────────────────────── -->
      <template v-if="activeTab === 'tax'">

        <div class="bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-[#E2E8F0]">
            <h2 class="text-sm font-semibold text-[#374151]">{{ t('erp.settings.tax') }}</h2>
            <p class="text-xs text-[#9BA7B0] mt-0.5">{{ t('erp.settings.taxDesc') }}</p>
          </div>

          <div class="px-6 py-5 space-y-5">

            <!-- Tax Rate -->
            <div class="max-w-xs">
              <label class="block text-xs font-semibold text-[#637381] uppercase tracking-wide mb-1.5">
                {{ t('erp.settings.taxRate') }}
              </label>
              <div class="relative">
                <input v-model.number="taxForm.rate" type="number" min="0" max="100" step="0.01"
                  class="input w-full pr-8" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#9BA7B0] pointer-events-none">%</span>
              </div>
            </div>

            <!-- Tax Method -->
            <div>
              <label class="block text-xs font-semibold text-[#637381] uppercase tracking-wide mb-1.5">
                {{ t('erp.settings.taxMethod') }}
              </label>
              <div class="flex border border-[#E2E8F0] overflow-hidden text-sm">
                <button type="button" @click="taxForm.inclusive = false"
                  :class="!taxForm.inclusive
                    ? 'flex-1 py-2.5 bg-primary-500 text-white font-medium'
                    : 'flex-1 py-2.5 bg-white text-[#637381] hover:bg-[#F7F9FC]'">
                  {{ t('erp.settings.taxExclusive') }}
                </button>
                <button type="button" @click="taxForm.inclusive = true"
                  :class="taxForm.inclusive
                    ? 'flex-1 py-2.5 bg-primary-500 text-white font-medium'
                    : 'flex-1 py-2.5 bg-white text-[#637381] hover:bg-[#F7F9FC]'">
                  {{ t('erp.settings.taxInclusive') }}
                </button>
              </div>
              <p class="mt-1.5 text-xs text-[#9BA7B0]">
                {{ taxForm.inclusive ? t('erp.settings.taxInclusiveDesc') : t('erp.settings.taxExclusiveDesc') }}
              </p>
            </div>

            <!-- Withholding tax (WHT) -->
            <div class="pt-5 border-t border-[#E2E8F0]">
              <label class="flex items-start gap-4 p-4 border-2 cursor-pointer transition-colors"
                :class="taxForm.withholding
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-[#E2E8F0] hover:border-[#CBD5E1]'">
                <input type="checkbox" v-model="taxForm.withholding"
                  class="mt-0.5 accent-primary-500 flex-shrink-0 w-4 h-4" />
                <div>
                  <p class="text-sm font-semibold text-[#1C2434]">{{ t('erp.settings.wht') }}</p>
                  <p class="text-xs text-[#637381] mt-0.5">{{ t('erp.settings.whtDesc') }}</p>
                </div>
              </label>
            </div>

          </div>
        </div>

        <!-- Feedback + save -->
        <div v-if="taxError"
          class="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          <ExclamationCircleIcon class="w-4 h-4 flex-shrink-0" />
          {{ taxError }}
        </div>
        <div v-if="taxSaved"
          class="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
          <CheckCircleIcon class="w-4 h-4 flex-shrink-0" />
          {{ t('erp.settings.savedOk') }}
        </div>
        <div class="flex justify-end">
          <button @click="saveTax" :disabled="taxSaving"
            class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold
                   bg-primary-500 text-white hover:bg-primary-700
                   disabled:opacity-50 transition-colors shadow-sm">
            <CheckIcon v-if="!taxSaving" class="w-4 h-4" />
            {{ taxSaving ? t('erp.common.saving') : t('erp.settings.saveSettings') }}
          </button>
        </div>

      </template>

      <!-- ── Audit Log tab ────────────────────────────────────────────── -->
      <template v-if="activeTab === 'auditlog'">

        <div class="bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-[#E2E8F0]">
            <h2 class="text-sm font-semibold text-[#374151]">{{ t('erp.settings.auditLog') }}</h2>
            <p class="text-xs text-[#9BA7B0] mt-0.5">{{ t('erp.settings.auditLogDesc') }}</p>
          </div>

          <div class="px-6 py-5">
            <!-- Debug toggle -->
            <label class="flex items-start gap-4 p-4 border-2 cursor-pointer transition-colors"
              :class="auditForm.debug
                ? 'border-primary-500 bg-primary-50'
                : 'border-[#E2E8F0] hover:border-[#CBD5E1]'">
              <input type="checkbox" v-model="auditForm.debug"
                class="mt-0.5 accent-primary-500 flex-shrink-0 w-4 h-4" />
              <div>
                <p class="text-sm font-semibold text-[#1C2434]">{{ t('erp.settings.auditDebug') }}</p>
                <p class="text-xs text-[#637381] mt-0.5">{{ t('erp.settings.auditDebugDesc') }}</p>
              </div>
            </label>
          </div>
        </div>

        <!-- Feedback + save -->
        <div v-if="auditError"
          class="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          <ExclamationCircleIcon class="w-4 h-4 flex-shrink-0" />
          {{ auditError }}
        </div>
        <div v-if="auditSaved"
          class="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
          <CheckCircleIcon class="w-4 h-4 flex-shrink-0" />
          {{ t('erp.settings.savedOk') }}
        </div>
        <div class="flex justify-end">
          <button @click="saveAudit" :disabled="auditSaving"
            class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold
                   bg-primary-500 text-white hover:bg-primary-700
                   disabled:opacity-50 transition-colors shadow-sm">
            <CheckIcon v-if="!auditSaving" class="w-4 h-4" />
            {{ auditSaving ? t('erp.common.saving') : t('erp.settings.saveSettings') }}
          </button>
        </div>

      </template>

      <!-- ── Sale Orders tab ──────────────────────────────────────────── -->
      <template v-if="activeTab === 'saleOrders'">

        <div class="bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-[#E2E8F0]">
            <h2 class="text-sm font-semibold text-[#374151]">{{ t('erp.settings.saleOrders') }}</h2>
            <p class="text-xs text-[#9BA7B0] mt-0.5">{{ t('erp.settings.saleOrdersDesc') }}</p>
          </div>

          <div class="px-6 py-5">
            <div class="max-w-sm">
              <label class="block text-xs font-semibold text-[#637381] uppercase tracking-wide mb-1.5">
                {{ t('erp.settings.defaultSaleType') }}
              </label>
              <div class="flex border border-[#E2E8F0] overflow-hidden text-sm">
                <button type="button" @click="saleOrdersForm.defaultSaleType = 'cash'"
                  :class="saleOrdersForm.defaultSaleType === 'cash'
                    ? 'flex-1 py-2.5 bg-primary-500 text-white font-medium'
                    : 'flex-1 py-2.5 bg-white text-[#637381] hover:bg-[#F7F9FC]'">
                  {{ t('erp.settings.saleTypeCash') }}
                </button>
                <button type="button" @click="saleOrdersForm.defaultSaleType = 'credit'"
                  :class="saleOrdersForm.defaultSaleType === 'credit'
                    ? 'flex-1 py-2.5 bg-primary-500 text-white font-medium'
                    : 'flex-1 py-2.5 bg-white text-[#637381] hover:bg-[#F7F9FC]'">
                  {{ t('erp.settings.saleTypeCredit') }}
                </button>
              </div>
              <p class="mt-1.5 text-xs text-[#9BA7B0]">
                {{ saleOrdersForm.defaultSaleType === 'cash' ? t('erp.settings.saleTypeCashDesc') : t('erp.settings.saleTypeCreditDesc') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Feedback + save -->
        <div v-if="saleOrdersError"
          class="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          <ExclamationCircleIcon class="w-4 h-4 flex-shrink-0" />
          {{ saleOrdersError }}
        </div>
        <div v-if="saleOrdersSaved"
          class="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
          <CheckCircleIcon class="w-4 h-4 flex-shrink-0" />
          {{ t('erp.settings.savedOk') }}
        </div>
        <div class="flex justify-end">
          <button @click="saveSaleOrders" :disabled="saleOrdersSaving"
            class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold
                   bg-primary-500 text-white hover:bg-primary-700
                   disabled:opacity-50 transition-colors shadow-sm">
            <CheckIcon v-if="!saleOrdersSaving" class="w-4 h-4" />
            {{ saleOrdersSaving ? t('erp.common.saving') : t('erp.settings.saveSettings') }}
          </button>
        </div>

      </template>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckIcon, ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/vue/24/outline'
import AppLayout from '@/layouts/AppLayout.vue'
import SearchSelect from '@/components/SearchSelect.vue'
import { useSettingsStore } from '@/stores/settings'
import * as accounting from 'accounting-js'

const { t } = useI18n()
const store = useSettingsStore()

// ── Tabs ──────────────────────────────────────────────────
const activeTab = ref('general')
const TABS = computed(() => [
  { key: 'general',  label: t('erp.settings.tabGeneral') },
  { key: 'currency', label: t('erp.settings.currency') },
  { key: 'tax',      label: t('erp.settings.tax') },
  { key: 'date',       label: t('erp.settings.tabDate') },
  { key: 'saleOrders', label: t('erp.settings.saleOrders') },
  { key: 'auditlog',   label: t('erp.settings.tabAuditLog') },
])

// ── General form ──────────────────────────────────────────
const generalForm = reactive({
  sortOrder: store.general.sortOrder,
})
const generalSaving = ref(false)
const generalSaved  = ref(false)
const generalError  = ref('')

async function saveGeneral() {
  generalError.value = ''
  generalSaved.value = false
  generalSaving.value = true
  try {
    await store.saveGeneral({ ...generalForm })
    generalSaved.value = true
    setTimeout(() => { generalSaved.value = false }, 3000)
  } catch (err) {
    generalError.value = err.response?.data?.message || 'Failed to save general settings'
  } finally {
    generalSaving.value = false
  }
}

// ── Options ───────────────────────────────────────────────
const thousandSepOptions = [
  { id: ',', name: ', (comma) — 1,000'  },
  { id: '.', name: '. (period) — 1.000' },
  { id: ' ', name: '  (space) — 1 000'  },
  { id: '',  name: 'None — 1000'        },
]
const decimalSepOptions = [
  { id: '.', name: '. (period) — 1,234.56' },
  { id: ',', name: ', (comma) — 1.234,56'  },
]
const precisionOptions = [
  { id: 0, name: '0 — 1,235'      },
  { id: 1, name: '1 — 1,234.5'    },
  { id: 2, name: '2 — 1,234.56'   },
  { id: 3, name: '3 — 1,234.567'  },
]

// ── Currency form ─────────────────────────────────────────
const currencyForm = reactive({
  symbol:      store.currency.symbol,
  position:    store.currency.position,
  thousandSep: store.currency.thousandSep,
  decimalSep:  store.currency.decimalSep,
  precision:   store.currency.precision,
})
const currencySaving = ref(false)
const currencySaved  = ref(false)
const currencyError  = ref('')

function formatPreview(value) {
  const symbol = currencyForm.symbol || ''
  const fmt    = currencyForm.position === 'prefix' ? '%s%v' : (symbol ? '%v %s' : '%v')
  return accounting.formatMoney(value, {
    symbol, format: fmt,
    thousand:  currencyForm.thousandSep,
    decimal:   currencyForm.decimalSep,
    precision: currencyForm.precision,
  })
}
const previewLarge = computed(() => formatPreview(1234567.89))
const previewSmall = computed(() => formatPreview(0.5))

async function saveCurrency() {
  currencyError.value = ''
  currencySaved.value = false
  currencySaving.value = true
  try {
    await store.saveCurrency({ ...currencyForm })
    currencySaved.value = true
    setTimeout(() => { currencySaved.value = false }, 3000)
  } catch (err) {
    currencyError.value = err.response?.data?.message || 'Failed to save currency settings'
  } finally {
    currencySaving.value = false
  }
}

// ── Tax form ──────────────────────────────────────────────
const taxForm = reactive({
  rate:        store.tax.rate,
  inclusive:   store.tax.inclusive,
  withholding: store.tax.withholding,
})
const taxSaving = ref(false)
const taxSaved  = ref(false)
const taxError  = ref('')

async function saveTax() {
  taxError.value = ''
  taxSaved.value = false
  taxSaving.value = true
  try {
    await store.saveTax({ ...taxForm })
    taxSaved.value = true
    setTimeout(() => { taxSaved.value = false }, 3000)
  } catch (err) {
    taxError.value = err.response?.data?.message || 'Failed to save tax settings'
  } finally {
    taxSaving.value = false
  }
}

// ── Calendar form ─────────────────────────────────────────
const DATE_FORMAT_OPTIONS = ['dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd', 'dd.mm.yyyy']

const calendarForm = reactive({
  system:     store.calendar.system,
  dateFormat: store.calendar.dateFormat || 'dd/mm/yyyy',
})

function previewFmt(fmt, system) {
  const now   = new Date()
  const yr    = (system ?? calendarForm.system) === 'BE' ? now.getFullYear() + 543 : now.getFullYear()
  const mm    = String(now.getMonth() + 1).padStart(2, '0')
  const dd    = String(now.getDate()).padStart(2, '0')
  return fmt
    .replace('dd',   dd)
    .replace('mm',   mm)
    .replace('yyyy', String(yr))
}

function previewDateFor(system) {
  return previewFmt(calendarForm.dateFormat || 'dd/mm/yyyy', system)
}

const calendarSaving = ref(false)
const calendarSaved  = ref(false)
const calendarError  = ref('')

async function saveCalendar() {
  calendarError.value = ''
  calendarSaved.value = false
  calendarSaving.value = true
  try {
    await store.saveCalendar({ ...calendarForm })
    calendarSaved.value = true
    setTimeout(() => { calendarSaved.value = false }, 3000)
  } catch (err) {
    calendarError.value = err.response?.data?.message || 'Failed to save calendar settings'
  } finally {
    calendarSaving.value = false
  }
}

// ── Audit Log form ────────────────────────────────────────
const auditForm = reactive({
  debug: store.audit.debug,
})
const auditSaving = ref(false)
const auditSaved  = ref(false)
const auditError  = ref('')

async function saveAudit() {
  auditError.value = ''
  auditSaved.value = false
  auditSaving.value = true
  try {
    await store.saveAudit({ ...auditForm })
    auditSaved.value = true
    setTimeout(() => { auditSaved.value = false }, 3000)
  } catch (err) {
    auditError.value = err.response?.data?.message || 'Failed to save audit log settings'
  } finally {
    auditSaving.value = false
  }
}

// ── Sale Orders form ──────────────────────────────────────
const saleOrdersForm = reactive({
  defaultSaleType: store.saleOrders.defaultSaleType,
})
const saleOrdersSaving = ref(false)
const saleOrdersSaved  = ref(false)
const saleOrdersError  = ref('')

async function saveSaleOrders() {
  saleOrdersError.value = ''
  saleOrdersSaved.value = false
  saleOrdersSaving.value = true
  try {
    await store.saveSaleOrders({ ...saleOrdersForm })
    saleOrdersSaved.value = true
    setTimeout(() => { saleOrdersSaved.value = false }, 3000)
  } catch (err) {
    saleOrdersError.value = err.response?.data?.message || 'Failed to save sale order settings'
  } finally {
    saleOrdersSaving.value = false
  }
}

// ── Load ──────────────────────────────────────────────────
onMounted(async () => {
  await store.load()
  Object.assign(generalForm, store.general)
  Object.assign(currencyForm, store.currency)
  Object.assign(taxForm, store.tax)
  Object.assign(calendarForm, {
    system:     store.calendar.system,
    dateFormat: store.calendar.dateFormat || 'dd/mm/yyyy',
  })
  Object.assign(auditForm, store.audit)
  Object.assign(saleOrdersForm, store.saleOrders)
})
</script>
