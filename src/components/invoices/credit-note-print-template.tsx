import { CompanyBrand, PrintGeneratedBy } from '@/components/print/company-brand'
import { amountToLetters, formatCfa, formatFrDate, printAccentVars } from '@/lib/invoices'
import { cn } from '@/lib/cn'
import type { CreditNotePrint } from '@/lib/credit-notes'

export type CreditNotePrintFormat = 'ticket' | 'a5' | 'a4'

type CreditNotePrintTemplateProps = {
  note: CreditNotePrint
  format?: CreditNotePrintFormat
  className?: string
}

const formatClass: Record<CreditNotePrintFormat, string> = {
  ticket: 'pos-ticket-sheet w-[80mm] p-4 text-[11px]',
  a5: 'pos-ticket-sheet pos-ticket-sheet--a5 w-[148mm] p-8 text-[13px]',
  a4: 'pos-ticket-sheet pos-ticket-sheet--a4 w-[210mm] p-10 text-sm',
}

export function CreditNotePrintTemplate({
  note,
  format = 'ticket',
  className,
}: CreditNotePrintTemplateProps) {
  const compact = format === 'ticket'

  return (
    <article
      className={cn('flex flex-col bg-white text-foreground shadow-sm', formatClass[format], className)}
      style={printAccentVars(note.settings.accentColor)}
    >
      <header
        className={cn('border-b pb-3', compact ? 'text-center' : 'flex items-start justify-between gap-4')}
        style={{ borderColor: 'var(--print-accent)' }}
      >
        <CompanyBrand
          name={note.company.name}
          logoPath={note.company.logoPath}
          logoUrl={note.company.logoUrl}
          size={compact ? 'sm' : 'md'}
          align={compact ? 'center' : 'left'}
        />
        <div className={compact ? 'mt-2' : 'text-right'}>
          <p className="text-[10px] font-bold tracking-wide uppercase" style={{ color: 'var(--print-accent)' }}>
            Ticket / Reçu d’avoir
          </p>
          <p className="text-base font-bold">{note.code}</p>
        </div>
      </header>

      <section className="mt-3 space-y-0.5">
        {note.company.slogan ? <p className="italic text-foreground-muted">{note.company.slogan}</p> : null}
        <p>{note.company.address}</p>
        <p>Tél. {note.company.phone1}</p>
      </section>

      <dl className="mt-3 space-y-1 border-y border-dashed border-subtle-border py-2">
        <div className="flex justify-between gap-2">
          <dt>Date</dt>
          <dd>{formatFrDate(note.createdAt)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Facture liée</dt>
          <dd className="text-right font-bold">{note.invoiceCode}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Client</dt>
          <dd className="text-right font-bold">{note.customerName}</dd>
        </div>
      </dl>

      <div
        className="mt-4 rounded-xl border p-4 text-center"
        style={{ borderColor: 'var(--print-accent)', background: 'var(--print-accent-soft)' }}
      >
        <p className="text-[10px] font-bold tracking-wide text-foreground-muted uppercase">Montant de l’avoir</p>
        <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--print-accent)' }}>
          {formatCfa(note.amount)}
        </p>
      </div>

      <p className="mt-3">
        Motif : <span className="font-bold">{note.reason}</span>
      </p>
      {note.restock ? (
        <p className="mt-1 font-bold text-emerald-700">Articles réintégrés en stock.</p>
      ) : (
        <p className="mt-1 text-foreground-muted">Sans réapprovisionnement en stock.</p>
      )}

      <p className={cn('mt-4', compact ? 'text-[10px]' : 'text-sm')}>
        Arrêté le présent avoir à la somme de <span className="font-bold">{amountToLetters(note.amount)}</span>.
      </p>

      {compact ? (
        <div className="mt-4 space-y-1 text-center text-[10px]">
          <p>
            Avoir émis par : <span className="font-bold">{note.cashierName}</span>
          </p>
          <p>Motif : {note.reason}</p>
        </div>
      ) : (
        <div className="mt-auto grid grid-cols-2 gap-6 pt-10 text-sm">
          <div>
            <p className="font-bold">Signature Caissier</p>
            <p className="mt-1 text-xs text-foreground-muted">{note.cashierName}</p>
            <p className="mt-10 border-t border-subtle-border pt-2">Cachet / Signature</p>
          </div>
          <div className="text-right">
            <p className="font-bold">Signature Client (Reçu conforme)</p>
            <p className="mt-1 text-xs text-foreground-muted">{note.customerName}</p>
            <p className="mt-10 border-t border-subtle-border pt-2">Signature</p>
          </div>
        </div>
      )}

      <PrintGeneratedBy className={cn('mt-4', compact ? 'text-center' : undefined)} />
    </article>
  )
}
