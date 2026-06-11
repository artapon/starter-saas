import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

/**
 * Desktop flyout (mega menu) state for sidebar layouts.
 *
 * On md+ a sidebar group's children open in a <NavFlyout> panel beside the
 * sidebar instead of an inline accordion; the accordion stays for the mobile
 * drawer. Owns open/close state, hover grace, Esc / outside-tap / route-change
 * dismissal. Pair with <NavFlyout> for the panel markup.
 *
 * @param {import('vue').ComputedRef} navSections - from useAppLayout()
 * @param {{ toggleGroup?: (label: string) => void }} opts - mobile accordion fallback
 */
export function useNavFlyout(navSections, { toggleGroup } = {}) {
  const route      = useRoute()
  const flyoutOpen = ref(null)
  const flyoutPos  = ref({ top: 0, left: 0 })
  let   closeTimer = null

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
    if (!isDesktop()) return toggleGroup?.(item.label)
    openFlyoutAt(item, event)
  }

  function scheduleFlyoutClose() {
    closeTimer = setTimeout(() => { flyoutOpen.value = null }, 200)
  }

  function cancelFlyoutClose() {
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
  }

  function closeFlyout() { flyoutOpen.value = null }

  function isGroupActive(item) {
    if (!item.children) return false
    return item.children.some((child) => {
      if (child.to) return route.path.startsWith(child.to)
      if (child.children) return child.children.some((gc) => route.path.startsWith(gc.to))
      return false
    })
  }

  watch(() => route.path, closeFlyout)

  function onKeydown(e) {
    if (e.key === 'Escape' && flyoutOpen.value) closeFlyout()
  }
  // Hover-out closes for mouse users; this covers touch/pen taps outside the
  // panel and its [data-flyout] triggers.
  function onMousedown(e) {
    if (flyoutOpen.value && !e.target.closest('[data-flyout]')) closeFlyout()
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    document.addEventListener('mousedown', onMousedown)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    document.removeEventListener('mousedown', onMousedown)
    cancelFlyoutClose()
  })

  return {
    flyoutOpen, flyoutItem, flyoutPos,
    onGroupEnter, onGroupClick,
    scheduleFlyoutClose, cancelFlyoutClose, closeFlyout,
    isGroupActive,
  }
}
