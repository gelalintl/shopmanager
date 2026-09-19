'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Caption, Heading, Text } from '@/components/ui/typography'
import { StatsCard } from '@/components/dashboard/stats-card'
import { CustomerModal } from '@/components/customers/customer-modal'
import { PaymentDialog } from '@/components/payments/payment-dialog'
import { kindLabel, type CustomerDetails } from '@/lib/customers'
import { formatCfa, formatFrDate, statusClass, statusLabels, type DocumentListItem } from '@/lib/invoices'
import { cn } from '@/lib/cn'

type CustomerProfileProps = {
  customer: CustomerDetails
}

export function CustomerProfile({ customer }: CustomerProfileProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [paying, setPaying] = useState<DocumentListItem | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <span
              className={cn(
                'inline-flex rounded-full px-2.5 py-1 text-xs font-bold',
                customer.kind === 'COMPANY' ? 'bg-soft-cobalt text-cobalt' : 'bg-slate-100 text-slate-600',
              )}
            >
              {kindLabel(customer.kind)}
            </span>
            <Heading as="h2" className="mt-3">
              {customer.name}
            </Heading>
            <div className="mt-3 space-y-1">
              <Text>
                {customer.postBox ? `BP ${customer.postBox}, ` : ''}
                {customer.address}
              </Text>
              <Text>Tél. {customer.phone || '—'}</Text>
              {customer.email ? <Text>Email {customer.email}</Text> : null}
              {customer.kind === 'COMPANY' && customer.nif ? <Text>NIF {customer.nif}</Text> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setModalOpen(true)}>
              Modifier
            </Button>
            <Link href={`/dashboard/invoices/new?kind=estimation&customer=${customer.publicId}`}>
              <Button variant="secondary">Créer un devis</Button>
            </Link>
            <Link href={`/dashboard/invoices/new?kind=invoice&customer=${customer.publicId}`}>
              <Button>Créer une facture</Button>
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard
          title="Total facturé"
          value={formatCfa(customer.billed)}
          hint={`${customer.invoiceCount} facture${customer.invoiceCount > 1 ? 's' : ''}`}
        />
        <StatsCard
          title="Montant encaissé"
          value={formatCfa(customer.collected)}
          tone="success"
        />
        <StatsCard
          title="Solde impayé"
          value={formatCfa(customer.remaining)}
          hint={`${customer.estimationCount} devis`}
          tone={customer.remaining > 0 ? 'warning' : 'success'}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-subtle-border px-4 py-3">
          <Text weight="bold">Historique commercial</Text>
          <Caption className="mt-0.5 block">Devis et factures rattachés, du plus récent au plus ancien.</Caption>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] table-fixed text-left">
            <thead className="border-b border-subtle-border bg-powder/80">
              <tr>
                <th className="px-4 py-3 text-sm font-bold text-foreground-muted">Document</th>
                <th className="w-32 px-4 py-3 text-sm font-bold text-foreground-muted">Date</th>
                <th className="w-32 px-4 py-3 text-sm font-bold text-foreground-muted">Statut</th>
                <th className="w-36 px-4 py-3 text-sm font-bold text-foreground-muted">TTC</th>
                <th className="w-36 px-4 py-3 text-sm font-bold text-foreground-muted">Reste</th>
                <th className="w-44 px-4 py-3 text-sm font-bold text-foreground-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customer.documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <Text variant="muted">Aucun devis ni facture pour ce client.</Text>
                  </td>
                </tr>
              ) : (
                customer.documents.map((doc) => (
                  <tr key={`${doc.kind}-${doc.publicId}`} className="border-b border-subtle-border last:border-0">
                    <td className="overflow-hidden px-4 py-3 align-middle">
                      <Link
                        href={`/dashboard/invoices/${doc.estimationPublicId}`}
                        className="font-bold text-cobalt hover:underline"
                      >
                        {doc.code}
                      </Link>
                      <Caption className="block">{doc.kind === 'INVOICE' ? 'Facture' : 'Devis'}</Caption>
                    </td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                      {formatFrDate(doc.createdAt)}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-bold', statusClass[doc.status])}>
                        {statusLabels[doc.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap">{formatCfa(doc.totalTtc)}</td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                      {doc.kind === 'INVOICE' ? formatCfa(doc.remaining) : '—'}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {doc.kind === 'INVOICE' && doc.invoicePublicId && doc.remaining > 0 && doc.status !== 'CANCELED' && doc.status !== 'PENDING_CANCELLATION' ? (
                        <Button variant="secondary" size="sm" onClick={() => setPaying(doc)}>
                          Enregistrer un règlement
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <CustomerModal
        open={modalOpen}
        customer={customer}
        onClose={() => setModalOpen(false)}
      />

      {paying?.invoicePublicId ? (
        <PaymentDialog
          open
          invoicePublicId={paying.invoicePublicId}
          invoiceCode={paying.code}
          remaining={paying.remaining}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}
