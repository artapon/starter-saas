<template>
  <div>
    <FieldLabel v-if="label" :text="label" :class="labelClass" />
    <div class="text-[13px] text-[#1C2434] font-medium py-2.5 min-h-[2.5rem]
                whitespace-pre-line break-words leading-relaxed">
      <slot>{{ display }}</slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import FieldLabel from './FieldLabel.vue'

// Read-only counterpart to a form field: renders the label above a static value
// (em dash when empty) so a disabled form reads as a clean label/value layout
// instead of greyed-out inputs.
const props = defineProps({
  label:      { type: String, default: '' },
  value:      { type: [String, Number], default: '' },
  labelClass: { type: String, default: '' },
})

const display = computed(() => {
  const v = props.value
  return (v === '' || v == null) ? '—' : v
})
</script>
