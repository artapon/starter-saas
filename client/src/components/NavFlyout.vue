<template>
  <Teleport to="body">
    <!-- Mega flyout: at least one child has its own sub-group -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="opacity-0 -translate-x-1"
      enter-to-class="opacity-100 translate-x-0"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 -translate-x-1"
    >
      <div
        v-if="item && isMega"
        data-flyout
        :style="megaStyle"
        class="hidden md:flex items-stretch bg-white shadow-xl border border-[#E2E8F0] scrollbar-thin"
        @mouseenter="$emit('enter')"
        @mouseleave="$emit('leave')"
      >
        <!-- Quick links rail — the group's flat top-level pages -->
        <div v-if="quickLinks.length" class="w-[220px] flex-shrink-0 bg-[#F7F9FC] border-r border-[#E2E8F0] p-3">
          <p class="px-2.5 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-primary-600 uppercase">
            {{ t('nav.quickLinks') }}
          </p>
          <ul class="space-y-0.5">
            <li v-for="link in quickLinks" :key="link.to">
              <RouterLink
                :to="link.to"
                class="flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium text-[#1C2434]
                       hover:bg-white hover:text-primary-600 hover:shadow-sm transition-all"
                active-class="bg-white text-primary-600 shadow-sm"
                @click="$emit('navigate')"
              >
                <component v-if="link.icon" :is="link.icon" class="w-4 h-4 text-[#637381] flex-shrink-0" />
                <span class="truncate">{{ t(link.label) }}</span>
              </RouterLink>
            </li>
          </ul>
        </div>

        <!-- Sub-group columns -->
        <div class="flex-1 min-w-0 p-5 grid gap-x-8 gap-y-6 content-start"
             :style="{ gridTemplateColumns: `repeat(auto-fit, minmax(${MEGA_COL_MIN}px, 1fr))` }">
          <div v-for="col in groupColumns" :key="col.label" class="min-w-0">

            <p class="flex items-center gap-1.5 mb-2 text-[11px] font-semibold tracking-wider text-primary-600 uppercase">
              <component v-if="col.icon" :is="col.icon" class="w-3.5 h-3.5 flex-shrink-0" />
              {{ t(col.label) }}
            </p>

            <ul class="space-y-0.5">
              <li v-for="link in col.items" :key="link.to">
                <RouterLink
                  :to="link.to"
                  class="flex items-center gap-2.5 -mx-2 px-2 py-1.5 text-[13px] text-[#374151]
                         hover:bg-primary-50 hover:text-primary-700 transition-colors"
                  active-class="bg-primary-50 text-primary-700 font-medium"
                  @click="$emit('navigate')"
                >
                  <component v-if="link.icon" :is="link.icon" class="w-4 h-4 text-[#9BA7B0] flex-shrink-0" />
                  <span class="truncate">{{ t(link.label) }}</span>
                </RouterLink>
              </li>
            </ul>

          </div>
        </div>
      </div>
    </Transition>

    <!-- Simple flyout: flat children only -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="opacity-0 -translate-x-1"
      enter-to-class="opacity-100 translate-x-0"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 -translate-x-1"
    >
      <div
        v-if="item && !isMega"
        data-flyout
        :style="simpleStyle"
        class="hidden md:block w-60 bg-white shadow-xl border border-[#E2E8F0] p-1.5"
        @mouseenter="$emit('enter')"
        @mouseleave="$emit('leave')"
      >
        <template v-for="child in item.children" :key="child.label || child.to">
          <RouterLink
            :to="child.to"
            class="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#374151]
                   hover:bg-primary-50 hover:text-primary-700 transition-colors"
            active-class="bg-primary-50 text-primary-700 font-medium"
            @click="$emit('navigate')"
          >
            <component v-if="child.icon" :is="child.icon" class="w-4 h-4 text-[#9BA7B0] flex-shrink-0" />
            <span class="truncate">{{ t(child.label) }}</span>
          </RouterLink>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  // The nav group whose children are shown; null hides the flyout.
  item: { type: Object, default: null },
  // Fixed-position anchor: { top, left } of the panel's top-left corner.
  pos:  { type: Object, default: () => ({ top: 0, left: 0 }) },
})

defineEmits(['enter', 'leave', 'navigate'])

const { t } = useI18n()

const quickLinks = computed(() =>
  props.item?.children.filter((c) => !c.children && c.to) ?? [])
const groupColumns = computed(() =>
  (props.item?.children ?? [])
    .filter((c) => c.children?.length)
    .map((g) => ({ label: g.label, icon: g.icon, items: g.children })))
const isMega = computed(() => groupColumns.value.length > 0)

// Sizing — same metrics as the Modern template's mega menu.
const MEGA_COL_MIN = 200   // min column width — wide enough for long report labels
const MEGA_COL_GAP = 32    // matches gap-x-8
const MEGA_PADDING = 20    // matches p-5
const MEGA_RAIL_W  = 220   // quick-links rail
const MEGA_MAX     = 1200  // hard cap, even on huge monitors
const VIEWPORT_PAD = 12    // breathing room from window edges

const megaStyle = computed(() => {
  const cols   = groupColumns.value.length || 1
  const railW  = quickLinks.value.length ? MEGA_RAIL_W : 0
  const vw     = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh     = typeof window !== 'undefined' ? window.innerHeight : 800
  const idealW = railW + cols * MEGA_COL_MIN + (cols - 1) * MEGA_COL_GAP + MEGA_PADDING * 2
  const width  = Math.min(idealW, MEGA_MAX, vw - props.pos.left - VIEWPORT_PAD)
  const top    = Math.max(VIEWPORT_PAD, Math.min(props.pos.top, vh * 0.4))
  return {
    position: 'fixed',
    top:  top + 'px',
    left: props.pos.left + 'px',
    width: width + 'px',
    maxHeight: `calc(100vh - ${top + VIEWPORT_PAD}px)`,
    overflowY: 'auto',
    zIndex: 9999,
  }
})

const simpleStyle = computed(() => {
  const vh  = typeof window !== 'undefined' ? window.innerHeight : 800
  const top = Math.max(VIEWPORT_PAD, Math.min(props.pos.top, vh - 320))
  return {
    position: 'fixed',
    top:  top + 'px',
    left: props.pos.left + 'px',
    maxHeight: `calc(100vh - ${top + VIEWPORT_PAD}px)`,
    overflowY: 'auto',
    zIndex: 9999,
  }
})
</script>
