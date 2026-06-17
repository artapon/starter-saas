<template>
  <div class="relative">
    <!-- Visible field: always shows the date in the configured format + calendar
         system (BE/CE). Typing is accepted in that same format. -->
    <input
      ref="textEl"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      v-bind="$attrs"
      :value="displayText"
      :placeholder="placeholderText"
      :style="{ paddingRight: '2.25rem' }"
      @change="onTextChange"
      @keydown.enter="onTextChange"
    />

    <!-- Calendar button — opens the browser's native picker (kept in real
         Gregorian/ISO since native date controls can't render BE years). -->
    <button
      type="button"
      tabindex="-1"
      class="absolute inset-y-0 right-0 flex items-center px-2.5 text-[#9BA7B0] hover:text-primary-600 transition-colors"
      @mousedown.prevent
      @click="openPicker"
    >
      <CalendarDaysIcon class="w-4 h-4" />
    </button>

    <!-- Hidden native date input drives the picker. Visually hidden (not
         display:none) so showPicker() works. Always holds the CE/ISO value. -->
    <input
      ref="nativeEl"
      type="date"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      :value="modelValue || ''"
      @change="onNativeChange"
    />
  </div>
</template>

<script>
// Let the fallthrough class/attrs land on the visible text input, not the wrapper.
export default { inheritAttrs: false }
</script>

<script setup>
import { ref, computed } from 'vue'
import { CalendarDaysIcon } from '@heroicons/vue/24/outline'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit  = defineEmits(['update:modelValue', 'change'])

const textEl   = ref(null)
const nativeEl = ref(null)
const settings = useSettingsStore()

defineExpose({ focus: () => textEl.value?.focus() })

const BE_OFFSET = 543

const isBE       = computed(() => settings.calendar?.system === 'BE')
const dateFormat = computed(() => settings.calendar?.dateFormat || 'dd/mm/yyyy')
const placeholderText = computed(() => dateFormat.value)

// Formatted text for the visible field, honoring the calendar system + format.
const displayText = computed(() => {
  if (!props.modelValue) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(props.modelValue)
  if (!m) return props.modelValue
  const year = isBE.value ? Number(m[1]) + BE_OFFSET : Number(m[1])
  return dateFormat.value
    .replace('dd',   m[3])
    .replace('mm',   m[2])
    .replace('yyyy', String(year))
})

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Parse a value typed in the configured format (+ BE offset) back to a CE
// "yyyy-mm-dd" string. Returns '' for empty, null for unparseable/invalid.
function parseTyped(text) {
  const s = (text || '').trim()
  if (!s) return ''
  const order = []
  const reStr = '^' + escapeRe(dateFormat.value).replace(/dd|mm|yyyy/g, (tok) => {
    order.push(tok)
    return tok === 'yyyy' ? '(\\d{1,4})' : '(\\d{1,2})'
  }) + '$'
  const m = new RegExp(reStr).exec(s)
  if (!m) return null
  const v = {}
  order.forEach((tok, i) => { v[tok] = Number(m[i + 1]) })
  let year = v.yyyy
  const month = v.mm
  const day = v.dd
  if (isBE.value) year -= BE_OFFSET
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null
  // Reject impossible calendar dates (e.g. 31/02).
  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function emitValue(iso) {
  emit('update:modelValue', iso)
  emit('change', iso)
}

function onTextChange(e) {
  const raw = e.target.value
  if (!raw.trim()) {
    if (props.modelValue) emitValue('')
    e.target.value = ''
    return
  }
  const iso = parseTyped(raw)
  if (iso === null) {
    // Unparseable — snap back to the last valid display.
    e.target.value = displayText.value
    return
  }
  if (iso !== props.modelValue) emitValue(iso)
  else e.target.value = displayText.value  // reformat an equal-but-restyled entry
}

// Native picker always speaks CE/ISO, so emit its value as-is.
function onNativeChange(e) {
  emitValue(e.target.value || '')
}

function openPicker() {
  const el = nativeEl.value
  if (!el) return
  if (typeof el.showPicker === 'function') el.showPicker()
  else el.focus()
}
</script>
