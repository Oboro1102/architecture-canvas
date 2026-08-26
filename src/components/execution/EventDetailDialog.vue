<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { EVENT_TYPE_LABEL } from '@/types/execution'
import type { ExecutionEvent } from '@/types/execution'

const props = defineProps<{ event: ExecutionEvent | null }>()
const emit = defineEmits<{ close: [] }>()

const metaEntries = computed(() =>
  props.event?.metadata ? Object.entries(props.event.metadata) : [],
)
</script>

<template>
  <Transition name="modal">
    <div
      v-if="event"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-detail-title"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
        <header class="flex items-start justify-between gap-3">
          <h2 id="event-detail-title" class="text-sm font-semibold">{{ event.title }}</h2>
          <button class="icon-btn" aria-label="關閉事件詳情" @click="emit('close')">
            <X class="size-4" aria-hidden="true" />
          </button>
        </header>
        <dl class="mt-3 space-y-2 text-xs">
          <div class="flex gap-2">
            <dt class="w-16 shrink-0 text-muted-foreground">時間</dt>
            <dd class="font-mono">
              {{ new Date(event.timestamp).toLocaleString('zh-TW', { hour12: false }) }}
            </dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-16 shrink-0 text-muted-foreground">Agent</dt>
            <dd>{{ event.agentId }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-16 shrink-0 text-muted-foreground">類型</dt>
            <dd>{{ EVENT_TYPE_LABEL[event.type] }}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-16 shrink-0 text-muted-foreground">內容</dt>
            <dd class="whitespace-pre-wrap">{{ event.description }}</dd>
          </div>
          <template v-if="metaEntries.length">
            <div v-for="[k, v] in metaEntries" :key="k" class="flex gap-2">
              <dt class="w-16 shrink-0 text-muted-foreground">{{ k }}</dt>
              <dd>{{ String(v) }}</dd>
            </div>
          </template>
        </dl>
      </div>
    </div>
  </Transition>
</template>
