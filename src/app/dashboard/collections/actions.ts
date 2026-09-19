'use server'

import { revalidatePath } from 'next/cache'
import { issueCreditNote, type CreditNoteInput } from '@/lib/credit-notes'

export async function createCreditNote(data: CreditNoteInput) {
  const result = await issueCreditNote(data)
  if (result.ok) {
    revalidatePath('/dashboard/payments')
    revalidatePath('/dashboard/invoices')
    revalidatePath('/dashboard/pos')
    revalidatePath('/dashboard/products')
    revalidatePath('/dashboard')
  }
  return result
}
