'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Heading, Text } from '@/components/ui/typography'
import { InputField } from '@/components/ui/input'
import { createCustomer, updateCustomer } from '@/app/dashboard/customers/actions'
import { cn } from '@/lib/cn'
import { toastResult } from '@/lib/notify'
import type { CatalogCustomer } from '@/lib/invoices'
import type { CustomerKindForm, CustomerListItem } from '@/lib/customers'

type CustomerModalProps = {
  open: boolean
  onClose: () => void
  customer?: CustomerListItem | null
  onCreated?: (customer: CatalogCustomer) => void
}

export function CustomerModal({ open, onClose, customer, onCreated }: CustomerModalProps) {
  if (!open) return null

  return (
    <CustomerModalForm
      key={customer?.publicId ?? 'new'}
      customer={customer}
      onClose={onClose}
      onCreated={onCreated}
    />
  )
}

function CustomerModalForm({
  customer,
  onClose,
  onCreated,
}: Omit<CustomerModalProps, 'open'>) {
  const editing = Boolean(customer)
  const [kind, setKind] = useState<CustomerKindForm>(customer?.kind ?? 'INDIVIDUAL')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const payload = {
      kind,
      name: String(form.get('name') ?? ''),
      nif: String(form.get('nif') ?? ''),
      phone: String(form.get('phone') ?? ''),
      email: String(form.get('email') ?? ''),
      address: String(form.get('address') ?? ''),
      postBox: String(form.get('postBox') ?? ''),
    }

    setLoading(true)

    const result = editing && customer
      ? await updateCustomer(customer.publicId, payload)
      : await createCustomer(payload)

    setLoading(false)

    if (!toastResult(result, editing ? 'Client mis à jour.' : 'Client créé.')) return

    if (!editing && result.customer) {
      onCreated?.(result.customer)
    }

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label="Fermer" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-sm">
        <div className="border-b border-subtle-border px-6 py-5">
          <Heading as="h2" size="lg">
            {editing ? 'Modifier le client' : 'Nouveau client'}
          </Heading>
          <Text variant="muted" size="sm" className="mt-1">
            {editing
              ? 'Mettez à jour les coordonnées du client.'
              : 'Renseignez le type, le nom et les coordonnées.'}
          </Text>
        </div>

        <form
          key={customer?.publicId ?? 'new'}
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto px-6 pb-6"
        >
          <p className="mt-2.5 mb-1 font-sans text-sm font-bold text-foreground">Type</p>
          <div className="flex gap-2" role="group" aria-label="Type de client">
            {([
              { id: 'INDIVIDUAL', label: 'Particulier' },
              { id: 'COMPANY', label: 'Entreprise' },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setKind(option.id)}
                className={cn(
                  'flex-1 rounded-full border px-3 py-2 text-sm font-bold transition-all duration-200',
                  kind === option.id
                    ? 'border-cobalt bg-cobalt text-white'
                    : 'border-subtle-border bg-white text-foreground hover:border-cobalt hover:text-cobalt',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <InputField
            id="name"
            name="name"
            label={kind === 'COMPANY' ? 'Raison sociale' : 'Nom'}
            required
            defaultValue={customer?.name ?? ''}
            placeholder={kind === 'COMPANY' ? 'Raison sociale' : 'Nom du client'}
          />
          {kind === 'COMPANY' ? (
            <InputField
              id="nif"
              name="nif"
              label="NIF"
              defaultValue={customer?.nif ?? ''}
              placeholder="Numéro d’identification fiscale"
            />
          ) : null}
          <InputField
            id="phone"
            name="phone"
            label="Téléphone"
            inputMode="numeric"
            defaultValue={customer?.phone ?? ''}
            placeholder="Téléphone"
          />
          <InputField
            id="email"
            name="email"
            label="Email"
            type="email"
            defaultValue={customer?.email ?? ''}
            placeholder="Email"
          />
          <InputField
            id="address"
            name="address"
            label="Adresse physique"
            defaultValue={customer?.address ?? ''}
            placeholder="Adresse"
          />
          <InputField
            id="postBox"
            name="postBox"
            label="Boîte postale"
            defaultValue={customer?.postBox ?? ''}
            placeholder="B.P."
          />

          <div className="mt-auto flex gap-3 pt-6">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" isLoading={loading}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  )
}
