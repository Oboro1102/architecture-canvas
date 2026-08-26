<script setup lang="ts">
/**
 * V3 — the app IS the landing experience now. The V2 dashboard remains
 * reachable via `?view=v2` for development / regression checking.
 */
import { ref, onMounted } from 'vue'
import LandingView from '@/components/layout/LandingView.vue'
import AppShell from '@/components/layout/AppShell.vue'

const view = ref<'landing' | 'v2'>('landing')

onMounted(() => {
  if (new URLSearchParams(window.location.search).get('view') === 'v2') {
    view.value = 'v2'
  }
})
</script>

<template>
  <LandingView v-if="view === 'landing'" />
  <AppShell v-else />
</template>
