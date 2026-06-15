<template>
  <AppLayout>
    <div class="space-y-5">

      <PageHeader :title="t('erp.invoices.new')" back-to="/erp/invoices"
        :breadcrumb="[
          { label: t('erp.invoices.title'), to: '/erp/invoices' },
          { label: t('common.create') },
        ]">
        <template #badge>
          <StatusPill :label="t('erp.common.draft')" />
        </template>
        <template #actions>
          <KeyboardShortcuts :shortcuts="shortcuts" width="w-56" />
          <HeaderSaveActions
            cancel-to="/erp/invoices"
            :cancel-label="t('common.cancel')"
            :saving="saving"
            :saving-label="t('erp.common.creating')"
            :save-label="t('erp.invoices.create')"
            :disabled="!canSave"
            :disabled-hint="t('erp.invoices.fillRequiredFields')"
            @save="save"
          />
        </template>
      </PageHeader>

      <div class="space-y-5">

        <!-- Customer & Invoice Info -->
        <FormCard :title="t('erp.invoices.info')" :icon="DocumentTextIcon" icon-color="primary" :padded="false">
          <div class="px-6 py-5 grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-5">

            <div class="lg:col-span-2">
              <FieldLabel :text="t('erp.common.customer')" required />
              <div class="flex gap-2 items-start">
                <div ref="customerFieldRef" class="flex-1 min-w-0">
                  <SearchSelect v-model="form.customerId" :options="customers" :invalid="!!errors.customerId" placeholder="— Select customer —">
                    <template #option="{ option }">{{ option.name }}<span v-if="option.company" class="text-[#9BA7B0]"> · {{ option.company }}</span></template>
                    <template #singleLabel="{ option }">{{ option.name }}<span v-if="option.company" class="text-[#9BA7B0]"> · {{ option.company }}</span></template>
                  </SearchSelect>
                </div>
                <button type="button" @click="openCustomerCreate"
                  :title="`${t('erp.invoices.newCustomer')} (Alt+C)`"
                  class="px-3 py-2.5 text-[12px] font-semibold border border-primary-200
                         text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors flex-shrink-0 inline-flex items-center gap-1.5">
                  <PlusIcon class="w-3.5 h-3.5" />
                  {{ t('erp.invoices.newCustomer') }}
                </button>
              </div>
              <FieldError name="customerId" :errors="errors" />
              <CustomerChip :customer="selectedCustomer" />
            </div>

            <FormField name="referenceNumber" :label="t('erp.invoices.referenceNumber')" :errors="errors"
              v-model="form.referenceNumber" placeholder="e.g. PO-2025-001" />

            <FormField name="invoiceDate" :label="t('erp.invoices.invoiceDate')" :errors="errors" required>
              <template #default="{ hasError }">
                <DateInput v-model="form.invoiceDate" :class="['input', hasError && 'input-error']" />
              </template>
            </FormField>

            <FormField name="dueDate" :label="t('erp.invoices.dueDate')" :errors="errors">
              <template #default>
                <DateInput v-model="form.dueDate" class="input" />
              </template>
            </FormField>

            <div>
              <FieldLabel :text="t('erp.invoices.referenceOrder')" />
              <SearchSelect v-model="form.orderId" :options="orders" label-key="orderNumber" placeholder="— None —" @change="onOrderChange" />
            </div>

            <div>
              <FieldLabel :text="t('erp.common.currency')" />
              <CurrencySelector v-model="form.currency" v-model:exchangeRate="form.exchangeRate" :as-of-date="form.invoiceDate" />
            </div>

            <FormField name="paymentTerms" :label="t('erp.invoices.paymentTerms')" :errors="errors">
              <template #default="{ id }">
                <select :id="id" v-model="form.paymentTerms" class="input">
                  <option value="">—</option>
                  <option v-for="opt in paymentTerms" :key="opt.id" :value="opt.code || opt.name">{{ opt.name }}</option>
                </select>
              </template>
            </FormField>

            <div>
              <FieldLabel :text="t('erp.invoices.salesperson')" />
              <SearchSelect v-model="form.salespersonId" :options="staff" placeholder="— Salesperson —">
                <template #option="{ option }">{{ option.name }}<span v-if="option.email" class="text-[#9BA7B0]"> · {{ option.email }}</span></template>
                <template #singleLabel="{ option }">{{ option.name }}</template>
              </SearchSelect>
            </div>

          </div>
        </FormCard>

        <!-- Addresses -->
        <FormCard :title="t('erp.invoices.addresses')" :icon="MapPinIcon" icon-color="primary" :padded="false">
          <template #actions>
            <button type="button" @click="syncAddressesFromCustomer"
              :disabled="!selectedCustomer?.address"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold
                     text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <ArrowPathIcon class="w-3.5 h-3.5" />
              {{ t('erp.invoices.useCustomerAddress') }}
            </button>
          </template>
          <div class="px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FormField name="shippingAddress" :label="t('erp.invoices.shippingAddress')" :errors="errors"
              v-model="form.shippingAddress" textarea :rows="3" input-class="resize-none" />
            <div>
              <div class="flex items-center justify-between">
                <FieldLabel :text="t('erp.invoices.billingAddress')" />
                <label class="flex items-center gap-1.5 text-[11px] text-[#637381] cursor-pointer select-none">
                  <input type="checkbox" v-model="billingSameAsShipping" class="" />
                  {{ t('erp.invoices.sameAsShipping') }}
                </label>
              </div>
              <textarea v-model="form.billingAddress" rows="3"
                :disabled="billingSameAsShipping"
                class="w-full px-3.5 py-2.5 border border-[#E2E8F0] text-[13px] text-[#1C2434]
                       focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
                       transition-all resize-none disabled:bg-[#F7F9FC] disabled:text-[#9BA7B0]" />
            </div>
          </div>
        </FormCard>

        <!-- Line Items -->
        <FormCard :title="t('erp.invoices.lineItems')" :icon="ClipboardDocumentListIcon" icon-color="green"
          :subtitle="itemsSubtitle" :padded="false">
          <template #actions>
            <button @click="openBulkPicker" type="button"
              :title="`${t('erp.invoices.addItem')} (Ctrl+A)`"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold
                     text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200
                     transition-colors">
              <PlusIcon class="w-3.5 h-3.5" />
              {{ t('erp.invoices.addItem') }}
              <kbd class="hidden sm:inline ml-0.5 px-1.5 py-0.5 bg-white/80 border border-primary-200 font-mono text-[10px] text-primary-700">Ctrl+A</kbd>
            </button>
          </template>

          <EmptyState v-if="!form.items.length"
            :icon="ClipboardDocumentListIcon"
            :title="t('erp.common.noItems')"
            :subtitle="t('erp.invoices.noItemsHint')"
            :action-label="t('erp.invoices.addFirstItem')"
            :error-message="errors.items"
            @action="openBulkPicker" />

          <div v-else>
            <div class="grid items-center gap-3 px-5 py-2.5 bg-[#F7F9FC] border-b border-[#E2E8F0]"
              style="grid-template-columns: 1.8rem 2.5fr 1.4fr 2fr 4.5rem 6rem 4.5rem 5.5rem 5.5rem 2rem">
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider text-center">#</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">{{ t('erp.invoices.saleItem') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">{{ t('erp.invoices.store') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">{{ t('erp.invoices.description') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider text-right">{{ t('erp.common.qty') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider text-right">{{ t('erp.invoices.colUnitPrice') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider text-right">{{ t('erp.invoices.tax') }} %</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider text-right">{{ t('erp.invoices.tax') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider text-right">{{ t('erp.invoices.colAmount') }}</div>
              <div></div>
            </div>

            <div class="divide-y divide-[#E2E8F0]">
              <div v-for="(line, idx) in form.items" :key="line.key || idx"
                v-show="isRowVisible(line)"
                :data-line-key="line.key"
                class="grid items-center gap-3 px-5 py-3 transition-colors group border-l-2"
                :class="[
                  line.isPackage ? 'bg-primary-50/40 border-l-primary-400'
                    : (line.parentKey ? 'bg-[#F7F9FC]/60 hover:bg-[#F1F5F9] border-l-primary-200' : 'border-l-transparent hover:bg-[#F7F9FC]'),
                  dragFromIdx === topLevelStart(idx) ? 'opacity-40' : '',
                  dragOverIdx === topLevelStart(idx) && dragFromIdx !== topLevelStart(idx) ? 'border-t-2 border-t-primary-500' : '',
                ]"
                style="grid-template-columns: 1.8rem 2.5fr 1.4fr 2fr 4.5rem 6rem 4.5rem 5.5rem 5.5rem 2rem"
                @dragover="onDragOver($event, idx)"
                @drop="onDrop(idx)"
                @dragleave="onDragLeave(idx)">

                <div v-if="!line.parentKey"
                  draggable="true"
                  @dragstart="onDragStart($event, idx)"
                  @dragend="onDragEnd"
                  class="text-[12px] font-semibold text-center select-none flex items-center justify-center
                         cursor-grab active:cursor-grabbing hover:bg-[#E2E8F0]/60 h-7
                         text-[#CBD5E1] group-hover:text-[#637381]">
                  <Bars3Icon class="w-4 h-4 hidden group-hover:block" />
                  <span class="group-hover:hidden">{{ idx + 1 }}</span>
                </div>
                <div v-else class="text-[11px] text-[#CBD5E1] text-center select-none">↳</div>

                <div v-if="line.isPackage" class="flex items-center gap-1.5 text-[13px] font-semibold text-primary-700">
                  <button type="button" @click="toggleCollapse(line.key)"
                    class="flex items-center justify-center w-5 h-5 hover:bg-primary-100 text-primary-600 flex-shrink-0">
                    <ChevronRightIcon v-if="isCollapsed(line.key)" class="w-3.5 h-3.5" />
                    <ChevronDownIcon  v-else                       class="w-3.5 h-3.5" />
                  </button>
                  <CubeIcon class="w-4 h-4 flex-shrink-0" />
                  <span class="truncate">{{ line.productName }}</span>
                  <span class="text-[11px] font-normal text-[#9BA7B0]">· {{ t('erp.invoices.salePackage') }}</span>
                </div>
                <div v-else-if="line.parentKey" class="text-[12px] text-[#9BA7B0] truncate pl-2">
                  {{ t('erp.invoices.packageItem') }}
                </div>
                <SearchSelectPopup
                  v-else
                  v-model="line.saleItemId"
                  :options="groupedItemOptions"
                  group-values="items"
                  group-label="label"
                  placeholder="— Item —"
                  search-placeholder="Search by code or name…"
                  @change="onPickerChange(line, idx)"
                />

                <div>
                  <SearchSelect v-if="!line.isPackage && line.hasProduct" v-model="line.storeId" :options="stores" placeholder="— Store —" />
                  <div v-else class="flex items-center justify-center h-9">
                    <span class="text-[12px] text-[#CBD5E1]">—</span>
                  </div>
                </div>

                <div v-if="line.parentKey" class="flex items-center gap-2 pl-5 text-[13px] text-[#374151] truncate">
                  <span class="truncate">{{ line.productName }}</span>
                  <span class="text-[11px] font-semibold text-[#9BA7B0] tabular-nums flex-shrink-0">× {{ line.quantity }}</span>
                </div>
                <div v-else-if="line.isPackage" class="text-[12px] text-[#637381] italic">
                  {{ childrenOf(line.key).length }} item{{ childrenOf(line.key).length !== 1 ? 's' : '' }}
                </div>
                <input v-else v-model="line.productName" type="text" placeholder="Description…"
                  class="w-full px-2.5 py-2 border border-[#E2E8F0] text-[13px] text-[#1C2434]
                         focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
                         transition-all placeholder:text-[#CBD5E1]" />

                <template v-if="line.parentKey">
                  <div></div><div></div><div></div><div></div><div></div>
                </template>
                <template v-else>
                  <input v-model.number="line.quantity" type="number" min="0.001" step="0.001"
                    class="w-full px-2 py-2 border border-[#E2E8F0] text-[13px] text-right
                           text-[#1C2434] tabular-nums focus:outline-none focus:ring-2
                           focus:ring-primary-500/20 focus:border-primary-400 transition-all" />

                  <input v-model.number="line.unitPrice" type="number" min="0" step="0.01" placeholder="0.00"
                    class="w-full px-2.5 py-2 border border-[#E2E8F0] text-[13px] text-right
                           text-[#1C2434] tabular-nums focus:outline-none focus:ring-2
                           focus:ring-primary-500/20 focus:border-primary-400 transition-all placeholder:text-[#CBD5E1]" />

                  <input v-model.number="line.taxRate" type="number" min="0" max="100" step="0.01" placeholder="0"
                    class="w-full px-2 py-2 border border-[#E2E8F0] text-[13px] text-right
                           text-[#1C2434] tabular-nums focus:outline-none focus:ring-2
                           focus:ring-primary-500/20 focus:border-primary-400 transition-all placeholder:text-[#CBD5E1]" />

                  <div class="text-[13px] text-[#637381] tabular-nums text-right">
                    {{ fmtMoney(lineTax(line)) }}
                  </div>

                  <div class="text-[13px] tabular-nums text-right"
                    :class="line.isPackage ? 'font-bold text-primary-700' : 'font-semibold text-[#1C2434]'">
                    {{ fmtMoney((line.quantity || 0) * (line.unitPrice || 0)) }}
                  </div>
                </template>

                <button @click="removeLine(idx)" type="button"
                  class="w-7 h-7 flex items-center justify-center flex-shrink-0
                         text-[#CBD5E1] hover:text-red-500 hover:bg-red-50 transition-colors
                         opacity-0 group-hover:opacity-100">
                  <TrashIcon class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div class="grid items-center gap-3 px-5 py-3.5 bg-[#F7F9FC] border-t border-[#E2E8F0]"
              style="grid-template-columns: 1.8rem 2.5fr 1.4fr 2fr 4.5rem 6rem 4.5rem 5.5rem 5.5rem 2rem">
              <div class="col-span-7 text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider text-right">
                {{ t('erp.invoices.subtotal') }}
              </div>
              <div class="text-[13px] font-semibold text-[#637381] tabular-nums text-right">{{ fmtMoney(taxAmount) }}</div>
              <div class="text-[13px] font-bold text-[#1C2434] tabular-nums text-right">{{ fmtMoney(subtotal) }}</div>
              <div></div>
            </div>

            <p v-if="errors.items" class="px-5 py-2.5 text-[11px] text-red-600 bg-[#FEE2E2] border-t border-[#FECACA]">
              {{ errors.items }}
            </p>
          </div>

          <SearchSelectPopup
            ref="bulkPickerRef"
            :model-value="''"
            :options="groupedItemOptions"
            group-values="items"
            group-label="label"
            multiple
            hide-trigger
            search-placeholder="Search by code or name…"
            @submit="onBulkAdd"
          />
        </FormCard>

        <ErrorBanner :message="globalError" />

        <!-- Summary + totals -->
        <FormCard :title="t('erp.invoices.invoiceSummary')" :icon="CalculatorIcon" icon-color="slate" :padded="false">
          <div class="px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <FormField name="notes" :label="t('erp.common.notes')" :errors="errors"
              v-model="form.notes" textarea placeholder="Invoice notes or payment instructions…"
              wrapper-class="flex flex-col text-left" input-class="flex-1 min-h-[10rem]" />
            <dl class="w-full space-y-2.5">
              <div class="flex items-center justify-between text-[13px]">
                <dt class="text-[#637381]">{{ t('erp.invoices.subtotal') }}</dt>
                <dd class="font-semibold text-[#1C2434] tabular-nums">{{ fmtMoney(subtotal) }}</dd>
              </div>
              <div class="flex items-center justify-between text-[13px]">
                <dt class="text-[#637381]">{{ t('erp.invoices.tax') }}</dt>
                <dd class="font-semibold text-[#1C2434] tabular-nums">{{ fmtMoney(taxAmount) }}</dd>
              </div>
              <div class="flex items-center justify-between text-[13px] gap-3">
                <dt class="text-[#637381] flex-shrink-0">{{ t('erp.invoices.discount') }}</dt>
                <div class="flex items-center gap-1.5">
                  <select v-model="form.discountType"
                    class="px-2 py-1.5 border border-[#E2E8F0] text-[12px] bg-white
                           focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                    <option value="">—</option>
                    <option value="percent">%</option>
                    <option value="fixed">{{ form.currency || '฿' }}</option>
                  </select>
                  <input v-model.number="form.discountValue" type="number" min="0" step="0.01" placeholder="0"
                    :disabled="!form.discountType"
                    class="w-20 px-2 py-1.5 border border-[#E2E8F0] text-[12px] text-right tabular-nums
                           focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
                           disabled:bg-[#F7F9FC] disabled:text-[#9BA7B0]" />
                  <span class="text-[13px] font-semibold text-red-600 tabular-nums w-20 text-right">−{{ fmtMoney(discountAmount) }}</span>
                </div>
              </div>
              <div v-if="settings.tax?.withholding" class="flex items-center justify-between text-[13px] gap-3">
                <dt class="text-[#637381] flex-shrink-0">{{ t('erp.invoices.wht') }}</dt>
                <div class="flex items-center gap-1.5">
                  <select v-model="form.whtCode" @change="onWhtChange"
                    class="max-w-[12rem] px-2 py-1.5 border border-[#E2E8F0] text-[12px] bg-white
                           focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                    <option value="">—</option>
                    <option v-for="o in whtOptions" :key="o.id" :value="o.code">{{ o.name }} ({{ o.dataValue }}%)</option>
                  </select>
                  <span class="text-[13px] font-semibold text-red-600 tabular-nums w-20 text-right">−{{ fmtMoney(whtAmount) }}</span>
                </div>
              </div>
              <div class="flex items-center justify-between pt-2.5 border-t border-[#E2E8F0]">
                <dt class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">{{ t('erp.invoices.total') }}</dt>
                <dd class="text-base font-bold text-[#1C2434] tabular-nums">{{ fmtMoney(grandTotal) }}</dd>
              </div>
              <div v-if="Number(whtAmount) > 0" class="flex items-center justify-between pt-2.5 border-t border-[#E2E8F0]">
                <dt class="text-[11px] font-semibold text-[#9BA7B0] uppercase tracking-wider">{{ t('erp.invoices.netTotal') }}</dt>
                <dd class="text-base font-bold text-primary-600 tabular-nums">{{ fmtMoney(netTotal) }}</dd>
              </div>
            </dl>
          </div>
        </FormCard>

      </div>
    </div>

    <!-- Sticky save bar -->
    <div class="sticky bottom-0 -mx-6 mt-6 px-6 py-3.5 bg-white/95 backdrop-blur border-t border-[#E2E8F0] shadow-[0_-4px_12px_rgba(15,23,42,0.05)] z-20
                flex items-center justify-between gap-3">
      <div class="flex items-center gap-4">
        <div>
          <p class="text-[10px] font-semibold text-[#9BA7B0] uppercase tracking-wider mb-0.5">{{ t('erp.invoices.total') }}</p>
          <p class="text-2xl font-extrabold tabular-nums leading-none text-primary-600">{{ fmtMoney(grandTotal) }}</p>
        </div>
        <span v-if="draftSavedAt" class="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-600">
          <CheckIcon class="w-3.5 h-3.5" />
          {{ t('erp.invoices.savedDraft') }} · {{ savedAtRelative }}
        </span>
        <span v-else-if="dirty" class="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-600">
          <ExclamationTriangleIcon class="w-3.5 h-3.5" />
          {{ t('erp.invoices.unsavedChanges') }}
        </span>
      </div>
      <div class="flex items-center gap-2.5">
        <div class="hidden lg:flex items-center gap-3 text-[11px] text-[#9BA7B0] mr-1">
          <span class="flex items-center gap-1" :title="t('erp.invoices.saveDraft')">
            <kbd class="px-1.5 py-0.5 border border-[#E2E8F0] bg-[#F7F9FC] font-mono text-[10px]">Ctrl+S</kbd>
            <span>draft</span>
          </span>
          <span class="flex items-center gap-1" :title="t('erp.invoices.create')">
            <kbd class="px-1.5 py-0.5 border border-[#E2E8F0] bg-[#F7F9FC] font-mono text-[10px]">Ctrl+Shift+S</kbd>
            <span>save</span>
          </span>
          <span class="flex items-center gap-1">
            <kbd class="px-1.5 py-0.5 border border-[#E2E8F0] bg-[#F7F9FC] font-mono text-[10px]">Ctrl+A</kbd>
            <span>item</span>
          </span>
        </div>
        <button @click="discard" type="button"
          class="px-4 py-2.5 text-sm font-medium text-[#637381] hover:text-[#1C2434] transition-colors">
          {{ t('erp.invoices.discard') }}
        </button>
        <button @click="saveDraft" :disabled="!canSave || savingDraft || saving" type="button"
          :title="!canSave ? t('erp.invoices.fillRequiredFields') : `${t('erp.invoices.saveDraft')} (Ctrl+S)`"
          class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                 bg-white text-primary-600 border border-primary-200 hover:bg-primary-50
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <ArrowPathIcon v-if="savingDraft" class="w-4 h-4 animate-spin" />
          <BookmarkSquareIcon v-else class="w-4 h-4" />
          {{ savingDraft ? t('erp.common.saving') : t('erp.invoices.saveDraft') }}
        </button>
        <button @click="save" :disabled="!canSave || saving || savingDraft" type="button"
          :title="!canSave ? t('erp.invoices.fillRequiredFields') : `${t('erp.invoices.create')} (Ctrl+Shift+S)`"
          class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold
                 bg-primary-500 text-white hover:bg-primary-600 shadow-sm
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <ArrowPathIcon v-if="saving" class="w-4 h-4 animate-spin" />
          <CheckIcon v-else class="w-4 h-4" />
          {{ saving ? t('erp.common.creating') : t('erp.invoices.create') }}
        </button>
      </div>
    </div>

    <!-- Confirm dialog -->
    <Teleport to="body">
      <div v-if="confirmOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
        <div class="w-full max-w-sm bg-white shadow-2xl overflow-hidden">
          <div class="px-5 py-4 flex items-start gap-3">
            <div class="w-9 h-9 bg-amber-100 flex items-center justify-center flex-shrink-0">
              <ExclamationTriangleIcon class="w-5 h-5 text-amber-600" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-[#1C2434]">{{ confirmTitle }}</p>
              <p v-if="confirmMessage" class="mt-1 text-[12px] text-[#637381] leading-snug">{{ confirmMessage }}</p>
            </div>
          </div>
          <div class="px-5 py-3 bg-[#F7F9FC] flex items-center justify-end gap-2">
            <button type="button" @click="confirmAnswer(false)"
              class="px-4 py-2 text-sm font-medium text-[#637381] hover:text-[#1C2434]">{{ t('common.cancel') }}</button>
            <button type="button" @click="confirmAnswer(true)"
              class="px-4 py-2 text-sm font-semibold bg-red-500 text-white hover:bg-red-600 shadow-sm">
              {{ confirmOkLabel }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Inline customer create slide-over -->
    <Teleport to="body">
      <div v-if="customerCreateOpen" class="fixed inset-0 z-50 flex">
        <div class="flex-1 bg-black/30" @click="closeCustomerCreate"></div>
        <div class="w-full max-w-md bg-white shadow-2xl overflow-y-auto flex flex-col">
          <div class="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h3 class="text-base font-semibold text-[#1C2434]">{{ t('erp.invoices.newCustomer') }}</h3>
            <button @click="closeCustomerCreate" type="button"
              class="w-8 h-8 hover:bg-[#F1F5F9] text-[#637381] flex items-center justify-center">
              <XMarkIcon class="w-4 h-4" />
            </button>
          </div>
          <div class="flex-1 px-6 py-5 space-y-4">
            <FormField name="customerName" :label="t('erp.customers.name')" :errors="{}" required>
              <template #default="{ id }">
                <input :id="id" v-model="newCustomer.name" ref="newCustomerNameRef" type="text"
                  placeholder="Customer name" class="input" />
              </template>
            </FormField>
            <FormField name="customerCompany" :label="t('erp.customers.company')" :errors="{}"
              v-model="newCustomer.company" />
            <div class="grid grid-cols-2 gap-4">
              <FormField name="customerEmail" :label="t('erp.customers.email')" :errors="{}"
                v-model="newCustomer.email" type="email" />
              <FormField name="customerPhone" :label="t('erp.customers.phone')" :errors="{}"
                v-model="newCustomer.phone" />
            </div>
            <FormField name="customerAddress" :label="t('erp.customers.address')" :errors="{}"
              v-model="newCustomer.address" textarea :rows="3" input-class="resize-none" />
            <p v-if="newCustomerError" class="text-[12px] text-red-600">{{ newCustomerError }}</p>
          </div>
          <div class="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
            <button @click="closeCustomerCreate" type="button"
              class="px-4 py-2 text-sm text-[#637381] hover:text-[#1C2434]">{{ t('common.cancel') }}</button>
            <button @click="saveCustomer" :disabled="newCustomerSaving" type="button"
              class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50">
              <ArrowPathIcon v-if="newCustomerSaving" class="w-4 h-4 animate-spin" />
              <CheckIcon v-else class="w-4 h-4" />
              {{ newCustomerSaving ? t('erp.common.creating') : t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import {
  PlusIcon, TrashIcon, XMarkIcon, CheckIcon, DocumentTextIcon,
  ArrowPathIcon, ClipboardDocumentListIcon, CalculatorIcon,
  ExclamationTriangleIcon, Bars3Icon, CubeIcon, ChevronDownIcon, ChevronRightIcon,
  MapPinIcon, BookmarkSquareIcon,
} from '@heroicons/vue/24/outline'
import AppLayout from '@/layouts/AppLayout.vue'
import CurrencySelector from '@/components/CurrencySelector.vue'
import SearchSelect from '@/components/SearchSelect.vue'
import SearchSelectPopup from '@/components/SearchSelectPopup.vue'
import KeyboardShortcuts from '@/components/KeyboardShortcuts.vue'
import { useFormShortcuts } from '@/composables/useShortcuts'
import PageHeader from '@/components/form/PageHeader.vue'
import FormCard from '@/components/form/FormCard.vue'
import FormField from '@/components/form/FormField.vue'
import FieldLabel from '@/components/form/FieldLabel.vue'
import FieldError from '@/components/form/FieldError.vue'
import ErrorBanner from '@/components/form/ErrorBanner.vue'
import StatusPill from '@/components/form/StatusPill.vue'
import HeaderSaveActions from '@/components/form/HeaderSaveActions.vue'
import CustomerChip from '@/components/form/CustomerChip.vue'
import EmptyState from '@/components/form/EmptyState.vue'
import { useFieldErrors } from '@/composables/useFieldErrors'
import api from '@/api'
import { fmtMoney, toFixed } from '@/utils/fmt'
import { parseApiError } from '@/utils/apiError'
import { useSettingsStore } from '@/stores/settings'

const { t }    = useI18n()
const router   = useRouter()
const settings = useSettingsStore()

const customers    = ref([])
const orders       = ref([])
const saleItems    = ref([])
const salePackages = ref([])
const stores       = ref([])
const staff        = ref([])
const paymentTerms = ref([])
const whtOptions   = ref([])
const globalError  = ref('')
const saving       = ref(false)
const savingDraft  = ref(false)
const draftSavedAt = ref(null)
const errors       = ref({})
const { setFromError, reset: resetErrors } = useFieldErrors()

// First successful Save Draft yields an invoice id; subsequent saves PUT to
// that id instead of POSTing, so the page silently transitions to edit mode.
const createdInvoiceId = ref('')

const customerCreateOpen = ref(false)
const newCustomer        = ref({ name: '', company: '', email: '', phone: '', address: '' })
const newCustomerError   = ref('')
const newCustomerSaving  = ref(false)
const newCustomerNameRef = ref(null)
const customerFieldRef   = ref(null)

const today = new Date().toISOString().slice(0, 10)
const form  = ref({
  customerId: '', orderId: '', invoiceDate: today, dueDate: '',
  currency: '', exchangeRate: 1, notes: '', items: [],
  referenceNumber: '', paymentTerms: '', salespersonId: '',
  shippingAddress: '', billingAddress: '',
  discountType: '', discountValue: 0,
  whtCode: '', whtRate: 0,
})
const billingSameAsShipping = ref(true)

const dirty = ref(false)
let dirtyArmed = false
watch(form, () => { if (dirtyArmed) dirty.value = true }, { deep: true })
onMounted(() => { setTimeout(() => { dirtyArmed = true }, 0) })

function onBeforeUnload(e) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = t('erp.invoices.unsavedChanges')
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload))

const confirmOpen     = ref(false)
const confirmTitle    = ref('')
const confirmMessage  = ref('')
const confirmOkLabel  = ref('OK')
let confirmResolver   = null
function confirmAsync({ title, message, okLabel } = {}) {
  confirmTitle.value   = title   || ''
  confirmMessage.value = message || ''
  confirmOkLabel.value = okLabel || 'OK'
  confirmOpen.value    = true
  return new Promise(resolve => { confirmResolver = resolve })
}
function confirmAnswer(ok) {
  confirmOpen.value = false
  if (confirmResolver) { confirmResolver(ok); confirmResolver = null }
}

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return await confirmAsync({
    title:   t('erp.invoices.unsavedChanges'),
    message: t('erp.invoices.unsavedChangesHint'),
    okLabel: t('erp.invoices.discard'),
  })
})

const selectedCustomer = computed(() =>
  form.value.customerId ? customers.value.find(c => c.id === form.value.customerId) : null
)

const groupedItemOptions = computed(() => {
  const groups = [{ label: t('erp.invoices.saleItems'), items: saleItems.value }]
  if (salePackages.value.length) {
    groups.push({
      label: t('erp.invoices.salePackages'),
      items: salePackages.value.map(p => ({ ...p, name: `📦 ${p.name}` })),
    })
  }
  return groups
})

onMounted(() => {
  setTimeout(() => {
    const root = customerFieldRef.value?.querySelector('.multiselect')
    root?.focus()
  }, 100)
})

onMounted(async () => {
  const [cRes, oRes, siRes, spRes, stRes, staffRes, ptRes, whtRes] = await Promise.allSettled([
    api.get('/erp/customers',     { params: { limit: 200 } }),
    api.get('/erp/sale-orders',        { params: { limit: 500, status: 'confirmed' } }),
    api.get('/erp/sale-items',    { params: { limit: 500, status: 'active' } }),
    api.get('/erp/sale-packages', { params: { limit: 200, status: 'active' } }),
    api.get('/erp/stores',        { params: { limit: 200 } }),
    api.get('/organizations/staff'),
    api.get('/erp/master-data/payment-terms'),
    api.get('/erp/master-data/by-name/WHT Type'),
  ])
  if (cRes.status     === 'fulfilled') customers.value    = cRes.value.data.data.customers || []
  if (oRes.status     === 'fulfilled') orders.value       = oRes.value.data.data.orders    || []
  if (siRes.status    === 'fulfilled') saleItems.value    = siRes.value.data.data.items    || []
  if (spRes.status    === 'fulfilled') salePackages.value = spRes.value.data.data.items    || []
  if (stRes.status    === 'fulfilled') stores.value       = stRes.value.data.data.stores   || []
  if (staffRes.status === 'fulfilled') staff.value        = staffRes.value.data.data.staff || []
  if (ptRes.status    === 'fulfilled') paymentTerms.value = ptRes.value.data.data.values   || []
  if (whtRes.status   === 'fulfilled') whtOptions.value   = whtRes.value.data.data.values  || []
})

watch(() => form.value.customerId, (id) => {
  const c = customers.value.find(x => x.id === id)
  if (!c) return
  if (!form.value.shippingAddress && c.address) form.value.shippingAddress = c.address
})

watch(billingSameAsShipping, (on) => {
  if (on) form.value.billingAddress = form.value.shippingAddress
}, { immediate: true })
watch(() => form.value.shippingAddress, (v) => {
  if (billingSameAsShipping.value) form.value.billingAddress = v
})

function syncAddressesFromCustomer() {
  const c = selectedCustomer.value
  if (!c?.address) return
  form.value.shippingAddress = c.address
  if (billingSameAsShipping.value) form.value.billingAddress = c.address
}

function onOrderChange() {
  const id = form.value.orderId
  if (!id) return
  const o = orders.value.find(x => x.id === id)
  if (!o) return
  if (!form.value.customerId && o.customerId) form.value.customerId = o.customerId
}

function openCustomerCreate() {
  newCustomer.value = { name: '', company: '', email: '', phone: '', address: '' }
  newCustomerError.value = ''
  customerCreateOpen.value = true
  setTimeout(() => newCustomerNameRef.value?.focus(), 50)
}
function closeCustomerCreate() { customerCreateOpen.value = false }
async function saveCustomer() {
  newCustomerError.value = ''
  if (!newCustomer.value.name?.trim()) { newCustomerError.value = 'Name is required'; return }
  newCustomerSaving.value = true
  try {
    const { data } = await api.post('/erp/customers', { ...newCustomer.value, status: 'active' })
    const c = data.data?.customer || data.data
    if (c?.id) {
      customers.value = [c, ...customers.value]
      form.value.customerId = c.id
    }
    customerCreateOpen.value = false
  } catch (err) {
    newCustomerError.value = parseApiError(err, 'Failed to create customer')
  } finally {
    newCustomerSaving.value = false
  }
}

const { shortcuts } = useFormShortcuts({
  save: () => save(),
  saveDraft: () => saveDraft(),
  cancel: () => discard(),
  enabled: () => !customerCreateOpen.value,
  cancelLabel: 'Back to list',
  extra: [
    { combo: 'ctrl+a', handler: () => openBulkPicker(), hint: { key: 'Ctrl+A', label: 'Add item' } },
    { combo: 'alt+c',  handler: () => openCustomerCreate(), hint: { key: 'Alt+C', label: 'New customer' } },
  ],
})

// The customer slide-over's Escape (close) is handled separately so it takes
// over while open (page shortcuts are suppressed via the `enabled` guard above).
function onModalKeydown(e) {
  if (customerCreateOpen.value && e.key === 'Escape') { e.preventDefault(); closeCustomerCreate() }
}
onMounted(() => window.addEventListener('keydown', onModalKeydown))
onUnmounted(() => window.removeEventListener('keydown', onModalKeydown))

function defaultTaxRate() {
  for (let i = form.value.items.length - 1; i >= 0; i--) {
    if (form.value.items[i].isPackage) continue
    return Number(form.value.items[i].taxRate) || 0
  }
  return Number(settings.tax?.rate) || 0
}

let _localKeyCounter = 0
function newKey() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `k${Date.now()}-${++_localKeyCounter}`
}

function removeLine(idx) {
  const line = form.value.items[idx]
  if (line.isPackage) {
    form.value.items = form.value.items.filter(it => it.key !== line.key && it.parentKey !== line.key)
  } else {
    form.value.items.splice(idx, 1)
  }
}

function childrenOf(parentKey) {
  return form.value.items.filter(it => it.parentKey === parentKey)
}

const collapsedPackages = ref(new Set())
function isCollapsed(key) { return collapsedPackages.value.has(key) }
function toggleCollapse(key) {
  const next = new Set(collapsedPackages.value)
  if (next.has(key)) next.delete(key); else next.add(key)
  collapsedPackages.value = next
}
function isRowVisible(line) { return !(line.parentKey && isCollapsed(line.parentKey)) }

const dragFromIdx = ref(null)
const dragOverIdx = ref(null)
function topLevelStart(idx) {
  const line = form.value.items[idx]
  if (!line || !line.parentKey) return idx
  return form.value.items.findIndex(it => it.key === line.parentKey)
}
function groupSpan(startIdx) {
  const start = form.value.items[startIdx]
  if (!start || !start.isPackage) return 1
  let n = 1
  for (let i = startIdx + 1; i < form.value.items.length; i++) {
    if (form.value.items[i].parentKey === start.key) n++
    else break
  }
  return n
}
function onDragStart(e, idx) {
  const top = topLevelStart(idx)
  dragFromIdx.value = top
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(top))
}
function onDragOver(e, idx) {
  if (dragFromIdx.value === null) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dragOverIdx.value = topLevelStart(idx)
}
function onDragLeave(idx) {
  if (dragOverIdx.value === topLevelStart(idx)) dragOverIdx.value = null
}
function onDrop(idx) {
  const from = dragFromIdx.value
  const to   = topLevelStart(idx)
  if (from === null || from === to) { onDragEnd(); return }
  const fromSpan   = groupSpan(from)
  const targetSpan = groupSpan(to)
  const moved = form.value.items.splice(from, fromSpan)
  const insertAt = from < to ? (to - fromSpan) + targetSpan : to
  form.value.items.splice(insertAt, 0, ...moved)
  onDragEnd()
}
function onDragEnd() { dragFromIdx.value = null; dragOverIdx.value = null }

const bulkPickerRef = ref(null)
function openBulkPicker() { bulkPickerRef.value?.open() }

function getBestPricing(si, customerGroupId) {
  const pricings = si.pricings || []
  if (!pricings.length) return null
  if (customerGroupId) {
    const match = pricings.find(p => p.customerGroupId === customerGroupId)
    if (match) return match
  }
  return pricings.find(p => !p.customerGroupId) || pricings[0]
}

function applyPricing(line) {
  if (!line.saleItemId) return
  const si = saleItems.value.find(s => s.id === line.saleItemId)
  if (!si) return
  const customer = customers.value.find(c => c.id === form.value.customerId)
  const pricing = getBestPricing(si, customer?.customerGroupId)
  if (pricing) line.unitPrice = Number(pricing.unitPrice)
}

function makeLineFromSaleItem(si) {
  const customer = customers.value.find(c => c.id === form.value.customerId)
  const pricing  = getBestPricing(si, customer?.customerGroupId)
  return {
    key:           newKey(),
    parentKey:     '',
    isPackage:     false,
    salePackageId: '',
    saleItemId:    si.id,
    productId:     si.productId || '',
    storeId:       '',
    hasProduct:    !!si.productId,
    productName:   si.name,
    itemCode:      si.code || '',
    quantity:      1,
    unitPrice:     pricing ? Number(pricing.unitPrice) : 0,
    taxRate:       defaultTaxRate(),
  }
}

async function linesFromPackage(packageId) {
  try {
    const { data } = await api.get(`/erp/sale-packages/${packageId}`)
    const pkg = data.data.package
    const customer = customers.value.find(c => c.id === form.value.customerId)
    const parentKey = newKey()
    let parentPrice = 0
    const children = (pkg.packageItems || []).map(pi => {
      const si = pi.saleItem || saleItems.value.find(s => s.id === pi.saleItemId) || {}
      let resolved = pi.unitPrice != null ? Number(pi.unitPrice) : 0
      if (!resolved) {
        const pricing = si ? getBestPricing(si, customer?.customerGroupId) : null
        if (pricing) resolved = Number(pricing.unitPrice)
      }
      const childQty = Number(pi.quantity) || 1
      parentPrice += childQty * resolved
      return {
        key: newKey(), parentKey,
        isPackage: false, salePackageId: '',
        saleItemId: pi.saleItemId, productId: si.productId || '',
        storeId: '', hasProduct: !!si.productId,
        productName: si.name || 'Item',
        itemCode:    si.code || '',
        quantity: childQty, unitPrice: 0, taxRate: 0,
      }
    })
    const parent = {
      key: parentKey, parentKey: '',
      isPackage: true, salePackageId: pkg.id,
      saleItemId: '', productId: '', storeId: '',
      hasProduct: false, productName: pkg.name,
      itemCode:    pkg.code || '',
      quantity: 1, unitPrice: parentPrice,
      taxRate: Number(settings.tax?.rate) || 0,
    }
    return [parent, ...children]
  } catch {
    return []
  }
}

async function onPickerChange(line, idx) {
  const id = line.saleItemId
  if (!id) return
  if (saleItems.value.some(s => s.id === id)) {
    const si = saleItems.value.find(s => s.id === id)
    if (si) {
      line.productName = si.name
      line.productId   = si.productId || ''
      line.itemCode    = si.code || ''
      line.hasProduct  = !!si.productId
      if (!line.hasProduct) line.storeId = ''
      applyPricing(line)
    }
    return
  }
  if (salePackages.value.some(p => p.id === id)) {
    const lines = await linesFromPackage(id)
    if (lines.length) form.value.items.splice(idx, 1, ...lines)
    else              form.value.items.splice(idx, 1)
  }
}

async function onBulkAdd(objects) {
  const newLines = []
  for (const obj of objects) {
    if (saleItems.value.some(s => s.id === obj.id)) {
      newLines.push(makeLineFromSaleItem(obj))
    } else if (salePackages.value.some(p => p.id === obj.id)) {
      const lines = await linesFromPackage(obj.id)
      newLines.push(...lines)
    }
  }
  if (!newLines.length) return
  form.value.items.push(...newLines)
  await nextTick()
}

watch(() => form.value.customerId, () => {
  for (const line of form.value.items) applyPricing(line)
})

function lineTax(line) {
  if (line.parentKey) return 0
  return (line.quantity || 0) * (line.unitPrice || 0) * ((line.taxRate || 0) / 100)
}
const itemsSubtitle = computed(() => {
  const standalone = form.value.items.filter(i => !i.parentKey && !i.isPackage).length
  const packages   = form.value.items.filter(i =>  i.isPackage).length
  if (!standalone && !packages) return 'No items yet'
  const parts = []
  if (standalone) parts.push(`${standalone} item${standalone !== 1 ? 's' : ''}`)
  if (packages)   parts.push(`${packages} package${packages !== 1 ? 's' : ''}`)
  return parts.join(' · ')
})
const subtotal   = computed(() => form.value.items.reduce((s, i) => i.parentKey ? s : s + (i.quantity || 0) * (i.unitPrice || 0), 0))
const taxAmount  = computed(() => toFixed(form.value.items.reduce((s, i) => s + lineTax(i), 0), 2))
const discountAmount = computed(() => {
  const gross = subtotal.value + Number(taxAmount.value)
  const v = Number(form.value.discountValue) || 0
  if (form.value.discountType === 'percent') return toFixed(gross * v / 100, 2)
  if (form.value.discountType === 'fixed')   return toFixed(Math.min(v, gross), 2)
  return 0
})
const grandTotal = computed(() => subtotal.value + Number(taxAmount.value) - Number(discountAmount.value))
// WHT is computed on the invoice amount (subtotal + tax); net = total - WHT.
const whtAmount  = computed(() => toFixed((subtotal.value + Number(taxAmount.value)) * (Number(form.value.whtRate) || 0) / 100, 2))
const netTotal   = computed(() => toFixed(Number(grandTotal.value) - Number(whtAmount.value), 2))
function onWhtChange() {
  const o = whtOptions.value.find(x => x.code === form.value.whtCode)
  form.value.whtRate = o ? Number(o.dataValue) || 0 : 0
}

const canSave = computed(() => {
  if (!form.value.customerId || !form.value.invoiceDate) return false
  if (!form.value.items.filter(i => !i.parentKey).length) return false
  for (const item of form.value.items) {
    if (item.isPackage) {
      if (!item.quantity || item.quantity <= 0) return false
      continue
    }
    if (!item.productName?.trim()) return false
    if (!item.quantity || item.quantity <= 0) return false
  }
  return true
})

function validate() {
  const e = {}
  if (!form.value.customerId)  e.customerId  = t('erp.invoices.customerRequired')
  if (!form.value.invoiceDate) e.invoiceDate = t('erp.invoices.dateRequired')
  const pricedCount = form.value.items.filter(i => !i.parentKey).length
  if (!pricedCount) e.items = t('erp.invoices.itemsRequired')
  for (const item of form.value.items) {
    if (item.isPackage) {
      if (!item.quantity || item.quantity <= 0) { e.items = 'Package quantity must be greater than 0'; break }
      continue
    }
    if (!item.productName?.trim())        { e.items = 'All items need a name'; break }
    if (!item.quantity || item.quantity <= 0) { e.items = t('erp.invoices.itemQtyInvalid'); break }
  }
  errors.value = e
  return Object.keys(e).length === 0
}

async function save({ redirect = true } = {}) {
  globalError.value = ''
  resetErrors()
  if (!validate()) return
  if (redirect) saving.value = true
  else          savingDraft.value = true
  try {
    const payload = {
      ...form.value,
      orderId:       form.value.orderId      || null,
      dueDate:       form.value.dueDate      || null,
      discountType:  form.value.discountType || null,
      discountValue: Number(form.value.discountValue) || 0,
      items: form.value.items.map(({ key, parentKey, salePackageId, saleItemId, productId, storeId, productName, itemCode, quantity, unitPrice, taxRate }) => ({
        key, parentKey: parentKey || '',
        salePackageId: salePackageId || null,
        saleItemId:    saleItemId    || null,
        productId:     productId     || null,
        storeId:       storeId       || null,
        productName, itemCode: itemCode || null, quantity, unitPrice,
        taxRate: Number(taxRate) || 0,
      })),
    }
    let data
    if (createdInvoiceId.value) {
      ({ data } = await api.put(`/erp/invoices/${createdInvoiceId.value}`, payload))
    } else {
      ({ data } = await api.post('/erp/invoices', payload))
      createdInvoiceId.value = data.data.invoice.id
    }
    dirty.value = false
    if (redirect) {
      router.push(`/erp/invoices/${data.data.invoice.id}`)
    } else {
      draftSavedAt.value = new Date()
    }
  } catch (err) {
    const had = setFromError(err)
    if (!had) globalError.value = parseApiError(err, 'Failed to save invoice')
  } finally {
    saving.value = false
    savingDraft.value = false
  }
}

function saveDraft() { save({ redirect: false }) }

// "12s ago" / "2m ago" relative-time hint next to the saved indicator.
const _now = ref(Date.now())
onMounted(() => { const id = setInterval(() => { _now.value = Date.now() }, 15000); onUnmounted(() => clearInterval(id)) })
const savedAtRelative = computed(() => {
  if (!draftSavedAt.value) return ''
  const secs = Math.max(0, Math.round((_now.value - draftSavedAt.value.getTime()) / 1000))
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`
  return `${Math.round(secs / 3600)}h ago`
})

async function discard() {
  if (dirty.value) {
    const ok = await confirmAsync({
      title:   t('erp.invoices.unsavedChanges'),
      message: t('erp.invoices.unsavedChangesHint'),
      okLabel: t('erp.invoices.discard'),
    })
    if (!ok) return
  }
  router.push('/erp/invoices')
}
</script>
