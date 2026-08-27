<script setup lang="ts">
// Lightweight tooltip: wraps any trigger and shows `text` on hover or keyboard
// focus. Pure CSS (Tailwind group utilities) — no JS state, no extra deps.
defineProps<{ text: string }>()
</script>

<template>
  <span class="group relative inline-flex">
    <slot />
    <span
      class="pointer-events-none absolute left-1/2 top-full z-[60] mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-700 bg-[#0b1220] px-2 py-1 text-xs text-slate-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      role="tooltip"
    >
      {{ text }}
    </span>
  </span>
</template>
