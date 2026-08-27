<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useConfirm } from '@/composables/useConfirm'

const { state, settle } = useConfirm()
</script>

<template>
  <AlertDialog :open="!!state">
    <AlertDialogContent class="border-slate-700 bg-[#0b1220] text-slate-100">
      <AlertDialogHeader>
        <AlertDialogTitle class="text-slate-100">{{ state?.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="state?.description" class="text-slate-400">
          {{ state.description }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel
          class="border-slate-600 bg-transparent text-slate-300 hover:bg-slate-700/40 hover:text-white"
          @click="settle(false)"
        >
          {{ state?.cancelText ?? '取消' }}
        </AlertDialogCancel>
        <AlertDialogAction
          class="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
          @click="settle(true)"
        >
          {{ state?.confirmText ?? '確認' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
