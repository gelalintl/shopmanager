import { InvoiceStatus, MovementType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/tenant'
import {
  formatCreditNoteCode,
  invoiceSettlement,
  parsePrintSettings,
  type PrintCompany,
  type PrintSettings,
} from '@/lib/invoices'
import { invoiceStatusFromPaid } from '@/lib/payments'
import { toPrintCompany } from '@/lib/settings'
import { isServiceProduct } from '@/lib/stock'

export const CREDIT_NOTE_REASONS = [
  'Erreur de saisie caisse',
  'Retour article',
  'Geste commercial',
  'Produit défectueux',
  'Double encaissement',
] as const

export type CreditNoteReason = (typeof CREDIT_NOTE_REASONS)[number]

export type CreditNoteInput = {
  invoicePublicId: string
  amount: number
  reason: string
  restock: boolean
}

export type CreditNoteActionResult =
  | { ok: true; publicId: string; code: string; estimationPublicId: string }
  | { ok: false; error: string }

export type CreditNoteHistoryItem = {
  publicId: string
  code: string
  amount: number
  reason: string
  restock: boolean
  createdAt: string
  cashierName: string
}

export type CreditNotePrint = {
  publicId: string
  code: string
  amount: number
  reason: string
  restock: boolean
  createdAt: string
  invoiceCode: string
  invoicePublicId: string
  estimationPublicId: string
  cashierName: string
  customerName: string
  company: PrintCompany
  settings: PrintSettings
}

function sumAmounts(rows: Array<{ amount: bigint }>) {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0)
}

async function nextCreditNoteCode(
  tx: Prisma.TransactionClient,
  companyId: number,
  fiscalYear: number,
) {
  const seq = await tx.documentSequence.upsert({
    where: {
      companyId_fiscalYear_type: { companyId, fiscalYear, type: 'CREDIT_NOTE' },
    },
    create: { companyId, fiscalYear, type: 'CREDIT_NOTE', lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  })
  return formatCreditNoteCode(fiscalYear, seq.lastValue)
}

export async function issueCreditNote(data: CreditNoteInput): Promise<CreditNoteActionResult> {
  const ctx = await getTenantContext()
  if (!ctx.ok) return { ok: false, error: ctx.error }

  const amount = Math.round(Number(data.amount) || 0)
  if (amount <= 0) return { ok: false, error: 'Le montant de l’avoir doit être un montant positif.' }

  const reason = String(data.reason ?? '').trim()
  if (!reason) return { ok: false, error: 'Le motif de l’avoir est obligatoire.' }

  const invoice = await prisma.invoice.findFirst({
    where: {
      publicId: data.invoicePublicId,
      companyId: ctx.user.companyId,
    },
    include: {
      customer: { select: { id: true } },
      estimation: {
        select: {
          publicId: true,
          totalAmount: true,
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              unitPrice: true,
              product: { select: { type: true } },
            },
          },
        },
      },
      collections: { where: { isDeleted: false }, select: { amount: true } },
      creditNotes: { select: { amount: true, restock: true } },
    },
  })
  if (!invoice || invoice.companyId !== ctx.user.companyId) {
    return { ok: false, error: 'Facture introuvable.' }
  }
  if (invoice.status === InvoiceStatus.CANCELED) {
    return { ok: false, error: 'Impossible d’émettre un avoir sur une facture annulée.' }
  }
  if (invoice.status === InvoiceStatus.PENDING_CANCELLATION) {
    return { ok: false, error: 'Facture en attente d’annulation. Impossible d’émettre un avoir.' }
  }

  const totalTtc = Number(invoice.estimation.totalAmount)
  const collected = sumAmounts(invoice.collections)
  const credited = sumAmounts(invoice.creditNotes)
  const { netPaid } = invoiceSettlement(totalTtc, collected, credited)
  if (netPaid <= 0) {
    return {
      ok: false,
      error:
        'Aucun encaissement à rembourser. L’annulation complète d’une facture impayée nécessite une validation administrateur.',
    }
  }
  if (amount > netPaid) {
    return {
      ok: false,
      error: `Le montant maximum remboursable est de ${netPaid} F CFA.`,
    }
  }

  const restock = Boolean(data.restock)
  const alreadyRestocked = invoice.creditNotes.some((note) => note.restock)
  const shouldRestock = restock && !alreadyRestocked

  try {
    const created = await prisma.$transaction(async (tx) => {
      const fiscalYear = invoice.fiscalYear || new Date().getFullYear()
      const code = await nextCreditNoteCode(tx, invoice.companyId, fiscalYear)
      const note = await tx.creditNote.create({
        data: {
          companyId: invoice.companyId,
          code,
          fiscalYear,
          amount: BigInt(amount),
          reason,
          restock,
          invoiceId: invoice.id,
          createdById: ctx.user.id,
        },
      })

      const next = invoiceSettlement(totalTtc, collected, credited + amount)
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: invoiceStatusFromPaid(next.netPaid, totalTtc) },
      })

      if (shouldRestock) {
        for (const item of invoice.estimation.items) {
          if (item.quantity <= 0 || isServiceProduct(item.product.type)) continue
          await tx.stockMovement.create({
            data: {
              companyId: invoice.companyId,
              type: MovementType.IN,
              quantity: item.quantity,
              sellingPrice: item.unitPrice,
              productId: item.productId,
              customerId: invoice.customer.id,
              estimationItemId: item.id,
              createdById: ctx.user.id,
            },
          })
        }
      }

      return note
    })

    return { ok: true, publicId: created.publicId, code: created.code, estimationPublicId: invoice.estimation.publicId }
  } catch (error) {
    console.error('Erreur création avoir:', error)
    return { ok: false, error: 'L’enregistrement de l’avoir a échoué.' }
  }
}

export async function loadCreditNote(companyId: number, publicId: string): Promise<CreditNotePrint | null> {
  const note = await prisma.creditNote.findFirst({
    where: { companyId, publicId },
    include: {
      createdBy: { select: { name: true, pseudo: true } },
      company: true,
      invoice: {
        include: {
          customer: { select: { name: true } },
          estimation: { select: { publicId: true } },
        },
      },
    },
  })
  if (!note) return null

  return {
    publicId: note.publicId,
    code: note.code,
    amount: Number(note.amount),
    reason: note.reason,
    restock: note.restock,
    createdAt: note.createdAt.toISOString(),
    invoiceCode: note.invoice.code,
    invoicePublicId: note.invoice.publicId,
    estimationPublicId: note.invoice.estimation.publicId,
    cashierName: note.createdBy.name || note.createdBy.pseudo,
    customerName: note.invoice.customer.name,
    company: toPrintCompany(note.company),
    settings: parsePrintSettings(note.company.printSettings),
  }
}
