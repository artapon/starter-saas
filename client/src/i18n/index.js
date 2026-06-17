import { createI18n } from 'vue-i18n'
import baseEn from './locales/en.js'
import baseTh from './locales/th.js'

// Auto-discover per-module locale files:
//   client/src/modules/<module>/i18n/{en,th}.js
//   shared/<area>/<module>/i18n/{en,th}.js  (any depth)
const clientModuleLocales = import.meta.glob('../modules/**/i18n/*.js', { eager: true })
const sharedModuleLocales = import.meta.glob('../../../shared/**/i18n/*.js', { eager: true })

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const sv = source[key]
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {}
      deepMerge(target[key], sv)
    } else {
      target[key] = sv
    }
  }
  return target
}

function buildMessages() {
  const messages = { en: { ...baseEn }, th: { ...baseTh } }

  const merge = (path, mod) => {
    const m = path.match(/\/i18n\/([a-z]{2})\.js$/i)
    if (!m) return
    const locale = m[1]
    if (!messages[locale]) messages[locale] = {}
    deepMerge(messages[locale], mod.default || mod)
  }

  for (const [path, mod] of Object.entries(clientModuleLocales)) merge(path, mod)
  for (const [path, mod] of Object.entries(sharedModuleLocales)) merge(path, mod)

  return messages
}

const savedLang = localStorage.getItem('app-lang') || 'en'

// vue-i18n snapshots messages at createI18n() time and Vite has no built-in HMR
// for locale files, so newly added/changed keys in any */i18n/{en,th}.js wouldn't
// appear in a running dev session (they render as raw key paths) until a full
// reload. Keep a single i18n instance alive across HMR via hot.data so main.js
// keeps using the same object, and just re-merge messages into it on update.
const i18n = import.meta.hot?.data.i18n ?? createI18n({
  legacy: false,
  locale: savedLang,
  fallbackLocale: 'en',
  messages: buildMessages(),
})

if (import.meta.hot) {
  import.meta.hot.data.i18n = i18n
  import.meta.hot.accept(() => {
    const next = buildMessages()
    for (const locale of Object.keys(next)) {
      i18n.global.setLocaleMessage(locale, next[locale])
    }
  })
}

export default i18n
