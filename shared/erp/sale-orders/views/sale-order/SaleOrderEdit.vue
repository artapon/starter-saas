<template>
  <AppLayout>
    <div class="space-y-5 so-labels-sm">

      <PageHeader :title="loading ? t('erp.orders.editOrder') : (order?.orderNumber || t('erp.orders.editOrder'))"
        back-to="/erp/sale-orders"
        :breadcrumb="[
          { label: 'Orders', to: '/erp/sale-orders' },
          { label: order?.orderNumber || '…', to: `/erp/sale-orders/${route.params.id}` },
          { label: readonly ? t('common.view') : t('common.edit') },
        ]">
        <template #badge>
          <StatusPill
            :label="readonly ? t('erp.orders.' + order.status) : t('erp.orders.draft')"
            :variant="readonly ? (STATUS_VARIANT[order.status] || 'neutral') : 'draft'" />
        </template>
        <template #actions>
          <KeyboardShortcuts :shortcuts="shortcuts" width="w-64" />

          <!-- Workflow next-actions (moved here from the detail page): advance the
               status, cancel, or generate a delivery order. Drafts must be saved
               first, so transitions are disabled while there are unsaved edits. -->
          <template v-if="!loading && order">
            <button v-for="s in forwardTransitions" :key="s"
              @click="confirmAndChangeStatus(s)" :disabled="updatingStatus || dirty"
              :title="dirty ? t('erp.orders.saveBeforeAction') : ''"
              class="inline-flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :class="forwardBtnClass(s)">
              <ArrowPathIcon v-if="updatingStatus" class="w-3.5 h-3.5 animate-spin" />
              <template v-else>{{ transitionLabel(s) }}</template>
            </button>

            <button v-for="s in cancelTransitions" :key="s"
              @click="confirmAndChangeStatus(s)" :disabled="updatingStatus"
              class="inline-flex items-center px-3 py-2.5 text-[12px] font-semibold border border-red-200
                     text-red-600 bg-white hover:bg-red-50 transition-colors disabled:opacity-50">
              {{ t('erp.orders.cancelOrder') }}
            </button>

            <button v-if="['confirmed', 'shipped', 'delivered'].includes(order.status)"
              v-can="'erp.orders.edit'" @click="confirmAndConvert"
              :disabled="!!converting || !!order.linkedDeliveryOrder"
              :title="order.linkedDeliveryOrder ? t('erp.orders.alreadyLinkedTo', { ref: order.linkedDeliveryOrder.refNo }) : ''"
              class="inline-flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold
                     text-primary-600 bg-primary-50 border border-primary-200 hover:bg-primary-100
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <TruckIcon class="w-4 h-4" />
              {{ converting === 'do' ? t('erp.common.saving') : t('erp.orders.createDeliveryOrder') }}
            </button>
            <RouterLink v-if="order.linkedDeliveryOrder" :to="`/erp/delivery-orders/${order.linkedDeliveryOrder.id}`"
              class="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100">
              → {{ order.linkedDeliveryOrder.refNo }}
            </RouterLink>
          </template>

          <RouterLink v-if="!loading && order" :to="`/erp/sale-orders/${route.params.id}`"
            :title="t('erp.orders.previewPrint')"
            class="inline-flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold
                   text-[#637381] bg-white border border-[#E2E8F0] hover:bg-[#F7F9FC] hover:text-[#1C2434] transition-colors">
            <PrinterIcon class="w-4 h-4" />
            {{ t('erp.orders.previewPrint') }}
          </RouterLink>
        </template>
      </PageHeader>

      <ErrorBanner v-if="statusError || convertError" :message="statusError || convertError" />

      <LoadingSpinner v-if="loading" />

      <!-- Not found / not draft -->
      <ErrorBanner v-else-if="loadError" :message="loadError" />

      <!-- Sections. A disabled fieldset turns the whole form read-only for
           non-draft orders (custom multiselects get :disabled passed explicitly). -->
      <fieldset v-else :disabled="readonly" class="space-y-5 min-w-0 border-0 p-0 m-0" @focusin="scrollFocused">

        <!-- Customer & Order Info -->
        <FormCard :title="t('erp.orders.customerInfo')" :icon="UserIcon" icon-color="primary" :padded="false">
          <template #actions>
            <OrderWorkflowStrip v-if="order" :status="order.status" />
          </template>
          <div class="px-6 py-5 grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-5">

            <!-- Sale type: cash → Receipt, credit → Invoice — own full row -->
            <ReadonlyField v-if="readonly" class="lg:col-span-3" :label="t('erp.orders.saleType')" :value="saleTypeLabel" />
            <div v-else class="lg:col-span-3" ref="saleTypeContainerRef"
              @keydown.left.prevent="cycleSaleType(-1)"
              @keydown.right.prevent="cycleSaleType(1)">
              <FieldLabel :text="t('erp.orders.saleType')" required />
              <div class="flex border border-[#E2E8F0] overflow-hidden text-sm max-w-xs">
                <button v-for="opt in SALE_TYPE_OPTIONS" :key="opt.value" type="button"
                  @click="form.saleType = opt.value"
                  :class="form.saleType === opt.value
                    ? 'flex-1 py-2.5 bg-primary-500 text-white font-semibold'
                    : 'flex-1 py-2.5 bg-white text-[#637381] hover:bg-[#F7F9FC]'">
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <!-- Customer -->
            <ReadonlyField v-if="readonly" :label="t('erp.orders.customer')">
              <div class="flex items-stretch gap-2 flex-wrap">
                <CustomerChip v-if="selectedCustomer" :customer="selectedCustomer" />
                <span v-else>—</span>
                <CustomerArAgingAlert :customer-id="form.customerId" />
              </div>
            </ReadonlyField>
            <div v-else>
              <FieldLabel :text="t('erp.orders.customer')" required />
              <div class="flex gap-2 items-start">
                <div class="flex-1 min-w-0 customer-field">
                  <SearchSelect v-model="form.customerId" :options="customers" :disabled="readonly" :invalid="!!errors.customerId" :placeholder="t('erp.orders.selectCustomerPh')">
                    <template #option="{ option }">{{ option.name }}<span v-if="option.company" class="text-[#9BA7B0]"> · {{ option.company }}</span></template>
                    <template #singleLabel="{ option }">{{ option.name }}<span v-if="option.company" class="text-[#9BA7B0]"> · {{ option.company }}</span></template>
                  </SearchSelect>
                </div>
                <button type="button" @click="openCustomerCreate"
                  :title="`${t('erp.orders.newCustomer')} (Alt+C)`"
                  class="px-3 py-2.5 text-[12px] font-semibold border border-primary-200
                         text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors flex-shrink-0 inline-flex items-center gap-1.5">
                  <PlusIcon class="w-3.5 h-3.5" />
                  {{ t('erp.orders.newCustomer') }}
                  <kbd class="hidden lg:inline px-1.5 py-0.5 bg-white/80 border border-primary-200 font-mono text-[10px] text-primary-700">Alt+C</kbd>
                </button>
              </div>
              <FieldError :error="errors.customerId" />
              <div class="flex items-stretch gap-2 flex-wrap">
                <CustomerChip :customer="selectedCustomer" />
                <CustomerArAgingAlert :customer-id="form.customerId" />
              </div>
            </div>

            <!-- Reference / PO # -->
            <ReadonlyField v-if="readonly" :label="t('erp.orders.referenceNumber')" :value="form.referenceNumber" />
            <FormField v-else name="referenceNumber" :label="t('erp.orders.referenceNumber')" :errors="errors" label-class="label-xs">
              <template #default="{ id }">
                <input :id="id" ref="referenceInputRef" v-model="form.referenceNumber" type="text"
                  :placeholder="t('erp.orders.referencePh')" class="input" />
              </template>
            </FormField>

            <!-- Order Date -->
            <ReadonlyField v-if="readonly" :label="t('erp.orders.orderDate')" :value="fmtDate(form.orderDate)" />
            <FormField v-else name="orderDate" :label="t('erp.orders.orderDate')" :errors="errors" required label-class="label-xs">
              <template #default="{ hasError }">
                <DateInput v-model="form.orderDate" :class="['input', hasError && 'input-error']" />
              </template>
            </FormField>

            <!-- Salesperson -->
            <ReadonlyField v-if="readonly" :label="t('erp.orders.salesperson')" :value="salespersonName" />
            <div v-else>
              <FieldLabel :text="t('erp.orders.salesperson')" />
              <SearchSelect v-model="form.salespersonId" :options="staff" :disabled="readonly" :placeholder="t('erp.orders.salespersonPh')">
                <template #option="{ option }">{{ option.name }}<span v-if="option.email" class="text-[#9BA7B0]"> · {{ option.email }}</span></template>
                <template #singleLabel="{ option }">{{ option.name }}</template>
              </SearchSelect>
            </div>

            <!-- Payment terms — credit sales only (from master-data) -->
            <ReadonlyField v-if="readonly && form.saleType === 'credit'" :label="t('erp.orders.paymentTerms')" :value="paymentTermsName" />
            <FormField v-else-if="form.saleType === 'credit'" name="paymentTerms" :label="t('erp.orders.paymentTerms')" :errors="errors" label-class="label-xs">
              <template #default="{ id }">
                <select :id="id" v-model="form.paymentTerms" class="input">
                  <option value="">—</option>
                  <option v-for="opt in paymentTerms" :key="opt.id" :value="opt.code || opt.name">{{ opt.name }}</option>
                </select>
              </template>
            </FormField>

            <!-- VAT -->
            <ReadonlyField v-if="readonly" :label="t('erp.orders.vat')" :value="vatDisplay" />
            <div v-else>
              <FieldLabel :text="t('erp.orders.vat')" />
              <select v-model.number="form.vatRate" class="input">
                <option v-for="r in vatRateOptions" :key="r" :value="r">{{ r === 0 ? '— (0%)' : `${r}%` }}</option>
              </select>
            </div>

            <!-- Currency -->
            <ReadonlyField v-if="readonly" :label="t('erp.common.currency')" :value="currencyDisplay" />
            <div v-else>
              <FieldLabel :text="t('erp.common.currency')" />
              <CurrencySelector v-model="form.currency" v-model:exchangeRate="form.exchangeRate" :as-of-date="form.orderDate" :disabled="readonly" />
            </div>

          </div>
        </FormCard>

        <!-- Addresses -->
        <FormCard :title="t('erp.orders.addresses')" :icon="MapPinIcon" icon-color="primary" :padded="false">
          <template v-if="!readonly" #actions>
            <button type="button" @click="syncAddressesFromCustomer"
              :disabled="!selectedCustomer?.address"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold
                     text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <ArrowPathIcon class="w-3.5 h-3.5" />
              {{ t('erp.orders.useCustomerAddress') }}
            </button>
          </template>
          <div class="px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReadonlyField v-if="readonly" :label="t('erp.orders.shippingAddress')" :value="form.shippingAddress" />
            <FormField v-else name="shippingAddress" :label="t('erp.orders.shippingAddress')" :errors="errors"
              v-model="form.shippingAddress" textarea :rows="3" :placeholder="t('erp.orders.shippingAddressPh')"
              input-class="resize-none" label-class="label-xs" />

            <ReadonlyField v-if="readonly" :label="t('erp.orders.billingAddress')" :value="form.billingAddress" />
            <div v-else>
              <div class="flex items-center justify-between">
                <FieldLabel :text="t('erp.orders.billingAddress')" />
                <label class="flex items-center gap-1.5 text-[11px] text-[#637381] cursor-pointer select-none">
                  <input type="checkbox" v-model="billingSameAsShipping" class="" />
                  {{ t('erp.orders.sameAsShipping') }}
                </label>
              </div>
              <textarea v-model="form.billingAddress" rows="3" :disabled="billingSameAsShipping"
                :placeholder="t('erp.orders.billingAddressPh')"
                class="input resize-none disabled:bg-[#F7F9FC] disabled:text-[#9BA7B0]" />
            </div>
          </div>
        </FormCard>

        <!-- Line Items (tab-styled panel) -->
        <div class="bg-white border border-[#E2E8F0] shadow-card overflow-hidden">
          <!-- Tab header -->
          <div class="px-6 pt-3 border-b border-[#E2E8F0] flex items-end justify-between gap-3">
            <nav class="flex gap-1 -mb-px" role="tablist">
              <!-- Rendered as divs (not buttons) so they stay clickable even inside
                   the read-only fieldset — viewing a posted order's items/journals. -->
              <div role="tab" tabindex="0" :aria-selected="activeTab === 'items'"
                @click="activeTab = 'items'" @keydown.enter.prevent="activeTab = 'items'" @keydown.space.prevent="activeTab = 'items'"
                :class="['inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors cursor-pointer select-none',
                  activeTab === 'items' ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-[#637381] hover:text-[#1C2434] hover:border-[#CBD5E1]']">
                <ClipboardDocumentListIcon class="w-4 h-4" />
                {{ t('erp.orders.lineItems') }}
                <span class="text-[11px] font-normal text-[#9BA7B0]">{{ itemsSubtitle }}</span>
              </div>
              <div role="tab" tabindex="0" :aria-selected="activeTab === 'journals'"
                @click="activeTab = 'journals'" @keydown.enter.prevent="activeTab = 'journals'" @keydown.space.prevent="activeTab = 'journals'"
                :class="['inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors cursor-pointer select-none',
                  activeTab === 'journals' ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-[#637381] hover:text-[#1C2434] hover:border-[#CBD5E1]']">
                <BookOpenIcon class="w-4 h-4" />
                {{ t('erp.orders.journals') }}
              </div>
            </nav>
            <div v-if="activeTab === 'items' && !readonly" class="pb-2 flex-shrink-0">
              <button @click="openBulkPicker" type="button"
                :title="`${t('erp.orders.addItem')} (Ctrl+A)`"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold
                       text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200
                       transition-colors">
                <PlusIcon class="w-3.5 h-3.5" />
                {{ t('erp.orders.addItem') }}
                <kbd class="hidden sm:inline ml-0.5 px-1.5 py-0.5 bg-white/80 border border-primary-200 font-mono text-[10px] text-primary-700">Ctrl+A</kbd>
              </button>
            </div>
          </div>

          <!-- Line Items tab -->
          <div v-show="activeTab === 'items'">
          <!-- Empty state -->
          <EmptyState v-if="!form.items.length" :icon="ShoppingCartIcon" :title="t('erp.common.noItems')" :subtitle="t('erp.orders.addItemsHint')" :action-label="t('erp.orders.addFirstItem')" :error-message="errors.items" @action="openBulkPicker" />

          <!-- Items table -->
          <div v-else>
            <div class="grid items-center gap-3 px-5 py-2.5 bg-[#F7F9FC] border-b border-[#E2E8F0]"
              style="grid-template-columns: 1.8rem 2.5fr 1.4fr 5.5rem 5.5rem 5.5rem 5.5rem 2rem 2.25rem">
              <div class="text-[11px] font-semibold text-[#9BA7B0] tracking-wider text-center">#</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] tracking-wider">{{ t('erp.orders.saleItem') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] tracking-wider">{{ t('erp.orders.store') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] tracking-wider text-right">{{ t('erp.orders.items') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] tracking-wider text-right">{{ t('erp.orders.unitPrice') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] tracking-wider text-right">{{ t('erp.orders.lineDiscount') }}</div>
              <div class="text-[11px] font-semibold text-[#9BA7B0] tracking-wider text-right">{{ t('erp.orders.amount') }}</div>
              <div></div>
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
                style="grid-template-columns: 1.8rem 2.5fr 1.4fr 5.5rem 5.5rem 5.5rem 5.5rem 2rem 2.25rem"
                @dragover="onDragOver($event, idx)"
                @drop="onDrop(idx)"
                @dragleave="onDragLeave(idx)">

                <!-- Drag handle: only top-level rows are draggable (edit only). -->
                <div v-if="readonly && !line.parentKey"
                  class="text-[12px] font-semibold text-center select-none text-[#637381]">
                  {{ idx + 1 }}
                </div>
                <div v-else-if="!line.parentKey"
                  draggable="true"
                  @dragstart="onDragStart($event, idx)"
                  @dragend="onDragEnd"
                  :title="t('erp.orders.dragToReorder')"
                  class="text-[12px] font-semibold text-center select-none flex items-center justify-center
                         cursor-grab active:cursor-grabbing hover:bg-[#E2E8F0]/60 h-7
                         text-[#CBD5E1] group-hover:text-[#637381]">
                  <Bars3Icon class="w-4 h-4 hidden group-hover:block" />
                  <span class="group-hover:hidden">{{ idx + 1 }}</span>
                </div>
                <div v-else class="text-[11px] text-[#CBD5E1] text-center select-none">↳</div>

                <!-- Item picker / package label -->
                <div v-if="line.isPackage" class="flex items-center gap-1.5 text-[13px] font-semibold text-primary-700">
                  <button type="button" @click="toggleCollapse(line.key)"
                    :title="isCollapsed(line.key) ? t('erp.orders.expandPackage') : t('erp.orders.collapsePackage')"
                    class="flex items-center justify-center w-5 h-5 hover:bg-primary-100 text-primary-600 flex-shrink-0">
                    <ChevronRightIcon v-if="isCollapsed(line.key)" class="w-3.5 h-3.5" />
                    <ChevronDownIcon  v-else                       class="w-3.5 h-3.5" />
                  </button>
                  <CubeIcon class="w-4 h-4 flex-shrink-0" />
                  <span class="truncate">{{ line.productName }}</span>
                  <span class="text-[11px] font-normal text-[#9BA7B0]">· {{ t('erp.orders.salePackage') }}</span>
                </div>
                <div v-else-if="line.parentKey" class="flex items-center gap-2 pl-4 text-[13px] text-[#374151] truncate">
                  <span class="truncate">{{ line.productName }}</span>
                  <span class="text-[11px] font-semibold text-[#9BA7B0] tabular-nums flex-shrink-0">× {{ line.quantity }}</span>
                </div>
                <div v-else-if="readonly" class="text-[13px] text-[#1C2434] truncate">{{ lineItemName(line) }}</div>
                <SearchSelectPopup
                  v-else
                  v-model="line.saleItemId"
                  :options="groupedItemOptions"
                  group-values="items"
                  group-label="label"
                  :meta-columns="itemMetaColumns"
                  :label-header="t('erp.orders.saleItem')"
                  :placeholder="t('erp.orders.itemPh')"
                  :search-placeholder="t('erp.orders.itemSearchPh')"
                  @change="onPickerChange(line, idx)"
                />

                <!-- Store -->
                <div>
                  <div v-if="readonly" class="text-[13px] text-[#1C2434] truncate">
                    {{ (!line.isPackage && line.hasProduct) ? (storeName(line) || '—') : '—' }}
                  </div>
                  <SearchSelect v-else-if="!line.isPackage && line.hasProduct" v-model="line.storeId" :options="stores" :disabled="readonly" :invalid="line.hasProduct && !line.storeId" :placeholder="t('erp.orders.storePh')" @change="clampLineQty(line)" />
                  <div v-else class="flex items-center justify-center h-9">
                    <span class="text-[12px] text-[#CBD5E1]">—</span>
                  </div>
                </div>

                <!-- Quantity / Unit price / Disc % / Amount -->
                <template v-if="line.parentKey">
                  <div></div><div></div><div></div><div></div>
                </template>
                <template v-else-if="readonly">
                  <div class="text-[13px] text-right text-[#1C2434] tabular-nums">{{ fmtQty(line.quantity) }}</div>
                  <div class="text-[13px] text-right text-[#1C2434] tabular-nums">{{ fmtMoney(line.unitPrice) }}</div>
                  <div class="text-[13px] text-right tabular-nums"
                    :class="line.isPackage ? 'text-[#CBD5E1]' : 'text-[#637381]'">
                    {{ line.isPackage ? '—' : lineDiscountLabel(line) }}
                  </div>
                  <div class="text-[13px] tabular-nums text-right"
                    :class="line.isPackage ? 'font-bold text-primary-700' : 'font-semibold text-[#1C2434]'">
                    {{ fmtMoney(lineNet(line)) }}
                  </div>
                </template>
                <template v-else>
                  <input v-model.number="line.quantity" type="number" min="1"
                    :max="Number.isFinite(availableStock(line)) ? availableStock(line) : null"
                    @input="clampLineQty(line)"
                    :title="stockTitle(line)"
                    class="w-full px-2 py-2 border text-[13px] text-right
                           text-[#1C2434] tabular-nums focus:outline-none focus:ring-2
                           focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                    :class="atStockLimit(line) ? 'border-amber-300 bg-amber-50/40' : 'border-[#E2E8F0]'" />

                  <input v-model.number="line.unitPrice" type="number" min="0" step="0.01" placeholder="0.00"
                    class="w-full px-2.5 py-2 border border-[#E2E8F0] text-[13px] text-right
                           text-[#1C2434] tabular-nums focus:outline-none focus:ring-2
                           focus:ring-primary-500/20 focus:border-primary-400 transition-all placeholder:text-[#CBD5E1]" />

                  <div v-if="line.isPackage" class="flex items-center justify-center h-9">
                    <span class="text-[12px] text-[#CBD5E1]">—</span>
                  </div>
                  <LineDiscountPopover v-else
                    :type="line.discountType"
                    :value="line.discountValue"
                    :base="lineGross(line)"
                    :currency="form.currency || '฿'"
                    :title="t('erp.orders.lineDiscount')"
                    :percent-label="t('erp.orders.discountPercent')"
                    :amount-label="t('erp.orders.discountAmount')"
                    :clear-label="t('erp.common.clear')"
                    @update:type="line.discountType = $event"
                    @update:value="line.discountValue = $event" />

                  <div class="text-[13px] tabular-nums text-right"
                    :class="line.isPackage ? 'font-bold text-primary-700' : 'font-semibold text-[#1C2434]'">
                    {{ fmtMoney(lineNet(line)) }}
                  </div>
                </template>

                <!-- Duplicate-item indicator -->
                <div v-if="!line.parentKey" class="flex items-center justify-center relative" data-dup-popover>
                  <button v-if="isDuplicate(line)" type="button"
                    tabindex="-1"
                    @click="toggleDupPopover(line)"
                    :aria-label="t('erp.orders.duplicateItemWarning')"
                    :title="t('erp.orders.duplicateItemWarning')"
                    class="flex items-center justify-center w-6 h-6 bg-amber-100 text-amber-600
                           border border-amber-300 hover:bg-amber-200 transition-colors">
                    <ExclamationTriangleIcon class="w-4 h-4" />
                  </button>
                  <div v-if="openDupKey === line.key"
                    class="absolute z-20 right-full top-1/2 -translate-y-1/2 mr-2 w-56
                           bg-amber-50 border border-amber-200 shadow-lg p-2.5
                           text-[12px] text-amber-800 leading-snug">
                    <div class="flex items-start gap-1.5">
                      <ExclamationTriangleIcon class="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{{ t('erp.orders.duplicateItemWarning') }}</span>
                    </div>
                  </div>
                </div>
                <div v-else></div>

                <button v-if="!readonly" @click="removeLine(idx)" type="button"
                  :title="line.isPackage ? t('erp.orders.removePackage') : t('common.delete')"
                  class="w-7 h-7 flex items-center justify-center flex-shrink-0
                         text-[#94A3B8] border border-[#E2E8F0] bg-white
                         hover:text-red-600 hover:border-red-500 transition-colors">
                  <TrashIcon class="w-4 h-4" />
                </button>
                <div v-else></div>
              </div>
            </div>

            <!-- Subtotal footer -->
            <div class="grid items-center gap-3 px-5 py-3.5 bg-[#F7F9FC] border-t border-[#E2E8F0]"
              style="grid-template-columns: 1.8rem 2.5fr 1.4fr 5.5rem 5.5rem 5.5rem 5.5rem 2rem 2.25rem">
              <div class="col-span-6 text-[11px] font-semibold text-[#9BA7B0] tracking-wider text-right">
                {{ t('erp.orders.subtotal') }}
              </div>
              <div class="text-[13px] font-bold text-[#1C2434] tabular-nums text-right">{{ fmtMoney(subtotal) }}</div>
              <div></div>
              <div></div>
            </div>

            <p v-if="errors.items" class="px-5 py-2.5 text-[11px] text-red-600 bg-[#FEE2E2] border-t border-[#FECACA]">
              {{ errors.items }}
            </p>
          </div>

          <!-- Bulk-add popup (hidden trigger; opened by the Add Item button + empty state + Ctrl+A) -->
          <SearchSelectPopup
            ref="bulkPickerRef"
            :model-value="''"
            :options="groupedItemOptions"
            group-values="items"
            group-label="label"
            :meta-columns="itemMetaColumns"
            :label-header="t('erp.orders.saleItem')"
            multiple
            hide-trigger
            :search-placeholder="t('erp.orders.itemSearchPh')"
            @submit="onBulkAdd"
          />
          </div>

          <!-- Journals tab -->
          <div v-show="activeTab === 'journals'">
            <OrderJournalsPanel :order-id="route.params.id" :active="activeTab === 'journals'" />
          </div>
        </div>

        <ErrorBanner :message="globalError" />

        <!-- Summary + totals -->
        <FormCard :title="t('erp.orders.orderSummary')" :icon="CalculatorIcon" icon-color="slate" :padded="false">
          <div class="px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <ReadonlyField v-if="readonly" :label="t('erp.orders.notes')" :value="form.notes" />
            <FormField v-else name="notes" :errors="errors"
              v-model="form.notes" textarea :placeholder="t('erp.orders.notes')"
              wrapper-class="flex flex-col text-left h-full" field-wrapper-class="flex-1 flex flex-col min-h-0"
              input-class="resize-none flex-1 min-h-[8rem] h-full" />

            <!-- Totals: bordered card with clear separators + a prominent total band -->
            <dl class="w-full border border-[#E2E8F0] divide-y divide-[#E2E8F0] bg-white shadow-card">
              <div class="flex items-center justify-between px-4 py-3 text-[13px]">
                <dt class="text-[#637381]">{{ t('erp.orders.subtotal') }}</dt>
                <dd class="font-semibold text-[#1C2434] tabular-nums">{{ fmtMoney(subtotal) }}</dd>
              </div>
              <div class="flex items-center justify-between px-4 py-3 text-[13px]">
                <dt class="text-[#637381]">
                  {{ t('erp.orders.vat') }}<span v-if="form.vatRate" class="text-[#9BA7B0]"> · {{ form.vatRate }}%</span>
                </dt>
                <dd class="font-semibold text-[#1C2434] tabular-nums">{{ fmtMoney(taxAmount) }}</dd>
              </div>
              <!-- Discount input row -->
              <div class="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <dt class="text-[#637381] flex-shrink-0">
                  {{ t('erp.orders.discount') }}<span v-if="readonly && orderDiscountLabel" class="text-[#9BA7B0]"> · {{ orderDiscountLabel }}</span>
                </dt>
                <div class="flex items-center gap-1.5">
                  <template v-if="!readonly">
                    <select v-model="form.discountType"
                      class="px-2 py-1.5 border border-[#E2E8F0] text-[12px] bg-white
                             focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                      <option value="">—</option>
                      <option value="percent">%</option>
                      <option value="fixed">{{ form.currency || '฿' }}</option>
                    </select>
                    <input v-model.number="form.discountValue" type="number" min="0" step="0.01" placeholder="0"
                      :disabled="!form.discountType" :max="orderDiscountMax" @input="clampOrderDiscount"
                      class="w-16 px-2 py-1.5 border border-[#E2E8F0] text-[12px] text-right tabular-nums
                             focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
                             disabled:bg-[#F7F9FC] disabled:text-[#9BA7B0]" />
                  </template>
                  <span class="text-[13px] font-semibold text-red-600 tabular-nums w-24 text-right">−{{ fmtMoney(discountAmount) }}</span>
                </div>
              </div>
              <!-- Withholding tax (gated by ERP Settings → General → Tax) -->
              <div v-if="settings.tax?.withholding" class="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <dt class="text-[#637381] flex-shrink-0">
                  {{ t('erp.orders.wht') }}<span v-if="readonly && whtName" class="text-[#9BA7B0]"> · {{ whtName }}</span>
                </dt>
                <div class="flex items-center gap-1.5">
                  <select v-if="!readonly" v-model="form.whtCode" @change="onWhtChange"
                    class="max-w-[20rem] px-2 py-1.5 border border-[#E2E8F0] text-[12px] bg-white
                           focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                    <option value="">—</option>
                    <option v-for="o in whtOptions" :key="o.id" :value="o.code">{{ o.name }} ({{ o.dataValue }}%)</option>
                  </select>
                  <span class="text-[13px] font-semibold text-red-600 tabular-nums w-24 text-right">−{{ fmtMoney(whtAmount) }}</span>
                </div>
              </div>
              <!-- Grand total — prominent primary band -->
              <div class="flex items-center justify-between px-4 py-3.5 bg-primary-50">
                <dt class="text-[12px] font-bold uppercase tracking-wider text-primary-700">{{ t('erp.orders.total') }}</dt>
                <dd class="text-lg font-extrabold text-primary-700 tabular-nums">{{ fmtMoney(grandTotal) }}</dd>
              </div>
              <!-- Net payable after WHT — strongest emphasis -->
              <div v-if="Number(whtAmount) > 0" class="flex items-center justify-between px-4 py-4 bg-primary-600">
                <dt class="text-[12px] font-bold uppercase tracking-wider text-white/80">{{ t('erp.orders.netTotal') }}</dt>
                <dd class="text-xl font-extrabold text-white tabular-nums">{{ fmtMoney(netTotal) }}</dd>
              </div>
            </dl>
          </div>
        </FormCard>

      </fieldset>
    </div>

    <!-- Sticky save bar -->
    <div v-if="!loading && !loadError" class="sticky bottom-0 -mx-6 mt-6 px-6 py-3.5 bg-white/95 backdrop-blur border-t border-[#E2E8F0] shadow-[0_-4px_12px_rgba(15,23,42,0.05)] z-20
                flex items-center justify-between gap-3">
      <div class="flex items-center gap-4">
        <div>
          <p class="text-[10px] font-semibold text-[#9BA7B0] uppercase tracking-wider mb-0.5">{{ t('erp.orders.total') }}</p>
          <p class="text-2xl font-extrabold tabular-nums leading-none text-primary-600">{{ fmtMoney(grandTotal) }}</p>
        </div>
        <!-- "Saved" indicator shows after a successful in-place Save Draft. -->
        <span v-if="draftSavedAt" class="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-600">
          <CheckIcon class="w-3.5 h-3.5" />
          {{ t('erp.orders.savedDraft') }} · {{ savedAtRelative }}
        </span>
        <span v-else-if="dirty" class="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-600">
          <ExclamationTriangleIcon class="w-3.5 h-3.5" />
          {{ t('erp.orders.unsavedChanges') }}
        </span>
      </div>
      <!-- Read-only orders cannot be saved — only a way back to the list. -->
      <div v-if="readonly" class="flex items-center gap-3">
        <span class="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-medium text-[#637381]">
          <LockClosedIcon class="w-3.5 h-3.5" />
          {{ t('erp.orders.readOnlyNotice') }}
        </span>
        <RouterLink to="/erp/sale-orders"
          class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold
                 bg-white text-[#637381] border border-[#E2E8F0] hover:bg-[#F7F9FC] hover:text-[#1C2434] transition-colors">
          {{ t('erp.orders.backToList') }}
        </RouterLink>
      </div>
      <div v-else class="flex items-center gap-2.5">
        <button @click="discard" type="button"
          class="px-4 py-2.5 text-sm font-medium text-[#637381] hover:text-[#1C2434] transition-colors">
          {{ t('erp.orders.discard') }}
        </button>
        <button @click="saveDraft" :disabled="!canSave || savingDraft || saving" type="button"
          :title="!canSave ? t('erp.orders.fillRequiredFields') : `${t('erp.orders.saveDraft')} (Ctrl+S)`"
          class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                 bg-white text-primary-600 border border-primary-200 hover:bg-primary-50
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <ArrowPathIcon v-if="savingDraft" class="w-4 h-4 animate-spin" />
          <BookmarkSquareIcon v-else class="w-4 h-4" />
          {{ savingDraft ? t('erp.common.saving') : t('erp.orders.saveDraft') }}
        </button>
        <button @click="save" :disabled="!canSave || saving || savingDraft" type="button"
          :title="!canSave ? t('erp.orders.fillRequiredFields') : `${t('common.saveChanges')} (Ctrl+Shift+S)`"
          class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold
                 bg-primary-500 text-white hover:bg-primary-600 shadow-sm
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <ArrowPathIcon v-if="saving" class="w-4 h-4 animate-spin" />
          <CheckIcon v-else class="w-4 h-4" />
          {{ saving ? t('erp.common.saving') : t('common.saveChanges') }}
        </button>
      </div>
    </div>

    <!-- Confirm dialog (replaces window.confirm) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="confirmOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-[#1C2434]/40 backdrop-blur-sm px-4"
          @click.self="confirmAnswer(false)">
          <div class="w-full max-w-md bg-white border border-[#E2E8F0] shadow-2xl">
            <div class="px-6 pt-6 pb-5">
              <h3 class="text-[15px] font-semibold text-[#1C2434]">{{ confirmTitle }}</h3>
              <p v-if="confirmMessage" class="mt-2 text-[13px] text-[#637381] leading-relaxed">{{ confirmMessage }}</p>
            </div>
            <div class="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
              <button type="button" @click="confirmAnswer(false)"
                class="px-4 py-2 text-[13px] font-medium text-[#637381] hover:text-[#1C2434] hover:bg-[#F7F9FC] transition-colors">
                {{ t('common.cancel') }}
              </button>
              <button type="button" @click="confirmAnswer(true)"
                class="px-4 py-2 text-[13px] font-semibold transition-colors"
                :class="confirmOkClass">
                {{ confirmOkLabel }}
              </button>
              <button v-if="confirmSaveLabel" type="button" @click="confirmAnswer('save')"
                class="px-4 py-2 text-[13px] font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors">
                {{ confirmSaveLabel }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Inline customer create slide-over -->
    <Teleport to="body">
      <div v-if="customerCreateOpen" class="fixed inset-0 z-50 flex">
        <div class="flex-1 bg-black/30" @click="closeCustomerCreate"></div>
        <div class="w-full max-w-md bg-white shadow-2xl overflow-y-auto flex flex-col">
          <div class="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h3 class="text-base font-semibold text-[#1C2434]">{{ t('erp.orders.newCustomer') }}</h3>
            <button @click="closeCustomerCreate" type="button"
              class="w-8 h-8 hover:bg-[#F1F5F9] text-[#637381] flex items-center justify-center">
              <XMarkIcon class="w-4 h-4" />
            </button>
          </div>
          <div class="flex-1 px-6 py-5 space-y-4">
            <FormField name="customerName" :label="t('erp.customers.name')" :errors="{}" required>
              <template #default="{ id }">
                <input :id="id" v-model="newCustomer.name" ref="newCustomerNameRef" type="text"
                  :placeholder="t('erp.orders.customerNamePh')" class="input" />
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
import { useRoute, useRouter, RouterLink, onBeforeRouteLeave } from 'vue-router'
import {
  PlusIcon, TrashIcon, XMarkIcon,
  CheckIcon, ShoppingCartIcon,
  ArrowPathIcon, UserIcon, ClipboardDocumentListIcon,
  CalculatorIcon, ExclamationTriangleIcon,
  Bars3Icon, CubeIcon, ChevronDownIcon, ChevronRightIcon,
  MapPinIcon, BookmarkSquareIcon, BookOpenIcon, PrinterIcon, LockClosedIcon, TruckIcon,
} from '@heroicons/vue/24/outline'
import AppLayout from '@/layouts/AppLayout.vue'
import CurrencySelector from '@/components/CurrencySelector.vue'
import SearchSelect from '@/components/SearchSelect.vue'
import SearchSelectPopup from '@/components/SearchSelectPopup.vue'
import LineDiscountPopover from '@/components/LineDiscountPopover.vue'
import KeyboardShortcuts from '@/components/KeyboardShortcuts.vue'
import { useFormShortcuts } from '@/composables/useShortcuts'
import PageHeader from '@/components/form/PageHeader.vue'
import FormCard from '@/components/form/FormCard.vue'
import FormField from '@/components/form/FormField.vue'
import FieldLabel from '@/components/form/FieldLabel.vue'
import ErrorBanner from '@/components/form/ErrorBanner.vue'
import StatusPill from '@/components/form/StatusPill.vue'
import CustomerChip from '@/components/form/CustomerChip.vue'
import EmptyState from '@/components/form/EmptyState.vue'
import FieldError from '@/components/form/FieldError.vue'
import ReadonlyField from '@/components/form/ReadonlyField.vue'
import LoadingSpinner from '@/components/form/LoadingSpinner.vue'
import OrderJournalsPanel from './OrderJournalsPanel.vue'
import OrderWorkflowStrip from './OrderWorkflowStrip.vue'
import CustomerArAgingAlert from './CustomerArAgingAlert.vue'
import { useFieldErrors } from '@/composables/useFieldErrors'
import api from '@/api'
import { fmtMoney, toFixed, fmtDate, fmtQty } from '@/utils/fmt'
import { parseApiError } from '@/utils/apiError'
import { useSettingsStore } from '@/stores/settings'

const { t }       = useI18n()
const route       = useRoute()
const router      = useRouter()
const settings    = useSettingsStore()

const order        = ref(null)
// Only drafts are editable. Any other status opens this page as a read-only
// view: every control is disabled and the save actions are hidden.
const readonly = computed(() => !!order.value && order.value.status !== 'draft')
const STATUS_VARIANT = { draft: 'draft', confirmed: 'info', shipped: 'draft', delivered: 'success', cancelled: 'danger' }

// ── Workflow next-actions (status transitions + convert), moved here from the
// detail page so they live on the page that list rows actually open. ────────
const updatingStatus = ref(false)
const statusError    = ref('')
const converting     = ref('')
const convertError   = ref('')

const TRANSITIONS = {
  draft:     ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped:   ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
}
const availableTransitions = computed(() => TRANSITIONS[order.value?.status] || [])
const forwardTransitions   = computed(() => availableTransitions.value.filter(s => s !== 'cancelled'))
// Cancel Order only applies once the order has been confirmed — a still-draft
// order is discarded/deleted instead, not cancelled.
const cancelTransitions    = computed(() =>
  order.value?.status === 'draft' ? [] : availableTransitions.value.filter(s => s === 'cancelled')
)

const FORWARD_BTN = {
  confirmed: 'bg-blue-600 text-white hover:bg-blue-700',
  shipped:   'bg-amber-500 text-white hover:bg-amber-600',
  delivered: 'bg-green-600 text-white hover:bg-green-700',
}
function forwardBtnClass(s) { return FORWARD_BTN[s] || 'bg-primary-500 text-white hover:bg-primary-600' }

const TRANSITION_LABELS = { confirmed: 'erp.orders.confirmOrder', shipped: 'erp.orders.markAsShipped', delivered: 'erp.orders.markAsDelivered' }
function transitionLabel(s) { return TRANSITION_LABELS[s] ? t(TRANSITION_LABELS[s]) : s }

async function changeStatus(status) {
  statusError.value    = ''
  updatingStatus.value = true
  try {
    const { data } = await api.patch(`/erp/sale-orders/${order.value.id}/status`, { status })
    order.value = data.data.order
  } catch (err) {
    statusError.value = parseApiError(err, 'Failed to update status')
  } finally {
    updatingStatus.value = false
  }
}

async function convertToDeliveryOrder() {
  convertError.value = ''
  converting.value = 'do'
  try {
    const { data } = await api.post(`/erp/sale-orders/${order.value.id}/create-delivery-order`)
    router.push(`/erp/delivery-orders/${data.data.id}`)
  } catch (err) {
    convertError.value = parseApiError(err, 'Failed to create delivery order')
  } finally { converting.value = '' }
}

// Every workflow action confirms via the modal before running. Affirmative
// transitions use the primary button; cancelling uses the destructive variant.
const STATUS_CONFIRM = {
  confirmed: { okKey: 'erp.orders.confirmOrder',    variant: 'primary' },
  shipped:   { okKey: 'erp.orders.markAsShipped',   variant: 'primary' },
  delivered: { okKey: 'erp.orders.markAsDelivered', variant: 'primary' },
  cancelled: { okKey: 'erp.orders.cancelOrder',     variant: 'danger'  },
}
async function confirmAndChangeStatus(status) {
  const meta = STATUS_CONFIRM[status]
  if (!meta) return changeStatus(status)
  const ok = await confirmAsync({
    title:   t(`erp.orders.confirm.${status}.title`),
    message: t(`erp.orders.confirm.${status}.message`),
    okLabel: t(meta.okKey),
    variant: meta.variant,
  })
  if (ok === true) changeStatus(status)
}
async function confirmAndConvert() {
  const ok = await confirmAsync({
    title:   t('erp.orders.confirm.convert.title'),
    message: t('erp.orders.confirm.convert.message'),
    okLabel: t('erp.orders.createDeliveryOrder'),
    variant: 'primary',
  })
  if (ok === true) convertToDeliveryOrder()
}
const customers    = ref([])
const saleItems    = ref([])
const salePackages = ref([])
const stores       = ref([])
const staff        = ref([])
const loading      = ref(true)
const loadError    = ref('')
const billingSameAsShipping = ref(false)
// Line Items / Journals tab switch on the items panel.
const activeTab    = ref('items')

const paymentTerms = ref([])
const globalError  = ref('')
const saving       = ref(false)
const savingDraft  = ref(false)
const draftSavedAt = ref(null)
const errors       = ref({})
const { setFromError, reset: resetErrors } = useFieldErrors()

// Inline customer create slide-over state
const customerCreateOpen = ref(false)
const newCustomer        = ref({ name: '', company: '', email: '', phone: '', address: '' })
const newCustomerError   = ref('')
const newCustomerSaving  = ref(false)
const newCustomerNameRef    = ref(null)
const referenceInputRef     = ref(null)
const saleTypeContainerRef  = ref(null)

const { shortcuts } = useFormShortcuts({
  save: () => save(),
  saveDraft: () => saveDraft(),
  cancel: () => discard(),
  enabled: () => !confirmOpen.value && !customerCreateOpen.value,
  saveLabel: 'Save changes',
  cancelLabel: 'Discard & back',
  extra: [
    { combo: 'ctrl+a', handler: () => openBulkPicker(), hint: { key: 'Ctrl+A', label: 'Add item' } },
    { combo: 'alt+i',  handler: () => openBulkPicker() },
    { combo: 'alt+c',  handler: () => openCustomerCreate(), hint: { key: 'Alt+C', label: 'New customer' } },
    { combo: '', hint: { key: '← →', label: 'Change sale type' } },
  ],
})

const form = ref({
  customerId: '', orderDate: '', currency: '', exchangeRate: 1, notes: '', items: [],
  referenceNumber: '', paymentTerms: '', salespersonId: '',
  vatRate: 0,
  shippingAddress: '', billingAddress: '',
  discountType: '', discountValue: 0,
  whtCode: '', whtRate: 0,
  saleType: 'credit',
})

// WHT Type master data (code + name + dataValue rate%); admins manage it in
// ERP Settings → Master Data. The WHT row is gated by the tax setting.
const whtOptions = ref([])
function onWhtChange() {
  const o = whtOptions.value.find(x => x.code === form.value.whtCode)
  form.value.whtRate = o ? Number(o.dataValue) || 0 : 0
}

const SALE_TYPE_OPTIONS = computed(() => [
  { value: 'cash',   label: t('erp.orders.saleTypeCash') },
  { value: 'credit', label: t('erp.orders.saleTypeCredit') },
])
function cycleSaleType(dir) {
  const opts = SALE_TYPE_OPTIONS.value
  const idx  = opts.findIndex(o => o.value === form.value.saleType)
  form.value.saleType = opts[(idx + dir + opts.length) % opts.length].value
}
watch(() => form.value.saleType, (st) => {
  if (st === 'cash') { form.value.paymentTerms = '' }
})
watch(() => form.value.vatRate, (rate) => {
  for (const line of form.value.items) line.taxRate = rate
})
// VAT options derive from ERP Settings → General → Tax: always "no VAT" (0%)
// plus the configured rate. The loaded order's rate is kept selectable so an
// existing value is never silently dropped if the setting later changes.
const vatRateOptions = computed(() => {
  const set = new Set([0])
  const rate = Number(settings.tax?.rate) || 0
  if (rate > 0) set.add(rate)
  const current = Number(form.value.vatRate) || 0
  if (current > 0) set.add(current)
  return [...set].sort((a, b) => a - b)
})

// Dirty tracking: warn on tab close / Discard click after the user changes
// anything. We arm the watcher once the existing order has loaded so the
// initial parse doesn't immediately mark the form dirty.
const dirty = ref(false)
let dirtyArmed = false
watch(form, () => { if (dirtyArmed) dirty.value = true }, { deep: true })

function onBeforeUnload(e) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = t('erp.orders.unsavedChanges')
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload))

// ── Custom confirm modal (replaces window.confirm) ──────────────────────
// Resolves with: false = stay, true = leave without saving, 'save' = save draft.
const confirmOpen      = ref(false)
const confirmTitle     = ref('')
const confirmMessage   = ref('')
const confirmOkLabel   = ref('OK')
const confirmSaveLabel = ref('')
// OK-button styling: '' = neutral (default, e.g. "Don't Save"), 'primary' =
// affirmative workflow action, 'danger' = destructive (cancel order).
const confirmVariant   = ref('')
const confirmOkClass = computed(() => {
  if (confirmVariant.value === 'primary') return 'text-white bg-primary-600 hover:bg-primary-700 shadow-sm'
  if (confirmVariant.value === 'danger')  return 'text-white bg-red-600 hover:bg-red-700 shadow-sm'
  return 'text-[#637381] border border-[#E2E8F0] hover:text-red-600 hover:border-red-200 hover:bg-red-50/50'
})
let confirmResolver    = null
// When Esc opens this dialog (via the form's cancel shortcut), the *same* keydown
// would otherwise also reach the modal handler and immediately close it. Set this
// for the rest of the current event loop tick so that opening keypress is ignored.
let confirmJustOpened  = false
function confirmAsync({ title, message, okLabel, saveLabel, variant } = {}) {
  confirmTitle.value     = title   || ''
  confirmMessage.value   = message || ''
  confirmOkLabel.value   = okLabel || 'OK'
  confirmSaveLabel.value = saveLabel || ''
  confirmVariant.value   = variant || ''
  confirmOpen.value      = true
  confirmJustOpened      = true
  setTimeout(() => { confirmJustOpened = false }, 0)
  return new Promise(resolve => { confirmResolver = resolve })
}
function confirmAnswer(ok) {
  confirmOpen.value = false
  if (confirmResolver) { confirmResolver(ok); confirmResolver = null }
}

// Save the draft from the unsaved-changes dialog, then report whether it stuck
// (a failed validation leaves the form dirty, so we shouldn't leave the page).
async function saveDraftAndLeave() {
  await save({ redirect: false })
  return !dirty.value
}

// Vue Router guard — covers in-app navigation (RouterLink, breadcrumbs, sidebar).
// beforeunload above handles tab close / reload.
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  const res = await confirmAsync({
    title:     t('erp.orders.unsavedChanges'),
    message:   t('erp.orders.unsavedChangesHint'),
    okLabel:   t('erp.orders.dontSave'),
    saveLabel: t('erp.orders.saveDraft'),
  })
  if (res === 'save') return await saveDraftAndLeave()
  return res === true
})

const selectedCustomer = computed(() =>
  form.value.customerId ? customers.value.find(c => c.id === form.value.customerId) : null
)

// ── Read-only display values ─────────────────────────────────────────────
// Mirror the editable controls as plain text for non-draft (read-only) orders.
const saleTypeLabel    = computed(() => form.value.saleType === 'cash' ? t('erp.orders.saleTypeCash') : t('erp.orders.saleTypeCredit'))
const salespersonName  = computed(() => staff.value.find(s => s.id === form.value.salespersonId)?.name || '')
const paymentTermsName = computed(() => paymentTerms.value.find(p => (p.code || p.name) === form.value.paymentTerms)?.name || '')
const vatDisplay       = computed(() => Number(form.value.vatRate) > 0 ? `${form.value.vatRate}%` : '— (0%)')
const currencyDisplay  = computed(() => {
  const cur = form.value.currency || ''
  const rate = Number(form.value.exchangeRate) || 1
  return rate !== 1 ? `${cur} @ ${rate}` : cur
})
const orderDiscountLabel = computed(() => {
  if (!form.value.discountType || !form.value.discountValue) return ''
  return form.value.discountType === 'percent' ? `${form.value.discountValue}%` : fmtMoney(form.value.discountValue)
})
const whtName = computed(() => whtOptions.value.find(o => o.code === form.value.whtCode)?.name || '')

function lineItemName(line) {
  return line.productName || saleItems.value.find(s => s.id === line.saleItemId)?.name || '—'
}
function storeName(line) {
  return stores.value.find(s => s.id === line.storeId)?.name || ''
}
function lineDiscountLabel(line) {
  if (!line.discountValue) return '—'
  return line.discountType === 'fixed' ? fmtMoney(line.discountValue) : `${line.discountValue}%`
}

// Picker columns: price + on-hand, shown right-aligned next to each item.
const itemMetaColumns = computed(() => [
  { key: 'priceLabel', header: t('erp.orders.unitPrice'), width: 100 },
  { key: 'stockLabel', header: t('erp.orders.stock'),     width: 84 },
])

const groupedItemOptions = computed(() => {
  const groups = [{
    label: t('erp.orders.saleItems'),
    items: saleItems.value.map(si => ({ ...si, ...itemMetaFields(si) })),
  }]
  if (salePackages.value.length) {
    groups.push({
      label: t('erp.orders.salePackages'),
      items: salePackages.value.map(p => ({ ...p, name: `📦 ${p.name}` })),
    })
  }
  return groups
})

// saleItemId → { total (aggregate on-hand), byStore: { storeId: qty } }
const saleItemStock = computed(() => {
  const map = new Map()
  for (const si of saleItems.value) {
    if (!si.product) continue
    const byStore = {}
    for (const ss of si.product.storeStocks || []) byStore[ss.storeId] = Number(ss.stock) || 0
    map.set(si.id, { total: Number(si.product.stock) || 0, byStore })
  }
  return map
})

// Available on-hand for a line: per its chosen store when store-level data
// exists, otherwise the aggregate. Non-stock items (services/packages) are
// unlimited (Infinity) so they're never capped.
function availableStock(line) {
  if (line.parentKey || line.isPackage || !line.hasProduct) return Infinity
  const info = saleItemStock.value.get(line.saleItemId)
  if (!info) return Infinity
  const hasStoreData = Object.keys(info.byStore).length > 0
  if (line.storeId && hasStoreData) return info.byStore[line.storeId] || 0
  return info.total
}
function atStockLimit(line) {
  const max = availableStock(line)
  return Number.isFinite(max) && (line.quantity || 0) >= max
}
function exceedsStock(line) {
  const max = availableStock(line)
  return Number.isFinite(max) && (line.quantity || 0) > max
}
function clampLineQty(line) {
  const max = availableStock(line)
  if (Number.isFinite(max) && (line.quantity || 0) > max) line.quantity = Math.max(max, 0)
}
function stockTitle(line) {
  const max = availableStock(line)
  if (!Number.isFinite(max)) return ''
  return `${t('erp.orders.availableStock')}: ${max}`
}

// Price (best for the chosen customer) + on-hand, as separate picker columns.
// Price shows 0.00 when no pricing is configured; stock is "—" for non-stock
// items (services).
function itemMetaFields(si) {
  const pricing = getBestPricing(si, selectedCustomer.value?.customerGroupId)
  return {
    priceLabel: fmtMoney(Number(pricing?.unitPrice) || 0),
    stockLabel: si.product ? String(Number(si.product.stock) || 0) : '—',
  }
}

onMounted(async () => {
  const id = route.params.id
  const [orderRes, customersRes, saleItemsRes, salePackagesRes, storesRes, staffRes, paymentTermsRes, whtRes] = await Promise.allSettled([
    api.get(`/erp/sale-orders/${id}`),
    api.get('/erp/customers',     { params: { limit: 200 } }),
    api.get('/erp/sale-items',    { params: { limit: 500, status: 'active' } }),
    api.get('/erp/sale-packages', { params: { limit: 200, status: 'active' } }),
    api.get('/erp/stores',        { params: { limit: 200 } }),
    api.get('/organizations/staff'),
    api.get('/erp/master-data/payment-terms'),
    api.get('/erp/master-data/by-name/WHT Type'),
  ])
  if (customersRes.status    === 'fulfilled') customers.value    = customersRes.value.data.data.customers
  if (saleItemsRes.status    === 'fulfilled') saleItems.value    = saleItemsRes.value.data.data.items
  if (salePackagesRes.status === 'fulfilled') salePackages.value = salePackagesRes.value.data.data.items
  if (storesRes.status       === 'fulfilled') stores.value       = storesRes.value.data.data.stores
  if (staffRes.status        === 'fulfilled') staff.value        = staffRes.value.data.data.staff
  if (paymentTermsRes.status === 'fulfilled') paymentTerms.value = paymentTermsRes.value.data.data.values || []
  if (whtRes.status          === 'fulfilled') whtOptions.value   = whtRes.value.data.data.values || []

  if (orderRes.status !== 'fulfilled') {
    loadError.value = parseApiError(orderRes.reason, 'Failed to load order')
    loading.value = false
    return
  }

  const o = orderRes.value.data.data.order
  // Non-draft orders are loaded too, but rendered read-only (see `readonly`).
  order.value = o

  // Reconstruct parent/child links: server uses real UUIDs, the client uses
  // local keys so freshly-added rows can reference their parent before save.
  const idToKey = new Map()
  for (const it of o.items || []) idToKey.set(it.id, newKey())

  // Sync the "same as shipping" toggle from saved data — if shipping == billing
  // we present them as linked; otherwise both are independently editable.
  billingSameAsShipping.value = !!o.shippingAddress && o.shippingAddress === o.billingAddress

  form.value = {
    customerId:   o.customerId   || '',
    orderDate:    o.orderDate    || '',
    currency:     o.currency     || '',
    exchangeRate: o.exchangeRate != null ? Number(o.exchangeRate) : 1,
    notes:        o.notes        || '',
    referenceNumber:      o.referenceNumber      || '',
    vatRate:              Number(o.items?.find(i => !i.parentItemId)?.taxRate) || 0,
    paymentTerms:         o.paymentTerms         || '',
    salespersonId:        o.salespersonId        || '',
    shippingAddress:      o.shippingAddress      || '',
    billingAddress:       o.billingAddress       || '',
    discountType:         o.discountType         || '',
    discountValue:        Number(o.discountValue) || 0,
    whtCode:              o.whtCode              || '',
    whtRate:              Number(o.whtRate)      || 0,
    saleType:             o.saleType === 'cash' ? 'cash' : 'credit',
    items: (o.items || []).map(it => {
      const si = saleItems.value.find(s => s.id === it.saleItemId)
      const hasProduct = !!(it.productId || si?.productId)
      const isPackage = !!it.salePackageId && !it.parentItemId
      return {
        key:           idToKey.get(it.id),
        parentKey:     it.parentItemId ? (idToKey.get(it.parentItemId) || '') : '',
        isPackage,
        salePackageId: it.salePackageId || '',
        saleItemId:    it.saleItemId    || '',
        storeId:       it.storeId       || '',
        hasProduct:    isPackage ? false : hasProduct,
        productName:   it.productName || '',
        quantity:      Number(it.quantity) || 1,
        unitPrice:     it.unitPrice    != null ? Number(it.unitPrice)    : 0,
        taxRate:       it.taxRate      != null ? Number(it.taxRate)      : 0,
        discountType:  it.discountType === 'fixed' ? 'fixed' : 'percent',
        discountValue: it.discountValue != null ? Number(it.discountValue) : 0,
      }
    }),
  }
  loading.value = false
  // Arm dirty tracking after the load settles so the parse doesn't trip it.
  await nextTick()
  dirtyArmed = true
  saleTypeContainerRef.value?.querySelector('button')?.focus()
})

// Auto-populate addresses when customer changes and the field is empty.
watch(() => form.value.customerId, (id) => {
  const c = customers.value.find(x => x.id === id)
  if (!c) return
  if (!form.value.shippingAddress && c.address) form.value.shippingAddress = c.address
})

// Mirror shipping → billing while the "same as shipping" toggle is on.
watch(billingSameAsShipping, (on) => {
  if (on) form.value.billingAddress = form.value.shippingAddress
})
watch(() => form.value.shippingAddress, (v) => {
  if (billingSameAsShipping.value) form.value.billingAddress = v
})

function syncAddressesFromCustomer() {
  const c = selectedCustomer.value
  if (!c?.address) return
  form.value.shippingAddress = c.address
  if (billingSameAsShipping.value) form.value.billingAddress = c.address
}

// ── Inline customer create ──────────────────────────────────────────────
function openCustomerCreate() {
  if (readonly.value) return
  newCustomer.value = { name: '', company: '', email: '', phone: '', address: '' }
  newCustomerError.value = ''
  customerCreateOpen.value = true
  setTimeout(() => newCustomerNameRef.value?.focus(), 50)
}
function closeCustomerCreate() {
  customerCreateOpen.value = false
}
async function saveCustomer() {
  newCustomerError.value = ''
  if (!newCustomer.value.name?.trim()) {
    newCustomerError.value = 'Name is required'
    return
  }
  newCustomerSaving.value = true
  try {
    const { data } = await api.post('/erp/customers', { ...newCustomer.value, status: 'active' })
    const created = data.data?.customer || data.data
    if (created?.id) {
      customers.value = [created, ...customers.value]
      form.value.customerId = created.id
    }
    customerCreateOpen.value = false
  } catch (err) {
    newCustomerError.value = parseApiError(err, 'Failed to create customer')
  } finally {
    newCustomerSaving.value = false
  }
}

// ── Keyboard shortcuts ──────────────────────────────────────────────────
//   Ctrl/⌘+S          Save Draft (in-place)
//   Ctrl/⌘+Shift+S    Save Changes
//   Ctrl/⌘+A  /  Alt+I   Open product picker (Add Item)
//   Alt+C             New Customer slide-over
//   Esc               Close active modal / Discard
//   ?                 Toggle shortcuts panel
// Confirm dialog (Enter/Escape) and the customer slide-over (Escape) are handled
// separately so they take over while open (page shortcuts suppressed via `enabled`).
function onModalKeydown(e) {
  if (confirmOpen.value) {
    if (confirmJustOpened) return  // ignore the keypress that opened the dialog
    if (e.key === 'Enter')  { e.preventDefault(); confirmAnswer(confirmSaveLabel.value ? 'save' : true) }
    if (e.key === 'Escape') { e.preventDefault(); confirmAnswer(false) }
  } else if (customerCreateOpen.value && e.key === 'Escape') {
    e.preventDefault(); closeCustomerCreate()
  }
}

function scrollFocused(e) {
  const el = e.target
  if (!el || !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(el.tagName)) return
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
onMounted(() => window.addEventListener('keydown', onModalKeydown))
onUnmounted(() => window.removeEventListener('keydown', onModalKeydown))

function defaultTaxRate() {
  return form.value.vatRate
}

// Pre-selected store for new product lines (ERP Settings → Sale Orders).
function defaultLineStore() {
  return settings.saleOrders?.defaultStoreId || ''
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

// Which line's duplicate-warning popover is currently open (empty = none).
const openDupKey = ref('')
function toggleDupPopover(line) {
  openDupKey.value = openDupKey.value === line.key ? '' : line.key
}
function onDocClickClosePopover(e) {
  if (!openDupKey.value) return
  if (e.target.closest('[data-dup-popover]')) return
  openDupKey.value = ''
}
onMounted(() => document.addEventListener('mousedown', onDocClickClosePopover))
onUnmounted(() => document.removeEventListener('mousedown', onDocClickClosePopover))

const collapsedPackages = ref(new Set())
function isCollapsed(key) { return collapsedPackages.value.has(key) }
function toggleCollapse(key) {
  const next = new Set(collapsedPackages.value)
  if (next.has(key)) next.delete(key)
  else               next.add(key)
  collapsedPackages.value = next
}
function isRowVisible(line) {
  return !(line.parentKey && isCollapsed(line.parentKey))
}

// ── Drag-and-drop reorder ────────────────────────────────────────────────
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
  if (readonly.value) { e.preventDefault(); return }
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
function onDragEnd() {
  dragFromIdx.value = null
  dragOverIdx.value = null
}

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

function onSaleItemChange(line) {
  const si = saleItems.value.find(s => s.id === line.saleItemId)
  if (!si) { line.productName = ''; line.unitPrice = 0; line.hasProduct = false; line.storeId = ''; return }
  line.productName = si.name
  line.hasProduct  = !!si.productId
  if (!line.hasProduct) line.storeId = ''
  else if (!line.storeId) line.storeId = defaultLineStore()
  applyPricing(line)
  clampLineQty(line)
}

async function onPickerChange(line, idx) {
  const id = line.saleItemId
  if (!id) { onSaleItemChange(line); return }
  if (saleItems.value.some(s => s.id === id)) { onSaleItemChange(line); return }
  if (salePackages.value.some(p => p.id === id)) {
    await expandPackageInto(idx, id)
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
      const hasProduct = !!(si.productId || saleItems.value.find(s => s.id === pi.saleItemId)?.productId)
      let resolved = pi.unitPrice != null ? Number(pi.unitPrice) : 0
      if (!resolved) {
        const siFull = saleItems.value.find(s => s.id === pi.saleItemId)
        const pricing = siFull ? getBestPricing(siFull, customer?.customerGroupId) : null
        if (pricing) resolved = Number(pricing.unitPrice)
      }
      const childQty = Number(pi.quantity) || 1
      parentPrice += childQty * resolved
      return {
        key:           newKey(),
        parentKey,
        isPackage:     false,
        salePackageId: '',
        saleItemId:    pi.saleItemId,
        storeId:       hasProduct ? defaultLineStore() : '',
        hasProduct,
        productName:   si.name || 'Item',
        quantity:      childQty,
        unitPrice:     0,
        taxRate:       0,
      }
    })
    const parent = {
      key:           parentKey,
      parentKey:     '',
      isPackage:     true,
      salePackageId: pkg.id,
      saleItemId:    '',
      storeId:       '',
      hasProduct:    false,
      productName:   pkg.name,
      quantity:      1,
      unitPrice:     parentPrice,
      taxRate:       form.value.vatRate,
      discountType:  'percent',
      discountValue: 0,
    }
    return [parent, ...children]
  } catch {
    return []
  }
}

async function expandPackageInto(idx, packageId) {
  const lines = await linesFromPackage(packageId)
  if (lines.length) form.value.items.splice(idx, 1, ...lines)
  else              form.value.items.splice(idx, 1)
}

// ── Bulk-add popup wiring ───────────────────────────────────────────────
const bulkPickerRef = ref(null)
function openBulkPicker() { if (readonly.value) return; bulkPickerRef.value?.open() }

function makeLineFromSaleItem(si, parentKey = '') {
  const customer = customers.value.find(c => c.id === form.value.customerId)
  const pricing  = getBestPricing(si, customer?.customerGroupId)
  return {
    key:           newKey(),
    parentKey,
    isPackage:     false,
    salePackageId: '',
    saleItemId:    si.id,
    storeId:       si.productId ? defaultLineStore() : '',
    hasProduct:    !!si.productId,
    productName:   si.name,
    quantity:      1,
    unitPrice:     pricing ? Number(pricing.unitPrice) : 0,
    taxRate:       defaultTaxRate(),
    discountType:  'percent',
    discountValue: 0,
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
  for (const l of newLines) clampLineQty(l)
  form.value.items.push(...newLines)
  await nextTick()
  const firstPriced = newLines.find(l => !l.parentKey)
  if (!firstPriced) return
  const row = document.querySelector(`[data-line-key="${firstPriced.key}"]`)
  const qty = row?.querySelector('input[type="number"]')
  qty?.focus()
  qty?.select?.()
}

watch(() => form.value.customerId, () => {
  errors.value.customerId = ''
  for (const line of form.value.items) applyPricing(line)
})

// Sale-item IDs that appear on more than one *top-level* line.
const duplicateSaleItemIds = computed(() => {
  const counts = new Map()
  for (const it of form.value.items) {
    if (it.parentKey) continue
    const id = it.saleItemId
    if (!id) continue
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  const dupes = new Set()
  for (const [id, n] of counts) if (n > 1) dupes.add(id)
  return dupes
})
function isDuplicate(line) {
  return !line.parentKey && !!line.saleItemId && duplicateSaleItemIds.value.has(line.saleItemId)
}

function lineGross(line) {
  return (line.quantity || 0) * (line.unitPrice || 0)
}
function lineDiscountAmount(line) {
  const gross = lineGross(line)
  const v = Number(line.discountValue) || 0
  return line.discountType === 'fixed' ? Math.min(v, gross) : gross * (v / 100)
}
function lineNet(line) {
  if (line.parentKey) return 0
  return lineGross(line) - lineDiscountAmount(line)
}
function lineTax(line) {
  if (line.parentKey) return 0
  return lineNet(line) * ((line.taxRate || 0) / 100)
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
// VAT method comes from ERP Settings → General → Tax. Exclusive: entered prices
// are net and VAT is added on top. Inclusive: entered prices already include VAT,
// which is extracted so the displayed total stays the entered amount.
const taxInclusive = computed(() => settings.tax?.inclusive === true)
const linesTotal = computed(() => form.value.items.reduce((s, i) => s + lineNet(i), 0))
const taxAmount  = computed(() => {
  const rate = Number(form.value.vatRate) || 0
  if (!rate) return 0
  return taxInclusive.value
    ? toFixed(linesTotal.value * rate / (100 + rate), 2)
    : toFixed(linesTotal.value * rate / 100, 2)
})
const subtotal   = computed(() => taxInclusive.value
  ? toFixed(linesTotal.value - Number(taxAmount.value), 2)
  : toFixed(linesTotal.value, 2))
const discountAmount = computed(() => {
  const gross = Number(subtotal.value) + Number(taxAmount.value)
  const v = Number(form.value.discountValue) || 0
  if (form.value.discountType === 'percent') return toFixed(Math.min(gross * v / 100, gross), 2)
  if (form.value.discountType === 'fixed')   return toFixed(Math.min(v, gross), 2)
  return 0
})
const grandTotal = computed(() => Number(subtotal.value) + Number(taxAmount.value) - Number(discountAmount.value))

// WHT is computed on the order amount (subtotal + tax); net = total - WHT.
const whtAmount = computed(() => toFixed((Number(subtotal.value) + Number(taxAmount.value)) * (Number(form.value.whtRate) || 0) / 100, 2))
const netTotal  = computed(() => toFixed(Number(grandTotal.value) - Number(whtAmount.value), 2))

// The order discount can't exceed the order total: percent ≤ 100, fixed ≤ gross.
// Clamp on input and whenever the cap changes (type switch / totals change).
const orderDiscountMax = computed(() =>
  form.value.discountType === 'percent' ? 100 : Number(subtotal.value) + Number(taxAmount.value))
function clampOrderDiscount() {
  const max = orderDiscountMax.value
  let v = Number(form.value.discountValue) || 0
  if (v < 0) v = 0
  if (v > max) v = toFixed(max, 2)
  if (v !== form.value.discountValue) form.value.discountValue = v
}
watch(orderDiscountMax, clampOrderDiscount)

// Keep each line's fixed discount within its line price as qty/price change.
watch(() => form.value.items.map(l => `${l.discountType}:${l.discountValue}:${lineGross(l)}`).join('|'), () => {
  for (const line of form.value.items) {
    if (line.discountType !== 'fixed') continue
    const gross = lineGross(line)
    if ((Number(line.discountValue) || 0) > gross) line.discountValue = toFixed(gross, 2)
  }
})

const canSave = computed(() => {
  if (!form.value.customerId || !form.value.orderDate) return false
  if (!form.value.items.filter(i => !i.parentKey).length) return false
  for (const item of form.value.items) {
    if (item.isPackage) {
      if (!item.quantity || item.quantity < 1) return false
      continue
    }
    if (!item.productName?.trim()) return false
    if (item.hasProduct && !item.storeId) return false
    if (!item.quantity || item.quantity < 1) return false
    if (exceedsStock(item)) return false
  }
  return true
})

function validate() {
  const e = {}
  if (!form.value.customerId) e.customerId = 'Customer is required'
  if (!form.value.orderDate)  e.orderDate  = 'Order date is required'
  const pricedCount = form.value.items.filter(i => !i.parentKey).length
  if (!pricedCount) e.items = 'Add at least one item'
  for (const item of form.value.items) {
    if (item.isPackage) {
      if (!item.quantity || item.quantity < 1) { e.items = 'Package quantity must be at least 1'; break }
      continue
    }
    if (!item.productName?.trim())        { e.items = 'All items need a description'; break }
    if (item.hasProduct && !item.storeId) { e.items = 'Select a store for product items'; break }
    if (!item.quantity || item.quantity < 1) { e.items = 'All items need a valid quantity'; break }
    if (exceedsStock(item)) { e.items = `${item.productName}: ${t('erp.orders.qtyExceedsStock')} (${availableStock(item)})`; break }
  }
  errors.value = e
  return Object.keys(e).length === 0
}

// `redirect` controls whether we navigate back to the detail page after save.
// Save Changes → redirect; Save Draft → stay on edit page with "saved" indicator.
async function save({ redirect = true } = {}) {
  if (readonly.value) return
  globalError.value = ''
  resetErrors()
  if (!validate()) return
  if (redirect) saving.value = true
  else          savingDraft.value = true
  try {
    const payload = {
      customerId:   form.value.customerId,
      orderDate:    form.value.orderDate,
      currency:     form.value.currency || null,
      exchangeRate: form.value.exchangeRate,
      notes:        form.value.notes,
      referenceNumber:      form.value.referenceNumber      || null,

      paymentTerms:         form.value.paymentTerms         || null,
      salespersonId:        form.value.salespersonId        || null,
      shippingAddress:      form.value.shippingAddress      || null,
      billingAddress:       form.value.billingAddress       || null,
      discountType:         form.value.discountType         || null,
      discountValue:        Number(form.value.discountValue) || 0,
      whtCode:              form.value.whtCode              || null,
      whtRate:              Number(form.value.whtRate)      || 0,
      saleType:             form.value.saleType,
      items: form.value.items.map(({ key, parentKey, salePackageId, saleItemId, storeId, productName, quantity, unitPrice, taxRate, discountType, discountValue }) => ({
        key, parentKey: parentKey || '',
        salePackageId: salePackageId || null,
        saleItemId:    saleItemId    || null,
        storeId:       storeId       || null,
        productName, quantity, unitPrice,
        taxRate:       Number(taxRate)       || 0,
        discountType:  discountType === 'fixed' ? 'fixed' : 'percent',
        discountValue: Number(discountValue) || 0,
      })),
    }
    await api.put(`/erp/sale-orders/${route.params.id}`, payload)
    dirty.value = false
    if (redirect) {
      router.push(`/erp/sale-orders/${route.params.id}`)
    } else {
      draftSavedAt.value = new Date()
    }
  } catch (err) {
    const had = setFromError(err)
    if (!had) globalError.value = parseApiError(err, 'Failed to update order')
  } finally {
    saving.value = false
    savingDraft.value = false
  }
}

function saveDraft() { save({ redirect: false }) }

async function discard() {
  if (dirty.value) {
    const res = await confirmAsync({
      title:     t('erp.orders.unsavedChanges'),
      message:   t('erp.orders.unsavedChangesHint'),
      okLabel:   t('erp.orders.dontSave'),
      saveLabel: t('erp.orders.saveDraft'),
    })
    if (res === false) return                              // stay
    if (res === 'save' && !(await saveDraftAndLeave())) return  // save failed → stay
  }
  router.push('/erp/sale-orders')
}

// "12s ago" / "2m ago" hint next to the Saved indicator.
const _now = ref(Date.now())
onMounted(() => { const id = setInterval(() => { _now.value = Date.now() }, 15000); onUnmounted(() => clearInterval(id)) })
const savedAtRelative = computed(() => {
  if (!draftSavedAt.value) return ''
  const secs = Math.max(0, Math.round((_now.value - draftSavedAt.value.getTime()) / 1000))
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`
  return `${Math.round(secs / 3600)}h ago`
})
</script>

<style scoped>
.customer-field :deep(.multiselect),
.customer-field :deep(.multiselect__tags),
.customer-field :deep(.multiselect__select) {
  cursor: default;
}
</style>
