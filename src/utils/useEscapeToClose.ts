import { onMounted, onUnmounted } from 'vue'

/**
 * Phase 10 accessibility — close a dialog with the Escape key.
 * `active` controls whether the listener acts (dialog open).
 */
export function useEscapeToClose(active: () => boolean, close: () => void): void {
  function handler(e: KeyboardEvent): void {
    if (e.key === 'Escape' && active()) close()
  }
  onMounted(() => document.addEventListener('keydown', handler))
  onUnmounted(() => document.removeEventListener('keydown', handler))
}
