<template>
  <div class="flex flex-col h-screen bg-[#F1F5F9]">

    <!-- ── Topbar ─────────────────────────────────────────────────────────── -->
    <header class="h-[64px] bg-[#1C2434] flex items-center px-3 sm:px-4 md:px-6 gap-2 sm:gap-4 flex-shrink-0 shadow-lg">

      <!-- Hamburger (mobile only) -->
      <button
        type="button"
        class="md:hidden p-2 -ml-1 text-[#DEE4EE] hover:bg-white/[0.10] transition-colors flex-shrink-0"
        @click="mobileNavOpen = true"
        aria-label="Open navigation"
      >
        <Bars3Icon class="w-6 h-6" />
      </button>

      <!-- Logo -->
      <div class="flex items-center gap-2 md:mr-4 flex-shrink-0">
        <div class="w-6 h-6 bg-white/20 flex items-center justify-center flex-shrink-0">
          <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span class="text-white text-[15px] font-bold tracking-tight">Starter SaaS</span>
      </div>

      <!-- Horizontal nav (md+) — overflow visible so teleported dropdowns aren't clipped -->
      <nav class="hidden md:flex items-center gap-1 flex-1 overflow-x-auto" style="overflow-y:visible">
        <template v-for="(section, sIdx) in visibleSections" :key="section.label">

          <!-- Group divider — between sections only -->
          <div
            v-if="sIdx > 0"
            class="w-px h-6 bg-white/15 mx-2 flex-shrink-0"
            aria-hidden="true"
          ></div>

          <template v-for="item in section.items" :key="item.label">

            <!-- Flat link -->
            <RouterLink
              v-if="!item.children"
              :to="item.to"
              class="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[#DEE4EE]
                     hover:bg-white/[0.08] hover:text-white transition-colors whitespace-nowrap flex-shrink-0"
              active-class="bg-white/[0.15] text-white font-medium"
            >
              <component :is="item.icon" class="w-4 h-4 flex-shrink-0" />
              <span>{{ t(item.label) }}</span>
            </RouterLink>

            <!-- Dropdown group -->
            <div
              v-else
              class="flex-shrink-0"
              @mouseenter="openDropdownAt(item, $event)"
              @mouseleave="scheduleClose"
            >
              <button
                class="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[#DEE4EE]
                       hover:bg-white/[0.08] hover:text-white transition-colors whitespace-nowrap"
                :class="{ 'bg-white/[0.15] text-white': openDropdown === item.label || isGroupActive(item) }"
                @click="toggleDropdown(item, $event)"
              >
                <component :is="item.icon" class="w-4 h-4 flex-shrink-0" />
                <span>{{ t(item.label) }}</span>
                <ChevronDownIcon class="w-3.5 h-3.5" />
              </button>
            </div>

          </template>
        </template>
      </nav>

      <!-- Right: controls + user dropdown -->
      <div class="flex items-center gap-1.5 flex-shrink-0 ml-auto">
        <!-- AI Chat button -->
        <button type="button" @click="chatOpen = true"
          class="w-10 h-10 flex items-center justify-center border border-white/[0.15]
                 bg-white/[0.06] text-[#DEE4EE] hover:text-white hover:bg-white/[0.10] transition-colors"
          :title="`${t('aiAgent.chat.title')} (Shift+A)`">
          <SparklesIcon class="w-5 h-5" />
        </button>

        <!-- Language switcher -->
        <div class="relative" ref="langMenuRef">
          <button
            @click="langOpen = !langOpen"
            class="flex items-center gap-1.5 h-10 px-2.5 sm:px-3 text-[13px] font-medium text-[#DEE4EE]
                   border border-white/[0.15] bg-white/[0.06] hover:bg-white/[0.10] transition-colors select-none"
          >
            <span>{{ currentLangLabel }}</span>
            <ChevronDownIcon class="w-3.5 h-3.5 text-[#8D9BB4] transition-transform duration-150"
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
              class="absolute right-0 top-full mt-1.5 w-44 bg-white border border-[#E2E8F0] shadow-card-lg z-[9999] overflow-hidden"
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
                  <span v-if="locale === opt.code" class="w-1.5 h-1.5 bg-primary-500 flex-shrink-0" />
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
            class="flex items-center gap-2 h-10 pl-2.5 pr-3.5 border border-white/[0.15] bg-white/[0.06]
                   hover:bg-white/[0.10] transition-colors"
          >
            <div class="w-7 h-7 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center
                        text-white text-[11px] font-bold flex-shrink-0">
              {{ userInitial }}
            </div>
            <span class="hidden lg:block text-[13px] text-[#DEE4EE] font-medium truncate max-w-28">{{ auth.user?.name }}</span>
            <ChevronDownIcon class="hidden lg:block w-3.5 h-3.5 text-[#8D9BB4] transition-transform"
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
                 class="absolute right-0 top-full mt-1.5 w-56 bg-white border border-[#E2E8F0] shadow-card-lg z-[9999] overflow-hidden">
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

    <!-- ── Page title bar ─────────────────────────────────────────────────── -->
    <div class="bg-white border-b border-[#E2E8F0] px-4 md:px-6 py-3.5 flex items-center gap-3 flex-shrink-0">
      <h2 class="text-[14px] font-semibold text-[#1C2434] truncate">{{ currentPageTitle }}</h2>
      <div class="ml-auto text-[12px] text-[#637381] truncate max-w-48 hidden sm:block">{{ auth.user?.email }}</div>
    </div>

    <!-- ── Page content ───────────────────────────────────────────────────── -->
    <main class="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin" style="scroll-padding-bottom: 80px; scroll-padding-top: 16px;">
      <slot />
    </main>

    <!-- ── Mobile drawer (off-canvas nav) ─────────────────────────────────── -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100" leave-to-class="opacity-0"
      >
        <div
          v-if="mobileNavOpen"
          class="md:hidden fixed inset-0 bg-black/50 z-[9998]"
          @click="mobileNavOpen = false"
        />
      </Transition>

      <Transition
        enter-active-class="transition-transform duration-200 ease-out"
        enter-from-class="-translate-x-full" enter-to-class="translate-x-0"
        leave-active-class="transition-transform duration-150 ease-in"
        leave-from-class="translate-x-0" leave-to-class="-translate-x-full"
      >
        <aside
          v-if="mobileNavOpen"
          class="md:hidden fixed inset-y-0 left-0 w-[280px] max-w-[85vw] bg-[#1C2434] z-[9999] flex flex-col shadow-2xl"
        >
          <!-- Header -->
          <div class="h-[64px] flex items-center px-5 border-b border-white/[0.07] flex-shrink-0 gap-3">
            <div class="w-7 h-7 bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span class="text-white text-[15px] font-bold tracking-tight flex-1">Starter SaaS</span>
            <button
              type="button"
              class="p-2 -mr-1 text-[#DEE4EE] hover:bg-white/[0.10] transition-colors"
              @click="mobileNavOpen = false"
              aria-label="Close navigation"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <!-- Nav -->
          <nav class="flex-1 overflow-y-auto scrollbar-dark py-3 px-3">
            <template v-for="(section, si) in visibleSections" :key="section.label">

              <div v-if="si > 0" class="mx-1 my-2.5 h-px bg-white/[0.07]" />

              <p class="section-label text-[#8D9BB4]">{{ t(section.label) }}</p>

              <ul class="space-y-0.5 mt-1">
                <template v-for="item in section.items" :key="item.label">

                  <!-- Leaf -->
                  <li v-if="!item.children">
                    <RouterLink
                      :to="item.to"
                      class="mobile-nav-item"
                      active-class="mobile-nav-item-active"
                    >
                      <component :is="item.icon" class="w-[18px] h-[18px] flex-shrink-0" />
                      <span class="truncate">{{ t(item.label) }}</span>
                    </RouterLink>
                  </li>

                  <!-- Group -->
                  <li v-else>
                    <button
                      type="button"
                      class="mobile-nav-item w-full"
                      @click="toggleMobileGroup(item.label)"
                    >
                      <component :is="item.icon" class="w-[18px] h-[18px] flex-shrink-0" />
                      <span class="flex-1 text-left truncate">{{ t(item.label) }}</span>
                      <ChevronDownIcon
                        class="w-3.5 h-3.5 text-[#8D9BB4] transition-transform duration-150"
                        :class="{ 'rotate-180': mobileOpenGroups.has(item.label) }"
                      />
                    </button>

                    <ul
                      v-if="mobileOpenGroups.has(item.label)"
                      class="mt-0.5 ml-3 pl-3 border-l border-white/[0.07] space-y-0.5"
                    >
                      <template v-for="child in item.children" :key="child.label || child.to">

                        <!-- Nested group -->
                        <li v-if="child.children">
                          <button
                            type="button"
                            class="mobile-nav-item-sm w-full"
                            @click="toggleMobileGroup(item.label + ':' + child.label)"
                          >
                            <component v-if="child.icon" :is="child.icon" class="w-[15px] h-[15px] flex-shrink-0" />
                            <span class="flex-1 text-left truncate">{{ t(child.label) }}</span>
                            <ChevronDownIcon
                              class="w-3 h-3 text-[#8D9BB4] transition-transform duration-150"
                              :class="{ 'rotate-180': mobileOpenGroups.has(item.label + ':' + child.label) }"
                            />
                          </button>
                          <ul
                            v-if="mobileOpenGroups.has(item.label + ':' + child.label)"
                            class="mt-0.5 ml-2.5 pl-2.5 border-l border-white/[0.07] space-y-0.5"
                          >
                            <li v-for="grandchild in child.children" :key="grandchild.to">
                              <RouterLink
                                :to="grandchild.to"
                                class="mobile-nav-item-sm"
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
                            class="mobile-nav-item-sm"
                            active-class="!text-white !bg-white/[0.08] font-medium"
                          >
                            <component v-if="child.icon" :is="child.icon" class="w-[15px] h-[15px] flex-shrink-0" />
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
            <div class="flex items-center gap-3 px-2 py-2">
              <div class="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center
                          text-white text-[13px] font-bold flex-shrink-0">
                {{ userInitial }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[13px] font-semibold text-white truncate leading-tight">{{ auth.user?.name }}</p>
                <p class="text-[11.5px] text-[#8D9BB4] capitalize truncate leading-tight">{{ auth.user?.email }}</p>
              </div>
              <button
                type="button"
                @click="handleLogout"
                title="Sign out"
                class="p-1.5 text-[#8D9BB4] hover:text-white hover:bg-white/[0.10] flex-shrink-0"
              >
                <ArrowRightOnRectangleIcon class="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      </Transition>

      <!-- Mega-menu: at least one child has its own sub-group -->
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="openDropdown && activeItem && isMegaMenu"
          :style="megaMenuStyle"
          class="hidden md:flex items-stretch bg-white shadow-xl border border-[#E2E8F0] scrollbar-thin"
          @mouseenter="cancelClose"
          @mouseleave="scheduleClose"
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
                  @click="openDropdown = null"
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
                    @click="openDropdown = null"
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

      <!-- Simple dropdown: flat children only -->
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="openDropdown && activeItem && !isMegaMenu"
          :style="{
            position: 'fixed',
            top: dropdownPos.top + 'px',
            left: dropdownPos.left + 'px',
            zIndex: 9999,
          }"
          class="hidden md:block w-60 bg-white shadow-xl border border-[#E2E8F0] p-1.5"
          @mouseenter="cancelClose"
          @mouseleave="scheduleClose"
        >
          <template v-for="child in activeItem.children" :key="child.label || child.to">
            <RouterLink
              :to="child.to"
              class="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#374151]
                     hover:bg-primary-50 hover:text-primary-700 transition-colors"
              active-class="bg-primary-50 text-primary-700 font-medium"
              @click="openDropdown = null"
            >
              <component v-if="child.icon" :is="child.icon" class="w-4 h-4 text-[#9BA7B0] flex-shrink-0" />
              <span class="truncate">{{ t(child.label) }}</span>
            </RouterLink>
          </template>
        </div>
      </Transition>
    </Teleport>

  </div>

  <!-- AI Chat slide-over -->
  <AiChatPanel v-model="chatOpen" />
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import {
  ChevronDownIcon, ArrowRightOnRectangleIcon,
  Bars3Icon, XMarkIcon, SparklesIcon, UserCircleIcon, ComputerDesktopIcon, CreditCardIcon,
} from '@heroicons/vue/24/outline'
import { useI18n } from 'vue-i18n'
import { useAppLayout } from '@/composables/useAppLayout'
import AlertBell from '@/components/AlertBell.vue'
import AiChatPanel from '@/components/AiChatPanel.vue'

const {
  auth,
  navSections,
  userInitial,
  currentPageTitle,
  handleLogout,
} = useAppLayout()

const { locale, t } = useI18n()
const router       = useRouter()
const route        = useRoute()
const openDropdown = ref(null)
const dropdownPos  = ref({ top: 0, left: 0 })
let   closeTimer   = null

// ── Topbar controls ─────────────────────────────────────────────────────
const chatOpen    = ref(false)
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

async function handleReturnToAdmin() {
  await auth.returnToAdmin()
  router.push('/admin/organizations')
}

// ── Mobile drawer state ─────────────────────────────────────────────────
const mobileNavOpen = ref(false)
const mobileOpenGroups = reactive(new Set())

function toggleMobileGroup(label) {
  mobileOpenGroups.has(label) ? mobileOpenGroups.delete(label) : mobileOpenGroups.add(label)
}

// Close drawer on route change
watch(() => route.path, () => { mobileNavOpen.value = false })

// Lock body scroll while drawer open
watch(mobileNavOpen, (open) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open ? 'hidden' : ''
})

function onClickOutside(e) {
  if (langMenuRef.value && !langMenuRef.value.contains(e.target)) langOpen.value = false
  if (userMenuRef.value && !userMenuRef.value.contains(e.target)) userOpen.value = false
}

function onKeydown(e) {
  if (e.key === 'Escape' && mobileNavOpen.value) mobileNavOpen.value = false
  if (e.key === 'Escape' && openDropdown.value) openDropdown.value = null
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

// Drop empty sections so dividers don't render around nothing
const visibleSections = computed(() =>
  navSections.value.filter((s) => s.items && s.items.length)
)

// Find the item whose dropdown is open so the Teleport can render its children
const activeItem = computed(() => {
  if (!openDropdown.value) return null
  for (const section of visibleSections.value) {
    const found = section.items.find((i) => i.label === openDropdown.value)
    if (found) return found
  }
  return null
})

// Mega-menu detection — any direct child that itself has children opens horizontal layout
const isMegaMenu = computed(() => {
  return !!activeItem.value?.children?.some((c) => Array.isArray(c.children) && c.children.length)
})

// Mega-menu content: flat children become the quick-links rail, sub-groups
// become the link columns.
const quickLinks = computed(() =>
  activeItem.value?.children.filter((c) => !c.children && c.to) ?? [])
const groupColumns = computed(() =>
  (activeItem.value?.children ?? [])
    .filter((c) => c.children?.length)
    .map((g) => ({ label: g.label, icon: g.icon, items: g.children })))

// Positioning — keep mega menu within the viewport. Columns wrap to a new row
// when the available width can't fit them all (CSS auto-fit grid handles that).
const MEGA_COL_MIN = 200   // min column width — wide enough for long report labels
const MEGA_COL_GAP = 32    // matches gap-x-8
const MEGA_PADDING = 20    // matches p-5
const MEGA_RAIL_W  = 220   // quick-links rail
const MEGA_MAX     = 1200  // hard cap, even on huge monitors
const VIEWPORT_PAD = 12    // breathing room from window edges

const megaMenuStyle = computed(() => {
  const cols     = groupColumns.value.length || 1
  const railW    = quickLinks.value.length ? MEGA_RAIL_W : 0
  const vw       = typeof window !== 'undefined' ? window.innerWidth : 1280
  const idealW   = railW + cols * MEGA_COL_MIN + (cols - 1) * MEGA_COL_GAP + MEGA_PADDING * 2
  const maxW     = Math.min(MEGA_MAX, vw - VIEWPORT_PAD * 2)
  const width    = Math.min(idealW, maxW)
  const maxLeft  = Math.max(VIEWPORT_PAD, vw - width - VIEWPORT_PAD)
  return {
    position: 'fixed',
    top:  dropdownPos.value.top + 'px',
    left: Math.min(dropdownPos.value.left, maxLeft) + 'px',
    width: width + 'px',
    maxHeight: `calc(100vh - ${dropdownPos.value.top + 16}px)`,
    overflowY: 'auto',
    zIndex: 9999,
  }
})

function openDropdownAt(item, event) {
  cancelClose()
  const rect = event.currentTarget.getBoundingClientRect()
  dropdownPos.value = { top: rect.bottom + 4, left: rect.left }
  openDropdown.value = item.label
}

// Click opens too — hover-only menus confuse users who click the trigger
// expecting something to happen. Idempotent (no toggle-close): hover usually
// opened the menu already, so a toggling click would instantly dismiss it.
function toggleDropdown(item, event) {
  openDropdownAt(item, event)
}

function scheduleClose() {
  closeTimer = setTimeout(() => { openDropdown.value = null }, 200)
}

function cancelClose() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
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
</script>

<style scoped>
.mobile-nav-item {
  @apply flex items-center gap-3 px-3 py-2.5 text-[13.5px] text-[#DEE4EE]
         hover:bg-white/[0.06] hover:text-white transition-colors duration-100 w-full;
}
.mobile-nav-item-active {
  @apply !bg-primary-500/20 !text-white font-semibold;
}
.mobile-nav-item-sm {
  @apply flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#9BA7B8]
         hover:bg-white/[0.05] hover:text-[#DEE4EE] transition-colors duration-100 w-full;
}
</style>
