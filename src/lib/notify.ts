'use client'

import { toast } from 'sonner'

export function toastResult<T extends { ok: true }>(
  result: T | { ok: false; error: string },
  success: string,
): result is T {
  if (result.ok) {
    toast.success(success)
    return true
  }
  toast.error(result.error)
  return false
}
