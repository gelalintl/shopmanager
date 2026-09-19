import { CompanyBrand, PrintCopyBadge, PrintGeneratedBy } from '@/components/print/company-brand'
import { amountToLetters, formatCfa, formatFrDate, printAccentVars } from '@/lib/invoices'
import { cn } from '@/lib/cn'
import type { PosTicket } from '@/app/dashboard/pos/types'

export type PosTicketFormat = 'ticket' | 'a5' | 'a4'
export type PosTicketCopy = 'client' | 'shop'

type PosTicketTemplateProps = {
  ticket: PosTicket
  format?: PosTicketFormat
  copy?: PosTicketCopy
  className?: string
}

const formatClass: Record<PosTicketFormat, string> = {
  ticket: 'pos-ticket-sheet w-[80mm] p-4 text-[11px]',
  a5: 'pos-ticket-sheet pos-ticket-sheet--a5 w-[148mm] p-8 text-[13px]',
  a4: 'pos-ticket-sheet pos-ticket-sheet--a4 w-[210mm] p-10 text-sm',
}

const copyLabels: Record<PosTicketCopy, string> = {
  client: 'COPIE CLIENT',
  shop: 'COPIE BOUTIQUE / CAISSE',
}

export function PosTicketTemplate({
  ticket,
  format = 'ticket',
  copy = 'client',
  className,
}: PosTicketTemplateProps) {
  const compact = format === 'ticket'
  const copyLabel = copyLabels[copy]

  return (
    <article
      className={cn(
        'flex flex-col bg-white text-foreground shadow-sm',
        formatClass[format],
        className,
      )}
      style={printAccentVars(ticket.settings.accentColor)}
    >
      <div className={cn('mb-3', compact ? 'text-center' : 'flex justify-end')}>
        <PrintCopyBadge label={copyLabel} />
      </div>

      <header
        className={cn('border-b pb-3', compact ? 'text-center' : 'flex items-start justify-between gap-4')}
        style={{ borderColor: 'var(--print-accent)' }}
      >
        <CompanyBrand
          name={ticket.company.name}
          logoPath={ticket.company.logoPath}
          logoUrl={ticket.company.logoUrl}
          size={compact ? 'sm' : 'md'}
          align={compact ? 'center' : 'left'}
        />
        <div className={compact ? 'mt-2' : 'text-right'}>
          <p className="text-[10px] font-bold tracking-wide uppercase" style={{ color: 'var(--print-accent)' }}>
            Ticket de caisse
          </p>
          <p className="text-base font-bold">{ticket.code}</p>
        </div>
      </header>

      <section className="mt-3 space-y-0.5">
        {ticket.company.slogan ? <p className="italic text-foreground-muted">{ticket.company.slogan}</p> : null}
        <p>{ticket.company.address}</p>
        <p>Tél. {ticket.company.phone1}</p>
        {ticket.company.nif ? <p>NIF {ticket.company.nif}</p> : null}
      </section>

      <dl className="mt-3 space-y-1 border-y border-dashed border-subtle-border py-2">
        <div className="flex justify-between gap-2">
          <dt>Date</dt>
          <dd>{formatFrDate(ticket.createdAt)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Client</dt>
          <dd className="text-right font-bold">{ticket.customerName}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Caisse</dt>
          <dd>{ticket.cashierName}</dd>
        </div>
      </dl>

      <table className="mt-3 w-full">
        <thead>
          <tr className="border-b border-subtle-border text-left text-[10px] tracking-wide uppercase text-foreground-muted">
            <th className="py-1">Article</th>
            <th className="py-1 text-right">Qté</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {ticket.lines.map((line, index) => (
            <tr key={`${line.designation}-${index}`} className="align-top">
              <td className="py-1.5 pr-2">
                <span className="font-bold">{line.designation}</span>
                <span className="mt-0.5 block text-foreground-muted">
                  {formatCfa(line.unitPrice)}
                  {line.discountRate > 0 ? ` · -${line.discountRate}%` : ''}
                </span>
              </td>
              <td className="py-1.5 text-right">{line.quantity}</td>
              <td className="py-1.5 text-right font-bold">{formatCfa(line.ht)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 border-t border-dashed border-subtle-border pt-3">
        <div className="flex justify-between">
          <span>Sous-total HT</span>
          <span>{formatCfa(ticket.totals.ht)}</span>
        </div>
        {ticket.totals.globalDiscount > 0 ? (
          <div className="flex justify-between">
            <span>Remise</span>
            <span>- {formatCfa(ticket.totals.globalDiscount)}</span>
          </div>
        ) : null}
        {ticket.hasTva ? (
          <div className="flex justify-between">
            <span>TVA 19 %</span>
            <span>{formatCfa(ticket.totals.vat)}</span>
          </div>
        ) : (
          <div className="flex justify-between text-foreground-muted">
            <span>TVA</span>
            <span>Exonéré</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold" style={{ color: 'var(--print-accent)' }}>
          <span>Net à payer</span>
          <span>{formatCfa(ticket.totals.ttc)}</span>
        </div>
        <div className="flex justify-between">
          <span>{ticket.paymentMethodLabel}</span>
          <span>{formatCfa(ticket.amountTendered)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Rendu</span>
          <span>{formatCfa(ticket.change)}</span>
        </div>
      </div>

      <p className={cn('mt-4', compact ? 'text-[10px]' : 'text-sm')}>
        Arrêté le présent ticket à la somme de <span className="font-bold">{amountToLetters(ticket.totals.ttc)}</span>.
      </p>

      {!compact ? (
        <div className="mt-auto grid grid-cols-2 gap-6 pt-10 text-sm">
          <div>
            <p className="text-foreground-muted">Le client</p>
            <p className="mt-10 border-t border-subtle-border pt-2">Signature</p>
          </div>
          <div className="text-right">
            <p className="text-foreground-muted">Pour {ticket.company.name}</p>
            <p className="mt-10 border-t border-subtle-border pt-2">Cachet</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-center text-[10px] text-foreground-muted">Merci de votre visite</p>
      )}

      <div className={cn('mt-4', compact ? 'text-center' : 'flex justify-end')}>
        <PrintCopyBadge label={copyLabel} />
      </div>
      <PrintGeneratedBy className={cn('mt-3', compact ? 'text-center' : undefined)} />
    </article>
  )
}
