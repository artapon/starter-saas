import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api'

const GENERAL_DEFAULTS = {
  sortOrder: 'DESC',
}

const CURRENCY_DEFAULTS = {
  symbol:      '฿',
  position:    'suffix',
  thousandSep: ',',
  decimalSep:  '.',
  precision:   2,
}

const TAX_DEFAULTS = {
  rate:        0,
  inclusive:   false,
  withholding: true,
}

const CALENDAR_DEFAULTS = {
  system:     'CE',
  dateFormat: 'dd/mm/yyyy',
}

const AUDIT_DEFAULTS = {
  debug: false,
}

const SALE_ORDERS_DEFAULTS = {
  defaultSaleType: 'credit',  // 'cash' = SO → DO → Receipt | 'credit' = SO → DO → Invoice
}

export const useSettingsStore = defineStore('settings', () => {
  const general  = ref({ ...GENERAL_DEFAULTS })
  const currency = ref({ ...CURRENCY_DEFAULTS })
  const tax      = ref({ ...TAX_DEFAULTS })
  const calendar = ref({ ...CALENDAR_DEFAULTS })
  const audit    = ref({ ...AUDIT_DEFAULTS })
  const saleOrders = ref({ ...SALE_ORDERS_DEFAULTS })

  async function load() {
    try {
      const { data } = await api.get('/erp/settings/general')
      if (data?.data?.general) {
        general.value = { ...GENERAL_DEFAULTS, ...data.data.general }
      }
      if (data?.data?.currency) {
        currency.value = { ...CURRENCY_DEFAULTS, ...data.data.currency }
      }
      if (data?.data?.tax) {
        tax.value = { ...TAX_DEFAULTS, ...data.data.tax }
      }
      if (data?.data?.calendar) {
        calendar.value = { ...CALENDAR_DEFAULTS, ...data.data.calendar }
      }
      if (data?.data?.audit) {
        audit.value = { ...AUDIT_DEFAULTS, ...data.data.audit }
      }
      if (data?.data?.saleOrders) {
        saleOrders.value = { ...SALE_ORDERS_DEFAULTS, ...data.data.saleOrders }
      }
    } catch {
      // fall back to defaults
    }
  }

  async function saveGeneral(config) {
    const { data } = await api.put('/erp/settings/general', { general: config })
    general.value = { ...GENERAL_DEFAULTS, ...data.data.general }
  }

  async function saveCurrency(config) {
    const { data } = await api.put('/erp/settings/general', { currency: config })
    currency.value = { ...CURRENCY_DEFAULTS, ...data.data.currency }
  }

  async function saveTax(config) {
    const { data } = await api.put('/erp/settings/general', { tax: config })
    tax.value = { ...TAX_DEFAULTS, ...data.data.tax }
  }

  async function saveCalendar(config) {
    const { data } = await api.put('/erp/settings/general', { calendar: config })
    calendar.value = { ...CALENDAR_DEFAULTS, ...data.data.calendar }
  }

  async function saveAudit(config) {
    const { data } = await api.put('/erp/settings/general', { audit: config })
    audit.value = { ...AUDIT_DEFAULTS, ...data.data.audit }
  }

  async function saveAll({ currency: currencyData, tax: taxData }) {
    const { data } = await api.put('/erp/settings/general', { currency: currencyData, tax: taxData })
    if (data?.data?.currency) currency.value = { ...CURRENCY_DEFAULTS, ...data.data.currency }
    if (data?.data?.tax)      tax.value      = { ...TAX_DEFAULTS,      ...data.data.tax }
  }

  async function saveSaleOrders(config) {
    const { data } = await api.put('/erp/settings/general', { saleOrders: config })
    saleOrders.value = { ...SALE_ORDERS_DEFAULTS, ...data.data.saleOrders }
  }

  return { general, currency, tax, calendar, audit, saleOrders, load, saveGeneral, saveCurrency, saveTax, saveCalendar, saveAudit, saveSaleOrders, saveAll }
})
