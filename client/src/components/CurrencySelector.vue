<template>
  <div class="inline-flex items-center gap-2">
    <div class="w-28">
      <SearchSelect
        :model-value="modelValue || baseCode"
        :options="options"
        track-by="code"
        label-key="code"
        :allow-empty="false"
        :disabled="disabled"
        :placeholder="baseCode || '—'"
        @update:model-value="onChange"
      >
        <template #option="{ option }">
          <span class="font-mono font-semibold">{{ option.code }}</span>
          <span v-if="option.name" class="text-[#9BA7B0]"> · {{ option.name }}</span>
        </template>
        <template #singleLabel="{ option }">
          <span class="font-mono font-semibold">{{ option.code }}</span>
        </template>
      </SearchSelect>
    </div>
    <span v-if="showRate && rateNum !== 1 && baseCode" class="text-[11px] text-[#9BA7B0] tabular-nums whitespace-nowrap">
      @ {{ Number(rateNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) }} {{ baseCode }}
    </span>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useCurrencies } from '@/composables/useCurrencies'
import SearchSelect from '@/components/SearchSelect.vue'

const props = defineProps({
  modelValue:   { type: String, default: '' },
  exchangeRate: { type: [Number, String], default: 1 },
  asOfDate:     { type: String, default: '' },
  showRate:     { type: Boolean, default: true },
  disabled:     { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'update:exchangeRate'])

const { currencies, load, baseCurrency, activeCurrencies, getRateOn } = useCurrencies()

const baseCode = computed(() => baseCurrency()?.code || '')
const options  = computed(() => activeCurrencies())
const rateNum  = computed(() => Number(props.exchangeRate) || 1)

onMounted(load)

async function refreshRate(code) {
  const rate = await getRateOn(code, props.asOfDate)
  emit('update:exchangeRate', rate)
}

async function onChange(code) {
  emit('update:modelValue', code || '')
  await refreshRate(code)
}

watch(() => props.asOfDate, async (d) => {
  if (!d) return
  if (!props.modelValue || props.modelValue === baseCode.value) return
  await refreshRate(props.modelValue)
})
</script>
