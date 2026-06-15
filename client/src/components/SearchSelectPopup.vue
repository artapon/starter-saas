<template>
  <div>
    <!-- Default trigger — hidden when parent controls opening externally -->
    <button v-if="!hideTrigger" type="button" @click="openModal"
      class="w-full text-left px-2.5 py-2 border text-[13px] text-[#1C2434] bg-white
             focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
             transition-all flex items-center gap-2 min-h-[36px]"
      :class="invalid ? 'border-red-300 bg-red-50/50' : 'border-[#E2E8F0]'"
    >
      <span class="flex-1 truncate" :class="!selectedLabel && 'text-[#9BA7B0]'">
        {{ selectedLabel || placeholder || '— Select —' }}
      </span>
      <MagnifyingGlassIcon class="w-3.5 h-3.5 text-[#9BA7B0] flex-shrink-0" />
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-100"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div v-if="open" class="fixed inset-0 bg-black/50 z-[9998]" @click="close" />
      </Transition>

      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95"
      >
        <div v-if="open"
          class="fixed left-1/2 top-[12vh] -translate-x-1/2 w-full max-w-[640px] px-4 sm:px-0 z-[9999]"
        >
          <div class="bg-white shadow-2xl border border-[#E2E8F0] flex flex-col max-h-[70vh] overflow-hidden">
            <!-- Header / search -->
            <div class="px-4 py-3 border-b border-[#E2E8F0] flex items-center gap-2.5">
              <MagnifyingGlassIcon class="w-4 h-4 text-[#9BA7B0] flex-shrink-0" />
              <input
                ref="searchInput"
                v-model="search"
                type="text"
                :placeholder="searchPlaceholder || 'Search code or name…'"
                class="flex-1 text-[14px] text-[#1C2434] focus:outline-none placeholder:text-[#9BA7B0] bg-transparent"
                @keydown.escape.prevent="close"
                @keydown.enter.prevent="onEnter"
                @keydown.down.prevent="moveSel(1)"
                @keydown.up.prevent="moveSel(-1)"
                @keydown.left="onLeftRight('left', $event)"
                @keydown.right="onLeftRight('right', $event)"
              />
              <button type="button" class="p-1 text-[#9BA7B0] hover:text-[#1C2434] hover:bg-[#F7F9FC] transition-colors"
                @click="close" aria-label="Close">
                <XMarkIcon class="w-4 h-4" />
              </button>
            </div>

            <!-- Results -->
            <div ref="listEl" class="flex-1 overflow-y-auto scrollbar-thin">
              <div v-if="!flatOptionCount" class="px-4 py-10 text-center text-[13px] text-[#9BA7B0]">
                {{ noResult || 'No results' }}
              </div>
              <template v-else>
                <template v-for="(row, idx) in flat" :key="`${row.kind}-${row.key}`">
                  <div v-if="row.kind === 'group'"
                    class="px-4 py-2 text-[10.5px] font-bold tracking-wider uppercase text-[#9BA7B0]
                           bg-[#F7F9FC] border-y border-[#E2E8F0] select-none">
                    {{ row.label }}
                  </div>
                  <button v-else type="button"
                    :data-row-idx="idx"
                    @click="onRowClick(row.option)"
                    @mouseenter="selIdx = idx"
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-l-2"
                    :class="selIdx === idx
                      ? 'bg-primary-50 border-primary-500'
                      : 'border-transparent hover:bg-[#F7F9FC]'">
                    <!-- Multi: checkbox; Single: nothing here, check icon at end -->
                    <span v-if="multiple"
                      class="w-4 h-4 border flex items-center justify-center flex-shrink-0 transition-colors"
                      :class="isChecked(row.option)
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : 'border-[#CBD5E1] bg-white'">
                      <CheckIcon v-if="isChecked(row.option)" class="w-3 h-3" stroke-width="3" />
                    </span>
                    <span v-if="row.option[codeKey]"
                      class="font-mono text-[12px] text-[#637381] flex-shrink-0 min-w-[80px]">
                      {{ row.option[codeKey] }}
                    </span>
                    <span class="flex-1 text-[13px] text-[#1C2434] truncate">{{ row.option[labelKey] }}</span>
                    <span v-if="metaKey && row.option[metaKey]"
                      class="text-[12px] text-[#637381] tabular-nums flex-shrink-0 whitespace-nowrap">
                      {{ row.option[metaKey] }}
                    </span>
                    <CheckIcon v-if="!multiple && isSelectedSingle(row.option)"
                      class="w-4 h-4 text-primary-600 flex-shrink-0" />
                  </button>
                </template>
              </template>
            </div>

            <!-- Footer / hint -->
            <div v-if="flatOptionCount" class="px-4 py-2.5 border-t border-[#E2E8F0] bg-[#F7F9FC] flex items-center gap-3">
              <span class="text-[11px] text-[#9BA7B0] flex-1 truncate">
                <template v-if="multiple">
                  {{ checkedCount }} of {{ flatOptionCount }} selected
                </template>
                <template v-else>
                  {{ flatOptionCount }} result{{ flatOptionCount === 1 ? '' : 's' }}
                </template>
              </span>
              <span class="hidden sm:flex items-center gap-3 text-[11px] text-[#9BA7B0]">
                <span><kbd class="px-1.5 py-0.5 bg-white border border-[#E2E8F0] font-mono text-[10px]">↑↓</kbd></span>
                <template v-if="multiple">
                  <span class="flex items-center gap-1">
                    <kbd class="px-1.5 py-0.5 bg-white border border-[#E2E8F0] font-mono text-[10px]">←</kbd>
                    <span>uncheck</span>
                  </span>
                  <span class="flex items-center gap-1">
                    <kbd class="px-1.5 py-0.5 bg-white border border-[#E2E8F0] font-mono text-[10px]">→</kbd>
                    <span>check</span>
                  </span>
                  <span class="flex items-center gap-1">
                    <kbd class="px-1.5 py-0.5 bg-white border border-[#E2E8F0] font-mono text-[10px]">Enter</kbd>
                    <span>add</span>
                  </span>
                </template>
                <span v-else><kbd class="px-1.5 py-0.5 bg-white border border-[#E2E8F0] font-mono text-[10px]">Enter</kbd></span>
                <span><kbd class="px-1.5 py-0.5 bg-white border border-[#E2E8F0] font-mono text-[10px]">Esc</kbd></span>
              </span>
              <button v-if="multiple" type="button"
                @click="submitMulti"
                :disabled="!checkedCount"
                class="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold
                       bg-primary-500 text-white hover:bg-primary-600
                       disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors">
                <PlusIcon class="w-3.5 h-3.5" />
                {{ submitLabel || `Add ${checkedCount || 0} item${checkedCount === 1 ? '' : 's'}` }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import { MagnifyingGlassIcon, XMarkIcon, CheckIcon, PlusIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  modelValue:        { type: [String, Number, null], default: '' },
  options:           { type: Array, required: true },
  // For grouped options like SearchSelect: { label, items } with these keys
  groupValues:       { type: String, default: '' },
  groupLabel:        { type: String, default: '' },
  trackBy:           { type: String, default: 'id' },
  labelKey:          { type: String, default: 'name' },
  codeKey:           { type: String, default: 'code' },
  // Optional right-aligned secondary text per row (e.g. price · stock)
  metaKey:           { type: String, default: '' },
  placeholder:       { type: String, default: '' },
  searchPlaceholder: { type: String, default: '' },
  invalid:           { type: Boolean, default: false },
  noResult:          { type: String, default: '' },
  // Multi-select: rows render checkboxes; emit `submit` with chosen objects on Add.
  multiple:          { type: Boolean, default: false },
  submitLabel:       { type: String, default: '' },
  // Hide built-in trigger button; parent opens via exposed open()
  hideTrigger:       { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'change', 'submit'])

const open    = ref(false)
const search  = ref('')
const selIdx  = ref(-1)
const checked = ref(new Set())
const searchInput = ref(null)
const listEl  = ref(null)

// ── Flatten options into a single array of rows ────────────────────────
const groups = computed(() => {
  if (props.groupValues) {
    return props.options.map((g) => ({
      label: g?.[props.groupLabel] || '',
      items: g?.[props.groupValues] || [],
    }))
  }
  return [{ label: '', items: props.options || [] }]
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return groups.value
  return groups.value.map((g) => ({
    label: g.label,
    items: g.items.filter((o) => {
      const code = String(o?.[props.codeKey] ?? '').toLowerCase()
      const name = String(o?.[props.labelKey] ?? '').toLowerCase()
      return code.includes(q) || name.includes(q)
    }),
  })).filter((g) => g.items.length)
})

const flat = computed(() => {
  const rows = []
  let k = 0
  for (const g of filtered.value) {
    if (g.label) rows.push({ kind: 'group', label: g.label, key: `g${k++}` })
    for (const o of g.items) rows.push({ kind: 'option', option: o, key: String(o?.[props.trackBy] ?? `o${k++}`) })
  }
  return rows
})

const flatOptionCount = computed(() => flat.value.filter((r) => r.kind === 'option').length)
const checkedCount    = computed(() => checked.value.size)

const selectedObject = computed(() => {
  if (props.modelValue === '' || props.modelValue == null) return null
  for (const g of groups.value) {
    const hit = g.items.find((o) => String(o?.[props.trackBy]) === String(props.modelValue))
    if (hit) return hit
  }
  return null
})

const selectedLabel = computed(() => {
  const o = selectedObject.value
  if (!o) return ''
  const code = o[props.codeKey]
  const name = o[props.labelKey]
  return code ? `${code} · ${name}` : name
})

function isSelectedSingle(option) {
  return String(option?.[props.trackBy]) === String(props.modelValue)
}

function isChecked(option) {
  return checked.value.has(String(option?.[props.trackBy]))
}

function toggleChecked(option) {
  const id = String(option?.[props.trackBy])
  const next = new Set(checked.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  checked.value = next
}

function setChecked(option, value) {
  const id = String(option?.[props.trackBy])
  const next = new Set(checked.value)
  if (value) next.add(id)
  else       next.delete(id)
  checked.value = next
}

// Multi mode: ← unchecks the highlighted row, → checks it. In single mode
// the arrows are left alone so they still move the caret in the search field.
function onLeftRight(direction, e) {
  if (!props.multiple || !open.value) return
  const row = flat.value[selIdx.value]
  if (row?.kind !== 'option') return
  e.preventDefault()
  setChecked(row.option, direction === 'right')
}

function openModal() {
  open.value = true
  search.value = ''
  checked.value = new Set()
  nextTick(() => {
    selIdx.value = findInitialSelIdx()
    scrollToSelected()
    searchInput.value?.focus()
  })
}

function close() {
  open.value = false
}

function onRowClick(option) {
  if (props.multiple) toggleChecked(option)
  else pickSingle(option)
}

function pickSingle(option) {
  const v = option?.[props.trackBy]
  emit('update:modelValue', v)
  emit('change', v, option)
  close()
}

function submitMulti() {
  if (!checked.value.size) return
  const ids = Array.from(checked.value)
  const objects = []
  for (const id of ids) {
    for (const g of groups.value) {
      const hit = g.items.find((o) => String(o?.[props.trackBy]) === id)
      if (hit) { objects.push(hit); break }
    }
  }
  emit('submit', objects)
  close()
}

function onEnter() {
  if (props.multiple) {
    // In multi mode, Enter on the search field submits whatever's been
    // checked. To toggle the highlighted row, use Space.
    submitMulti()
    return
  }
  const row = flat.value[selIdx.value]
  if (row?.kind === 'option') pickSingle(row.option)
}

function findInitialSelIdx() {
  if (!props.multiple && props.modelValue) {
    const i = flat.value.findIndex((r) => r.kind === 'option' && isSelectedSingle(r.option))
    if (i >= 0) return i
  }
  return flat.value.findIndex((r) => r.kind === 'option')
}

function moveSel(step) {
  if (!flat.value.length) return
  let i = selIdx.value
  for (let n = 0; n < flat.value.length; n++) {
    i = (i + step + flat.value.length) % flat.value.length
    if (flat.value[i].kind === 'option') {
      selIdx.value = i
      scrollToSelected()
      return
    }
  }
}

function scrollToSelected() {
  nextTick(() => {
    const el = listEl.value?.querySelector(`[data-row-idx="${selIdx.value}"]`)
    if (el?.scrollIntoView) el.scrollIntoView({ block: 'nearest' })
  })
}

// Space toggles the highlighted row in multi mode (typical multi-select UX)
function onSpace(e) {
  if (!props.multiple || !open.value) return
  // Don't intercept Space while the user is typing into the search field
  const tag = (e.target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea') return
  const row = flat.value[selIdx.value]
  if (row?.kind === 'option') {
    e.preventDefault()
    toggleChecked(row.option)
  }
}

// Reset highlight when search changes
watch(search, () => {
  selIdx.value = flat.value.findIndex((r) => r.kind === 'option')
})

// Lock body scroll + global key handler
watch(open, (v) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
})

function onKeydown(e) {
  if (!open.value) return
  if (e.key === 'Escape') close()
  if (e.key === ' ') onSpace(e)
  // If focus isn't in the search input (e.g. user tabbed out), still let
  // ←/→ check/uncheck the highlighted row in multi mode.
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && props.multiple) {
    const tag = (e.target?.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea') return
    onLeftRight(e.key === 'ArrowRight' ? 'right' : 'left', e)
  }
}
if (typeof window !== 'undefined') window.addEventListener('keydown', onKeydown)
onUnmounted(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown)
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})

defineExpose({ open: openModal, close })
</script>
