import { ref, type Component } from 'vue'

// A tiny app-wide confirmation dialog built on shadcn-vue's AlertDialog.
// Components call `confirm({ title, description, confirmText, cancelText })` and
// await a boolean — replacing the ugly native `window.confirm` with a styled,
// theme-consistent dialog.

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  // Optional icon component shown in the dialog media slot.
  icon?: Component
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve: (ok: boolean) => void
}

const state = ref<ConfirmState | null>(null)

export function useConfirm() {
  return {
    // Current dialog state (read by the global <ConfirmDialog> host).
    state,
    confirm(options: ConfirmOptions): Promise<boolean> {
      return new Promise<boolean>((resolve) => {
        state.value = { ...options, open: true, resolve }
      })
    },
    // Called by ConfirmDialog when the user picks an option.
    settle(ok: boolean) {
      const s = state.value
      if (!s) return
      state.value = null
      s.resolve(ok)
    },
  }
}
