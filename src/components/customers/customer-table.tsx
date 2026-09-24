'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/typography'
import { IconEye, IconPencil, IconTrash } from '@/components/ui/icons'
import { SortableHeader } from '@/components/ui/sortable-header'
import { deleteCustomer } from '@/app/dashboard/customers/actions'
import { useRestrictedAction } from '@/components/auth/admin-approval-modal'
import { kindLabel, type CustomerListItem } from '@/lib/customers'
import { cn } from '@/lib/cn'

type CustomerTableProps = {
  customers: CustomerListItem[]
  onEdit: (customer: CustomerListItem) => void
}

const iconBtn =
  'inline-flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200'

export function CustomerTable({ customers, onEdit }: CustomerTableProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const { runRestricted, modal } = useRestrictedAction()

  function handleDelete(customer: CustomerListItem) {
    void runRestricted({
      title: 'Supprimer le client',
      description: `Validation gestionnaire pour supprimer « ${customer.name} ».`,
      successMessage: 'Client supprimé.',
      run: async (proof) => {
        setPendingId(customer.publicId)
        const result = await deleteCustomer(customer.publicId, proof)
        setPendingId(null)
        return result
      },
    })
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] table-fixed text-left">
          <thead className="border-b border-subtle-border bg-powder/80">
            <tr>
              <SortableHeader className="w-32" sortKey="kind" label="Type" fallbackKey="name" fallbackDir="asc" />
              <SortableHeader sortKey="name" label="Nom / Raison sociale" fallbackKey="name" fallbackDir="asc" />
              <SortableHeader className="w-40" sortKey="nif" label="NIF" fallbackKey="name" fallbackDir="asc" />
              <SortableHeader sortKey="contact" label="Téléphone & Email" fallbackKey="name" fallbackDir="asc" />
              <th className="w-36 px-3 py-3 text-sm font-bold text-foreground-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <Text variant="muted">Aucun client ne correspond à la recherche.</Text>
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.publicId} className="border-b border-subtle-border last:border-0">
                  <td className="px-4 py-3 align-middle">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-1 text-xs font-bold',
                        customer.kind === 'COMPANY'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {kindLabel(customer.kind)}
                    </span>
                  </td>
                  <td className="overflow-hidden px-4 py-3 align-middle">
                    <Text weight="bold" className="truncate">
                      {customer.name}
                    </Text>
                  </td>
                  <td className="overflow-hidden px-4 py-3 align-middle">
                    <span className="block truncate text-foreground-muted">
                      {customer.kind === 'COMPANY' ? customer.nif || '—' : '—'}
                    </span>
                  </td>
                  <td className="overflow-hidden px-4 py-3 align-middle">
                    <span className="block truncate">{customer.phone || '—'}</span>
                    <span className="block truncate text-sm text-foreground-muted">
                      {customer.email || '—'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-middle">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/dashboard/customers/${customer.publicId}`}
                        title="Fiche client"
                        aria-label="Fiche client"
                        className={cn(iconBtn, 'text-primary hover:bg-primary/10')}
                      >
                        <IconEye className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        title="Éditer"
                        aria-label="Éditer"
                        className={cn(iconBtn, 'text-primary hover:bg-primary/10')}
                        onClick={() => onEdit(customer)}
                      >
                        <IconPencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Supprimer"
                        aria-label="Supprimer"
                        disabled={pendingId === customer.publicId}
                        className={cn(
                          iconBtn,
                          'text-danger hover:bg-red-50 disabled:opacity-50',
                        )}
                        onClick={() => handleDelete(customer)}
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {modal}
    </Card>
  )
}
