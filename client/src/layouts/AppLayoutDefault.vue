<template>
  <div class="flex h-screen bg-[#F1F5F9] overflow-hidden">

    <!-- ── Mobile backdrop ───────────────────────────────────────────────────── -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0" enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100" leave-to-class="opacity-0"
    >
      <div
        v-if="sidebarOpen"
        class="md:hidden fixed inset-0 bg-black/50 z-30"
        @click="sidebarOpen = false"
      />
    </Transition>

    <!-- ── Sidebar ───────────────────────────────────────────────────────────── -->
    <aside
      class="w-[260px] bg-[#1C2434] flex flex-col flex-shrink-0
             fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 ease-out
             md:relative md:translate-x-0 md:transition-none"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
    >

      <!-- Logo -->
      <div class="h-[64px] flex items-center px-6 border-b border-white/[0.07] flex-shrink-0 gap-3">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div class="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-md">
            <svg class="w-[15px] h-[15px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span class="text-[15px] font-bold text-white tracking-tight truncate">Starter SaaS</span>
        </div>
        <button
          type="button"
          class="md:hidden p-2 -mr-2 text-[#DEE4EE] hover:bg-white/[0.10] transition-colors"
          @click="sidebarOpen = false"
          aria-label="Close navigation"
        >
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>

      <!-- Nav -->
      <nav class="flex-1 overflow-y-auto scrollbar-dark py-4 px-4">
        <template v-for="(section, si) in navSections" :key="section.label">

          <div v-if="si > 0" class="mx-1 my-3 h-px bg-white/[0.07]" />

          <p class="section-label">{{ t(section.label) }}</p>

          <ul class="space-y-0.5 mt-1">
            <template v-for="item in section.items" :key="item.label">

              <!-- Leaf item -->
              <li v-if="!item.children">
                <RouterLink
                  :to="item.to"
                  class="nav-item"
                  active-class="nav-item-active"
                >
                  <component :is="item.icon" class="w-[18px] h-[18px] flex-shrink-0" />
                  <span class="truncate">{{ t(item.label) }}</span>
                </RouterLink>
              </li>

              <!-- Group item — accordion on mobile, flyout mega panel on md+ -->
              <li v-else @mouseenter="onGroupEnter(item, $event)" @mouseleave="scheduleFlyoutClose">
                <button
                  data-flyout
                  @click="onGroupClick(item, $event)"
                  class="nav-item w-full"
                  :class="{
                    'nav-item-open': openGroups.has(item.label) || flyoutOpen === item.label,
                    'nav-item-active': isGroupActive(item),
                  }"
                >
                  <component :is="item.icon" class="w-[18px] h-[18px] flex-shrink-0" />
                  <span class="flex-1 text-left truncate">{{ t(item.label) }}</span>
                  <ChevronRightIcon class="hidden md:block w-3.5 h-3.5 text-[#8D9BB4] flex-shrink-0" />
                  <ChevronDownIcon
                    class="md:hidden w-3.5 h-3.5 text-[#8D9BB4] transition-transform duration-200 flex-shrink-0"
                    :class="{ 'rotate-180': openGroups.has(item.label) }"
                  />
                </button>

                <ul v-if="openGroups.has(item.label)" class="md:hidden mt-0.5 ml-3 pl-3 border-l border-white/[0.07] space-y-0.5">
                  <template v-for="child in item.children" :key="child.label || child.to">

                    <!-- Nested group -->
                    <li v-if="child.children">
                      <button
                        @click="toggleGroup(item.label + ':' + child.label)"
                        class="nav-item-sm w-full"
                      >
                        <component :is="child.icon" class="w-[15px] h-[15px] flex-shrink-0" />
                        <span class="flex-1 text-left truncate">{{ t(child.label) }}</span>
                        <ChevronDownIcon
                          class="w-3 h-3 text-[#8D9BB4] transition-transform duration-200"
                          :class="{ 'rotate-180': openGroups.has(item.label + ':' + child.label) }"
                        />
                      </button>
                      <ul
                        v-if="openGroups.has(item.label + ':' + child.label)"
                        class="mt-0.5 ml-2.5 pl-2.5 border-l border-white/[0.07] space-y-0.5"
                      >
                        <li v-for="grandchild in child.children" :key="grandchild.to">
                          <RouterLink
                            :to="grandchild.to"
                            class="nav-item-sm"
                            active-class="!text-white font-medium"
                          >
                            <component v-if="grandchild.icon" :is="grandchild.icon" class="w-3.5 h-3.5 flex-shrink-0" />
                            <span class="truncate">{{ t(grandchild.label) }}</span>
                          </RouterLink>
                        </li>
                      </ul>
                    </li>

                    <!-- Nested leaf -->
                    <li v-else>
                      <RouterLink
                        :to="child.to"
                        class="nav-item-sm"
                        active-class="!text-white !bg-white/[0.08] font-medium"
                      >
                        <component :is="child.icon" class="w-[15px] h-[15px] flex-shrink-0" />
                        <span class="truncate">{{ t(child.label) }}</span>
                      </RouterLink>
                    </li>

                  </template>
                </ul>
              </li>

            </template>
          </ul>

        </template>
      </nav>

      <!-- User strip -->
      <div class="border-t border-white/[0.07] p-3 flex-shrink-0">
        <div class="flex items-center gap-3 px-2 py-2.5 group cursor-default
                    hover:bg-white/[0.06] transition-colors duration-150">
          <div class="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center
                      text-white text-[13px] font-bold flex-shrink-0 select-none">
            {{ userInitial }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-semibold text-white truncate leading-[1.3]">{{ auth.user?.name }}</p>
            <p class="text-[11.5px] text-[#8D9BB4] capitalize leading-[1.3]">{{ auth.user?.role }}</p>
          </div>
          <button
            @click="handleLogout"
            title="Sign out"
            class="p-1.5 text-[#8D9BB4] hover:text-white hover:bg-white/[0.10]
                   opacity-0 group-hover:opacity-100 transition-all duration-150"
          >
            <ArrowRightOnRectangleIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- ── Main area ──────────────────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col overflow-hidden">

      <!-- Topbar -->
      <header class="h-[64px] bg-white border-b border-[#E2E8F0] flex items-center px-3 sm:px-4 md:px-6 gap-2 sm:gap-4 flex-shrink-0">
        <button
          type="button"
          class="md:hidden p-2 -ml-1 text-[#637381] hover:bg-[#F7F9FC] transition-colors flex-shrink-0"
          @click="sidebarOpen = true"
          aria-label="Open navigation"
        >
          <Bars3Icon class="w-6 h-6" />
        </button>
        <div class="flex-1 min-w-0">
          <h2 class="text-[14px] font-semibold text-[#1C2434] truncate">{{ currentPageTitle }}</h2>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2.5">
          <!-- AI Chat button -->
          <button type="button" @click="chatOpen = true"
            class="w-10 h-10 flex items-center justify-center border border-[#E2E8F0]
                   bg-white hover:bg-[#F7F9FC] text-[#637381] hover:text-[#1C2434] transition-colors"
            :title="`${t('aiAgent.chat.title')} (Shift+A)`">
            <SparklesIcon class="w-5 h-5" />
          </button>

          <!-- Language switcher -->
          <div class="relative" ref="langMenuRef">
            <button
              @click="langOpen = !langOpen"
              class="flex items-center gap-1.5 h-10 px-2.5 sm:px-3 text-[13px] font-medium text-[#637381]
                     border border-[#E2E8F0] bg-white hover:bg-[#F7F9FC] transition-colors select-none"
            >
              <span>{{ currentLangLabel }}</span>
              <ChevronDownIcon class="w-3.5 h-3.5 text-[#9BA7B0] transition-transform duration-150"
                              :class="{ 'rotate-180': langOpen }" />
            </button>

            <Transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="opacity-0 scale-95 -translate-y-1"
              enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="opacity-100 scale-100 translate-y-0"
              leave-to-class="opacity-0 scale-95 -translate-y-1"
            >
              <div
                v-if="langOpen"
                class="absolute right-0 top-full mt-1.5 w-44 bg-white border border-[#E2E8F0] shadow-card-lg z-50 overflow-hidden"
              >
                <div class="p-1.5">
                  <button
                    v-for="opt in langOptions"
                    :key="opt.code"
                    @click="setLang(opt.code)"
                    class="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left
                           hover:bg-[#F7F9FC] transition-colors"
                    :class="locale === opt.code ? 'text-primary-600 font-semibold' : 'text-[#1C2434]'"
                  >
                    <span class="text-base leading-none">{{ opt.flag }}</span>
                    <span class="flex-1">{{ opt.label }}</span>
                    <span v-if="locale === opt.code"
                      class="w-1.5 h-1.5 bg-primary-500 flex-shrink-0" />
                  </button>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Notification bell -->
          <AlertBell class="hidden sm:block" />

          <!-- User avatar / dropdown -->
          <div class="relative" ref="userMenuRef">
            <button
              type="button"
              @click="userOpen = !userOpen"
              class="flex items-center gap-2.5 h-10 sm:pl-2.5 sm:pr-3.5 border border-transparent sm:border-[#E2E8F0] bg-transparent sm:bg-white
                     hover:bg-[#F7F9FC] transition-colors"
            >
              <div class="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center
                          text-white text-[12px] font-bold flex-shrink-0">
                {{ userInitial }}
              </div>
              <div class="hidden lg:block min-w-0 text-left">
                <p class="text-[13px] font-semibold text-[#1C2434] truncate max-w-32 leading-tight">{{ auth.user?.name }}</p>
                <p class="text-[11px] text-[#637381] capitalize leading-tight">{{ auth.user?.role }}</p>
              </div>
              <ChevronDownIcon class="hidden lg:block w-3.5 h-3.5 text-[#9BA7B0] transition-transform"
                               :class="{ 'rotate-180': userOpen }" />
            </button>

            <Transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="opacity-0 scale-95 -translate-y-1"
              enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="opacity-100 scale-100 translate-y-0"
              leave-to-class="opacity-0 scale-95 -translate-y-1"
            >
              <div v-if="userOpen"
                   class="absolute right-0 top-full mt-1.5 w-56 bg-white border border-[#E2E8F0] shadow-card-lg z-50 overflow-hidden">
                <div class="px-4 py-3 border-b border-[#E2E8F0]">
                  <p class="text-[13px] font-semibold text-[#1C2434] truncate">{{ auth.user?.name }}</p>
                  <p class="text-[11.5px] text-[#637381] truncate">{{ auth.user?.email }}</p>
                </div>
                <div class="p-1.5">
                  <RouterLink to="/profile/general" @click="userOpen = false"
                    class="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#1C2434] hover:bg-[#F7F9FC] transition-colors">
                    <UserCircleIcon class="w-4 h-4 text-[#637381]" />
                    <span>{{ t('nav.profile') }}</span>
                  </RouterLink>
                  <RouterLink to="/profile/sessions" @click="userOpen = false"
                    class="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#1C2434] hover:bg-[#F7F9FC] transition-colors">
                    <ComputerDesktopIcon class="w-4 h-4 text-[#637381]" />
                    <span>{{ t('profile.tabSessions') }}</span>
                  </RouterLink>
                  <RouterLink to="/billing" @click="userOpen = false"
                    class="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#1C2434] hover:bg-[#F7F9FC] transition-colors">
                    <CreditCardIcon class="w-4 h-4 text-[#637381]" />
                    <span>{{ t('billing.nav') }}</span>
                  </RouterLink>
                </div>
                <div class="p-1.5 border-t border-[#E2E8F0]">
                  <button type="button" @click="handleLogout"
                    class="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#B91C1C] hover:bg-red-50 transition-colors">
                    <ArrowRightOnRectangleIcon class="w-4 h-4" />
                    <span>{{ t('nav.signOut') }}</span>
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </header>

      <!-- Impersonation banner -->
      <div v-if="auth.impersonating" class="flex-shrink-0 bg-amber-400 px-4 md:px-6 py-2 flex items-center gap-3">
        <UserCircleIcon class="w-4 h-4 text-amber-900 flex-shrink-0" />
        <p class="text-[13px] font-semibold text-amber-900 flex-1 leading-none">
          Viewing as <span class="font-bold">{{ auth.user?.name }}</span> ({{ auth.user?.email }})
        </p>
        <button @click="handleReturnToAdmin"
          class="text-[12px] font-bold text-amber-900 bg-amber-900/15 hover:bg-amber-900/25 px-3 py-1 transition-colors flex-shrink-0">
          Return to Admin
        </button>
      </div>

      <!-- Content -->
      <main class="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
        <slot />
      </main>

    </div>
  </div>

  <!-- ── Desktop flyout for sidebar groups ──────────────────────────────── -->
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
        v-if="flyoutOpen && flyoutItem && isMegaFlyout"
        data-flyout
        :style="flyoutMegaStyle"
        class="hidden md:flex items-stretch bg-white shadow-xl border border-[#E2E8F0] scrollbar-thin"
        @mouseenter="cancelFlyoutClose"
        @mouseleave="scheduleFlyoutClose"
      >
        <!-- Quick links rail — the group's flat top-level pages -->
        <div v-if="flyoutQuickLinks.length" class="w-[220px] flex-shrink-0 bg-[#F7F9FC] border-r border-[#E2E8F0] p-3">
          <p class="px-2.5 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-primary-600 uppercase">
            {{ t('nav.quickLinks') }}
          </p>
          <ul class="space-y-0.5">
            <li v-for="link in flyoutQuickLinks" :key="link.to">
              <RouterLink
                :to="link.to"
                class="flex items-center gap-2.5 px-2.5 py-2 text-[13px] font-medium text-[#1C2434]
                       hover:bg-white hover:text-primary-600 hover:shadow-sm transition-all"
                active-class="bg-white text-primary-600 shadow-sm"
                @click="flyoutOpen = null"
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
          <div v-for="col in flyoutGroupColumns" :key="col.label" class="min-w-0">

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
                  @click="flyoutOpen = null"
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
        v-if="flyoutOpen && flyoutItem && !isMegaFlyout"
        data-flyout
        :style="flyoutSimpleStyle"
        class="hidden md:block w-60 bg-white shadow-xl border border-[#E2E8F0] p-1.5"
        @mouseenter="cancelFlyoutClose"
        @mouseleave="scheduleFlyoutClose"
      >
        <template v-for="child in flyoutItem.children" :key="child.label || child.to">
          <RouterLink
            :to="child.to"
            class="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#374151]
                   hover:bg-primary-50 hover:text-primary-700 transition-colors"
            active-class="bg-primary-50 text-primary-700 font-medium"
            @click="flyoutOpen = null"
          >
            <component v-if="child.icon" :is="child.icon" class="w-4 h-4 text-[#9BA7B0] flex-shrink-0" />
            <span class="truncate">{{ t(child.label) }}</span>
          </RouterLink>
        </template>
      </div>
    </Transition>
  </Teleport>

  <!-- AI Chat slide-over -->
  <AiChatPanel v-model="chatOpen" />
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  ChevronDownIcon, ChevronRightIcon, ArrowRightOnRectangleIcon,
  UserCircleIcon, ComputerDesktopIcon, CreditCardIcon, Bars3Icon, XMarkIcon, SparklesIcon,
} from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useAppLayout } from '@/composables/useAppLayout'
import AlertBell from '@/components/AlertBell.vue'
import AiChatPanel from '@/components/AiChatPanel.vue'

const {
  auth,
  navSections,
  openGroups,
  toggleGroup,
  userInitial,
  currentPageTitle,
  handleLogout,
} = useAppLayout()

const router = useRouter()
const route  = useRoute()

// ── Mobile sidebar state ────────────────────────────────────────────────
const sidebarOpen = ref(false)

// ── AI Chat panel ────────────────────────────────────────────────────────
const chatOpen = ref(false)

watch(() => route.path, () => { sidebarOpen.value = false; flyoutOpen.value = null })

watch(sidebarOpen, (open) => {
  if (typeof document === 'undefined') return
  // Only lock when sidebar is opened as overlay (mobile). On md+ it's static.
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  document.body.style.overflow = open && isMobile ? 'hidden' : ''
})

async function handleReturnToAdmin() {
  await auth.returnToAdmin()
  router.push('/admin/organizations')
}

// ── Desktop flyout (mega menu) for sidebar groups ───────────────────────
// On md+ a group's children open in a panel beside the sidebar instead of
// an inline accordion; the accordion stays for the mobile drawer.
const flyoutOpen = ref(null)
const flyoutPos  = ref({ top: 0, left: 0 })
let   flyoutCloseTimer = null

const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

const flyoutItem = computed(() => {
  if (!flyoutOpen.value) return null
  for (const section of navSections.value) {
    const found = section.items.find((i) => i.label === flyoutOpen.value)
    if (found) return found
  }
  return null
})

const flyoutQuickLinks = computed(() =>
  flyoutItem.value?.children.filter((c) => !c.children && c.to) ?? [])
const flyoutGroupColumns = computed(() =>
  (flyoutItem.value?.children ?? [])
    .filter((c) => c.children?.length)
    .map((g) => ({ label: g.label, icon: g.icon, items: g.children })))
const isMegaFlyout = computed(() => flyoutGroupColumns.value.length > 0)

// Sizing — same metrics as the Modern template's mega menu.
const MEGA_COL_MIN = 200   // min column width — wide enough for long report labels
const MEGA_COL_GAP = 32    // matches gap-x-8
const MEGA_PADDING = 20    // matches p-5
const MEGA_RAIL_W  = 220   // quick-links rail
const MEGA_MAX     = 1200  // hard cap, even on huge monitors
const VIEWPORT_PAD = 12    // breathing room from window edges

const flyoutMegaStyle = computed(() => {
  const cols   = flyoutGroupColumns.value.length || 1
  const railW  = flyoutQuickLinks.value.length ? MEGA_RAIL_W : 0
  const vw     = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh     = typeof window !== 'undefined' ? window.innerHeight : 800
  const idealW = railW + cols * MEGA_COL_MIN + (cols - 1) * MEGA_COL_GAP + MEGA_PADDING * 2
  const width  = Math.min(idealW, MEGA_MAX, vw - flyoutPos.value.left - VIEWPORT_PAD)
  const top    = Math.max(VIEWPORT_PAD, Math.min(flyoutPos.value.top, vh * 0.4))
  return {
    position: 'fixed',
    top:  top + 'px',
    left: flyoutPos.value.left + 'px',
    width: width + 'px',
    maxHeight: `calc(100vh - ${top + VIEWPORT_PAD}px)`,
    overflowY: 'auto',
    zIndex: 9999,
  }
})

const flyoutSimpleStyle = computed(() => {
  const vh  = typeof window !== 'undefined' ? window.innerHeight : 800
  const top = Math.max(VIEWPORT_PAD, Math.min(flyoutPos.value.top, vh - 320))
  return {
    position: 'fixed',
    top:  top + 'px',
    left: flyoutPos.value.left + 'px',
    maxHeight: `calc(100vh - ${top + VIEWPORT_PAD}px)`,
    overflowY: 'auto',
    zIndex: 9999,
  }
})

function openFlyoutAt(item, event) {
  cancelFlyoutClose()
  const rect = event.currentTarget.getBoundingClientRect()
  flyoutPos.value = { top: rect.top, left: rect.right + 8 }
  flyoutOpen.value = item.label
}

function onGroupEnter(item, event) {
  if (isDesktop()) openFlyoutAt(item, event)
}

// Click opens the flyout on desktop (idempotent — hover usually opened it
// already, and toggling closed on click reads as broken), the accordion in
// the mobile drawer.
function onGroupClick(item, event) {
  if (!isDesktop()) return toggleGroup(item.label)
  openFlyoutAt(item, event)
}

function scheduleFlyoutClose() {
  flyoutCloseTimer = setTimeout(() => { flyoutOpen.value = null }, 200)
}

function cancelFlyoutClose() {
  if (flyoutCloseTimer) {
    clearTimeout(flyoutCloseTimer)
    flyoutCloseTimer = null
  }
}

function isGroupActive(item) {
  if (!item.children) return false
  return item.children.some((child) => {
    if (child.to) return route.path.startsWith(child.to)
    if (child.children) return child.children.some((gc) => route.path.startsWith(gc.to))
    return false
  })
}

const { locale, t } = useI18n()

const langOpen    = ref(false)
const langMenuRef = ref(null)

const userOpen    = ref(false)
const userMenuRef = ref(null)

const langOptions = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'th', flag: '🇹🇭', label: 'ภาษาไทย' },
]

const currentLangLabel = computed(() =>
  langOptions.find(o => o.code === locale.value)?.flag + ' ' +
  (locale.value === 'th' ? 'TH' : 'EN')
)

function setLang(code) {
  locale.value = code
  localStorage.setItem('app-lang', code)
  langOpen.value = false
}

function onClickOutside(e) {
  if (langMenuRef.value && !langMenuRef.value.contains(e.target)) {
    langOpen.value = false
  }
  if (userMenuRef.value && !userMenuRef.value.contains(e.target)) {
    userOpen.value = false
  }
  // Flyout closes on hover-out for mouse users; this covers touch/pen taps
  // outside the panel and its triggers.
  if (flyoutOpen.value && !e.target.closest('[data-flyout]')) {
    flyoutOpen.value = null
  }
}

function onKeydown(e) {
  if (e.key === 'Escape' && sidebarOpen.value) sidebarOpen.value = false
  if (e.key === 'Escape' && flyoutOpen.value) flyoutOpen.value = null

  // Shift+A toggles the AI panel — ignored while typing so it doesn't hijack
  // a capital "A" in an input, textarea, select, or contenteditable.
  if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'a') {
    const el = e.target
    const typing = el && (
      el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' || el.isContentEditable
    )
    if (typing) return
    e.preventDefault()
    chatOpen.value = !chatOpen.value
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  window.removeEventListener('keydown', onKeydown)
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>

<style scoped>
.nav-item {
  @apply flex items-center gap-3 px-3 py-2.5 text-[13.5px] text-[#DEE4EE]
         hover:bg-white/[0.06] hover:text-white transition-colors duration-100 w-full;
}
.nav-item-active {
  @apply !bg-primary-500/20 !text-white font-semibold;
}
.nav-item-open {
  @apply bg-white/[0.04] text-white;
}
.nav-item-sm {
  @apply flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#9BA7B8]
         hover:bg-white/[0.05] hover:text-[#DEE4EE] transition-colors duration-100 w-full;
}
</style>
