<template>
  <label :for="forId" class="label-xs">
    <slot>{{ text }}</slot>
    <span v-if="required" class="text-red-500 normal-case font-normal">*</span>
  </label>
</template>

<script setup>
defineProps({
  text:     { type: String, default: '' },
  required: { type: Boolean, default: false },
  forId:    { type: String, default: '' },
})
</script>
