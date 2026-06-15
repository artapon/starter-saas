<template>
  <div ref="root" class="w-full">
    <!-- Trigger: shows the current line discount, opens the editor on click -->
    <button ref="trigger" type="button" @click="toggle"
      class="w-full px-2 py-2 border text-[13px] text-right tabular-nums transition-all
             focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
      :class="[
        open ? 'border-primary-400 ring-2 ring-primary-500/20' : 'border-[#E2E8F0]',
        hasDiscount ? 'text-[#1C2434] font-medium' : 'text-[#CBD5E1]',
      ]">
      {{ triggerLabel }}
    </button>

    <!-- Popover (teleported so the card's overflow:hidden can't clip it) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
        <div v-if="open" ref="panel" :style="panelStyle"
          class="fixed z-[9999] w-56 bg-white border border-[#E2E8F0] shadow-xl p-3 origin-top">
          <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider mb-2">{{ title }}</div>

          <!-- Type toggle: Discount % | Amount -->
          <div class="grid grid-cols-2 gap-1 mb-2.5 p-0.5 bg-[#F1F5F9]">
            <button type="button" @click="setType('percent')"
              class="px-2 py-1.5 text-[12px] font-semibold transition-colors"
              :class="localType === 'percent' ? 'bg-white text-primary-700 shadow-sm' : 'text-[#637381] hover:text-[#1C2434]'">
              {{ percentLabel }}
            </button>
            <button type="button" @click="setType('fixed')"
              class="px-2 py-1.5 text-[12px] font-semibold transition-colors"
              :class="localType === 'fixed' ? 'bg-white text-primary-700 shadow-sm' : 'text-[#637381] hover:text-[#1C2434]'">
              {{ amountLabel }}
            </button>
          </div>

          <!-- Value input with the active unit as a suffix -->
          <div class="flex items-center border border-[#E2E8F0] focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-400">
            <input ref="valueInput" v-model.number="localValue" type="number" min="0" step="0.01"
              :max="localType === 'percent' ? 100 : undefined" placeholder="0"
              @keydown.enter.prevent="close" @keydown.escape.prevent="close"
              class="flex-1 w-full px-2 py-1.5 text-[13px] text-right tabular-nums text-[#1C2434]
                     focus:outline-none placeholder:text-[#CBD5E1]" />
            <span class="px-2 text-[12px] font-semibold text-[#9BA7B0] select-none">
              {{ localType === 'percent' ? '%' : currency }}
            </span>
          </div>

          <!-- Resolved discount preview + clear -->
          <div class="flex items-center justify-between mt-2.5">
            <button type="button" @click="clear"
              class="text-[11px] font-medium text-[#9BA7B0] hover:text-red-600 transition-colors">
              {{ clearLabel }}
            </button>
            <span class="text-[11px] text-[#637381] tabular-nums">−{{ fmtMoney(resolvedAmount) }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted } from 'vue'
import { fmtMoney, toFixed } from '@/utils/fmt'

const props = defineProps({
  // 'percent' | 'fixed'
  type:     { type: String, default: 'percent' },
  value:    { type: [Number, String], default: 0 },
  // Line gross (qty × unitPrice) — used to preview/cap a fixed discount.
  base:     { type: [Number, String], default: 0 },
  currency: { type: String, default: '฿' },
  title:        { type: String, default: 'Line discount' },
  percentLabel: { type: String, default: 'Discount %' },
  amountLabel:  { type: String, default: 'Amount' },
  clearLabel:   { type: String, default: 'Clear' },
})
const emit = defineEmits(['update:type', 'update:value'])

const open = ref(false)
const root = ref(null)
const trigger = ref(null)
const panel = ref(null)
const valueInput = ref(null)
const panelStyle = ref({})

const localType = computed({
  get: () => (props.type === 'fixed' ? 'fixed' : 'percent'),
  set: (v) => emit('update:type', v === 'fixed' ? 'fixed' : 'percent'),
})
const localValue = computed({
  get: () => Number(props.value) || 0,
  set: (v) => emit('update:value', Number(v) || 0),
})

const hasDiscount = computed(() => localValue.value > 0)

const resolvedAmount = computed(() => {
  const base = Number(props.base) || 0
  const v = localValue.value
  if (!v) return 0
  return localType.value === 'fixed'
    ? toFixed(Math.min(v, base), 2)
    : toFixed(base * v / 100, 2)
})

const triggerLabel = computed(() => {
  if (!hasDiscount.value) return '—'
  return localType.value === 'fixed'
    ? `${localValue.value} ${props.currency}`
    : `${localValue.value}%`
})

function setType(next) {
  if (localType.value === next) return
  localType.value = next
  nextTick(() => valueInput.value?.focus())
}

function clear() {
  localValue.value = 0
  close()
}

// Anchor the fixed-position panel to the trigger, right-aligned, flipping above
// when there isn't room below.
function positionPanel() {
  const el = trigger.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const PANEL_W = 224 // w-56
  const PANEL_H = 168 // approximate
  const left = Math.max(8, Math.min(r.right - PANEL_W, window.innerWidth - PANEL_W - 8))
  const below = r.bottom + 4
  const openUp = below + PANEL_H > window.innerHeight && r.top - PANEL_H - 4 > 0
  panelStyle.value = {
    left: `${left}px`,
    top: openUp ? `${r.top - PANEL_H - 4}px` : `${below}px`,
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    positionPanel()
    nextTick(() => valueInput.value?.focus())
  }
}

function close() {
  open.value = false
}

function onDocMouseDown(e) {
  if (!open.value) return
  if (root.value?.contains(e.target)) return
  if (panel.value?.contains(e.target)) return
  close()
}
function onReposition() {
  if (open.value) positionPanel()
}
if (typeof document !== 'undefined') {
  document.addEventListener('mousedown', onDocMouseDown)
  window.addEventListener('scroll', onReposition, true)
  window.addEventListener('resize', onReposition)
}
onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('mousedown', onDocMouseDown)
    window.removeEventListener('scroll', onReposition, true)
    window.removeEventListener('resize', onReposition)
  }
})
</script>
